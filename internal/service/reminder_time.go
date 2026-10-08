package service

import (
	"strings"
	"time"
	"todo-app/internal/models"
)

const fallbackMorningReminderTime = "09:00"

func resolveReminderStartForTask(startUTC time.Time, allDay bool, timezone, defaultMorningTime string) time.Time {
	startUTC = startUTC.UTC()
	if !allDay {
		return startUTC
	}

	loc := loadLocationOrUTC(timezone)
	localStart := startUTC.In(loc)
	hour, minute := parseReminderClock(defaultMorningTime)
	localReminder := time.Date(
		localStart.Year(),
		localStart.Month(),
		localStart.Day(),
		hour,
		minute,
		0,
		0,
		loc,
	)
	return localReminder.UTC()
}

func parseReminderClock(raw string) (int, int) {
	value := strings.TrimSpace(raw)
	if value == "" {
		value = fallbackMorningReminderTime
	}
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		parsed, _ = time.Parse("15:04", fallbackMorningReminderTime)
	}
	return parsed.Hour(), parsed.Minute()
}

// resolveTaskReminderMinutes is shared by task writes, rebuilds and ICS export.
func resolveTaskReminderMinutes(task *models.Task, user *models.User) (int, bool) {
	if task == nil || user == nil || task.Status != models.TaskStatusPending {
		return 0, false
	}
	switch task.ReminderPolicy {
	case models.TaskReminderNone:
		return 0, false
	case models.TaskReminderOffset:
		if task.ReminderMinutesBefore == nil || *task.ReminderMinutesBefore < 0 || *task.ReminderMinutesBefore > 10080 {
			return 0, false
		}
		return *task.ReminderMinutesBefore, true
	default:
		if !user.DefaultReminderEnabled {
			return 0, false
		}
		minutes := user.DefaultReminderMinutes
		if minutes <= 0 {
			minutes = 5
		}
		return minutes, true
	}
}
