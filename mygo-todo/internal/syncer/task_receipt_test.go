package syncer

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func receiptFixture() storage.Cache {
	day := time.Date(2026, 11, 9, 9, 0, 0, 0, time.UTC)
	task := api.Task{ID: 1, Title: "series", Description: "original", Status: "pending", Revision: 7, StartTime: &day, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	event := api.CalendarEvent{ID: "one", Title: "one", Start: day.Format(time.RFC3339)}
	event.ExtendedProps.TaskID, event.ExtendedProps.InstanceID, event.ExtendedProps.Status = 1, "one", "pending"
	other := event
	other.ID, other.Title, other.ExtendedProps.InstanceID = "two", "two", "two"
	return storage.Cache{Server: "server", UserID: 42, SyncCursor: "cursor", Tasks: []api.Task{task, {ID: 2, Title: "other", Status: "pending", Revision: 3}},
		Next:    []api.Occurrence{{TaskID: 1, InstanceID: "one", Title: "one", Status: "pending", StartTime: day}, {TaskID: 1, InstanceID: "two", Title: "two", Status: "pending", StartTime: day}},
		History: api.OccurrencePage{NextCursor: 20, HasMore: true}, ReminderEvents: []api.CalendarEvent{event, other},
		Calendar:   &storage.CalendarSnapshot{Events: []api.CalendarEvent{event, other}, SeriesRevisions: map[int64]int64{1: 7}},
		Categories: []api.Category{{ID: 5, Name: "work"}}, CategoryAliases: map[int64]int64{-3: 5},
		ProfileChanges: &storage.ProfileChanges{Failure: "profile"}, ReminderKeys: map[int64]string{1: "key"}, NextLocalID: -8,
	}
}

func receipt(t *testing.T, state storage.Cache, id string, task api.Task, requestErr error) storage.Cache {
	t.Helper()
	next, err := ApplyTaskReceipt(state, id, task, requestErr)
	if err != nil {
		t.Fatal(err)
	}
	return next
}

func TestTaskReceiptKeepsLiveAppendsAndDeltaOnNewerCanonical(t *testing.T) {
	state := enqueue(t, receiptFixture(), "PUT", "/tasks/1", map[string]any{"description": "first"}, 7)
	state.Outbox[0].Sent = true
	sent := state.Outbox[0]
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]any{"description": "latest"}, 7)
	state = enqueue(t, state, "PUT", "/tasks/2", map[string]any{"title": "other edit"}, 3)
	// A remote pull and UI edits happened while the first request was in flight.
	remoteDay := state.Tasks[0].StartTime.Add(24 * time.Hour)
	state.Tasks[0].Title, state.Tasks[0].StartTime, state.Tasks[0].Revision = "remote title", &remoteDay, 12
	before := Clone(state)
	ack := sent.Local
	ack.Revision = 8
	got := receipt(t, state, sent.ID, ack, nil)
	if len(got.Outbox) != 2 || got.Outbox[0].ID != state.Outbox[1].ID || got.Outbox[1].ID != state.Outbox[2].ID {
		t.Fatal("lost appended operations", got.Outbox)
	}
	if got.Tasks[0].Revision != 12 || got.Tasks[0].Title != "remote title" || !got.Tasks[0].StartTime.Equal(remoteDay) {
		t.Fatal("stale receipt replaced remote snapshot", got.Tasks)
	}
	if got.Outbox[0].Revision != 8 || got.LocalAckRevisions[1] != 8 || got.Outbox[1].Revision != 3 {
		t.Fatal("wrong local authority", got.Outbox, got.LocalAckRevisions)
	}
	view := View(got)
	for _, task := range view.Tasks {
		if task.ID == 1 && (task.Title != "remote title" || task.Description != "latest" || !task.StartTime.Equal(remoteDay) || task.Revision != 12) {
			t.Fatal("whole Local replaced canonical fields", task)
		}
		if task.ID == 2 && task.Title != "other edit" {
			t.Fatal("lost independent intent", task)
		}
	}
	expected := Clone(before)
	expected.Tasks, expected.Outbox, expected.LocalAckRevisions = got.Tasks, got.Outbox, got.LocalAckRevisions
	if !reflect.DeepEqual(expected, got) {
		t.Fatal("unrelated cache fields changed")
	}
	if !reflect.DeepEqual(Clone(state), before) {
		t.Fatal("input mutated")
	}
	// A late duplicate cannot remove the next operation.
	if again := receipt(t, got, sent.ID, ack, nil); !reflect.DeepEqual(again, got) {
		t.Fatal("duplicate receipt changed live state")
	}
}

func TestTaskReceiptCommitsOnlySentOperationAndPreservesSeriesProjections(t *testing.T) {
	for _, body := range []map[string]any{{"title": "renamed"}, {"category_ids": []int64{-3}}, {"start_time": receiptFixture().Tasks[0].StartTime}} {
		state := enqueue(t, receiptFixture(), "PUT", "/tasks/1", body, 7)
		state.Outbox[0].Sent = true
		op := state.Outbox[0]
		state = enqueue(t, state, "PATCH", "/tasks/1/status", map[string]string{"status": "completed", "instance_id": "one"}, 7)
		ack := op.Local
		ack.Revision = 8
		got := receipt(t, state, op.ID, ack, nil)
		if len(got.Next) != 2 || len(got.History.Items) != 0 || len(got.ReminderEvents) != 2 || len(got.Calendar.Events) != 2 {
			t.Fatal("ordinary series edit erased projections or committed later intent", got)
		}
		if len(View(got).History.Items) != 1 {
			t.Fatal("later intent no longer overlaid")
		}
	}
	state := enqueue(t, receiptFixture(), "PUT", "/tasks/1", map[string]any{"recurrence_rule": map[string]string{"freq": "weekly"}}, 7)
	state.Outbox[0].Sent = true
	ack := state.Outbox[0].Local
	ack.Revision = 8
	got := receipt(t, state, state.Outbox[0].ID, ack, nil)
	if len(got.Next) != 0 || len(got.ReminderEvents) != 0 || len(got.Calendar.Events) != 0 {
		t.Fatal("obsolete schedule expansion survived")
	}
}

func TestTaskReceiptInstanceTitleDescriptionAndStatus(t *testing.T) {
	state := enqueue(t, receiptFixture(), "PUT", "/tasks/1", map[string]string{"instance_id": "one", "occurrence_date": "2026-11-09", "title": "instance title", "description": "instance notes", "status": "completed"}, 7)
	state.Outbox[0].Sent = true
	ack := state.Tasks[0]
	ack.Revision = 8
	got := receipt(t, state, state.Outbox[0].ID, ack, nil)
	if len(got.Next) != 1 || got.Next[0].InstanceID != "two" || len(got.History.Items) != 1 || got.History.Items[0].Title != "instance title" || got.History.Items[0].Description != "instance notes" || got.History.Items[0].CompletedAt == nil {
		t.Fatal("incorrect scoped acknowledgement", got.Next, got.History)
	}
	for _, task := range got.Tasks {
		if task.ID == 1 && task.Title != "series" {
			t.Fatal("instance changed series")
		}
	}
	for _, events := range [][]api.CalendarEvent{got.ReminderEvents, got.Calendar.Events} {
		if events[0].Title != "instance title" || events[0].ExtendedProps.Description != "instance notes" || events[0].ExtendedProps.Status != "completed" || events[1].Title != "two" {
			t.Fatal("incorrect calendar overlay", events)
		}
	}
	if got.Calendar.SeriesRevisions[1] != 8 || got.History.NextCursor != 20 || !got.History.HasMore {
		t.Fatal("metadata lost")
	}
}

func TestTaskReceiptTemporaryIDAndOwnAckRevision(t *testing.T) {
	state := enqueue(t, storage.Cache{Tasks: []api.Task{{ID: 42, Title: "remote", Revision: 20}}, LocalAckRevisions: map[int64]int64{42: 9}}, "POST", "/tasks", map[string]string{"title": "new"}, 0)
	state.Outbox[0].Sent = true
	op := state.Outbox[0]
	key := state.ReminderKeys[-1]
	state = enqueue(t, state, "PUT", "/tasks/-1", map[string]string{"description": "later"}, 0)
	state = enqueue(t, state, "PATCH", "/tasks/-1/status", map[string]string{"status": "completed"}, 0)
	state.Outbox[2].Sent = true
	state = enqueue(t, state, "PUT", "/tasks/-1", map[string]string{"title": "different guard"}, 3)
	got := receipt(t, state, op.ID, api.Task{ID: 42, Revision: 8, Title: "receipt"}, nil)
	if len(got.Tasks) != 1 || got.Tasks[0].Revision != 20 || got.Tasks[0].Title != "remote" {
		t.Fatal("old creation receipt replaced canonical", got.Tasks)
	}
	if got.ReminderKeys[42] != key || got.ReminderKeys[-1] != "" || got.LocalAckRevisions[42] != 9 {
		t.Fatal("identity or monotonic receipt lost", got)
	}
	next := got.Outbox[0]
	if next.TaskID != 42 || next.Local.ID != 42 || next.Base.ID != 42 || next.Revision != 8 || next.Base.Revision != 8 || next.Local.Revision != 8 {
		t.Fatal("successor did not use this local receipt", next)
	}
	if !reflect.DeepEqual(got.Outbox[1], Clone(state).Outbox[2]) {
		t.Fatal("sent payload changed")
	}
	mapped := Clone(state).Outbox[3]
	mapped.TaskID, mapped.Base.ID, mapped.Local.ID = 42, 42, 42
	if !reflect.DeepEqual(got.Outbox[2], mapped) {
		t.Fatal("temporary ID mapping changed a different guard", got.Outbox[2])
	}
}

func TestEnqueueCoalescedPreservesIdentityAliasesAndDelta(t *testing.T) {
	state, err := EnqueueCoalesced(receiptFixture(), "PUT", "/tasks/1", map[string]any{"title": "draft", "category_ids": []int64{-3}}, 7)
	if err != nil {
		t.Fatal(err)
	}
	first := state.Outbox[0]
	state.Tasks[0].Description = "remote description"
	got, err := EnqueueCoalesced(state, "PUT", "/tasks/1", map[string]string{"title": "final"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Outbox) != 1 {
		t.Fatal("not coalesced")
	}
	op := got.Outbox[0]
	if op.ID != first.ID || !op.CreatedAt.Equal(first.CreatedAt) || !reflect.DeepEqual(op.Base, first.Base) || op.Local.Title != "final" || op.Local.Description != "remote description" || len(op.Local.Categories) != 1 || op.Local.Categories[0].ID != 5 {
		t.Fatal("lost identity, delta, or alias", op)
	}
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(op.Body, &fields)
	if len(fields) != 2 || string(fields["category_ids"]) != "[5]" {
		t.Fatal("merged whole snapshot instead of body delta", string(op.Body))
	}
	if len(state.Outbox) != 1 || state.Outbox[0].Local.Title != "draft" {
		t.Fatal("input mutated")
	}
}

func TestEnqueueCoalescedBoundaries(t *testing.T) {
	for _, name := range []string{"sent", "rejected", "conflict", "instance", "date", "revision", "other_task", "interleaved", "method", "scope"} {
		t.Run(name, func(t *testing.T) {
			body := map[string]string{"instance_id": "one", "occurrence_date": "2026-11-09", "title": "draft"}
			state := enqueue(t, receiptFixture(), "PUT", "/tasks/1", body, 7)
			path, method, rev := "/tasks/1", "PUT", int64(7)
			switch name {
			case "sent":
				state.Outbox[0].Sent = true
			case "rejected", "conflict":
				state.Outbox[0].State = name
			case "instance":
				body["instance_id"] = "two"
			case "date":
				body["occurrence_date"] = "2026-11-10"
			case "revision":
				rev = 8
			case "other_task":
				path = "/tasks/2"
			case "interleaved":
				state = enqueue(t, state, "PUT", "/tasks/2", map[string]string{"title": "other"}, 3)
			case "method":
				method, path = "PATCH", "/tasks/1/status"
			case "scope":
				delete(body, "instance_id")
				delete(body, "occurrence_date")
			}
			before := Clone(state)
			got, err := EnqueueCoalesced(state, method, path, body, rev)
			if err != nil {
				t.Fatal(err)
			}
			if len(got.Outbox) != len(state.Outbox)+1 || !reflect.DeepEqual(got.Outbox[:len(state.Outbox)], before.Outbox) {
				t.Fatal("crossed coalescing boundary", got.Outbox)
			}
		})
	}
}

func TestTaskReceiptFailureRollsBackOnlyStatusInItsScope(t *testing.T) {
	for _, instance := range []bool{false, true} {
		for _, status := range []int{400, 409, 404, 408, 429, 503} {
			state := receiptFixture()
			body := map[string]string{"status": "completed", "description": "keep edit"}
			if instance {
				body["instance_id"] = "one"
			}
			state = enqueue(t, state, "PUT", "/tasks/1", body, 7)
			state.Outbox[0].Sent = true
			before := Clone(state)
			requestErr := &api.Error{Status: status}
			got, err := ApplyTaskReceipt(state, state.Outbox[0].ID, api.Task{}, requestErr)
			permanent := status < 500 && status != 408 && status != 429
			if err != nil {
				t.Fatal("incorrect error classification", err)
			}
			want := "pending"
			if permanent {
				want = "rejected"
				if status == 409 {
					want = "conflict"
				}
			}
			if got.Outbox[0].State != want || got.Outbox[0].Failure == "" || !got.Outbox[0].Sent {
				t.Fatal("failure not retained", got.Outbox)
			}
			expected := Clone(before)
			expected.Outbox = got.Outbox
			if !reflect.DeepEqual(got, expected) || !reflect.DeepEqual(Clone(state), before) {
				t.Fatal("failure modified canonical or input")
			}
			view := View(got)
			wantStatus := "completed"
			if permanent {
				wantStatus = "pending"
			}
			if instance {
				events := view.Calendar.Events
				if events[0].ExtendedProps.Status != wantStatus || events[0].ExtendedProps.Description != "keep edit" || events[1].ExtendedProps.Status != "pending" || view.Tasks[0].Status != "pending" {
					t.Fatal("failure affected wrong scope", view)
				}
				if permanent && (len(view.Next) != 2 || len(view.History.Items) != 0 || view.Next[1].CompletedAt != nil) {
					t.Fatal("failed instance remains checked", view)
				}
			} else {
				for _, task := range view.Tasks {
					if task.ID == 1 && (task.Status != wantStatus || task.Description != "keep edit" || permanent && task.CompletedAt != nil) {
						t.Fatal("failed status still overlaid", task)
					}
				}
				if len(view.Next) != 2 || view.Next[0].Status != "pending" {
					t.Fatal("series failure affected instance")
				}
			}
		}
	}
}

func TestTaskReceiptTransientNetworkErrorIsPersistable(t *testing.T) {
	state := enqueue(t, receiptFixture(), "PUT", "/tasks/1", map[string]string{"title": "draft"}, 7)
	state.Outbox[0].Sent = true
	got := receipt(t, state, state.Outbox[0].ID, api.Task{}, errors.New("connection lost"))
	if got.Outbox[0].State != "pending" || got.Outbox[0].Failure != "connection lost" || !got.Outbox[0].Sent || View(got).Tasks[1].Title != "draft" {
		t.Fatal("transient request cannot be persisted and retried", got.Outbox)
	}
	if invalid, err := ApplyTaskReceipt(state, state.Outbox[0].ID, api.Task{}, nil); err == nil || !reflect.DeepEqual(invalid, Clone(state)) {
		t.Fatal("invalid success receipt consumed intent")
	}
}

func TestEnqueueCoalescedSameInstanceAndReceiptWithNewerSeries(t *testing.T) {
	state := receiptFixture()
	var err error
	state, err = EnqueueCoalesced(state, "PUT", "/tasks/1", map[string]string{"instance_id": "one", "occurrence_date": "2026-11-09", "title": "renamed"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	id := state.Outbox[0].ID
	state, err = EnqueueCoalesced(state, "PUT", "/tasks/1", map[string]string{"instance_id": "one", "occurrence_date": "2026-11-09", "description": "notes"}, 7)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Outbox) != 1 || state.Outbox[0].ID != id {
		t.Fatal("same instance not coalesced")
	}
	state.Outbox[0].Sent = true
	ack := state.Tasks[0]
	ack.Revision = 8
	state.Tasks[0].Revision, state.Tasks[0].Title = 12, "newer series"
	state.Calendar.SeriesRevisions[1] = 12
	got := receipt(t, state, id, ack, nil)
	if got.Tasks[0].Revision != 12 || got.Tasks[0].Title != "newer series" || got.Calendar.SeriesRevisions[1] != 12 || got.LocalAckRevisions[1] != 8 {
		t.Fatal("receipt replaced newer canonical or guessed local revision")
	}
	for _, occurrence := range got.Next {
		if occurrence.InstanceID == "one" && (occurrence.Title != "one" || occurrence.Description != "") {
			t.Fatal("stale receipt overwrote the newer projection", occurrence)
		}
		if occurrence.InstanceID == "two" && occurrence.Title != "two" {
			t.Fatal("receipt affected another instance")
		}
	}
}

func TestTaskReceiptDelete404AndUnsentGuard(t *testing.T) {
	state := enqueue(t, receiptFixture(), "DELETE", "/tasks/1", nil, 7)
	if got, err := ApplyTaskReceipt(state, state.Outbox[0].ID, api.Task{}, nil); err == nil || !reflect.DeepEqual(got, Clone(state)) {
		t.Fatal("accepted an unsent receipt")
	}
	state.Outbox[0].Sent = true
	got := receipt(t, state, state.Outbox[0].ID, api.Task{}, &api.Error{Status: 404})
	if len(got.Outbox) != 0 || len(got.Tasks) != 1 || got.Tasks[0].ID != 2 {
		t.Fatal("DELETE 404 was not acknowledged", got)
	}
}
