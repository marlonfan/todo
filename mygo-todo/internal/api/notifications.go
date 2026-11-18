package api

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// Responses deliberately contain no channel credentials or server snapshots.
type NotifySetting struct {
	ID         int64  `json:"id"`
	Channel    string `json:"channel"`
	Configured bool   `json:"configured"`
	IsDefault  bool   `json:"is_default"`
}
type Notification struct {
	ID           int64      `json:"id"`
	TaskID       int64      `json:"task_id"`
	Source       string     `json:"source"`
	DeliveryMode string     `json:"delivery_mode"`
	Channel      string     `json:"channel"`
	Configured   bool       `json:"configured"`
	NotifyAt     time.Time  `json:"notify_at"`
	Status       string     `json:"status"`
	SentAt       *time.Time `json:"sent_at"`
}
type ActivityChange struct {
	From json.RawMessage `json:"from"`
	To   json.RawMessage `json:"to"`
}
type TaskActivity struct {
	ID           int64                     `json:"id"`
	TaskID       int64                     `json:"task_id"`
	Changes      map[string]ActivityChange `json:"changes"`
	OccurredAt   time.Time                 `json:"occurred_at"`
	SubmitSource string                    `json:"submit_source"`
}
type NotifySettingRequest struct {
	Channel   string            `json:"channel"`
	Config    map[string]string `json:"config"`
	IsDefault bool              `json:"is_default"`
}
type NotificationRequest struct {
	NotifyAt time.Time         `json:"notify_at"`
	Channel  string            `json:"channel,omitempty"`
	Config   map[string]string `json:"config,omitempty"`
}

func (c *Client) NotifySettings(ctx context.Context) ([]NotifySetting, error) {
	var result []NotifySetting
	err := c.Do(ctx, "GET", "/notify/settings", nil, &result, 0)
	return result, err
}
func (c *Client) NotifyChannels(ctx context.Context) ([]string, error) {
	var result struct {
		Channels []string `json:"channels"`
	}
	err := c.Do(ctx, "GET", "/notify/channels", nil, &result, 0)
	return result.Channels, err
}
func (c *Client) TaskNotifications(ctx context.Context, id int64) ([]Notification, error) {
	var result []Notification
	err := c.Do(ctx, "GET", fmt.Sprintf("/tasks/%d/notifications", id), nil, &result, 0)
	return result, err
}
func (c *Client) TaskActivities(ctx context.Context, id int64, limit int) ([]TaskActivity, error) {
	var result []TaskActivity
	err := c.Do(ctx, "GET", fmt.Sprintf("/tasks/%d/activities?limit=%d", id, limit), nil, &result, 0)
	return result, err
}
