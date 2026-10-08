package models

import "time"

// IDs are allocated while holding the user's transaction lock, so visible IDs
// cannot overtake an earlier uncommitted change for that same user.
type TaskChangeLog struct {
	ID        int64 `gorm:"primaryKey;autoIncrement;index:idx_task_change_user_id,priority:2"`
	UserID    int64 `gorm:"not null;index:idx_task_change_user_id,priority:1"`
	TaskID    int64 `gorm:"not null;index"`
	IsDelete  bool  `gorm:"not null"`
	CreatedAt time.Time
}
