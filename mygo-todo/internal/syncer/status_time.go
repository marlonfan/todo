package syncer

import "time"

// Mirror server status transitions for offline filtering. Use the persisted
// operation time so reopening the app never moves a row to a different day.
func applyStatusTime(before, after string, at time.Time, completed, deleted **time.Time) {
	if before == after {
		return
	}
	*completed, *deleted = nil, nil
	t := at.UTC()
	switch after {
	case "completed":
		*completed = &t
	case "cancelled":
		*deleted = &t
	}
}
