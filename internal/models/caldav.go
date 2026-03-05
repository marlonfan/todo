package models

import "time"

type CaldavSource struct {
	ID          int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID      int64      `json:"user_id" gorm:"index;not null"`
	Name        string     `json:"name" gorm:"size:120;not null"`
	BaseURL     string     `json:"base_url" gorm:"size:500;not null"`
	Username    string     `json:"username" gorm:"size:255;not null"`
	PasswordEnc string     `json:"-" gorm:"type:text;not null"`
	IsActive    bool       `json:"is_active" gorm:"default:true;index"`
	LastSyncAt  *time.Time `json:"last_sync_at"`
	LastError   string     `json:"last_error" gorm:"type:text"`
	CreatedAt   time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

type CaldavCalendar struct {
	ID          int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID      int64      `json:"user_id" gorm:"index;not null"`
	SourceID    int64      `json:"source_id" gorm:"index;not null"`
	CalendarURL string     `json:"calendar_url" gorm:"size:700;not null"`
	DisplayName string     `json:"display_name" gorm:"size:255"`
	Color       string     `json:"color" gorm:"size:32"`
	IsSelected  bool       `json:"is_selected" gorm:"default:true;index"`
	CTag        string     `json:"ctag" gorm:"size:255"`
	SyncToken   string     `json:"sync_token" gorm:"size:500"`
	CreatedAt   time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
	LastSyncAt  *time.Time `json:"last_sync_at"`
	LastError   string     `json:"last_error" gorm:"type:text"`
}

type CaldavEventCache struct {
	ID           int64      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID       int64      `json:"user_id" gorm:"index;not null;index:idx_caldav_event_unique,unique"`
	SourceID     int64      `json:"source_id" gorm:"index;not null;index:idx_caldav_event_unique,unique"`
	CalendarID   int64      `json:"calendar_id" gorm:"index;not null;index:idx_caldav_event_unique,unique"`
	EventUID     string     `json:"event_uid" gorm:"size:255;not null;index:idx_caldav_event_unique,unique"`
	RecurrenceID string     `json:"recurrence_id" gorm:"size:255;default:'';index:idx_caldav_event_unique,unique"`
	Title        string     `json:"title" gorm:"size:500"`
	Description  string     `json:"description" gorm:"type:text"`
	Location     string     `json:"location" gorm:"size:500"`
	Organizer    string     `json:"organizer" gorm:"size:500"`
	Attendees    string     `json:"attendees" gorm:"type:text"`
	MeetingLink  string     `json:"meeting_link" gorm:"size:1000"`
	StartTime    time.Time  `json:"start_time" gorm:"index;not null"`
	EndTime      *time.Time `json:"end_time" gorm:"index"`
	AllDay       bool       `json:"all_day" gorm:"default:false"`
	Status       string     `json:"status" gorm:"size:64"`
	Etag         string     `json:"etag" gorm:"size:255"`
	LastModified *time.Time `json:"last_modified"`
	RawHref      string     `json:"raw_href" gorm:"size:700"`
	CreatedAt    time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

type CaldavCalendarChoice struct {
	CalendarURL string `json:"calendar_url" binding:"required,max=700"`
	DisplayName string `json:"display_name"`
	Color       string `json:"color"`
}

type CaldavDiscoverRequest struct {
	SourceID int64  `json:"source_id"`
	BaseURL  string `json:"base_url" binding:"required,max=500"`
	Username string `json:"username" binding:"required,max=255"`
	Password string `json:"password" binding:"max=500"`
}

type CaldavUpsertSourceRequest struct {
	Name      string                 `json:"name" binding:"required,max=120"`
	BaseURL   string                 `json:"base_url" binding:"required,max=500"`
	Username  string                 `json:"username" binding:"required,max=255"`
	Password  string                 `json:"password" binding:"max=500"`
	Calendars []CaldavCalendarChoice `json:"calendars" binding:"required,min=1,dive"`
	IsActive  *bool                  `json:"is_active"`
}

type CaldavSourceResponse struct {
	ID         int64            `json:"id"`
	Name       string           `json:"name"`
	BaseURL    string           `json:"base_url"`
	Username   string           `json:"username"`
	IsActive   bool             `json:"is_active"`
	LastSyncAt *time.Time       `json:"last_sync_at"`
	LastError  string           `json:"last_error"`
	Calendars  []CaldavCalendar `json:"calendars"`
}

type CaldavFetchDebug struct {
	AttemptedCalendars  int      `json:"attempted_calendars"`
	SuccessfulCalendars int      `json:"successful_calendars"`
	EventCount          int      `json:"event_count"`
	Messages            []string `json:"messages,omitempty"`
}
