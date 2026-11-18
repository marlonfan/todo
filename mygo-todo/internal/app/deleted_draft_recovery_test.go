package app

import (
	"encoding/json"
	"github.com/egoist/mygo/ui"
	"reflect"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestDeletedRecurringDraftSaveAsNewKeepsRawRuleAndRetry(t *testing.T) {
	for _, invalid := range []bool{false, true} {
		store := storage.Store{Dir: t.TempDir()}
		a := New(store)
		a.client, _ = api.New(api.DefaultServer, "")
		a.cache.Server = api.DefaultServer
		a.cache.UserID = 42
		a.session.Server = api.DefaultServer
		a.session.User.ID = 42
		now := time.Now().Truncate(time.Minute)
		rule := json.RawMessage(`{"freq":"monthly","interval":2,"byday":["2SU"],"bymonth":[3,11],"count":8,"future_extension":{"preserve":true}}`)
		a.editTaskNow(api.Task{ID: 7, Revision: 9, Title: "旧系列", StartTime: &now, RecurrenceRule: rule, Status: "pending"})
		a.draft.Description = "远端删除后保留的输入"
		a.taskDraftOrphaned = true
		if invalid {
			a.draft.Title = ""
		}
		tt := ui.NewTester(a.view, 1280, 900)
		if err := tt.Click("另存为新任务"); err != nil {
			t.Fatal(err)
		}
		if invalid {
			if a.busy || a.failure != "任务标题应为 1–200 个字符" || a.draft.Description != "远端删除后保留的输入" {
				t.Fatal("validation discarded recovered draft", a.failure)
			}
			a.draft.Title = "恢复后的系列"
			a.saveTask()
		}
		var op storage.Mutation
		deadline := time.Now().Add(3 * time.Second)
		for time.Now().Before(deadline) {
			state, err := store.Cache(api.DefaultServer, 42)
			if err == nil && len(state.Outbox) == 1 {
				op = state.Outbox[0]
				break
			}
			time.Sleep(time.Millisecond * 5)
		}
		if op.Method != "POST" || op.TaskID >= 0 {
			t.Fatal("recovery did not persist a new local task", op)
		}
		var body map[string]any
		var expected any
		if err := json.Unmarshal(op.Body, &body); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(rule, &expected); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(body["recurrence_rule"], expected) || body["description"] != "远端删除后保留的输入" {
			t.Fatal("recovery lost raw recurrence or description", body)
		}
		a.Close()
	}
}
