package ntfy

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/notify"
)

type NtfyNotifier struct {
	httpClient *http.Client
}

func New() *NtfyNotifier {
	return &NtfyNotifier{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (n *NtfyNotifier) Name() string {
	return "ntfy"
}

func (n *NtfyNotifier) ValidateConfig(config map[string]string) error {
	if config["server_url"] == "" {
		return errors.New("server_url is required")
	}
	if config["topic"] == "" {
		return errors.New("topic is required")
	}
	// Validate priority if provided
	if priority := config["priority"]; priority != "" {
		p, err := strconv.Atoi(priority)
		if err != nil || p < 1 || p > 5 {
			return errors.New("priority must be between 1 and 5")
		}
	}
	return nil
}

func (n *NtfyNotifier) DefaultTemplate() string {
	return "{{.Title}}\n{{.Description}}"
}

func (n *NtfyNotifier) Send(ctx context.Context, userID int64, config map[string]string, msg *notify.Message) error {
	serverURL := config["server_url"]
	topic := config["topic"]
	priority := config["priority"]
	if priority == "" {
		priority = "3"
	}

	// Support for authentication token
	authToken := config["token"]

	// Build URL
	url := fmt.Sprintf("%s/%s", serverURL, topic)

	// Build message
	message := msg.Description
	loc := resolveLocation(msg.Timezone)
	if msg.NotifyAt != nil {
		message += fmt.Sprintf("\n\nReminder: %s", msg.NotifyAt.In(loc).Format("2006-01-02 15:04:05"))
	}
	if msg.DueDate != nil {
		message += fmt.Sprintf("\n\nDue: %s", msg.DueDate.In(loc).Format("2006-01-02 15:04:05"))
	}

	if strings.TrimSpace(message) == "" {
		message = msg.Title
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(message))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	req.Header.Set("Title", msg.Title)
	req.Header.Set("Priority", priority)
	req.Header.Set("Tags", "todo,task")
	if key := strings.TrimSpace(config["idempotency_key"]); key != "" {
		req.Header.Set("X-Notification-Key", key)
		req.Header.Set("Idempotency-Key", key)
	}

	// Add authorization token if provided
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("ntfy server returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
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
