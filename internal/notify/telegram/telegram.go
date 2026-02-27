package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"todo-app/internal/notify"
)

const (
	apiBaseURL = "https://api.telegram.org/bot%s/sendMessage"
)

type TelegramNotifier struct {
	httpClient *http.Client
}

func New() *TelegramNotifier {
	return &TelegramNotifier{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (t *TelegramNotifier) Name() string {
	return "telegram"
}

func (t *TelegramNotifier) ValidateConfig(config map[string]string) error {
	if config["bot_token"] == "" {
		return errors.New("bot_token is required")
	}
	if config["chat_id"] == "" {
		return errors.New("chat_id is required")
	}
	return nil
}

func (t *TelegramNotifier) DefaultTemplate() string {
	return "🔔 **{{.Title}}**\n\n{{.Description}}\n\n📅 Due: {{.DueDate}}"
}

func (t *TelegramNotifier) Send(ctx context.Context, userID int64, config map[string]string, msg *notify.Message) error {
	botToken := config["bot_token"]
	chatID := config["chat_id"]

	title := escapeMarkdown(msg.Title)
	description := escapeMarkdown(msg.Description)
	text := fmt.Sprintf("🔔 *%s*\n\n%s", title, description)
	if msg.DueDate != nil {
		loc := time.UTC
		if msg.Timezone != "" {
			if loaded, err := time.LoadLocation(msg.Timezone); err == nil {
				loc = loaded
			}
		}
		text += fmt.Sprintf("\n\n📅 Due: %s", escapeMarkdown(msg.DueDate.In(loc).Format("2006-01-02 15:04:05")))
	}

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "MarkdownV2",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf(apiBaseURL, botToken)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API returned status %d: %s", resp.StatusCode, extractTelegramError(body))
	}

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}

	if !result.OK {
		return fmt.Errorf("telegram API error: %s", result.Description)
	}

	return nil
}

func escapeMarkdown(text string) string {
	// Escape special MarkdownV2 characters
	specialChars := []string{"_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"}
	for _, char := range specialChars {
		text = replaceAll(text, char, "\\"+char)
	}
	return text
}

func replaceAll(s, old, new string) string {
	result := ""
	for _, c := range s {
		if string(c) == old {
			result += new
		} else {
			result += string(c)
		}
	}
	return result
}

func extractTelegramError(body []byte) string {
	var parsed struct {
		Description string `json:"description"`
	}
	if err := json.Unmarshal(body, &parsed); err == nil && parsed.Description != "" {
		return parsed.Description
	}

	msg := strings.TrimSpace(string(body))
	if msg == "" {
		return "unknown error"
	}
	return msg
}
