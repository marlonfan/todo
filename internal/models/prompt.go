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

type PromptAskHistory struct {
	ID            int64     `json:"id" gorm:"primaryKey;autoIncrement;index:idx_prompt_ask_histories_user_id_id,priority:2"`
	UserID        int64     `json:"user_id" gorm:"index;index:idx_prompt_ask_histories_user_id_id,priority:1;not null"`
	PromptID      *int64    `json:"prompt_id,omitempty" gorm:"index"`
	PromptTitle   string    `json:"prompt_title" gorm:"size:120;not null"`
	PromptContent string    `json:"prompt_content,omitempty" gorm:"type:text"`
	Input         string    `json:"input" gorm:"type:text;not null"`
	Output        string    `json:"output" gorm:"type:text;not null"`
	Status        string    `json:"status" gorm:"size:20;not null;default:'completed'"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	User   *User   `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Prompt *Prompt `json:"prompt,omitempty" gorm:"foreignKey:PromptID;constraint:OnDelete:SET NULL;"`
}

type CreatePromptRequest struct {
	Title   string `json:"title" binding:"required,max=120"`
	Content string `json:"content" binding:"required,max=20000"`
}

type UpdatePromptRequest struct {
	Title   string `json:"title" binding:"omitempty,max=120"`
	Content string `json:"content" binding:"omitempty,max=20000"`
}

type CreatePromptAskHistoryRequest struct {
	PromptID int64  `json:"prompt_id" binding:"required"`
	Input    string `json:"input" binding:"required,max=200000"`
	Output   string `json:"output" binding:"max=500000"`
	Status   string `json:"status" binding:"omitempty,oneof=completed stopped"`
}

type PromptAskHistoryListResponse struct {
	Items      []PromptAskHistory `json:"items"`
	NextCursor int64              `json:"next_cursor"`
	HasMore    bool               `json:"has_more"`
}
