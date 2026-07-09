package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// TaskStatus represents task status
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusCancelled TaskStatus = "cancelled"
	TaskStatusSkipped   TaskStatus = "skipped"
)

// Priority represents task priority
type Priority int

const (
	PriorityLow    Priority = -1
	PriorityMedium Priority = 0
	PriorityHigh   Priority = 1
)

// RecurrenceRule represents recurring task rule
type RecurrenceRule struct {
	Freq             string   `json:"freq,omitempty"`                // daily, weekly, monthly, yearly, lunar_yearly
	Interval         int      `json:"interval,omitempty"`            // every N days/weeks/months/years
	ByDay            []string `json:"byday,omitempty"`               // MO, TU, WE, TH, FR, SA, SU
	ByMonth          []int    `json:"bymonth,omitempty"`             // 1-12
	ByDate           []int    `json:"bydate,omitempty"`              // day of month
	Count            int      `json:"count,omitempty"`               // max occurrences
	LunarMonth       int      `json:"lunar_month,omitempty"`         // 1-12
	LunarDay         int      `json:"lunar_day,omitempty"`           // 1-30
	LunarIsLeapMonth bool     `json:"lunar_is_leap_month,omitempty"` // true => leap month when available
}

// Value implements driver.Valuer
func (r RecurrenceRule) Value() (driver.Value, error) {
	if r.Freq == "" {
		return nil, nil
	}
	return json.Marshal(r)
}

// Scan implements sql.Scanner
func (r *RecurrenceRule) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("invalid scan source for RecurrenceRule")
	}
	return json.Unmarshal(bytes, r)
}

type Task struct {
	ID                int64           `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID            int64           `json:"user_id" gorm:"index;not null"`
	ParentTaskID      *int64          `json:"parent_task_id,omitempty" gorm:"index"`
	Title             string          `json:"title" gorm:"size:200;not null"`
	Description       string          `json:"description" gorm:"type:text"`
	Status            TaskStatus      `json:"status" gorm:"size:20;default:'pending'"`
	Priority          Priority        `json:"priority" gorm:"default:0"`
	StartTime         *time.Time      `json:"start_time"`
	EndTime           *time.Time      `json:"end_time"`
	DueDate           *time.Time      `json:"due_date"`
	AllDay            bool            `json:"all_day" gorm:"default:false"`
	Revision          int64           `json:"revision" gorm:"not null;default:1;index"`
	RecurrenceRule    *RecurrenceRule `json:"recurrence_rule,omitempty" gorm:"type:text"`
	RecurrenceEndDate *time.Time      `json:"recurrence_end_date"`
	CompletedAt       *time.Time      `json:"completed_at"`
	DeletedAt         *time.Time      `json:"deleted_at"`
	CreatedAt         time.Time       `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time       `json:"updated_at" gorm:"autoUpdateTime"`
	CalDAVUID         string          `json:"caldav_uid,omitempty" gorm:"size:255;index"`
	CalDAVHref        string          `json:"caldav_href,omitempty" gorm:"size:255;index"`
	ReadOnly          bool            `json:"read_only" gorm:"-"`
	Source            string          `json:"source,omitempty" gorm:"-"`
	ExternalRef       string          `json:"external_ref,omitempty" gorm:"-"`

	// Relations
	User       *User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
	ParentTask *Task      `json:"parent_task,omitempty" gorm:"foreignKey:ParentTaskID"`
	Categories []Category `json:"categories,omitempty" gorm:"many2many:task_categories;"`
}

type TaskOccurrenceStatus struct {
	ID             int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID         int64      `json:"user_id" gorm:"not null;uniqueIndex:idx_task_occurrence_status"`
	TaskID         int64      `json:"task_id" gorm:"not null;uniqueIndex:idx_task_occurrence_status;index"`
	OccurrenceDate time.Time  `json:"occurrence_date" gorm:"not null;uniqueIndex:idx_task_occurrence_status;index"`
	Status         TaskStatus `json:"status" gorm:"size:20;not null"`
	CreatedAt      time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

type TaskOccurrenceOverride struct {
	ID             int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID         int64     `json:"user_id" gorm:"not null;uniqueIndex:idx_task_occurrence_override"`
	TaskID         int64     `json:"task_id" gorm:"not null;uniqueIndex:idx_task_occurrence_override;index"`
	OccurrenceDate time.Time `json:"occurrence_date" gorm:"not null;uniqueIndex:idx_task_occurrence_override;index"`
	Description    string    `json:"description" gorm:"type:text;not null;default:''"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// TaskOccurrence stores persisted recurring-instance overrides/history.
// One row represents one expanded occurrence date for a recurring series.
type TaskOccurrence struct {
	ID             int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID         int64      `json:"user_id" gorm:"not null;uniqueIndex:idx_task_occurrence_unique;index:idx_task_occurrence_status_date,priority:1"`
	TaskID         int64      `json:"task_id" gorm:"not null;uniqueIndex:idx_task_occurrence_unique;index;index:idx_task_occurrence_status_date,priority:2"`
	OccurrenceDate time.Time  `json:"occurrence_date" gorm:"not null;uniqueIndex:idx_task_occurrence_unique;index;index:idx_task_occurrence_status_date,priority:4"`
	InstanceID     string     `json:"instance_id" gorm:"size:64;not null;default:'';index"`
	Status         TaskStatus `json:"status" gorm:"size:20;not null;default:'pending';index:idx_task_occurrence_status_date,priority:3"`
	CompletedAt    *time.Time `json:"completed_at"`
	DeletedAt      *time.Time `json:"deleted_at"`
	Description    string     `json:"description" gorm:"type:text;not null;default:''"`
	StartTime      *time.Time `json:"start_time"`
	EndTime        *time.Time `json:"end_time"`
	AllDay         bool       `json:"all_day" gorm:"default:false"`
	CreatedAt      time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

type TaskDeleteLog struct {
	ID        int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    int64     `json:"user_id" gorm:"not null;index;index:idx_task_delete_user_time"`
	TaskID    int64     `json:"task_id" gorm:"not null;index"`
	DeletedAt time.Time `json:"deleted_at" gorm:"not null;index;index:idx_task_delete_user_time"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type TaskInstance struct {
	InstanceID   string     `json:"instance_id"` // virtual ID: taskID_date
	TaskID       int64      `json:"task_id"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Status       TaskStatus `json:"status"`
	Priority     Priority   `json:"priority"`
	StartTime    time.Time  `json:"start_time"`
	EndTime      *time.Time `json:"end_time"`
	AllDay       bool       `json:"all_day"`
	IsRecurring  bool       `json:"is_recurring"`
	OriginalDate time.Time  `json:"original_date"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
	Categories   []Category `json:"categories,omitempty"`
}

// API Request/Response types
type CreateTaskRequest struct {
	Title             string          `json:"title" binding:"required,max=200"`
	Description       string          `json:"description"`
	Priority          Priority        `json:"priority"`
	StartTime         *time.Time      `json:"start_time"`
	EndTime           *time.Time      `json:"end_time"`
	StartTimeLocal    string          `json:"start_time_local"`
	EndTimeLocal      string          `json:"end_time_local"`
	ClientTimezone    string          `json:"client_timezone" binding:"omitempty,max=50"`
	DueDate           *time.Time      `json:"due_date"`
	AllDay            bool            `json:"all_day"`
	RecurrenceRule    *RecurrenceRule `json:"recurrence_rule"`
	RecurrenceEndDate *time.Time      `json:"recurrence_end_date"`
	CategoryIDs       []int64         `json:"category_ids"`
}

type UpdateTaskRequest struct {
	Title             string          `json:"title" binding:"omitempty,max=200"`
	Description       string          `json:"description"`
	Priority          *Priority       `json:"priority"`
	Status            TaskStatus      `json:"status" binding:"omitempty,oneof=pending completed cancelled skipped"` // Fix 2: 添加 Status
	InstanceID        string          `json:"instance_id"`
	OccurrenceDate    string          `json:"occurrence_date"`
	StartTime         *time.Time      `json:"start_time"`
	EndTime           *time.Time      `json:"end_time"`
	StartTimeLocal    string          `json:"start_time_local"`
	EndTimeLocal      string          `json:"end_time_local"`
	ClientTimezone    string          `json:"client_timezone" binding:"omitempty,max=50"`
	DueDate           *time.Time      `json:"due_date"`
	AllDay            *bool           `json:"all_day"`
	RecurrenceRule    *RecurrenceRule `json:"recurrence_rule"`
	RecurrenceEndDate *time.Time      `json:"recurrence_end_date"`
	CategoryIDs       []int64         `json:"category_ids"`
}

type UpdateTaskStatusRequest struct {
	Status         TaskStatus `json:"status" binding:"required,oneof=pending completed cancelled skipped"`
	InstanceID     string     `json:"instance_id"`
	OccurrenceDate string     `json:"occurrence_date"`
}

type UpdateTaskScheduleRequest struct {
	StartTime *time.Time `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`
	AllDay    bool       `json:"all_day"`
}

type TaskResponse struct {
	Task
	Categories []Category `json:"categories"`
}

// CalendarEvent represents a FullCalendar event
type CalendarEvent struct {
	ID              string        `json:"id"`
	Title           string        `json:"title"`
	Start           string        `json:"start"`
	End             string        `json:"end,omitempty"`
	AllDay          bool          `json:"allDay"`
	Editable        bool          `json:"editable"`
	BackgroundColor string        `json:"backgroundColor,omitempty"`
	BorderColor     string        `json:"borderColor,omitempty"`
	TextColor       string        `json:"textColor,omitempty"`
	ExtendedProps   ExtendedProps `json:"extendedProps"`
}

type ExtendedProps struct {
	TaskID      int64      `json:"taskId"`
	Description string     `json:"description"`
	Priority    Priority   `json:"priority"`
	Status      TaskStatus `json:"status"`
	IsRecurring bool       `json:"isRecurring"`
	InstanceID  string     `json:"instanceId,omitempty"`
	ReadOnly    bool       `json:"readOnly,omitempty"`
	Source      string     `json:"source,omitempty"`
	Provider    string     `json:"provider,omitempty"`
	ExternalID  string     `json:"externalId,omitempty"`
	Location    string     `json:"location,omitempty"`
	Organizer   string     `json:"organizer,omitempty"`
	Attendees   []string   `json:"attendees,omitempty"`
	MeetingLink string     `json:"meetingLink,omitempty"`
}
