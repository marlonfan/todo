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
	ID        int64           `json:"id" gorm:"primaryKey;autoIncrement"`
	TaskID    int64           `json:"task_id" gorm:"index;not null"`
	Channel   NotifyChannel   `json:"channel" gorm:"size:50;not null"`
	Config    NotifyConfigMap `json:"config" gorm:"type:text;not null"`
	NotifyAt  time.Time       `json:"notify_at" gorm:"index;not null"`
	SentAt    *time.Time      `json:"sent_at"`
	Status    NotifyStatus    `json:"status" gorm:"size:20;default:'pending'"`
	ErrorMsg  string          `json:"error_msg,omitempty" gorm:"type:text"`
	CreatedAt time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time       `json:"updated_at" gorm:"autoUpdateTime"`

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
	ID        int64         `json:"id"`
	Channel   NotifyChannel `json:"channel"`
	NotifyAt  time.Time     `json:"notify_at"`
	Status    NotifyStatus  `json:"status"`
	SentAt    *time.Time    `json:"sent_at,omitempty"`
	ErrorMsg  string        `json:"error_msg,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
}

type NotifySettingResponse struct {
	ID        int64           `json:"id"`
	Channel   NotifyChannel   `json:"channel"`
	Config    NotifyConfigMap `json:"config"`
	IsDefault bool            `json:"is_default"`
}
