package models

import "time"

// TaskMutationReceipt records a client mutation op-id that has already been applied.
// It allows safe retries without re-applying stale If-Match updates.
type TaskMutationReceipt struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    int64     `json:"user_id" gorm:"not null;uniqueIndex:idx_task_mutation_receipts_user_op,priority:1;index"`
	OpID      string    `json:"op_id" gorm:"size:128;not null;uniqueIndex:idx_task_mutation_receipts_user_op,priority:2"`
	TaskID    int64     `json:"task_id" gorm:"not null;index"`
	OpType    string    `json:"op_type" gorm:"size:20;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime;index"`
}
