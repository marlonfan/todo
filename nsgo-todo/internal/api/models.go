package api

import (
	"encoding/json"
	"time"
)

type User struct {
	ID                     int64  `json:"id"`
	Username               string `json:"username"`
	Email                  string `json:"email"`
	AvatarURL              string `json:"avatar_url"`
	Timezone               string `json:"timezone"`
	CalendarDefaultView    string `json:"calendar_default_view"`
	DefaultTimeGranularity int    `json:"default_time_granularity"`
	DefaultTaskStartTime   string `json:"default_task_start_time"`
	DefaultNoonTime        string `json:"default_noon_time"`
	DefaultAfternoonTime   string `json:"default_afternoon_time"`
	DefaultEveningTime     string `json:"default_evening_time"`
	DefaultReminderEnabled bool   `json:"default_reminder_enabled"`
	DefaultReminderMinutes int    `json:"default_reminder_minutes"`
	DefaultMorningTime     string `json:"default_morning_time"`
}

type Category struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Color string `json:"color"`
}

type Task struct {
	// Projection fields belong to a single list row, never to the series editor.
	InstanceID            string          `json:"-"`
	OccurrenceDate        string          `json:"-"`
	ID                    int64           `json:"id"`
	Title                 string          `json:"title"`
	Description           string          `json:"description"`
	Status                string          `json:"status"`
	Priority              int             `json:"priority"`
	Revision              int64           `json:"revision"`
	StartTime             *time.Time      `json:"start_time"`
	EndTime               *time.Time      `json:"end_time"`
	DueDate               *time.Time      `json:"due_date"`
	AllDay                bool            `json:"all_day"`
	ReminderPolicy        string          `json:"reminder_policy"`
	ReminderMinutesBefore *int            `json:"reminder_minutes_before"`
	RecurrenceRule        json.RawMessage `json:"recurrence_rule"`
	RecurrenceEndDate     *time.Time      `json:"recurrence_end_date"`
	Categories            []Category      `json:"categories"`
	ReadOnly              bool            `json:"read_only"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`
	CompletedAt           *time.Time      `json:"completed_at"`
	DeletedAt             *time.Time      `json:"deleted_at"`
}

// Occurrence uses the server's original_date (UTC-encoded calendar date), which
// must not be converted to the display timezone when addressing a mutation.
type Occurrence struct {
	InstanceID   string     `json:"instance_id"`
	TaskID       int64      `json:"task_id"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Status       string     `json:"status"`
	Priority     int        `json:"priority"`
	StartTime    time.Time  `json:"start_time"`
	EndTime      *time.Time `json:"end_time"`
	AllDay       bool       `json:"all_day"`
	OriginalDate time.Time  `json:"original_date"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	DeletedAt    *time.Time `json:"deleted_at"`
}

type OccurrencePage struct {
	Items      []Occurrence `json:"items"`
	NextCursor int          `json:"next_cursor"`
	HasMore    bool         `json:"has_more"`
}

func (t Task) Recurring() bool {
	var rule struct {
		Freq string `json:"freq"`
	}
	return json.Unmarshal(t.RecurrenceRule, &rule) == nil && rule.Freq != ""
}

type CalendarEvent struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Start         string `json:"start"`
	End           string `json:"end"`
	AllDay        bool   `json:"allDay"`
	ExtendedProps struct {
		TaskID      int64  `json:"taskId"`
		Description string `json:"description"`
		Status      string `json:"status"`
		IsRecurring bool   `json:"isRecurring"`
		InstanceID  string `json:"instanceId"`
		ReadOnly    bool   `json:"readOnly"`
		Source      string `json:"source"`
		Priority    int    `json:"priority"`
		Location    string `json:"location"`
		Organizer   string `json:"organizer"`
		MeetingLink string `json:"meetingLink"`
	} `json:"extendedProps"`
}

type Session struct {
	Server string `json:"server"`
	Token  string `json:"token"`
	User   User   `json:"user"`
}
