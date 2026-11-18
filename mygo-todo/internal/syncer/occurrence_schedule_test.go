package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestOfflineOccurrenceScheduleRestartAndAcknowledgement(t *testing.T) {
	day := time.Date(2026, 11, 9, 9, 0, 0, 0, time.UTC)
	moved := day.AddDate(0, 0, 14)
	task := api.Task{ID: 1, Title: "重复", Status: "pending", Description: "系列", Revision: 7, StartTime: &day, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	e := api.CalendarEvent{ID: "1_20261109", Start: day.Format(time.RFC3339), End: day.Add(time.Hour).Format(time.RFC3339)}
	e.ExtendedProps.TaskID, e.ExtendedProps.InstanceID, e.ExtendedProps.Status, e.ExtendedProps.Description = 1, e.ID, "pending", "本次"
	state := storage.Cache{Server: "http://test", UserID: 1, Tasks: []api.Task{task}, Next: []api.Occurrence{{TaskID: 1, InstanceID: e.ID, StartTime: day, OriginalDate: day, Status: "pending", Description: "本次"}}, ReminderEvents: []api.CalendarEvent{e}, Calendar: &storage.CalendarSnapshot{Events: []api.CalendarEvent{e}, SeriesRevisions: map[int64]int64{1: 7}}}
	body := map[string]any{"instance_id": e.ID, "occurrence_date": "2026-11-09", "start_time": moved, "end_time": nil, "all_day": true}
	state = enqueue(t, state, "PATCH", "/tasks/1/occurrences/schedule", body, 7)
	assert := func(v storage.Cache) {
		t.Helper()
		v = View(v)
		if !v.Tasks[0].StartTime.Equal(day) || v.Tasks[0].Description != "系列" || !v.Next[0].StartTime.Equal(moved) || v.Next[0].EndTime != nil || !v.Next[0].AllDay || v.Next[0].Description != "本次" || !v.Next[0].OriginalDate.Equal(day) {
			t.Fatal(v)
		}
		for _, e := range []api.CalendarEvent{v.Calendar.Events[0], v.ReminderEvents[0]} {
			if e.Start != moved.Format(time.RFC3339) || e.End != "" || !e.AllDay || e.ExtendedProps.InstanceID != "1_20261109" {
				t.Fatal(e)
			}
		}
	}
	assert(state)
	store := storage.Store{Dir: t.TempDir()}
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	state, _ = store.Cache(state.Server, state.UserID)
	assert(state)
	id := state.Outbox[0].ID
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "PATCH" || r.URL.Path != "/api/tasks/1/occurrences/schedule" || r.Header.Get("If-Match") != "7" || r.Header.Get("X-Client-Op-Id") != id {
			t.Error(r.URL, r.Header)
		}
		task.Revision = 8
		json.NewEncoder(w).Encode(task)
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	state, err := Flush(context.Background(), client, store, state)
	if err != nil || len(state.Outbox) != 0 || state.Calendar.SeriesRevisions[1] != 8 {
		t.Fatal(state, err)
	}
	assert(state)
}

func TestOccurrenceScheduleRejectsLegacyEndpointWithoutSeriesFallback(t *testing.T) {
	start := time.Now()
	state := storage.Cache{Tasks: []api.Task{{ID: 1, StartTime: &start, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}}}
	state = enqueue(t, state, "PATCH", "/tasks/1/occurrences/schedule", map[string]any{"instance_id": "1_20261109", "start_time": start}, 1)
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/api/tasks/1/occurrences/schedule" {
			t.Error("dangerous fallback", r.URL)
		}
		w.WriteHeader(404)
	}))
	defer server.Close()
	c, _ := api.New(server.URL, "jwt")
	state, err := Flush(context.Background(), c, storage.Store{Dir: t.TempDir()}, state)
	if err != nil || calls != 1 || state.Outbox[0].State != "rejected" || state.Outbox[0].Failure == "" {
		t.Fatal(state, err)
	}
}
