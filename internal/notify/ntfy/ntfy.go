package ntfy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
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
	if msg.DueDate != nil {
		message += fmt.Sprintf("\n\nDue: %s", msg.DueDate.Format("2006-01-02 15:04"))
	}

	payload := map[string]interface{}{
		"topic":    topic,
		"title":    msg.Title,
		"message":  message,
		"priority": priority,
		"tags":     []string{"todo", "task"},
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	
	// Add authorization token if provided
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body := make([]byte, 1024)
		n, _ := resp.Body.Read(body)
		return fmt.Errorf("ntfy server returned status %d: %s", resp.StatusCode, string(body[:n]))
	}

	return nil
}
