package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func TestDirtyOfflineCreationReconcilesIdentityAndPreservesConflictBase(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.session.User = api.User{ID: 1}
	category := api.Category{ID: 7, Name: "工作"}
	state, err := syncer.Enqueue(storage.Cache{Categories: []api.Category{category}}, "POST", "/tasks", map[string]any{
		"title": "离线标题", "description": "离线描述", "category_ids": []int64{7},
	}, 0)
	if err != nil {
		t.Fatal(err)
	}
	a.adoptCache(state)
	local := a.tasks[0]
	a.editTaskNow(local)
	baseline := *a.taskDraftBase
	a.draft.Title, a.draft.Description, a.draft.Priority = "继续输入的标题", "尚未保存的描述", "高"
	a.draft.HasStart = true
	a.draft.Start = time.Date(2026, 11, 9, 9, 30, 0, 0, time.UTC)
	a.draft.Categories[7] = false
	wantDraft := a.draft

	canonical := local
	canonical.ID, canonical.Revision = 42, 2
	canonical.Title, canonical.Description = "服务端标题", "服务端描述"
	confirmed := storage.Cache{
		Tasks: []api.Task{canonical}, Categories: []api.Category{category},
		ReminderKeys:      map[int64]string{42: state.ReminderKeys[local.ID], 99: "local:unrelated"},
		LocalAckRevisions: map[int64]int64{42: 1},
	}
	a.adoptCache(confirmed)
	wantDraft.Task.ID, wantDraft.Task.Revision = 42, 1
	baseline.Task.ID, baseline.Task.Revision = 42, 1
	if a.selectedTaskID != 42 || !reflect.DeepEqual(a.draft, wantDraft) || !reflect.DeepEqual(*a.taskDraftBase, baseline) {
		t.Fatalf("identity reconciliation changed draft or baseline: selected=%d draft=%+v base=%+v", a.selectedTaskID, a.draft, a.taskDraftBase)
	}
	if !a.taskDraftDirty() || a.taskDraftOrphaned {
		t.Fatal("acknowledged creation must remain dirty and editable")
	}

	// A later remote edit must not silently advance the draft's revision or
	// replace the content the user originally saw in conflict comparison.
	confirmed.Tasks[0].Revision = 3
	confirmed.Tasks[0].Description = "其他设备再次修改"
	a.adoptCache(confirmed)
	if !reflect.DeepEqual(a.draft, wantDraft) || !reflect.DeepEqual(*a.taskDraftBase, baseline) {
		t.Fatal("later remote read rebased the unsaved editor")
	}
	body, err := a.draft.payload()
	if err != nil {
		t.Fatal(err)
	}
	queued, err := a.enqueueTaskIntent("PUT", fmt.Sprintf("/tasks/%d", a.draft.Task.ID), body, a.draft.Task.Revision)
	if err != nil {
		t.Fatal(err)
	}
	if len(queued.Outbox) != 1 {
		t.Fatalf("expected one update, got %+v", queued.Outbox)
	}
	op := queued.Outbox[0]
	if op.Method != "PUT" || op.TaskID != 42 || op.Revision != 1 || !reflect.DeepEqual(op.Base, baseline.Task) {
		t.Fatalf("update lost canonical identity or original conflict base: %+v", op)
	}
	if op.Local.Title != wantDraft.Title || op.Local.Description != wantDraft.Description || op.Local.Priority != 1 || op.Local.StartTime == nil || !op.Local.StartTime.Equal(wantDraft.Start) || len(op.Local.Categories) != 0 {
		t.Fatalf("update lost unsaved fields: %+v", op.Local)
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(op.Body, &payload); err != nil {
		t.Fatal(err)
	}
	if string(payload["category_ids"]) != "[]" {
		t.Fatalf("category deselection lost: %s", op.Body)
	}
}

func TestCleanTaskRemoteDeletionClosesEditor(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	task := api.Task{ID: 11, Title: "远端删除的任务", Status: "pending", Revision: 2}
	a.adoptCache(storage.Cache{Tasks: []api.Task{task}})
	a.editTaskNow(task)
	a.adoptCache(storage.Cache{})
	if a.editing || a.taskEditorInline || a.taskDetailOpen || a.selectedTaskID != 0 || a.taskDraftBase != nil || a.taskDraftOrphaned {
		t.Fatalf("deleted clean task retained selection: editing=%v selected=%d base=%+v", a.editing, a.selectedTaskID, a.taskDraftBase)
	}
}

func TestDirtyTaskRemoteDeletionPreservesDraftAsOrphan(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	task := api.Task{ID: 11, Title: "原始标题", Description: "原始描述", Status: "pending", Revision: 2}
	a.adoptCache(storage.Cache{Tasks: []api.Task{task}})
	a.editTaskNow(task)
	a.draft.Title, a.draft.Description, a.draft.Reminder = "未保存的标题", "未保存的描述", "不提醒"
	wantDraft, wantBase := a.draft, *a.taskDraftBase
	for i := 0; i < 2; i++ {
		a.adoptCache(storage.Cache{})
		if !a.editing || a.selectedTaskID != 11 || !a.taskDraftOrphaned || !a.taskDraftDirty() {
			t.Fatalf("deleted dirty editor lost recovery state: editing=%v selected=%d orphaned=%v", a.editing, a.selectedTaskID, a.taskDraftOrphaned)
		}
		if !reflect.DeepEqual(a.draft, wantDraft) || !reflect.DeepEqual(*a.taskDraftBase, wantBase) {
			t.Fatal("remote deletion overwrote draft or conflict baseline")
		}
		if !strings.Contains(a.failure, "已被删除") || !strings.Contains(a.failure, "另存为新任务") {
			t.Fatalf("missing actionable deletion failure: %q", a.failure)
		}
	}
}

func TestUnsavedNewTaskIsNotOrphanedByRefresh(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.newTaskNow()
	a.draft.Title = "尚未保存的新任务"
	want := a.draft
	a.adoptCache(storage.Cache{})
	if !a.editing || a.taskDraftOrphaned || !reflect.DeepEqual(a.draft, want) {
		t.Fatal("refresh treated a new draft as a deleted task")
	}
}

func TestDirtyOfflineCreationRefreshKeepsReceiptRevision(t *testing.T) {
	for _, queuedPUT := range []bool{false, true} {
		t.Run(fmt.Sprintf("queuedPUT=%v", queuedPUT), func(t *testing.T) {
			ackRevision := int64(1)
			if queuedPUT {
				ackRevision = 2
			}
			remote := api.Task{ID: 42, Title: "已保存的标题", Description: "其他设备的修改", Status: "pending", Revision: ackRevision + 1}
			var writes, conflicts, reads atomic.Int64
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch {
				case r.Method == "POST" && r.URL.Path == "/api/tasks":
					writes.Add(1)
					_ = json.NewEncoder(w).Encode(api.Task{ID: 42, Title: "离线创建", Status: "pending", Revision: 1})
				case r.Method == "PUT" && r.URL.Path == "/api/tasks/42":
					if queuedPUT && writes.Load() == 1 {
						writes.Add(1)
						if r.Header.Get("If-Match") != "1" {
							t.Errorf("queued local update revision: %s", r.Header.Get("If-Match"))
						}
						_ = json.NewEncoder(w).Encode(api.Task{ID: 42, Title: "已保存的标题", Status: "pending", Revision: 2})
						return
					}
					conflicts.Add(1)
					if r.Header.Get("If-Match") != fmt.Sprint(ackRevision) {
						t.Errorf("dirty save authorized an unseen revision: %s", r.Header.Get("If-Match"))
					}
					w.WriteHeader(http.StatusConflict)
					_ = json.NewEncoder(w).Encode(map[string]any{"error": "revision conflict", "latest": remote})
				case r.URL.Path == "/api/auth/me":
					_ = json.NewEncoder(w).Encode(api.User{ID: 1})
				case r.URL.Path == "/api/tasks/sync":
					w.WriteHeader(http.StatusNotFound)
				case r.Method == "GET" && r.URL.Path == "/api/tasks":
					reads.Add(1)
					_ = json.NewEncoder(w).Encode([]api.Task{remote})
				case r.URL.Path == "/api/tasks/occurrences":
					_ = json.NewEncoder(w).Encode(api.OccurrencePage{})
				case r.URL.Path == "/api/categories", r.URL.Path == "/api/tasks/next-occurrences", r.URL.Path == "/api/calendar":
					_, _ = w.Write([]byte("[]"))
				default:
					t.Errorf("unexpected refresh request: %s %s", r.Method, r.URL)
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer srv.Close()
			store := storage.Store{Dir: t.TempDir()}
			a := New(store)
			defer a.Close()
			a.client, _ = api.New(srv.URL, "jwt")
			a.session = api.Session{Server: srv.URL, Token: "jwt", User: api.User{ID: 1}}
			state, err := syncer.Enqueue(storage.Cache{Server: srv.URL, UserID: 1}, "POST", "/tasks", map[string]string{"title": "离线创建"}, 0)
			if err != nil {
				t.Fatal(err)
			}
			if queuedPUT {
				state, err = syncer.Enqueue(state, "PUT", "/tasks/-1", map[string]string{"title": "已保存的标题"}, 0)
				if err != nil {
					t.Fatal(err)
				}
			}
			a.adoptCache(state)
			a.editTaskNow(a.tasks[0])
			a.draft.Title = "继续输入的草稿"
			wantDraft, wantBase := a.draft, *a.taskDraftBase

			// Exercise the UI-owned task receipt path, then the independent
			// refresh/read worker. No native window is needed for these packets.
			for len(a.cache.Outbox) > 0 {
				a.cache.Outbox[0].Sent = true
				op := a.cache.Outbox[0]
				if err := store.SaveCache(a.cache); err != nil {
					t.Fatal(err)
				}
				path := "/tasks"
				if op.Method != "POST" {
					path = fmt.Sprintf("/tasks/%d%s", op.TaskID, op.Suffix)
				}
				var task api.Task
				err := a.client.DoOperation(context.Background(), op.Method, path, op.Body, &task, op.Revision, op.ID)
				if err != nil {
					t.Fatal(err)
				}
				a.localWrites.reply = &taskWriteReply{op: op, task: task}
				a.drainTaskReceipts()
			}
			// Apply the saved read cache explicitly in place of the UI callback.
			a.refresh()
			var refreshed storage.Cache
			deadline := time.NewTimer(5 * time.Second)
			defer deadline.Stop()
			ticker := time.NewTicker(5 * time.Millisecond)
			defer ticker.Stop()
			for len(refreshed.Tasks) != 1 || refreshed.Tasks[0].Revision != remote.Revision {
				select {
				case <-deadline.C:
					t.Fatalf("refresh did not persist the remote snapshot: %+v", refreshed)
				case <-ticker.C:
					refreshed, _ = store.Cache(srv.URL, 1)
				}
			}
			if refreshed.LocalAckRevisions[42] != ackRevision {
				t.Fatalf("refresh lost local receipt revision: got %v, want task 42 at %d", refreshed.LocalAckRevisions, ackRevision)
			}
			a.adoptCache(refreshed)
			wantDraft.Task.ID, wantDraft.Task.Revision = 42, ackRevision
			wantBase.Task.ID, wantBase.Task.Revision = 42, ackRevision
			if !reflect.DeepEqual(a.draft, wantDraft) || !reflect.DeepEqual(*a.taskDraftBase, wantBase) || !a.taskDraftDirty() {
				t.Fatal("refresh changed dirty fields or immutable conflict baseline")
			}
			body, err := a.draft.payload()
			if err != nil {
				t.Fatal(err)
			}
			queued, err := a.enqueueTaskIntent("PUT", "/tasks/42", body, a.draft.Task.Revision)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(queued.Outbox[0].Base, wantBase.Task) {
				t.Fatal("enqueue replaced the original conflict baseline")
			}
			result, err := syncer.Flush(context.Background(), a.client, store, queued)
			if err != nil {
				t.Fatal(err)
			}
			if len(result.Outbox) != 1 || result.Outbox[0].State != "conflict" || result.Outbox[0].Latest == nil || result.Outbox[0].Latest.Revision != remote.Revision {
				t.Fatalf("dirty save failed to retain the conflict: %+v", result.Outbox)
			}
			// Flush clones through JSON, which normalizes time locations and nil
			// RawMessages. Compare the persisted representation of the baseline.
			gotBaseJSON, _ := json.Marshal(result.Outbox[0].Base)
			wantBaseJSON, _ := json.Marshal(wantBase.Task)
			if string(gotBaseJSON) != string(wantBaseJSON) {
				t.Fatalf("conflict changed baseline content: got %s want %s", gotBaseJSON, wantBaseJSON)
			}
			if writes.Load() != ackRevision || conflicts.Load() != 1 || reads.Load() != 1 || result.LocalAckRevisions[42] != ackRevision {
				t.Fatalf("unexpected requests/receipts: writes=%d conflicts=%d reads=%d receipts=%v", writes.Load(), conflicts.Load(), reads.Load(), result.LocalAckRevisions)
			}
		})
	}
}

func TestDirtyOfflineCreationWithoutReceiptUsesSafeRevision(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	local := api.Task{ID: -1, Title: "旧缓存任务", Status: "pending"}
	a.adoptCache(storage.Cache{Tasks: []api.Task{local}, ReminderKeys: map[int64]string{-1: "local:old"}})
	a.editTaskNow(local)
	a.draft.Title = "未保存的修改"
	remote := local
	remote.ID, remote.Revision, remote.Description = 42, 9, "未见过的远端修改"
	a.adoptCache(storage.Cache{Tasks: []api.Task{remote}, ReminderKeys: map[int64]string{42: "local:old"}})
	if a.selectedTaskID != 42 || a.draft.Task.Revision != 1 || a.taskDraftBase.Task.Revision != 1 || a.draft.Task.Description != local.Description || a.draft.Title != "未保存的修改" {
		t.Fatalf("old cache adopted an unseen revision or lost input: %+v", a.draft)
	}
}
