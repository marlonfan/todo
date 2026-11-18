package syncer

import (
	"time"
	"todo-native/internal/api"
)

func applyEventSchedule(event *api.CalendarEvent, start time.Time, end *time.Time, allDay bool) {
	event.Start, event.End, event.AllDay = start.Format(time.RFC3339Nano), "", allDay
	if end != nil {
		event.End = end.Format(time.RFC3339Nano)
	}
}
