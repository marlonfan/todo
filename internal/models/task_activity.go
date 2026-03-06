package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

type TaskActivityFieldChange struct {
	From interface{} `json:"from"`
	To   interface{} `json:"to"`
}

type TaskActivityChanges map[string]TaskActivityFieldChange

func (c TaskActivityChanges) Value() (driver.Value, error) {
	if c == nil {
		return "{}", nil
	}
	raw, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	return string(raw), nil
}

func (c *TaskActivityChanges) Scan(value interface{}) error {
	if value == nil {
		*c = TaskActivityChanges{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("invalid scan source for TaskActivityChanges")
	}
	if len(bytes) == 0 {
		*c = TaskActivityChanges{}
		return nil
	}
	var parsed TaskActivityChanges
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		return err
	}
	if parsed == nil {
		parsed = TaskActivityChanges{}
	}
	*c = parsed
	return nil
}

type TaskActivity struct {
	ID           int64               `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID       int64               `json:"user_id" gorm:"not null;index:idx_task_activity_user_task_time,priority:1"`
	TaskID       int64               `json:"task_id" gorm:"not null;index:idx_task_activity_user_task_time,priority:2"`
	Changes      TaskActivityChanges `json:"changes" gorm:"type:text;not null"`
	OccurredAt   time.Time           `json:"occurred_at" gorm:"not null;index:idx_task_activity_user_task_time,priority:3"`
	SubmitSource string              `json:"submit_source,omitempty" gorm:"size:32"`
	CreatedAt    time.Time           `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time           `json:"updated_at" gorm:"autoUpdateTime"`
}
