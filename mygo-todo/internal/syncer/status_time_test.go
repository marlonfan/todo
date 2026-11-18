package syncer

import (
	"encoding/json"
	"testing"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestOfflineStatusTimestampsAreStableAndPersisted(t *testing.T) {
	day := time.Date(2026, 11, 9, 9, 0, 0, 0, time.UTC)
	store := storage.Store{Dir: t.TempDir()}
	state := storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{
		{ID: 1, Status: "pending", CreatedAt: day, Revision: 1},
		{ID: 2, Status: "pending", CreatedAt: day, Revision: 1, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)},
	}, Next: []api.Occurrence{{TaskID: 2, InstanceID: "2_20261109", Status: "pending", StartTime: day, OriginalDate: day}}}
	var err error
	state, err = Enqueue(state, "PATCH", "/tasks/1/status", map[string]string{"status": "completed"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	state, err = Enqueue(state, "PATCH", "/tasks/2/status", map[string]string{"status": "cancelled", "instance_id": "2_20261109", "occurrence_date": "2026-11-09"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Cache(state.Server, state.UserID)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range []storage.Cache{state, restored} {
		v := View(s)
		var task api.Task
		for _, row := range v.Tasks {
			if row.ID == 1 {
				task = row
			}
		}
		if task.CompletedAt == nil || !task.CompletedAt.Equal(state.Outbox[0].CreatedAt) || task.DeletedAt != nil || !task.CreatedAt.Equal(day) {
			t.Fatal(task)
		}
		if len(v.History.Items) != 1 || v.History.Items[0].DeletedAt == nil || !v.History.Items[0].DeletedAt.Equal(state.Outbox[1].CreatedAt) || v.History.Items[0].CompletedAt != nil {
			t.Fatal(v.History)
		}
		if s.Tasks[0].CompletedAt != nil || s.Next[0].DeletedAt != nil {
			t.Fatal("canonical snapshot mutated")
		}
	}
	state, err = Enqueue(restored, "PATCH", "/tasks/1/status", map[string]string{"status": "pending"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	state, err = Enqueue(state, "PATCH", "/tasks/2/status", map[string]string{"status": "completed", "instance_id": "2_20261109"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	v := View(state)
	for _, task := range v.Tasks {
		if task.ID == 1 && (task.CompletedAt != nil || task.DeletedAt != nil) {
			t.Fatal(task)
		}
	}
	if v.History.Items[0].DeletedAt != nil || v.History.Items[0].CompletedAt == nil || !v.History.Items[0].CompletedAt.Equal(state.Outbox[3].CreatedAt) {
		t.Fatal(v.History.Items)
	}
	// Repeating an identical status preserves the action time.
	state, err = Enqueue(state, "PATCH", "/tasks/2/status", map[string]string{"status": "completed", "instance_id": "2_20261109"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !View(state).History.Items[0].CompletedAt.Equal(state.Outbox[3].CreatedAt) {
		t.Fatal("unchanged status moved completion time")
	}
}
