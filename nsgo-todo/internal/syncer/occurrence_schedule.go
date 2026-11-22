package syncer

import (
	"nsgo-todo/internal/api"
	"time"
)

func applyEventSchedule(event *api.CalendarEvent, start time.Time, end *time.Time, allDay bool) {
	event.Start, event.End, event.AllDay = start.Format(time.RFC3339Nano), "", allDay
	if end != nil {
		event.End = end.Format(time.RFC3339Nano)
	}
}
