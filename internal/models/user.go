package models

import (
	"time"
)

type User struct {
	ID                     int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	Username               string    `json:"username" gorm:"uniqueIndex;size:50;not null"`
	Email                  string    `json:"email" gorm:"uniqueIndex;size:100;not null"`
	PasswordHash           string    `json:"-" gorm:"size:255;not null"`
	Timezone               string    `json:"timezone" gorm:"size:50;default:'UTC'"`
	DefaultReminderEnabled bool      `json:"default_reminder_enabled" gorm:"default:false"`
	DefaultReminderMinutes int       `json:"default_reminder_minutes" gorm:"default:5"`
	DefaultTaskStartTime   string    `json:"default_task_start_time" gorm:"size:5;default:'09:00'"`
	DefaultMorningTime     string    `json:"default_morning_time" gorm:"size:5;default:'09:00'"`
	DefaultNoonTime        string    `json:"default_noon_time" gorm:"size:5;default:'12:00'"`
	DefaultAfternoonTime   string    `json:"default_afternoon_time" gorm:"size:5;default:'15:00'"`
	DefaultEveningTime     string    `json:"default_evening_time" gorm:"size:5;default:'20:00'"`
	CreatedAt              time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Relations
	Categories     []Category          `json:"categories,omitempty" gorm:"foreignKey:UserID"`
	Tasks          []Task              `json:"tasks,omitempty" gorm:"foreignKey:UserID"`
	NotifySettings []UserNotifySetting `json:"notify_settings,omitempty" gorm:"foreignKey:UserID"`
}

type UserRegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type UserLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type UpdateProfileRequest struct {
	Timezone               string `json:"timezone" binding:"omitempty,max=50"`
	DefaultReminderEnabled *bool  `json:"default_reminder_enabled"`
	DefaultReminderMinutes *int   `json:"default_reminder_minutes" binding:"omitempty,min=1,max=10080"`
	DefaultTaskStartTime   string `json:"default_task_start_time" binding:"omitempty,len=5"`
	DefaultMorningTime     string `json:"default_morning_time" binding:"omitempty,len=5"`
	DefaultNoonTime        string `json:"default_noon_time" binding:"omitempty,len=5"`
	DefaultAfternoonTime   string `json:"default_afternoon_time" binding:"omitempty,len=5"`
	DefaultEveningTime     string `json:"default_evening_time" binding:"omitempty,len=5"`
}

type UserResponse struct {
	ID                     int64     `json:"id"`
	Username               string    `json:"username"`
	Email                  string    `json:"email"`
	Timezone               string    `json:"timezone"`
	DefaultReminderEnabled bool      `json:"default_reminder_enabled"`
	DefaultReminderMinutes int       `json:"default_reminder_minutes"`
	DefaultTaskStartTime   string    `json:"default_task_start_time"`
	DefaultMorningTime     string    `json:"default_morning_time"`
	DefaultNoonTime        string    `json:"default_noon_time"`
	DefaultAfternoonTime   string    `json:"default_afternoon_time"`
	DefaultEveningTime     string    `json:"default_evening_time"`
	CreatedAt              time.Time `json:"created_at"`
}

func (u *User) ToResponse() UserResponse {
	minutes := u.DefaultReminderMinutes
	if minutes <= 0 {
		minutes = 5
	}
	defaultTaskStartTime := u.DefaultTaskStartTime
	if defaultTaskStartTime == "" {
		defaultTaskStartTime = "09:00"
	}
	defaultMorningTime := u.DefaultMorningTime
	if defaultMorningTime == "" {
		defaultMorningTime = "09:00"
	}
	defaultNoonTime := u.DefaultNoonTime
	if defaultNoonTime == "" {
		defaultNoonTime = "12:00"
	}
	defaultAfternoonTime := u.DefaultAfternoonTime
	if defaultAfternoonTime == "" {
		defaultAfternoonTime = "15:00"
	}
	defaultEveningTime := u.DefaultEveningTime
	if defaultEveningTime == "" {
		defaultEveningTime = "20:00"
	}

	return UserResponse{
		ID:                     u.ID,
		Username:               u.Username,
		Email:                  u.Email,
		Timezone:               u.Timezone,
		DefaultReminderEnabled: u.DefaultReminderEnabled,
		DefaultReminderMinutes: minutes,
		DefaultTaskStartTime:   defaultTaskStartTime,
		DefaultMorningTime:     defaultMorningTime,
		DefaultNoonTime:        defaultNoonTime,
		DefaultAfternoonTime:   defaultAfternoonTime,
		DefaultEveningTime:     defaultEveningTime,
		CreatedAt:              u.CreatedAt,
	}
}
