package models

import "time"

// CategoryMutationReceipt is committed in the same transaction as the category.
type CategoryMutationReceipt struct {
	ID          int64  `gorm:"primaryKey;autoIncrement"`
	UserID      int64  `gorm:"not null;uniqueIndex:idx_category_receipt_user_op,priority:1"`
	OpID        string `gorm:"size:128;not null;uniqueIndex:idx_category_receipt_user_op,priority:2"`
	Method      string `gorm:"size:8;not null"`
	CategoryID  int64  `gorm:"not null"`
	PayloadHash string `gorm:"size:64;not null"`
	Snapshot    string `gorm:"type:text"`
	CreatedAt   time.Time
}
