// Package api talks to the existing Todo server. It has no UI dependencies.
package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const DefaultServer = "https://todo.marlon.life"

type Client struct {
	base      string
	http      *http.Client
	mu        sync.Mutex
	token     string
	refreshMu sync.Mutex
}

func NormalizeServer(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u == nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", errors.New("请输入完整的 http:// 或 https:// 服务地址")
	}
	u.Path = strings.TrimSuffix(strings.TrimRight(u.Path, "/"), "/api")
	return strings.TrimRight(u.String(), "/"), nil
}

func New(server, token string) (*Client, error) {
	base, err := NormalizeServer(server)
	if err != nil {
		return nil, err
	}
	return &Client{base: base + "/api", token: token, http: &http.Client{Timeout: 35 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func (c *Client) Token() string     { c.mu.Lock(); defer c.mu.Unlock(); return c.token }
func (c *Client) setToken(v string) { c.mu.Lock(); defer c.mu.Unlock(); c.token = v }

type Error struct {
	Status  int
	Message string
	Latest  *Task
}

// Keep transport details available through errors.Unwrap without placing URLs,
// English socket errors or long implementation details in the native UI.
type ConnectionError struct{ Cause error }

func (e *ConnectionError) Error() string {
	return "无法连接 Todo 服务，请检查网络和服务地址"
}
func (e *ConnectionError) Unwrap() error { return e.Cause }

func (e *Error) Error() string {
	switch e.Status {
	case 401:
		return "登录已失效，请重新登录"
	case 409:
		return "任务与服务器版本冲突；本地修改已保留，请到同步页面处理"
	}
	return fmt.Sprintf("请求失败（%d）：%s", e.Status, e.Message)
}

// Do retries only authentication failures, with the same body and operation ID.
// Transport failures are returned to the caller: blind mutation retries duplicate work.
func (c *Client) Do(ctx context.Context, method, path string, body, out any, revision int64) error {
	opID := ""
	if method != http.MethodGet {
		var err error
		opID, err = NewOperationID()
		if err != nil {
			return err
		}
	}
	return c.DoOperation(ctx, method, path, body, out, revision, opID)
}

func NewOperationID() (string, error) {
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(id[:]), nil
}

// DoOperation reuses a durable outbox ID across connection failures and restarts.
// Task endpoints and /categories/sync support durable retries on the Todo server.
func (c *Client) DoOperation(ctx context.Context, method, path string, body, out any, revision int64, opID string) error {
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}
	token := c.Token()
	err = c.request(ctx, method, path, data, out, revision, opID, token)
	var apiErr *Error
	if !errors.As(err, &apiErr) || apiErr.Status != 401 || token == "" || path == "/auth/login" || path == "/auth/register" || path == "/auth/refresh" {
		return err
	}
	c.refreshMu.Lock()
	defer c.refreshMu.Unlock()
	if c.Token() == token {
		var refreshed struct {
			Token string `json:"token"`
		}
		if e := c.request(ctx, http.MethodPost, "/auth/refresh", nil, &refreshed, 0, "", token); e != nil {
			return e
		}
		if refreshed.Token == "" {
			return errors.New("服务器未返回有效登录凭据")
		}
		c.setToken(refreshed.Token)
	}
	return c.request(ctx, method, path, data, out, revision, opID, c.Token())
}

func (c *Client) request(ctx context.Context, method, path string, data []byte, out any, revision int64, opID, token string) error {
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		return errors.New("无效 API 路径")
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if revision > 0 {
		req.Header.Set("If-Match", strconv.FormatInt(revision, 10))
	}
	if opID != "" {
		req.Header.Set("X-Client-Op-Id", opID)
		req.Header.Set("X-Client-Submit-Source", "nsgo-mobile")
		req.Header.Set("X-Client-Submitted-At", time.Now().UTC().Format(time.RFC3339Nano))
	}
	httpClient := c.http
	if path == "/caldav/discover" {
		// The existing server permits up to 90 seconds for provider discovery.
		// Other task requests retain their normal timeout.
		discoveryClient := *c.http
		discoveryClient.Timeout = 100 * time.Second
		httpClient = &discoveryClient
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return &ConnectionError{Cause: err}
	}
	defer res.Body.Close()
	data, err = io.ReadAll(io.LimitReader(res.Body, 16<<20))
	if err != nil {
		return err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var payload struct {
			Error  string `json:"error"`
			Latest *Task  `json:"latest"`
		}
		_ = json.Unmarshal(data, &payload)
		if payload.Error == "" {
			payload.Error = http.StatusText(res.StatusCode)
		}
		return &Error{Status: res.StatusCode, Message: payload.Error, Latest: payload.Latest}
	}
	if out != nil && len(bytes.TrimSpace(data)) != 0 {
		if err := json.Unmarshal(data, out); err != nil {
			return fmt.Errorf("Todo 服务返回了无法读取的数据：%w", err)
		}
	}
	return nil
}

func (c *Client) Login(ctx context.Context, username, password string) (Session, error) {
	var session Session
	err := c.Do(ctx, http.MethodPost, "/auth/login", map[string]string{"username": username, "password": password}, &session, 0)
	if err == nil && session.Token == "" {
		err = errors.New("服务器未返回有效登录凭据")
	}
	if err == nil {
		c.setToken(session.Token)
		session.Server = strings.TrimSuffix(c.base, "/api")
	}
	return session, err
}

func (c *Client) Register(ctx context.Context, username, email, password string) (Session, error) {
	payload := map[string]string{
		"username": username,
		"email":    email,
		"password": password,
	}
	if err := c.Do(ctx, http.MethodPost, "/auth/register", payload, nil, 0); err != nil {
		return Session{}, err
	}
	return c.Login(ctx, username, password)
}

func (c *Client) Me(ctx context.Context) (User, error) {
	var u User
	err := c.Do(ctx, http.MethodGet, "/auth/me", nil, &u, 0)
	return u, err
}

func (c *Client) Tasks(ctx context.Context) ([]Task, error) {
	var v []Task
	err := c.Do(ctx, "GET", "/tasks", nil, &v, 0)
	return v, err
}
func (c *Client) Categories(ctx context.Context) ([]Category, error) {
	var v []Category
	err := c.Do(ctx, "GET", "/categories", nil, &v, 0)
	return v, err
}
func (c *Client) NextOccurrences(ctx context.Context) ([]Occurrence, error) {
	var v []Occurrence
	err := c.Do(ctx, "GET", "/tasks/next-occurrences", nil, &v, 0)
	return v, err
}
func (c *Client) OccurrenceHistory(ctx context.Context, cursor int) (OccurrencePage, error) {
	q := url.Values{"status": {"completed,cancelled,skipped"}, "limit": {"200"}, "cursor": {strconv.Itoa(cursor)}}
	var v OccurrencePage
	err := c.Do(ctx, "GET", "/tasks/occurrences?"+q.Encode(), nil, &v, 0)
	return v, err
}
func (c *Client) Calendar(ctx context.Context, start, end time.Time) ([]CalendarEvent, error) {
	q := url.Values{"start": {start.Format(time.RFC3339)}, "end": {end.Format(time.RFC3339)}}
	var v []CalendarEvent
	err := c.Do(ctx, "GET", "/calendar?"+q.Encode(), nil, &v, 0)
	return v, err
}
