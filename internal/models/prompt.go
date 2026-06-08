package models

import (
	"time"
)

type Prompt struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    int64     `json:"user_id" gorm:"index;not null"`
	Title     string    `json:"title" gorm:"size:120;not null"`
	Content   string    `json:"content" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	User *User `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

type CreatePromptRequest struct {
	Title   string `json:"title" binding:"required,max=120"`
	Content string `json:"content" binding:"required,max=20000"`
}

type UpdatePromptRequest struct {
	Title   string `json:"title" binding:"omitempty,max=120"`
	Content string `json:"content" binding:"omitempty,max=20000"`
}
