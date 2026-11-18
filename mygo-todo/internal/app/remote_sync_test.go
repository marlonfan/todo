package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func TestRemoteCommitPreservesEditorAndRejectsSupersededSnapshot(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	base := storage.Cache{Server: api.DefaultServer, UserID: 1, SyncCursor: "v1:1", Tasks: []api.Task{{ID: 1, Title: "原始标题", Revision: 1, Status: "pending"}}}
	a.adoptCache(base)
	a.editTask(a.tasks[0])
	a.draft.Title = "尚未保存的标题"
	remote := syncer.Clone(a.cache)
	remote.SyncCursor, remote.Tasks[0].Title, remote.Tasks[0].Revision = "v1:2", "另一设备修改", 2
	stale := syncer.Clone(remote)
	oldGeneration := a.cacheGeneration
	committed, err := a.commitRemoteChanges(remote, oldGeneration)
	if err != nil || !committed || a.tasks[0].Title != "另一设备修改" || a.draft.Title != "尚未保存的标题" || a.draft.Task.Revision != 1 || !a.editing {
		t.Fatal("background read changed the editor", err)
	}
	intent, err := a.enqueueTaskIntent("PUT", "/tasks/1", map[string]string{"title": a.draft.Title}, a.draft.Task.Revision)
	if err != nil || intent.Outbox[0].Base.Title != "原始标题" || intent.Outbox[0].Revision != 1 {
		t.Fatal("original conflict baseline was rebased", intent, err)
	}
	if err := a.store.SaveCache(intent); err != nil {
		t.Fatal(err)
	}
	a.adoptCache(intent)
	if ok, err := a.commitRemoteChanges(stale, oldGeneration); ok || err != nil {
		t.Fatal("stale response committed", err)
	}
	if len(a.cache.Outbox) != 1 || a.tasks[0].Title != "尚未保存的标题" {
		t.Fatal("late read erased local intent")
	}
	persisted, err := a.store.Cache(base.Server, 1)
	if err != nil || len(persisted.Outbox) != 1 || persisted.SyncCursor != "v1:2" {
		t.Fatal(persisted, err)
	}
}

func TestRemoteCommitDefersDuringWritesComparisonAndDiskFailure(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, SyncCursor: "v1:1"})
	updated := syncer.Clone(a.cache)
	updated.SyncCursor = "v1:2"
	a.busy = true
	if ok, _ := a.commitRemoteChanges(updated, a.cacheGeneration); ok {
		t.Fatal("committed over foreground write")
	}
	a.busy, a.page = false, "sync"
	a.cache.Outbox = []storage.Mutation{{State: "conflict"}}
	if ok, _ := a.commitRemoteChanges(updated, a.cacheGeneration); ok {
		t.Fatal("changed active conflict comparison")
	}
	a.cache.Outbox = nil
	if err := os.Mkdir(filepath.Join(a.store.Dir, "cache.json"), 0700); err != nil {
		t.Fatal(err)
	}
	before := a.cacheGeneration
	if ok, err := a.commitRemoteChanges(updated, before); ok || err == nil {
		t.Fatal("disk failure exposed unpersisted cursor", err)
	}
	if a.cacheGeneration != before || a.cache.SyncCursor != "v1:1" {
		t.Fatal("disk failure changed in-memory cache")
	}
}

func TestRemoteProjectionFailureKeepsTaskCursorReplayable(t *testing.T) {
	for _, fail := range []bool{false, true} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/tasks/sync":
				json.NewEncoder(w).Encode(api.TaskChanges{Tasks: []api.Task{{ID: 1, Title: "新值", Revision: 2}}, NextCursor: "v1:2"})
			case "/api/categories":
				if fail {
					w.WriteHeader(503)
				} else {
					json.NewEncoder(w).Encode([]api.Category{})
				}
			case "/api/tasks/occurrences":
				json.NewEncoder(w).Encode(api.OccurrencePage{})
			case "/api/tasks/next-occurrences":
				json.NewEncoder(w).Encode([]api.Occurrence{})
			case "/api/calendar":
				json.NewEncoder(w).Encode([]api.CalendarEvent{})
			default:
				t.Error("unexpected request", r.URL)
				w.WriteHeader(500)
			}
		}))
		c, _ := api.New(srv.URL, "")
		state := storage.Cache{SyncCursor: "v1:1", Tasks: []api.Task{{ID: 1, Title: "原值", Revision: 1}}}
		updated, err := readRemoteChanges(context.Background(), c, state)
		if fail && (err == nil || !reflect.DeepEqual(updated, state)) {
			t.Fatal("partial task/cursor exposed on projection failure", updated, err)
		}
		if !fail && (err != nil || updated.SyncCursor != "v1:2" || updated.Tasks[0].Title != "新值") {
			t.Fatal(updated, err)
		}
		srv.Close()
	}
}
