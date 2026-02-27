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
	"todo-app/internal/notify"
)

type WebhookNotifier struct {
	httpClient *http.Client
}

func New() *WebhookNotifier {
	return &WebhookNotifier{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (w *WebhookNotifier) Name() string {
	return "webhook"
}

func (w *WebhookNotifier) ValidateConfig(config map[string]string) error {
	if config["url"] == "" {
		return errors.New("url is required")
	}
	if !strings.HasPrefix(config["url"], "http://") && !strings.HasPrefix(config["url"], "https://") {
		return errors.New("url must start with http:// or https://")
	}
	return nil
}

func (w *WebhookNotifier) DefaultTemplate() string {
	return `{"title":"{{.Title}}","description":"{{.Description}}","due_date":"{{.DueDate}}"}`
}

func (w *WebhookNotifier) Send(ctx context.Context, userID int64, config map[string]string, msg *notify.Message) error {
	url := config["url"]
	method := config["method"]
	if method == "" {
		method = "POST"
	}

	// Build payload
	payload := map[string]interface{}{
		"task_id":     msg.TaskID,
		"title":       msg.Title,
		"description": msg.Description,
		"user_id":     msg.UserID,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	}

	if msg.DueDate != nil {
		payload["due_date"] = msg.DueDate.Format(time.RFC3339)
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
