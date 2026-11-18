package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func interactionFixture(t *testing.T) *App {
	t.Helper()
	a := New(storage.Store{Dir: t.TempDir()})
	a.client, _ = api.New(api.DefaultServer, "test-token")
	t.Cleanup(a.Close)
	a.session = api.Session{Server: api.DefaultServer, User: api.User{ID: 1, Timezone: "UTC"}}
	a.categories = []api.Category{{ID: 1, Name: "A"}, {ID: 2, Name: "B"}, {ID: 3, Name: "C"}, {ID: 4, Name: "Later"}}
	task := api.Task{ID: 7, Title: "keep title", Description: "keep description", Status: "pending", Revision: 9, Categories: []api.Category{a.categories[0], a.categories[2]}}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{task}, Categories: a.categories})
	return a
}

func TestTaskInteractionRapidStatusAndInstanceIsolation(t *testing.T) {
	a := interactionFixture(t)
	now := time.Now()
	first := a.tasks[0]
	first.InstanceID, first.OccurrenceDate = "7_20261110", "2026-11-10"
	second := first
	second.InstanceID, second.OccurrenceDate = "7_20261111", "2026-11-11"
	a.interaction.recordStatus(first, "completed", "one", now)
	a.interaction.recordStatus(second, "completed", "other-instance", now)
	// Clicking the still visible checked row reverses only that instance.
	completed := first
	completed.Status = "completed"
	a.interaction.recordStatus(completed, "pending", "two", now.Add(time.Millisecond))
	a.taskIntentFailed(storage.Mutation{ID: "one"}, errors.New("late rejection"))
	rows := a.interactionTasks([]api.Task{first, second}, "all", "", now.Add(100*time.Millisecond))
	if len(rows) != 2 || taskRowKey(rows[0]) != taskRowKey(first) || rows[0].Status != "pending" || rows[1].Status != "completed" {
		t.Fatalf("late failure changed newer intent: %+v", rows)
	}
	a.taskIntentFailed(storage.Mutation{ID: "other-instance"}, errors.New("instance rejection"))
	rows = a.interactionTasks([]api.Task{first, second}, "all", "", now.Add(time.Second))
	if len(rows) != 2 || rows[1].Status != "pending" {
		t.Fatalf("failed instance was not restored: %+v", rows)
	}
	if a.busy {
		t.Fatal("interaction set global busy")
	}
}

func TestTaskInteractionCheckedFeedbackAndReducedMotion(t *testing.T) {
	for _, reduced := range []bool{false, true} {
		t.Run(map[bool]string{false: "feedback", true: "reduced"}[reduced], func(t *testing.T) {
			a := interactionFixture(t)
			now := time.Now()
			task := a.tasks[0]
			a.interaction.reduceMotion = reduced
			a.interaction.recordStatus(task, "completed", "status", now)
			task.Status = "completed"
			rows := a.interactionTasks([]api.Task{task}, "all", "", now.Add(100*time.Millisecond))
			if reduced {
				if len(rows) != 0 {
					t.Fatal("reduced motion retained departing row")
				}
			} else if len(rows) != 1 || rows[0].Status != "completed" {
				t.Fatal("missing checked feedback", rows)
			}
			if got := a.interactionTasks([]api.Task{task}, "all", "", now.Add(181*time.Millisecond)); len(got) != 0 {
				t.Fatal("row did not leave filter", got)
			}
			if got := a.interactionTasks([]api.Task{task}, "completed", "", now.Add(time.Second)); len(got) != 1 {
				t.Fatal("completed view hid row", got)
			}
		})
	}
}

func TestTaskInteractionRejectedOutboxRestoresStatus(t *testing.T) {
	a := interactionFixture(t)
	before := a.tasks[0]
	a.interaction.recordStatus(before, "completed", "rejected", time.Now())
	a.tasks[0].Status = "completed"
	a.cache.Outbox = []storage.Mutation{{ID: "rejected", State: "conflict", Failure: "revision changed"}}
	rows := a.interactionTasks(a.tasks, "all", "", time.Now().Add(time.Second))
	if len(rows) != 1 || rows[0].Status != "pending" || a.failure == "" {
		t.Fatal("conflict shown as success", rows, a.failure)
	}
}

func TestTaskCategoryDeltaAndUndoMerge(t *testing.T) {
	cases := []struct {
		name           string
		ids            []int64
		source, target int64
		want           []int64
	}{
		{"replace source only", []int64{1, 3}, 1, 2, []int64{3, 2}},
		{"aggregate adds", []int64{1, 3}, 0, 2, []int64{1, 3, 2}},
		{"same target", []int64{1, 3}, 1, 1, []int64{1, 3}},
		{"already target aggregate", []int64{1, 2, 3}, 0, 2, []int64{1, 2, 3}},
		{"existing target still removes source", []int64{1, 2, 3}, 1, 2, []int64{2, 3}},
		{"invalid target", []int64{1, 3}, 1, 0, []int64{1, 3}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			original := append([]int64{}, tc.ids...)
			delta := categoryDropDelta(tc.ids, tc.source, tc.target)
			if got := applyCategoryDelta(tc.ids, delta); !reflect.DeepEqual(got, tc.want) {
				t.Fatal(got, tc.want)
			}
			if !reflect.DeepEqual(original, tc.ids) {
				t.Fatal("mutated source collection")
			}
		})
	}
	delta := categoryDropDelta([]int64{1, 3}, 1, 2)
	// Another client removes C and adds Later after this move. Undo preserves it.
	got := applyCategoryDelta([]int64{2, 4}, inverseCategoryDelta(delta))
	if !sameCategorySet(got, []int64{1, 4}) {
		t.Fatal("undo overwrote later categories", got)
	}
}

func TestTaskCategoryPersistenceIdentityPartialBodyAndUndo(t *testing.T) {
	a := interactionFixture(t)
	task := a.tasks[0]
	delta := categoryDropDelta(a.taskCategoryIDs(task), 1, 2)
	op, err := a.persistCategoryDelta(task, delta)
	if err != nil {
		t.Fatal(err)
	}
	if op.Method != "PUT" || op.TaskID != task.ID || op.Suffix != "" || op.Revision != 9 {
		t.Fatal("move must update original task", op)
	}
	var body map[string]json.RawMessage
	if err = json.Unmarshal(op.Body, &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 1 || body["category_ids"] == nil {
		t.Fatal("category move sent task snapshot", string(op.Body))
	}
	if len(a.tasks) != 1 || a.tasks[0].ID != 7 || a.tasks[0].Title != task.Title || a.tasks[0].Description != task.Description {
		t.Fatal("move copied or overwrote task", a.tasks)
	}
	saved, err := a.store.Cache(a.session.Server, a.session.User.ID)
	if err != nil || len(saved.Outbox) != 1 || saved.Outbox[0].ID != op.ID {
		t.Fatal("intent not atomically persisted", saved.Outbox, err)
	}
	// Model a fresh remote projection with later content and category changes.
	latest := a.tasks[0]
	latest.Title = "later title"
	date := time.Date(2026, 12, 3, 10, 0, 0, 0, time.UTC)
	latest.StartTime = &date
	latest.Revision = 12
	latest.Categories = []api.Category{a.categories[1], a.categories[3]}
	a.adoptCache(storage.Cache{Server: a.session.Server, UserID: 1, Tasks: []api.Task{latest}, Categories: a.categories})
	_, err = a.persistCategoryDelta(latest, inverseCategoryDelta(delta))
	if err != nil {
		t.Fatal(err)
	}
	if a.tasks[0].Title != "later title" || a.tasks[0].StartTime == nil || !a.tasks[0].StartTime.Equal(date) || !sameCategorySet(a.taskCategoryIDs(a.tasks[0]), []int64{1, 4}) {
		t.Fatal("undo lost later edits", a.tasks[0])
	}
	if len(a.tasks) != 1 || a.cache.Outbox[0].Method == "POST" {
		t.Fatal("undo duplicated task")
	}
}

func TestTaskCategoryTemporaryAliasesAndFailure(t *testing.T) {
	a := interactionFixture(t)
	a.cache.CategoryAliases = map[int64]int64{-1: -2, -2: 1, -3: 2}
	if resolveInteractionCategory(-1, a.cache.CategoryAliases) != 1 {
		t.Fatal("alias chain not resolved")
	}
	task := a.tasks[0]
	delta := a.resolvedDelta(categoryDelta{Removed: []int64{-1}, Added: []int64{-3}})
	op, err := a.persistCategoryDelta(task, delta)
	if err != nil {
		t.Fatal(err)
	}
	// Undo resolves IDs again, allowing a temporary category to be acknowledged.
	if !sameCategorySet(applyCategoryDelta(a.taskCategoryIDs(a.tasks[0]), a.resolvedDelta(inverseCategoryDelta(delta))), []int64{1, 3}) {
		t.Fatal("alias undo failed")
	}
	a.taskIntentFailed(op, errors.New("category rejected"))
	rows := a.interactionTasks(a.tasks, "category:1", "", time.Now())
	if len(rows) != 1 || !sameCategorySet(a.taskCategoryIDs(rows[0]), []int64{1, 3}) {
		t.Fatal("failed move not restored", rows)
	}
}

func TestTaskInteractionPersistenceFailureLeavesStateUntouched(t *testing.T) {
	a := interactionFixture(t)
	blocker := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(blocker, []byte("not a directory"), 0600); err != nil {
		t.Fatal(err)
	}
	a.store.Dir = blocker
	before := syncer.Clone(a.cache)
	if _, err := a.persistCategoryDelta(a.tasks[0], categoryDelta{Added: []int64{2}}); err == nil {
		t.Fatal("expected persistence failure")
	}
	if !reflect.DeepEqual(before, syncer.Clone(a.cache)) || a.interaction.undo != nil || a.busy {
		t.Fatal("failed write applied interaction")
	}
}

func TestTaskInteractionStatusLocalFailureRetainsSelectionAndFeedback(t *testing.T) {
	a := interactionFixture(t)
	task := a.tasks[0]
	a.selectedTaskID = task.ID
	blocker := filepath.Join(t.TempDir(), "blocker")
	if err := os.WriteFile(blocker, []byte("file"), 0600); err != nil {
		t.Fatal(err)
	}
	a.store.Dir = blocker
	a.setTaskStatus(task, "completed")
	if a.failure == "" || len(a.cache.Outbox) != 0 || len(a.interaction.statuses) != 0 || a.tasks[0].Status != "pending" || a.selectedTaskID != task.ID || a.busy {
		t.Fatal("local status write failure applied state", a.failure, a.tasks, a.interaction)
	}
}

func TestTaskInteractionReceiptDistinguishesTransientAndRejected(t *testing.T) {
	for _, code := range []int{0, 408, 429, 500, 400, 409} {
		t.Run(fmt.Sprint(code), func(t *testing.T) {
			a := interactionFixture(t)
			task := a.tasks[0]
			a.interaction.recordStatus(task, "completed", "receipt", time.Now())
			op := storage.Mutation{ID: "receipt", State: "pending"}
			var requestErr error = &api.ConnectionError{Cause: errors.New("offline")}
			if code != 0 {
				requestErr = &api.Error{Status: code}
			}
			a.taskInteractionReceipt(op, requestErr)
			entry := a.interaction.statuses[taskRowKey(task)]
			terminal := code == 400 || code == 409
			if terminal {
				if !entry.failed || entry.status != "pending" || !entry.until.IsZero() || a.failure == "" {
					t.Fatal("terminal failure retained checked feedback", entry, a.failure)
				}
			} else if entry.failed || entry.status != "completed" || a.failure != "" || !strings.Contains(a.message, "等待") {
				t.Fatal("transient failure discarded local intent", entry, a.failure, a.message)
			}
		})
	}
}

func TestTaskInteractionBothRapidIntentsFailInEitherOrder(t *testing.T) {
	for _, reverse := range []bool{false, true} {
		t.Run(fmt.Sprint(reverse), func(t *testing.T) {
			a := interactionFixture(t)
			task := a.tasks[0]
			a.interaction.recordStatus(task, "completed", "first", time.Now())
			task.Status = "completed"
			a.interaction.recordStatus(task, "pending", "second", time.Now())
			ops := []string{"first", "second"}
			if reverse {
				ops = []string{"second", "first"}
			}
			for _, id := range ops {
				a.taskInteractionReceipt(storage.Mutation{ID: id}, &api.Error{Status: 400})
			}
			if got := a.interaction.statuses[taskRowKey(task)]; got.status != "pending" || !got.failed {
				t.Fatal("failed chain restored intermediate intent", got)
			}
		})
	}
}

func TestTaskCategoryInvalidAndSameTargetDoNotWrite(t *testing.T) {
	a := interactionFixture(t)
	for _, target := range []int64{0, 999, 1} {
		a.applyTaskCategoryDrop(taskCategoryDrag{TaskID: 7, SourceCategory: 1}, target)
	}
	if len(a.cache.Outbox) != 0 || len(a.tasks) != 1 || a.interaction.undo != nil {
		t.Fatal("invalid or same target wrote a mutation", a.cache.Outbox)
	}
}

func TestTaskCategoryCoalescedRejectionRestoresNetDelta(t *testing.T) {
	a := interactionFixture(t)
	first, err := a.persistCategoryDelta(a.tasks[0], categoryDelta{Removed: []int64{1}, Added: []int64{2}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := a.persistCategoryDelta(a.tasks[0], categoryDelta{Removed: []int64{2}, Added: []int64{4}})
	if err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID || len(a.cache.Outbox) != 1 {
		t.Fatal("fixture should coalesce adjacent unsent category PUTs")
	}
	a.taskInteractionReceipt(second, &api.Error{Status: 400})
	task, ok := a.interactionTask(7)
	if !ok || !sameCategorySet(a.taskCategoryIDs(task), []int64{1, 3}) {
		t.Fatal("coalesced rejection restored only last gesture", task)
	}
}

func TestTaskCategoryActualUndoKeepsLaterContent(t *testing.T) {
	a := interactionFixture(t)
	a.applyTaskCategoryDrop(taskCategoryDrag{TaskID: 7, SourceCategory: 1}, 2)
	if a.interaction.undo == nil {
		t.Fatal(a.failure)
	}
	// Simulate the move being acknowledged and a later remote edit arriving.
	latest := a.tasks[0]
	latest.Title = "other client"
	latest.Categories = []api.Category{a.categories[1], a.categories[3]}
	latest.Revision++
	a.adoptCache(storage.Cache{Server: a.session.Server, UserID: 1, Tasks: []api.Task{latest}, Categories: a.categories})
	a.undoTaskCategoryDrop()
	if a.interaction.undo != nil || a.tasks[0].Title != "other client" || !sameCategorySet(a.taskCategoryIDs(a.tasks[0]), []int64{1, 4}) {
		t.Fatal(a.failure, a.tasks[0])
	}
	if len(a.tasks) != 1 || len(a.cache.Outbox) != 1 || a.cache.Outbox[0].Method != "PUT" {
		t.Fatal("undo copied task", a.cache.Outbox)
	}
}

func TestTaskInteractionStatusPersistsRealInstanceIdentity(t *testing.T) {
	a := interactionFixture(t)
	task := a.tasks[0]
	task.InstanceID, task.OccurrenceDate = "7_20261110", "2026-11-10"
	task.RecurrenceRule = json.RawMessage(`{"freq":"daily"}`)
	a.tasks[0].RecurrenceRule = task.RecurrenceRule
	a.cache.Tasks[0].RecurrenceRule = task.RecurrenceRule
	a.selectedOccurrence = &task
	a.selectedTaskID = task.ID
	a.setTaskStatus(task, "completed")
	if a.selectedOccurrence == nil || taskRowKey(*a.selectedOccurrence) != taskRowKey(task) || a.selectedTaskID != task.ID {
		t.Fatal("completion cleared selection")
	}
	if len(a.cache.Outbox) != 1 {
		t.Fatal(a.failure, a.cache.Outbox)
	}
	var payload map[string]string
	_ = json.Unmarshal(a.cache.Outbox[0].Body, &payload)
	if payload["instance_id"] != task.InstanceID || payload["occurrence_date"] != task.OccurrenceDate || payload["status"] != "completed" {
		t.Fatal(payload)
	}
	if a.busy || a.tasks[0].Status != "pending" {
		t.Fatal("instance status altered series or global busy")
	}
}
