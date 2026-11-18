package reminders

import (
	"encoding/json"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/syncer"
)

func TestOfflineOccurrenceScheduleMovesReminderAndKeepsIdentity(t *testing.T) {
	in := fixture()
	start := *in.Cache.Tasks[0].StartTime
	in.Cache.Tasks[0].RecurrenceRule = json.RawMessage(`{"freq":"daily"}`)
	e := api.CalendarEvent{ID: "1_20261109", Start: start.Format(time.RFC3339), Title: "本次"}
	e.ExtendedProps.TaskID, e.ExtendedProps.InstanceID, e.ExtendedProps.Status = 1, e.ID, "pending"
	in.Cache.ReminderEvents = []api.CalendarEvent{e}
	before := Plan(in)
	if len(before) != 1 {
		t.Fatal(before)
	}
	moved := start.AddDate(0, 0, 2)
	var err error
	in.Cache, err = syncer.Enqueue(in.Cache, "PATCH", "/tasks/1/occurrences/schedule", map[string]any{"instance_id": e.ID, "occurrence_date": "2026-11-09", "start_time": moved, "end_time": nil, "all_day": true}, 1)
	if err != nil {
		t.Fatal(err)
	}
	after := Plan(in)
	if len(after) != 1 || after[0].InstanceID != before[0].InstanceID || after[0].TaskKey != before[0].TaskKey || after[0].ID == before[0].ID {
		t.Fatal(before, after)
	}
	loc, _ := time.LoadLocation("Asia/Shanghai")
	day := moved.In(loc)
	expected := time.Date(day.Year(), day.Month(), day.Day(), 9, 0, 0, 0, loc).Add(-5 * time.Minute)
	if !after[0].At.Equal(expected) {
		t.Fatal(after[0], expected)
	}
}
