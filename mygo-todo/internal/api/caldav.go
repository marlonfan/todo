package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type CaldavCalendar struct {
	CalendarURL string     `json:"calendar_url"`
	DisplayName string     `json:"display_name"`
	Color       string     `json:"color"`
	IsSelected  bool       `json:"is_selected"`
	LastSyncAt  *time.Time `json:"last_sync_at"`
	LastError   string     `json:"last_error"`
}
type CaldavChoice struct {
	CalendarURL string `json:"calendar_url"`
	DisplayName string `json:"display_name"`
	Color       string `json:"color"`
}
type CaldavSource struct {
	ID         int64            `json:"id"`
	Name       string           `json:"name"`
	BaseURL    string           `json:"base_url"`
	Username   string           `json:"username"`
	IsActive   bool             `json:"is_active"`
	LastSyncAt *time.Time       `json:"last_sync_at"`
	LastError  string           `json:"last_error"`
	Calendars  []CaldavCalendar `json:"calendars"`
}
type CaldavDiscover struct {
	SourceID int64  `json:"source_id,omitempty"`
	BaseURL  string `json:"base_url"`
	Username string `json:"username"`
	Password string `json:"password"`
}
type CaldavUpsert struct {
	Name      string         `json:"name"`
	BaseURL   string         `json:"base_url"`
	Username  string         `json:"username"`
	Password  string         `json:"password"`
	IsActive  bool           `json:"is_active"`
	Calendars []CaldavChoice `json:"calendars"`
}
type CalendarSubscription struct {
	ICSURL       string `json:"ics_url"`
	CalDAVURL    string `json:"caldav_url"`
	PrincipalURL string `json:"caldav_principal_url"`
	HomeURL      string `json:"caldav_home_url"`
	RootURL      string `json:"caldav_root_url"`
	Username     string `json:"username"`
}

func (c *Client) CaldavSources(ctx context.Context) ([]CaldavSource, error) {
	var v []CaldavSource
	err := c.Do(ctx, "GET", "/caldav/sources", nil, &v, 0)
	return v, err
}
func (c *Client) DiscoverCaldav(ctx context.Context, request CaldavDiscover) ([]CaldavChoice, error) {
	var v []CaldavChoice
	err := c.Do(ctx, "POST", "/caldav/discover", request, &v, 0)
	return v, err
}
func (c *Client) CalendarSubscription(ctx context.Context) (*CalendarSubscription, error) {
	var v CalendarSubscription
	err := c.Do(ctx, "GET", "/calendar/subscription", nil, &v, 0)
	return &v, err
}

// Feed URLs contain their own scoped token. Never attach the account JWT or
// follow redirects, and accept only feeds on the configured Todo origin.
func (c *Client) ExportCalendar(ctx context.Context, rawURL string) ([]byte, error) {
	u, err := url.Parse(rawURL)
	base, _ := url.Parse(strings.TrimSuffix(c.base, "/api"))
	if err != nil || u == nil || u.User != nil || u.Scheme != base.Scheme || !strings.EqualFold(u.Host, base.Host) || !strings.HasPrefix(u.Path, base.Path+"/feeds/calendar/") || !strings.HasSuffix(u.Path, ".ics") || u.RawQuery != "" || u.Fragment != "" {
		return nil, errors.New("订阅地址与当前 Todo 服务不一致，请检查服务的反向代理配置")
	}
	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, errors.New("无法读取日历订阅地址")
	}
	req.Header.Set("Accept", "text/calendar")
	res, err := c.http.Do(req)
	if err != nil {
		return nil, &ConnectionError{Cause: err}
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("导出日历失败（%d），请刷新订阅信息后重试", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, (16<<20)+1))
	if err != nil {
		return nil, errors.New("读取日历文件失败，请重试")
	}
	if len(data) > 16<<20 {
		return nil, errors.New("日历文件超过 16 MB，请使用订阅地址连接日历应用")
	}
	text := strings.TrimSpace(string(data))
	if !strings.HasPrefix(text, "BEGIN:VCALENDAR") || !strings.HasSuffix(text, "END:VCALENDAR") {
		return nil, errors.New("Todo 服务未返回有效的 ICS 日历文件")
	}
	return data, nil
}
