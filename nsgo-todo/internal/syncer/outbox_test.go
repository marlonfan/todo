package syncer

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
)

func enqueue(t *testing.T, state storage.Cache, method, path string, body any, revision int64) storage.Cache {
	t.Helper()
	next, err := Enqueue(state, method, path, body, revision)
	if err != nil {
		t.Fatal(err)
	}
	return next
}

func TestOfflineCreateEditCompleteDeleteRemapsIDsAndRevisions(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	state := storage.Cache{Server: "http://test", UserID: 1}
	state = enqueue(t, state, "POST", "/tasks", map[string]any{"title": "离线创建", "category_ids": []int64{}}, 0)
	state = enqueue(t, state, "PUT", "/tasks/-1", map[string]string{"title": "离线编辑"}, 0)
	state = enqueue(t, state, "PATCH", "/tasks/-1/status", map[string]string{"status": "completed"}, 0)
	if view := View(state); len(view.Tasks) != 1 || view.Tasks[0].Title != "离线编辑" || view.Tasks[0].Status != "completed" {
		t.Fatalf("view: %+v", view.Tasks)
	}
	state = enqueue(t, state, "DELETE", "/tasks/-1", nil, 0)
	if view := View(state); len(view.Tasks) != 0 {
		t.Fatal("delete overlay failed")
	}
	if err := s.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	// Restore from disk to prove no in-memory temporary ID mapping is required.
	state, _ = s.Cache(state.Server, 1)
	calls := 0
	seenIDs := map[string]bool{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		id := r.Header.Get("X-Client-Op-Id")
		if id == "" || seenIDs[id] {
			t.Error("different operations must have different IDs")
		}
		seenIDs[id] = true
		if calls == 1 {
			if r.Method != "POST" || r.URL.Path != "/api/tasks" {
				t.Errorf("create: %s %s", r.Method, r.URL.Path)
			}
		} else if r.Header.Get("If-Match") != strconv.Itoa(calls-1) {
			t.Errorf("wrong revision at step %d: %s", calls, r.Header.Get("If-Match"))
		}
		if calls == 2 && r.URL.Path != "/api/tasks/42" {
			t.Error("edit did not remap local ID")
		}
		if calls == 3 && r.URL.Path != "/api/tasks/42/status" {
			t.Error("status did not remap local ID")
		}
		if calls == 4 {
			w.WriteHeader(204)
			return
		}
		_ = json.NewEncoder(w).Encode(api.Task{ID: 42, Title: "离线编辑", Status: "pending", Revision: int64(calls)})
	}))
	defer srv.Close()
	client, _ := api.New(srv.URL, "jwt")
	state, err := Flush(context.Background(), client, s, state)
	if err != nil || calls != 4 || len(state.Outbox) != 0 || len(state.Tasks) != 0 {
		t.Fatalf("flush: %+v calls=%d err=%v", state, calls, err)
	}
	persisted, _ := s.Cache(state.Server, 1)
	if len(persisted.Outbox) != 0 || len(persisted.Tasks) != 0 {
		t.Fatal("acknowledgements not persisted")
	}
}

func TestUnknownDeliveryRetriesSameRequestAfterRestart(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	state := enqueue(t, storage.Cache{Server: "http://test", UserID: 1}, "POST", "/tasks", map[string]string{"title": "只创建一次"}, 0)
	var firstID, firstBody string
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		body, _ := io.ReadAll(r.Body)
		if calls == 1 {
			firstID, firstBody = r.Header.Get("X-Client-Op-Id"), string(body)
			// The server committed a receipt but the response was lost.
			w.WriteHeader(500)
			return
		}
		if r.Header.Get("X-Client-Op-Id") != firstID || string(body) != firstBody {
			t.Error("retry changed operation identity or payload")
		}
		_ = json.NewEncoder(w).Encode(api.Task{ID: 7, Title: "只创建一次", Revision: 1})
	}))
	defer srv.Close()
	client, _ := api.New(srv.URL, "jwt")
	state, err := Flush(context.Background(), client, s, state)
	if err == nil || len(state.Outbox) != 1 || !state.Outbox[0].Sent {
		t.Fatal("uncertain delivery was discarded")
	}
	restored, _ := s.Cache(state.Server, 1)
	state, err = Flush(context.Background(), client, s, restored)
	if err != nil || calls != 2 || len(state.Outbox) != 0 || len(state.Tasks) != 1 {
		t.Fatalf("retry: %+v %v", state, err)
	}
}

func TestConflictBlocksOnlySameTaskAndRequiresNewExplicitOperation(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	state := storage.Cache{Server: "http://test", UserID: 1, Tasks: []api.Task{{ID: 1, Title: "原内容", Status: "pending", Revision: 1}, {ID: 2, Title: "独立任务", Status: "pending", Revision: 1}}}
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"title": "本地修改"}, 1)
	state = enqueue(t, state, "PATCH", "/tasks/1/status", map[string]string{"status": "completed"}, 1)
	state = enqueue(t, state, "PATCH", "/tasks/2/status", map[string]string{"status": "completed"}, 1)
	oldID := state.Outbox[0].ID
	firstTaskCalls, independentCalls := 0, 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tasks/2/status" {
			independentCalls++
			_ = json.NewEncoder(w).Encode(api.Task{ID: 2, Revision: 2, Status: "completed"})
			return
		}
		firstTaskCalls++
		if firstTaskCalls == 1 {
			w.WriteHeader(409)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "revision conflict", "latest": api.Task{ID: 1, Title: "服务器修改", Revision: 2}})
			return
		}
		if firstTaskCalls == 2 && (r.Header.Get("X-Client-Op-Id") == oldID || r.Header.Get("If-Match") != "2") {
			t.Error("resolution did not create a guarded new operation")
		}
		if firstTaskCalls == 3 {
			if r.Header.Get("If-Match") != "1" {
				t.Error("resolution silently authorized a successor with a different base")
			}
			w.WriteHeader(409)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "revision conflict", "latest": api.Task{ID: 1, Title: "本地修改", Revision: 3}})
			return
		}
		if firstTaskCalls == 4 && r.Header.Get("If-Match") != "3" {
			t.Error("successor resolution did not use its explicit guard")
		}
		_ = json.NewEncoder(w).Encode(api.Task{ID: 1, Title: "本地修改", Status: "pending", Revision: int64(firstTaskCalls + 1)})
	}))
	defer srv.Close()
	client, _ := api.New(srv.URL, "jwt")
	state, err := Flush(context.Background(), client, s, state)
	if err != nil || firstTaskCalls != 1 || independentCalls != 1 || len(state.Outbox) != 2 || state.Outbox[0].State != "conflict" {
		t.Fatalf("conflict: %+v %v", state, err)
	}
	if got := View(state).Tasks; len(got) != 2 {
		t.Fatalf("lost local view: %+v", got)
	}
	state, err = Flush(context.Background(), client, s, state)
	if err != nil || firstTaskCalls != 1 {
		t.Fatal("conflict was retried automatically")
	}
	state, err = Resolve(state, oldID)
	if err != nil {
		t.Fatal(err)
	}
	state, err = Flush(context.Background(), client, s, state)
	if err != nil || firstTaskCalls != 3 || len(state.Outbox) != 1 || state.Outbox[0].State != "conflict" {
		t.Fatalf("successor must require its own resolution: %+v %v", state, err)
	}
	state, err = Resolve(state, state.Outbox[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	state, err = Flush(context.Background(), client, s, state)
	if err != nil || firstTaskCalls != 4 || len(state.Outbox) != 0 {
		t.Fatalf("resolve successor: %+v %v", state, err)
	}
}

func TestAcknowledgementDiskFailureKeepsReplayableOperation(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	state := enqueue(t, storage.Cache{Server: "http://test", UserID: 1}, "POST", "/tasks", map[string]string{"title": "保留收据"}, 0)
	path := filepath.Join(s.Dir, "cache.json")
	var id string
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			id = r.Header.Get("X-Client-Op-Id")
			if err := os.Rename(path, path+".saved"); err != nil {
				t.Error(err)
			}
			if err := os.Mkdir(path, 0700); err != nil {
				t.Error(err)
			}
		} else if r.Header.Get("X-Client-Op-Id") != id {
			t.Error("disk failure changed replay identity")
		}
		_ = json.NewEncoder(w).Encode(api.Task{ID: 10, Revision: 1})
	}))
	defer srv.Close()
	client, _ := api.New(srv.URL, "jwt")
	state, err := Flush(context.Background(), client, s, state)
	if err == nil || len(state.Outbox) != 1 {
		t.Fatal("unpersisted acknowledgement was exposed")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(path+".saved", path); err != nil {
		t.Fatal(err)
	}
	state, _ = s.Cache(state.Server, 1)
	state, err = Flush(context.Background(), client, s, state)
	if err != nil || calls != 2 || len(state.Outbox) != 0 {
		t.Fatalf("replay: %+v %v", state, err)
	}
}

func TestOccurrenceOverlayAndAcknowledgementNeverCompleteSeries(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	day := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	task := api.Task{ID: 1, Status: "pending", Revision: 1, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	state := storage.Cache{Server: "http://test", UserID: 1, Tasks: []api.Task{task}, Next: []api.Occurrence{{TaskID: 1, InstanceID: "1_20261109", StartTime: day, OriginalDate: day, Status: "pending"}}}
	state = enqueue(t, state, "PATCH", "/tasks/1/status", map[string]string{"status": "completed", "instance_id": "1_20261109", "occurrence_date": "2026-11-09"}, 1)
	view := View(state)
	if len(view.Next) != 0 || len(view.History.Items) != 1 || view.Tasks[0].Status != "pending" {
		t.Fatalf("occurrence overlay changed series: %+v", view)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { task.Revision = 2; _ = json.NewEncoder(w).Encode(task) }))
	defer srv.Close()
	client, _ := api.New(srv.URL, "jwt")
	state, err := Flush(context.Background(), client, s, state)
	if err != nil || len(state.Next) != 0 || len(state.History.Items) != 1 || state.Tasks[0].Status != "pending" {
		t.Fatalf("ack: %+v %v", state, err)
	}
}
