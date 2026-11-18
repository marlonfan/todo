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

func TestOfflineOccurrenceDescriptionSurvivesRestartAndAcknowledgement(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	day := time.Date(2026, 11, 9, 9, 0, 0, 0, time.UTC)
	task := api.Task{ID: 1, Title: "例会", Description: "系列描述", Status: "pending", Revision: 7, StartTime: &day, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	event := api.CalendarEvent{ID: "1_20261109", Start: day.Format(time.RFC3339)}
	event.ExtendedProps.TaskID, event.ExtendedProps.InstanceID, event.ExtendedProps.Status, event.ExtendedProps.Description = 1, event.ID, "pending", task.Description
	state := storage.Cache{Server: "http://test", UserID: 1, Tasks: []api.Task{task}, Next: []api.Occurrence{{TaskID: 1, InstanceID: event.ID, StartTime: day, OriginalDate: day, Status: "pending", Description: task.Description}}, ReminderEvents: []api.CalendarEvent{event}, Calendar: &storage.CalendarSnapshot{Events: []api.CalendarEvent{event}, SeriesRevisions: map[int64]int64{1: 7}}}
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"description": "本次记录", "instance_id": event.ID, "occurrence_date": "2026-11-09"}, 7)
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"description": "", "instance_id": event.ID, "occurrence_date": "2026-11-09"}, 7)
	assertView := func(state storage.Cache, revision int64) {
		t.Helper()
		view := View(state)
		if len(view.Next) != 1 || len(view.History.Items) != 0 || view.Next[0].Description != "" || view.Next[0].Status != "pending" || view.Tasks[0].Description != "系列描述" || !view.Tasks[0].StartTime.Equal(day) {
			t.Fatalf("scoped edit changed series or status: %+v", view)
		}
		if len(view.ReminderEvents) != 1 || len(view.Calendar.Events) != 1 || view.ReminderEvents[0].ExtendedProps.Description != "" || view.Calendar.Events[0].ExtendedProps.Description != "" || view.Calendar.Events[0].ExtendedProps.Status != "pending" || view.Calendar.SeriesRevisions[1] != revision {
			t.Fatal("calendar/reminder expansion lost or changed", view)
		}
	}
	assertView(state, 7)
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	state, _ = store.Cache(state.Server, state.UserID)
	assertView(state, 7)
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		wantRevision := "7"
		wantDescription := "本次记录"
		if requests == 2 {
			wantRevision, wantDescription = "8", ""
		}
		if r.Method != "PUT" || r.Header.Get("If-Match") != wantRevision || len(body) != 3 || body["description"] != wantDescription || body["instance_id"] != event.ID {
			t.Errorf("request affected more than description: %v, %v", r.Header, body)
		}
		task.Revision++
		_ = json.NewEncoder(w).Encode(task)
	}))
	defer srv.Close()
	client, _ := api.New(srv.URL, "jwt")
	state, err := Flush(context.Background(), client, store, state)
	if err != nil || requests != 2 || len(state.Outbox) != 0 {
		t.Fatal(requests, state, err)
	}
	assertView(state, 9)
}

func TestHistoryDescriptionEditPreservesStatusAndUnrelatedInstances(t *testing.T) {
	day := time.Now()
	state := storage.Cache{Tasks: []api.Task{{ID: 1, Description: "系列", RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}}, History: api.OccurrencePage{Items: []api.Occurrence{{TaskID: 1, InstanceID: "past", Status: "completed", Description: "旧记录", StartTime: day, OriginalDate: day}}, NextCursor: 200, HasMore: true}, Next: []api.Occurrence{{TaskID: 1, InstanceID: "next", Status: "pending", Description: "后续", StartTime: day, OriginalDate: day}}}
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"instance_id": "past", "description": "补充记录"}, 1)
	state = View(state)
	if len(state.Next) != 1 || state.Next[0].Description != "后续" || len(state.History.Items) != 1 || state.History.Items[0].Description != "补充记录" || state.History.Items[0].Status != "completed" || !state.History.HasMore || state.History.NextCursor != 200 {
		t.Fatal(state)
	}
}
