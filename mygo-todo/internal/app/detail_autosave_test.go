package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func autosaveFixture(t *testing.T) *App {
	t.Helper()
	a := New(storage.Store{Dir: t.TempDir()})
	t.Cleanup(a.Close)
	a.client, _ = api.New(api.DefaultServer, "")
	a.adoptCache(storage.Cache{Tasks: []api.Task{{ID: 1, Title: "原生标题", Description: "远端原描述", Status: "pending", Revision: 1}, {ID: 2, Title: "第二项", Description: "另一任务", Status: "pending", Revision: 7}}})
	a.editTaskNow(a.tasks[0])
	return a
}

func TestAutosaveDeltaReceiptCannotReplaceLaterInputOrOtherTask(t *testing.T) {
	a := autosaveFixture(t)
	a.taskTitleEditing = true
	a.draft.Title = "第一次标题"
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	if a.busy || !a.taskTitleEditing || len(a.cache.Outbox) != 1 {
		t.Fatal("save reset focus/global busy", a.busy, a.taskTitleEditing)
	}
	var body map[string]any
	_ = json.Unmarshal(a.cache.Outbox[0].Body, &body)
	if len(body) != 1 || body["title"] != "第一次标题" {
		t.Fatal("autosave sent unrelated fields", body)
	}
	sent := a.cache.Outbox[0]
	a.cache.Outbox[0].Sent = true
	a.draft.Description = "后来仍在输入"
	a.localWrites.reply = &taskWriteReply{op: sent, task: api.Task{ID: 1, Title: "第一次标题", Description: "远端原描述", Status: "pending", Revision: 2}}
	a.drainTaskReceipts()
	if a.draft.Description != "后来仍在输入" || !a.taskDraftDirty() || a.draft.Task.Revision != 2 {
		t.Fatal("receipt replaced new input", a.draft)
	}
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	sent = a.cache.Outbox[0]
	a.cache.Outbox[0].Sent = true
	a.editTaskNow(a.tasks[0])
	if a.draft.Task.ID != 2 {
		t.Fatal("fixture lost task 2")
	}
	a.draft.Title = "第二项新输入"
	a.localWrites.reply = &taskWriteReply{op: sent, task: api.Task{ID: 1, Title: "第一次标题", Description: "后来仍在输入", Status: "pending", Revision: 3}}
	a.drainTaskReceipts()
	if a.draft.Task.ID != 2 || a.draft.Title != "第二项新输入" {
		t.Fatal("late receipt crossed editor identity", a.draft)
	}
}

func TestAutosaveSwitchDurablyFlushesDeltaWithoutDiscardDialog(t *testing.T) {
	a := autosaveFixture(t)
	a.draft.Title = "切换前已输入"
	a.openTask(a.tasks[1])
	if a.taskDiscardConfirm || a.draft.Task.ID != 2 {
		t.Fatal("valid existing draft did not switch in place")
	}
	cache, err := a.store.Cache("", 0)
	if err != nil || len(cache.Outbox) != 1 {
		t.Fatal("switch lost durable draft", err, cache.Outbox)
	}
	projected := syncer.View(cache)
	var savedTask api.Task
	for _, task := range projected.Tasks {
		if task.ID == 1 {
			savedTask = task
		}
	}
	if savedTask.Title != "切换前已输入" || savedTask.Description != "远端原描述" {
		t.Fatal(projected.Tasks)
	}
}

func TestAutosaveCompositionDoesNotPersistIntermediateNativeText(t *testing.T) {
	a := autosaveFixture(t)
	a.taskTitleEditing = true
	tt := ui.NewTester(a.view, 1280, 900)
	if err := tt.Click("任务标题"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Ctrl, ui.KeyA)
	tt.Compose("组合输入", 2)
	if !a.autosave.composing {
		t.Fatal("native composition not observed")
	}
	if a.flushDetailAutosave() || len(a.cache.Outbox) != 0 {
		t.Fatal("composition saved an intermediate payload")
	}
	// Finish native composition with actual text input; explicit flush now stores it.
	tt.Compose("", 0)
	tt.Type("完成输入")
	tt.Frame()
	if a.autosave.composing {
		t.Fatal("composition did not finish")
	}
	a.draft.Title = "完成输入"
	if !a.flushDetailAutosave() || len(a.cache.Outbox) != 1 {
		t.Fatal(a.autosave.failure)
	}
}

func TestAutosaveLocalFailurePreservesInputAndValidation(t *testing.T) {
	a := autosaveFixture(t)
	bad := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(bad, []byte("occupied"), 0600); err != nil {
		t.Fatal(err)
	}
	a.store.Dir = bad
	a.draft.Title = "本机失败保留"
	if a.flushDetailAutosave() || !a.taskDraftDirty() || a.draft.Title != "本机失败保留" || len(a.cache.Outbox) != 0 {
		t.Fatal("local failure discarded input")
	}
	a.draft.Title = ""
	if a.flushDetailAutosave() || !a.taskDraftDirty() {
		t.Fatal("invalid draft saved")
	}
	a.autosave.composing = true
	a.requestTaskTransition(func() { t.Fatal("composition unmounted editor") })
	if a.draft.Title != "" {
		t.Fatal("transition lost input")
	}
}

func TestAutosaveDoesNotAuthorizeUnseenRemoteVersion(t *testing.T) {
	a := autosaveFixture(t)
	a.draft.Title = "本机仅标题"
	state := syncer.Clone(a.cache)
	state.Tasks[0].Description = "他端新描述"
	state.Tasks[0].Revision = 2
	a.adoptCache(state)
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	op := a.cache.Outbox[0]
	if op.Revision != 1 {
		t.Fatal("remote pull authorized stale draft", op.Revision)
	}
	view := syncer.View(a.cache)
	var local api.Task
	for _, task := range view.Tasks {
		if task.ID == 1 {
			local = task
		}
	}
	if local.Description != "他端新描述" {
		t.Fatal("delta overlay replaced unedited remote field")
	}
	a.busy = true
	a.draft.Description = "网络读写期间输入"
	before := len(a.cache.Outbox)
	if a.flushDetailAutosave() || len(a.cache.Outbox) != before || a.draft.Description != "网络读写期间输入" {
		t.Fatal("legacy write raced local intent")
	}
	a.busy = false
}
