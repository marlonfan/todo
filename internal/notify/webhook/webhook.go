package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"todo-app/internal/netpolicy"
	"todo-app/internal/notify"
)

type WebhookNotifier struct {
	httpClient *http.Client
}

func New() *WebhookNotifier {
	return &WebhookNotifier{
		httpClient: netpolicy.NewHTTPClient(30 * time.Second),
	}
}

func (w *WebhookNotifier) Name() string {
	return "webhook"
}

func (w *WebhookNotifier) ValidateConfig(config map[string]string) error {
	if config["url"] == "" {
		return errors.New("url is required")
	}
	if err := netpolicy.ValidateURL(config["url"]); err != nil {
		return err
	}
	return nil
}

func (w *WebhookNotifier) DefaultTemplate() string {
	return `{"title":"{{.Title}}","description":"{{.Description}}","due_date":"{{.DueDate}}"}`
}

func (w *WebhookNotifier) Send(ctx context.Context, userID int64, config map[string]string, msg *notify.Message) error {
	url := config["url"]
	if err := netpolicy.ValidateURL(url); err != nil {
		return err
	}
	method := config["method"]
	if method == "" {
		method = "POST"
	}

	loc := resolveLocation(msg.Timezone)

	// Build payload
	payload := map[string]interface{}{
		"task_id":     msg.TaskID,
		"title":       msg.Title,
		"description": msg.Description,
		"user_id":     msg.UserID,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"timezone":    loc.String(),
	}

	if msg.NotifyAt != nil {
		payload["notify_at"] = msg.NotifyAt.UTC().Format(time.RFC3339)
		payload["notify_at_local"] = msg.NotifyAt.In(loc).Format(time.RFC3339)
	}
	if msg.DueDate != nil {
		payload["due_date"] = msg.DueDate.UTC().Format(time.RFC3339)
		payload["due_date_local"] = msg.DueDate.In(loc).Format(time.RFC3339)
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if key := strings.TrimSpace(config["idempotency_key"]); key != "" {
		req.Header.Set("X-Notification-Key", key)
		req.Header.Set("Idempotency-Key", key)
	}

	// Add custom headers if provided
	if headers := config["headers"]; headers != "" {
		var headerMap map[string]string
		if err := json.Unmarshal([]byte(headers), &headerMap); err == nil {
			for key, value := range headerMap {
				req.Header.Set(key, value)
			}
		}
	}

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}

func resolveLocation(timezone string) *time.Location {
	if timezone == "" {
		return time.UTC
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return time.UTC
	}
	return loc
}
