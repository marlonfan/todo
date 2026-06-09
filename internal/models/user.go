package models

import (
	"strconv"
	"strings"
	"time"
)

type User struct {
	ID                     int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	Username               string    `json:"username" gorm:"uniqueIndex;size:50;not null"`
	Email                  string    `json:"email" gorm:"uniqueIndex;size:100;not null"`
	PasswordHash           string    `json:"-" gorm:"size:255;not null"`
	AvatarURL              string    `json:"avatar_url" gorm:"type:text"`
	Timezone               string    `json:"timezone" gorm:"size:50;default:'UTC'"`
	CalendarDefaultView    string    `json:"calendar_default_view" gorm:"size:20;default:'timeGridDay'"`
	DefaultReminderEnabled bool      `json:"default_reminder_enabled" gorm:"default:false"`
	DefaultReminderMinutes int       `json:"default_reminder_minutes" gorm:"default:5"`
	DefaultTimeGranularity int       `json:"default_time_granularity" gorm:"default:15"`
	DefaultTaskStartTime   string    `json:"default_task_start_time" gorm:"size:5;default:'09:00'"`
	DefaultMorningTime     string    `json:"default_morning_time" gorm:"size:5;default:'09:00'"`
	DefaultNoonTime        string    `json:"default_noon_time" gorm:"size:5;default:'12:00'"`
	DefaultAfternoonTime   string    `json:"default_afternoon_time" gorm:"size:5;default:'15:00'"`
	DefaultEveningTime     string    `json:"default_evening_time" gorm:"size:5;default:'20:00'"`
	MobileDefaultTab       string    `json:"mobile_default_tab" gorm:"size:20;default:'tasks'"`
	MobileDefaultTaskView  string    `json:"mobile_default_task_view" gorm:"size:40;default:'all'"`
	MobileTabPreset        string    `json:"mobile_tab_preset" gorm:"size:60;default:'tasks_calendar_settings'"`
	CreatedAt              time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// Relations
	Categories     []Category          `json:"categories,omitempty" gorm:"foreignKey:UserID"`
	Tasks          []Task              `json:"tasks,omitempty" gorm:"foreignKey:UserID"`
	NotifySettings []UserNotifySetting `json:"notify_settings,omitempty" gorm:"foreignKey:UserID"`
	PromptHistory  []PromptAskHistory  `json:"prompt_history,omitempty" gorm:"foreignKey:UserID"`
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
	AvatarURL              *string `json:"avatar_url" binding:"omitempty,max=2000000"`
	Timezone               string  `json:"timezone" binding:"omitempty,max=50"`
	CalendarDefaultView    string  `json:"calendar_default_view" binding:"omitempty,oneof=dayGridMonth timeGridWeek timeGridDay"`
	DefaultReminderEnabled *bool   `json:"default_reminder_enabled"`
	DefaultReminderMinutes *int    `json:"default_reminder_minutes" binding:"omitempty,min=1,max=10080"`
	DefaultTimeGranularity *int    `json:"default_time_granularity" binding:"omitempty,min=5,max=60"`
	DefaultTaskStartTime   string  `json:"default_task_start_time" binding:"omitempty,len=5"`
	DefaultMorningTime     string  `json:"default_morning_time" binding:"omitempty,len=5"`
	DefaultNoonTime        string  `json:"default_noon_time" binding:"omitempty,len=5"`
	DefaultAfternoonTime   string  `json:"default_afternoon_time" binding:"omitempty,len=5"`
	DefaultEveningTime     string  `json:"default_evening_time" binding:"omitempty,len=5"`
	MobileDefaultTab       string  `json:"mobile_default_tab" binding:"omitempty,oneof=tasks calendar settings"`
	MobileDefaultTaskView  string  `json:"mobile_default_task_view" binding:"omitempty,max=40"`
	MobileTabPreset        string  `json:"mobile_tab_preset" binding:"omitempty,oneof=tasks_calendar_settings tasks_calendar_categories_settings tasks_inbox_calendar_settings"`
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

type UserResponse struct {
	ID                     int64     `json:"id"`
	Username               string    `json:"username"`
	Email                  string    `json:"email"`
	AvatarURL              string    `json:"avatar_url"`
	Timezone               string    `json:"timezone"`
	CalendarDefaultView    string    `json:"calendar_default_view"`
	DefaultReminderEnabled bool      `json:"default_reminder_enabled"`
	DefaultReminderMinutes int       `json:"default_reminder_minutes"`
	DefaultTimeGranularity int       `json:"default_time_granularity"`
	DefaultTaskStartTime   string    `json:"default_task_start_time"`
	DefaultMorningTime     string    `json:"default_morning_time"`
	DefaultNoonTime        string    `json:"default_noon_time"`
	DefaultAfternoonTime   string    `json:"default_afternoon_time"`
	DefaultEveningTime     string    `json:"default_evening_time"`
	MobileDefaultTab       string    `json:"mobile_default_tab"`
	MobileDefaultTaskView  string    `json:"mobile_default_task_view"`
	MobileTabPreset        string    `json:"mobile_tab_preset"`
	CreatedAt              time.Time `json:"created_at"`
}

func NormalizeMobileDefaultTaskView(value string) string {
	normalized := strings.TrimSpace(value)
	switch normalized {
	case "all", "inbox", "today", "upcoming":
		return normalized
	}
	if strings.HasPrefix(normalized, "category:") {
		rawID := strings.TrimSpace(strings.TrimPrefix(normalized, "category:"))
		categoryID, err := strconv.ParseInt(rawID, 10, 64)
		if err == nil && categoryID > 0 {
			return "category:" + strconv.FormatInt(categoryID, 10)
		}
	}
	return "all"
}

func (u *User) ToResponse() UserResponse {
	calendarDefaultView := u.CalendarDefaultView
	switch calendarDefaultView {
	case "dayGridMonth", "timeGridWeek", "timeGridDay":
	default:
		calendarDefaultView = "timeGridDay"
	}
	minutes := u.DefaultReminderMinutes
	if minutes <= 0 {
		minutes = 5
	}
	granularity := u.DefaultTimeGranularity
	if granularity != 5 && granularity != 10 && granularity != 15 && granularity != 30 && granularity != 60 {
		granularity = 15
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
	mobileDefaultTab := u.MobileDefaultTab
	if mobileDefaultTab != "tasks" && mobileDefaultTab != "calendar" && mobileDefaultTab != "settings" {
		mobileDefaultTab = "tasks"
	}
	mobileDefaultTaskView := NormalizeMobileDefaultTaskView(u.MobileDefaultTaskView)
	mobileTabPreset := u.MobileTabPreset
	switch mobileTabPreset {
	case "tasks_calendar_settings", "tasks_calendar_categories_settings", "tasks_inbox_calendar_settings":
	default:
		mobileTabPreset = "tasks_calendar_settings"
	}

	return UserResponse{
		ID:                     u.ID,
		Username:               u.Username,
		Email:                  u.Email,
		AvatarURL:              u.AvatarURL,
		Timezone:               u.Timezone,
		CalendarDefaultView:    calendarDefaultView,
		DefaultReminderEnabled: u.DefaultReminderEnabled,
		DefaultReminderMinutes: minutes,
		DefaultTimeGranularity: granularity,
		DefaultTaskStartTime:   defaultTaskStartTime,
		DefaultMorningTime:     defaultMorningTime,
		DefaultNoonTime:        defaultNoonTime,
		DefaultAfternoonTime:   defaultAfternoonTime,
		DefaultEveningTime:     defaultEveningTime,
		MobileDefaultTab:       mobileDefaultTab,
		MobileDefaultTaskView:  mobileDefaultTaskView,
		MobileTabPreset:        mobileTabPreset,
		CreatedAt:              u.CreatedAt,
	}
}
