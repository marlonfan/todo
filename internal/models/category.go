package models

import (
	"time"
)

type Category struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    int64     `json:"user_id" gorm:"index;not null"`
	Name      string    `json:"name" gorm:"size:50;not null"`
	Emoji     string    `json:"emoji" gorm:"size:16;default:'📁'"`
	Color     string    `json:"color" gorm:"size:7;default:'#3788d8'"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Relations
	User  *User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Tasks []Task `json:"tasks,omitempty" gorm:"many2many:task_categories;"`
}

// TaskCategory is the join table for many-to-many relationship
type TaskCategory struct {
	TaskID     int64 `gorm:"primaryKey"`
	CategoryID int64 `gorm:"primaryKey"`

	// Fix 3: 添加外键约束
	Task     *Task     `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE;"`
	Category *Category `gorm:"foreignKey:CategoryID;constraint:OnDelete:CASCADE;"`
}

type CreateCategoryRequest struct {
	Name  string `json:"name" binding:"required,max=50"`
	Emoji string `json:"emoji" binding:"omitempty,max=16"`
	Color string `json:"color" binding:"omitempty,len=7,hexcolor"`
}

type UpdateCategoryRequest struct {
	Name  string `json:"name" binding:"omitempty,max=50"`
	Emoji string `json:"emoji" binding:"omitempty,max=16"`
	Color string `json:"color" binding:"omitempty,len=7,hexcolor"`
}
