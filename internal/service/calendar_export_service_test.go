package service

import (
	"strings"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestDefaultCalendarAlarmTrigger(t *testing.T) {
	tests := []struct {
		name    string
		task    *models.Task
		user    *models.User
		want    string
		wantSet bool
	}{
		{
			name: "timed event",
			task: &models.Task{Status: models.TaskStatusPending, StartTime: timePointer(time.Now()), AllDay: false},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 15},
			want: "-PT15M", wantSet: true,
		},
		{
			name: "all day event uses morning reminder time",
			task: &models.Task{Status: models.TaskStatusPending, StartTime: timePointer(time.Now()), AllDay: true},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 5, DefaultMorningTime: "09:00"},
			want: "PT8H55M", wantSet: true,
		},
		{
			name: "disabled",
			task: &models.Task{Status: models.TaskStatusPending, StartTime: timePointer(time.Now())},
			user: &models.User{DefaultReminderEnabled: false, DefaultReminderMinutes: 5},
		},
		{
			name: "completed task",
			task: &models.Task{Status: models.TaskStatusCompleted, StartTime: timePointer(time.Now())},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 5},
		},
		{
			name: "unscheduled task",
			task: &models.Task{Status: models.TaskStatusPending},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 5},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotSet := defaultCalendarAlarmTrigger(tt.task, tt.user)
			if got != tt.want || gotSet != tt.wantSet {
				t.Fatalf("defaultCalendarAlarmTrigger() = (%q, %v), want (%q, %v)", got, gotSet, tt.want, tt.wantSet)
			}
		})
	}
}

func TestParseICalendarObjectIgnoresAlarmProperties(t *testing.T) {
	data := strings.Join([]string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"BEGIN:VEVENT",
		"UID:alarm-only-description@example",
		"SUMMARY:Calendar event",
		"DTSTART:20260715T010000Z",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		"DESCRIPTION:Alarm description",
		"TRIGGER:-PT5M",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
	}, "\r\n")

	parsed, err := parseICalendarObject([]byte(data), time.UTC)
	if err != nil {
		t.Fatalf("parseICalendarObject() error = %v", err)
	}
	if parsed.Description != "" {
		t.Fatalf("event description = %q, want empty; VALARM properties must be ignored", parsed.Description)
	}
}

func timePointer(value time.Time) *time.Time {
	return &value
}
