package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// NotifyStatus represents notification status
type NotifyStatus string

const (
	NotifyStatusPending    NotifyStatus = "pending"
	NotifyStatusProcessing NotifyStatus = "processing" // Fix 7: 新增处理中状态
	NotifyStatusSent       NotifyStatus = "sent"
	NotifyStatusFailed     NotifyStatus = "failed"
)

// NotifyChannel represents notification channel
type NotifyChannel string

const (
	NotifyChannelTelegram NotifyChannel = "telegram"
	NotifyChannelNtfy     NotifyChannel = "ntfy"
	NotifyChannelWebhook  NotifyChannel = "webhook"
)

type NotificationSource string

const (
	NotificationSourceDefaultAuto NotificationSource = "default_auto"
	NotificationSourceManual      NotificationSource = "manual"
)

type NotificationDeliveryMode string

const (
	NotificationDeliveryCurrentDefault NotificationDeliveryMode = "current_default"
	NotificationDeliveryLockedSnapshot NotificationDeliveryMode = "locked_snapshot"
)

// NotifyConfig represents generic notification config
type NotifyConfigMap map[string]string

// Value implements driver.Valuer
func (c NotifyConfigMap) Value() (driver.Value, error) {
	if c == nil {
		return nil, nil
	}
	return json.Marshal(c)
}

// Scan implements sql.Scanner
func (c *NotifyConfigMap) Scan(value interface{}) error {
	if value == nil {
		*c = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("invalid scan source for NotifyConfigMap")
	}
	return json.Unmarshal(bytes, c)
}

type Notification struct {
	ID            int64                    `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID        int64                    `json:"task_id" gorm:"index:idx_notifications_task_source,priority:1;uniqueIndex:idx_notifications_task_client_op,priority:1;not null"`
	Source        NotificationSource       `json:"source" gorm:"size:30;default:'manual';index:idx_notifications_task_source,priority:2"`
	DeliveryMode  NotificationDeliveryMode `json:"delivery_mode" gorm:"size:30;default:'locked_snapshot'"`
	Channel       NotifyChannel            `json:"channel" gorm:"size:50;not null"`
	Config        NotifyConfigMap          `json:"config" gorm:"type:text;not null"`
	DedupeKey     string                   `json:"dedupe_key,omitempty" gorm:"size:120;index:idx_notifications_dedupe"`
	ClientOpID    *string                  `json:"-" gorm:"size:128;uniqueIndex:idx_notifications_task_client_op,priority:2"`
	NotifyAt      time.Time                `json:"notify_at" gorm:"index;not null"`
	NextRetryAt   *time.Time               `json:"next_retry_at,omitempty" gorm:"index:idx_notifications_dispatch,priority:2"`
	RetryCount    int                      `json:"retry_count" gorm:"not null;default:0"`
	LastAttemptAt *time.Time               `json:"last_attempt_at,omitempty"`
	SentAt        *time.Time               `json:"sent_at"`
	Status        NotifyStatus             `json:"status" gorm:"size:20;default:'pending';index:idx_notifications_dispatch,priority:1"`
	ErrorMsg      string                   `json:"error_msg,omitempty" gorm:"type:text"`
	CreatedAt     time.Time                `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time                `json:"updated_at" gorm:"autoUpdateTime"`

	// Relations
	Task *Task `json:"task,omitempty" gorm:"foreignKey:TaskID"`
}

type UserNotifySetting struct {
	ID        int64           `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    int64           `json:"user_id" gorm:"index;not null"`
	Channel   NotifyChannel   `json:"channel" gorm:"size:50;not null"`
	Config    NotifyConfigMap `json:"config" gorm:"type:text;not null"`
	IsDefault bool            `json:"is_default" gorm:"default:false"`

	// Relations
	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// API Request/Response types
type CreateNotificationRequest struct {
	Channel  NotifyChannel   `json:"channel" binding:"omitempty,oneof=telegram ntfy webhook"`
	Config   NotifyConfigMap `json:"config"`
	NotifyAt time.Time       `json:"notify_at" binding:"required"`
}

type UpdateNotificationRequest struct {
	NotifyAt time.Time `json:"notify_at" binding:"required"`
}

type CreateNotifySettingRequest struct {
	Channel   NotifyChannel   `json:"channel" binding:"required,oneof=telegram ntfy webhook"`
	Config    NotifyConfigMap `json:"config" binding:"required"`
	IsDefault bool            `json:"is_default"`
}

type TestNotificationRequest struct {
	Channel NotifyChannel   `json:"channel" binding:"required,oneof=telegram ntfy webhook"`
	Config  NotifyConfigMap `json:"config" binding:"required"`
}

type NotificationResponse struct {
	ID           int64                    `json:"id"`
	TaskID       int64                    `json:"task_id"`
	Source       NotificationSource       `json:"source"`
	DeliveryMode NotificationDeliveryMode `json:"delivery_mode"`
	Channel      NotifyChannel            `json:"channel"`
	Configured   bool                     `json:"configured"`
	NotifyAt     time.Time                `json:"notify_at"`
	Status       NotifyStatus             `json:"status"`
	SentAt       *time.Time               `json:"sent_at,omitempty"`
	CreatedAt    time.Time                `json:"created_at"`
}

type NotifySettingResponse struct {
	ID         int64         `json:"id"`
	Channel    NotifyChannel `json:"channel"`
	Configured bool          `json:"configured"`
	IsDefault  bool          `json:"is_default"`
}

func (n Notification) ToResponse() NotificationResponse {
	return NotificationResponse{
		ID:           n.ID,
		TaskID:       n.TaskID,
		Source:       n.Source,
		DeliveryMode: n.DeliveryMode,
		Channel:      n.Channel,
		Configured:   len(n.Config) > 0,
		NotifyAt:     n.NotifyAt,
		Status:       n.Status,
		SentAt:       n.SentAt,
		CreatedAt:    n.CreatedAt,
	}
}

func NotificationResponses(notifications []Notification) []NotificationResponse {
	responses := make([]NotificationResponse, 0, len(notifications))
	for _, notification := range notifications {
		responses = append(responses, notification.ToResponse())
	}
	return responses
}

func (s UserNotifySetting) ToResponse() NotifySettingResponse {
	return NotifySettingResponse{
		ID:         s.ID,
		Channel:    s.Channel,
		Configured: len(s.Config) > 0,
		IsDefault:  s.IsDefault,
	}
}

func NotifySettingResponses(settings []UserNotifySetting) []NotifySettingResponse {
	responses := make([]NotifySettingResponse, 0, len(settings))
	for _, setting := range settings {
		responses = append(responses, setting.ToResponse())
	}
	return responses
}

type TaskWithReminderResponse struct {
	Task
	ReminderSummary []NotificationResponse `json:"reminder_summary"`
}
