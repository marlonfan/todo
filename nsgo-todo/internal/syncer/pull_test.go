package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
)

func TestIncrementalPullPaginationDeletionAndLocalOverlay(t *testing.T) {
	state := storage.Cache{Server: "test", UserID: 1, SyncCursor: "v1:4", Tasks: []api.Task{{ID: 1, Title: "原始", Revision: 1}, {ID: 2, Title: "将被删除", Revision: 1}}}
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"title": "本机草稿"}, 1)
	state = enqueue(t, state, "POST", "/tasks", map[string]string{"title": "离线新建"}, 0)
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/api/tasks/sync" {
			t.Error("unexpected full task read", r.URL)
		}
		switch r.URL.Query().Get("cursor") {
		case "v1:4":
			if r.URL.Query().Get("wait") != "20" {
				t.Error(r.URL)
			}
			json.NewEncoder(w).Encode(api.TaskChanges{Tasks: []api.Task{{ID: 1, Title: "服务器新值", Revision: 2}}, HasMore: true, NextCursor: "v1:5"})
		case "v1:5":
			if r.URL.Query().Get("wait") != "" {
				t.Error("later page must not wait")
			}
			json.NewEncoder(w).Encode(api.TaskChanges{Tasks: []api.Task{{ID: 3, Title: "其他客户端新增", Revision: 1}}, Deleted: []api.TaskDeletion{{TaskID: 2}}, NextCursor: "v1:7"})
		default:
			t.Error(r.URL)
		}
	}))
	defer srv.Close()
	c, _ := api.New(srv.URL, "jwt")
	updated, err := PullTasks(context.Background(), c, state, 20*time.Second)
	if err != nil || calls != 2 || updated.SyncCursor != "v1:7" || len(updated.Tasks) != 2 || updated.Tasks[0].Title != "服务器新值" || len(updated.Outbox) != 2 {
		t.Fatal(updated, err)
	}
	view := View(updated)
	beforeOps, _ := json.Marshal(state.Outbox)
	afterOps, _ := json.Marshal(updated.Outbox)
	if len(view.Tasks) != 3 || string(beforeOps) != string(afterOps) || state.Tasks[0].Title != "原始" || state.SyncCursor != "v1:4" {
		t.Fatal("pull mutated local intents or snapshot")
	}
	for _, task := range view.Tasks {
		if task.ID == 1 && task.Title != "本机草稿" {
			t.Fatal("remote data replaced local intent")
		}
	}
	store := storage.Store{Dir: t.TempDir()}
	if err := store.SaveCache(updated); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Cache(updated.Server, 1)
	if err != nil || restored.SyncCursor != "v1:7" || len(restored.Outbox) != 2 {
		t.Fatal(restored, err)
	}
}

func TestFailedLaterSyncPageDoesNotAdvanceCursorOrEraseTasks(t *testing.T) {
	state := storage.Cache{SyncCursor: "v1:1", Tasks: []api.Task{{ID: 1, Title: "原值", Revision: 1}}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("cursor") == "v1:1" {
			json.NewEncoder(w).Encode(api.TaskChanges{Tasks: []api.Task{{ID: 1, Title: "新值", Revision: 2}}, NextCursor: "v1:2", HasMore: true})
			return
		}
		w.WriteHeader(503)
	}))
	defer srv.Close()
	c, _ := api.New(srv.URL, "")
	got, err := PullTasks(context.Background(), c, state, 0)
	if err == nil || !reflect.DeepEqual(got, state) {
		t.Fatal("partial result exposed", got, err)
	}
}

func TestLegacyServerFallbackAndBootstrapDropsStaleCanonicalRows(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/tasks" {
				json.NewEncoder(w).Encode([]api.Task{{ID: 9, Title: "兼容读取"}})
				return
			}
			if legacy {
				w.WriteHeader(404)
				return
			}
			json.NewEncoder(w).Encode(api.TaskChanges{Tasks: []api.Task{{ID: 9, Title: "增量引导"}}, NextCursor: "v1:7"})
		}))
		c, _ := api.New(srv.URL, "")
		state := storage.Cache{Tasks: []api.Task{{ID: 1, Title: "旧缓存残留"}}}
		got, err := PullTasks(context.Background(), c, state, 0)
		if err != nil || len(got.Tasks) != 1 || got.Tasks[0].ID != 9 || (legacy && got.SyncCursor != "") || (!legacy && got.SyncCursor != "v1:7") {
			t.Fatal(got, err)
		}
		srv.Close()
	}
}

func TestCategoryMetadataRefreshWithoutTaskChange(t *testing.T) {
	state := storage.Cache{Tasks: []api.Task{{ID: 1, Categories: []api.Category{{ID: 1, Name: "旧名称"}, {ID: 2, Name: "已删除"}}}}}
	UpdateCategories(&state, []api.Category{{ID: 1, Name: "新名称", Color: "#3788d8"}})
	if len(state.Tasks[0].Categories) != 1 || state.Tasks[0].Categories[0].Name != "新名称" {
		t.Fatal(state)
	}
}
