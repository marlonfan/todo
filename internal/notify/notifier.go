package notify

import (
	"context"
	"time"
)

// Message represents a notification message
type Message struct {
	TaskID      int64
	Title       string
	Description string
	NotifyAt    *time.Time
	DueDate     *time.Time
	Timezone    string
	UserID      int64
}

// Notifier is the interface for notification plugins
type Notifier interface {
	// Name returns the plugin name
	Name() string

	// Send sends a notification
	Send(ctx context.Context, userID int64, config map[string]string, msg *Message) error

	// ValidateConfig validates the configuration
	ValidateConfig(config map[string]string) error

	// DefaultTemplate returns the default message template
	DefaultTemplate() string
}
