package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func categoryQueue(t *testing.T, state storage.Cache, method string, cat api.Category) storage.Cache {
	t.Helper()
	next, err := QueueCategory(state, method, cat)
	if err != nil {
		t.Fatal(err)
	}
	return next
}

func TestOfflineCategoryMetadataAliasesAndDependentTaskFlush(t *testing.T) {
	category := api.Category{Name: "离线分类", Emoji: "📁", Color: "#3788d8"}
	state := categoryQueue(t, storage.Cache{UserID: 1}, "POST", category)
	category = View(state).Categories[0]
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "关联任务", "category_ids": []int64{category.ID}}, 0)
	category.Name = "离线重命名"
	state = categoryQueue(t, state, "PUT", category)
	if view := View(state); len(view.Categories) != 1 || view.Tasks[0].Categories[0].Name != category.Name {
		t.Fatal(view)
	}
	if len(state.CategoryOutbox) != 1 || state.CategoryOutbox[0].Method != "POST" {
		t.Fatal("unsent edits did not collapse", state.CategoryOutbox)
	}
	requests := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.URL.Path)
		if r.URL.Path == "/api/categories/sync" {
			json.NewEncoder(w).Encode(map[string]any{"category": api.Category{ID: 41, Name: category.Name, Emoji: category.Emoji, Color: category.Color}})
		} else {
			var payload struct {
				IDs []int64 `json:"category_ids"`
			}
			json.NewDecoder(r.Body).Decode(&payload)
			if !slices.Equal(payload.IDs, []int64{41}) {
				t.Error("temporary category ID sent", payload.IDs)
			}
			json.NewEncoder(w).Encode(api.Task{ID: 7, Title: "关联任务", Revision: 1, Categories: []api.Category{{ID: 41, Name: category.Name}}})
		}
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	store := storage.Store{Dir: t.TempDir()}
	state.Server = server.URL
	// An unresolved category must never leak a negative ID to the task API.
	state, err := Flush(context.Background(), client, store, state)
	if err != nil || len(requests) != 0 || len(state.Outbox) != 1 {
		t.Fatal(requests, state, err)
	}
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	state, _ = store.Cache(server.URL, 1)
	state, err = FlushCategories(context.Background(), client, store, state, false)
	if err != nil || state.CategoryAliases[category.ID] != 41 || len(state.CategoryOutbox) != 0 {
		t.Fatal(state, err)
	}
	if categoryIDs(state.Outbox[0].Body)[0] != 41 {
		t.Fatal("dependent body was not remapped")
	}
	// An editor may still hold an old temporary ID when an ACK arrives.
	state = enqueue(t, state, "PUT", "/tasks/-1", map[string]any{"category_ids": []int64{category.ID}}, 0)
	if categoryIDs(state.Outbox[1].Body)[0] != 41 {
		t.Fatal("stale editor ID was not resolved")
	}
	state, err = Flush(context.Background(), client, store, state)
	if err != nil || len(state.Outbox) != 0 || len(requests) != 3 || View(state).Tasks[0].Categories[0].ID != 41 {
		t.Fatal(requests, state, err)
	}
}

func TestCategoryUncertainCreatePreservesExactOperationAndReplaysAfterDiskFailure(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	category := api.Category{Name: "初始名称", Emoji: "📁", Color: "#3788d8"}
	state := categoryQueue(t, storage.Cache{UserID: 1}, "POST", category)
	firstID := state.CategoryOutbox[0].ID
	calls := 0
	var firstBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var payload map[string]any
		json.NewDecoder(r.Body).Decode(&payload)
		body, _ := json.Marshal(payload)
		if calls <= 2 {
			if r.Header.Get("X-Client-Op-Id") != firstID {
				t.Error("retry changed operation ID")
			}
			if calls == 1 {
				firstBody = body
			} else if string(body) != string(firstBody) {
				t.Error("retry changed payload")
			}
		}
		// Block acknowledgement persistence after the pre-send journal has committed.
		if calls == 1 {
			path := filepath.Join(store.Dir, "cache.json")
			if err := os.Rename(path, path+".backup"); err != nil {
				t.Error(err)
			}
			if err := os.Mkdir(path, 0700); err != nil {
				t.Error(err)
			}
		}
		json.NewEncoder(w).Encode(map[string]any{"category": api.Category{ID: 51, Name: "初始名称", Emoji: "📁", Color: "#3788d8"}})
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	state.Server = server.URL
	result, err := FlushCategories(context.Background(), client, store, state, false)
	if err == nil || len(result.CategoryOutbox) != 1 || !result.CategoryOutbox[0].Sent {
		t.Fatal(result, err)
	}
	path := filepath.Join(store.Dir, "cache.json")
	os.Remove(path)
	os.Rename(path+".backup", path)
	state, _ = store.Cache(server.URL, 1)
	category = View(state).Categories[0]
	category.Name = "后续名称"
	state = categoryQueue(t, state, "PUT", category)
	if len(state.CategoryOutbox) != 2 || state.CategoryOutbox[0].ID != firstID || state.CategoryOutbox[0].Local.Name != "初始名称" {
		t.Fatal("uncertain intent overwritten", state.CategoryOutbox)
	}
	state, err = FlushCategories(context.Background(), client, store, state, false)
	if err != nil || len(state.CategoryOutbox) != 0 || calls != 3 {
		t.Fatal(state, calls, err)
	}
}

func TestCategoryTransportFailureAndFailureJournalErrorKeepSentIntent(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	state := categoryQueue(t, storage.Cache{UserID: 1}, "POST", api.Category{Name: "原请求", Emoji: "📁", Color: "#3788d8"})
	firstID := state.CategoryOutbox[0].ID
	path := filepath.Join(store.Dir, "cache.json")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The server may have committed before losing the response. Also prevent
		// the client from persisting its failure message after the durable Sent mark.
		if err := os.Rename(path, path+".backup"); err != nil {
			t.Error(err)
		}
		if err := os.Mkdir(path, 0700); err != nil {
			t.Error(err)
		}
		conn, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error(err)
			return
		}
		conn.Close()
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	state.Server = server.URL
	state, err := FlushCategories(context.Background(), client, store, state, false)
	if err == nil || !state.CategoryOutbox[0].Sent || state.CategoryOutbox[0].ID != firstID {
		t.Fatal(state, err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(path+".backup", path); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Cache(server.URL, 1)
	if err != nil || !restored.CategoryOutbox[0].Sent {
		t.Fatal(restored, err)
	}
	category := View(state).Categories[0]
	category.Name = "后续编辑"
	state = categoryQueue(t, state, "PUT", category)
	if len(state.CategoryOutbox) != 2 || state.CategoryOutbox[0].ID != firstID || state.CategoryOutbox[0].Local.Name != "原请求" {
		t.Fatal("uncertain request must not be replaced", state)
	}
}

func TestCategoryDeleteWaitsForTaskAndAbandonedLocalCategoryKeepsTask(t *testing.T) {
	cat := api.Category{ID: 4, Name: "分类", Emoji: "📁", Color: "#3788d8"}
	state := storage.Cache{UserID: 1, Categories: []api.Category{cat}}
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "保留的任务", "category_ids": []int64{4}}, 0)
	state = categoryQueue(t, state, "DELETE", cat)
	if len(View(state).Categories) != 0 || len(View(state).Tasks) != 1 || len(View(state).Tasks[0].Categories) != 0 {
		t.Fatal(View(state))
	}
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls++; w.Write([]byte(`{"category":null}`)) }))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	store := storage.Store{Dir: t.TempDir()}
	next, err := FlushCategories(context.Background(), client, store, state, true)
	if err != nil || calls != 0 || len(next.CategoryOutbox) != 1 {
		t.Fatal(next, calls, err)
	}
	next.Outbox = nil
	next, err = FlushCategories(context.Background(), client, store, next, true)
	if err != nil || calls != 1 || len(next.CategoryOutbox) != 0 || len(next.Categories) != 0 {
		t.Fatal(next, calls, err)
	}
	local := categoryQueue(t, storage.Cache{UserID: 1}, "POST", api.Category{Name: "新分类", Emoji: "📁", Color: "#3788d8"})
	temp := View(local).Categories[0]
	local = enqueue(t, local, "POST", "/tasks", map[string]any{"title": "保留的任务", "category_ids": []int64{temp.ID}}, 0)
	local = categoryQueue(t, local, "DELETE", temp)
	if len(local.CategoryOutbox) != 0 || len(local.Outbox) != 1 || len(categoryIDs(local.Outbox[0].Body)) != 0 || len(View(local).Tasks[0].Categories) != 0 {
		t.Fatal(local)
	}
}

func TestCategoryRejectionCanBeCorrectedAndIndependentTaskStillFlushes(t *testing.T) {
	state := categoryQueue(t, storage.Cache{UserID: 1}, "POST", api.Category{Name: "冲突名称", Emoji: "📁", Color: "#3788d8"})
	state.CategoryOutbox[0].Sent, state.CategoryOutbox[0].State = true, "rejected"
	cat := View(state).Categories[0]
	cat.Name = "修正名称"
	state = categoryQueue(t, state, "PUT", cat)
	if len(state.CategoryOutbox) != 1 || state.CategoryOutbox[0].State != "pending" || state.CategoryOutbox[0].Method != "POST" {
		t.Fatal(state)
	}
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "等待分类", "category_ids": []int64{cat.ID}}, 0)
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "独立任务"}, 0)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/categories/sync" {
			w.WriteHeader(400)
			w.Write([]byte(`{"error":"duplicate name"}`))
			return
		}
		json.NewEncoder(w).Encode(api.Task{ID: 10, Title: "独立任务", Revision: 1})
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	store := storage.Store{Dir: t.TempDir()}
	state, err := FlushCategories(context.Background(), client, store, state, false)
	if err != nil || state.CategoryOutbox[0].State != "rejected" {
		t.Fatal(state, err)
	}
	state, err = Flush(context.Background(), client, store, state)
	if err != nil || len(state.Outbox) != 1 || state.Outbox[0].Local.Title != "等待分类" || len(state.Tasks) != 1 {
		t.Fatal(state, err)
	}
}
