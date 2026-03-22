package service

import (
	"strings"
	"time"
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
