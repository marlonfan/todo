package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestLocalAckRevisionsPersistReceiptsAcrossPullAndReplay(t *testing.T) {
	for _, tc := range []struct {
		name, method, path      string
		previous, receipt, want int64
	}{
		{"create", "POST", "/tasks", 0, 1, 1},
		{"update", "PUT", "/tasks/42", 1, 2, 2},
		{"status", "PATCH", "/tasks/42/status", 2, 3, 3},
		{"replayed_create", "POST", "/tasks", 2, 1, 2},
		{"replayed_update", "PUT", "/tasks/42", 3, 2, 3},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := storage.Store{Dir: t.TempDir()}
			attempts := 0
			var operationID string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					_ = json.NewEncoder(w).Encode(api.TaskChanges{Tasks: []api.Task{{ID: 42, Revision: 10}}, NextCursor: "v1:10"})
					return
				}
				attempts++
				if attempts == 1 {
					operationID = r.Header.Get("X-Client-Op-Id")
					// The write committed but its receipt was lost in transit.
					w.WriteHeader(http.StatusServiceUnavailable)
					return
				}
				if operationID == "" || r.Header.Get("X-Client-Op-Id") != operationID {
					t.Error("retry changed the operation identity")
				}
				_ = json.NewEncoder(w).Encode(api.Task{ID: 42, Title: "本地修改", Status: "pending", Revision: tc.receipt})
			}))
			defer srv.Close()
			state := storage.Cache{Server: srv.URL, UserID: 1, Tasks: []api.Task{{ID: 42, Title: "原内容", Status: "pending", Revision: 1}}}
			if tc.previous > 0 {
				state.LocalAckRevisions = map[int64]int64{42: tc.previous}
			}
			state = enqueue(t, state, tc.method, tc.path, map[string]string{"title": "本地修改", "status": "completed"}, 1)
			client, _ := api.New(srv.URL, "jwt")
			failed, err := Flush(context.Background(), client, store, state)
			if err == nil || failed.LocalAckRevisions[42] != tc.previous {
				t.Fatalf("uncertain delivery advanced the local receipt: %+v err=%v", failed.LocalAckRevisions, err)
			}
			restored, err := store.Cache(srv.URL, 1)
			if err != nil {
				t.Fatal(err)
			}
			acked, err := Flush(context.Background(), client, store, restored)
			if err != nil || acked.LocalAckRevisions[42] != tc.want || len(acked.Outbox) != 0 {
				t.Fatalf("replayed receipt: %+v err=%v", acked, err)
			}
			persisted, err := store.Cache(srv.URL, 1)
			if err != nil || persisted.LocalAckRevisions[42] != tc.want {
				t.Fatalf("receipt was not persisted atomically: %+v err=%v", persisted, err)
			}
			pulled, err := PullTasks(context.Background(), client, persisted, 0)
			if err != nil || len(pulled.Tasks) != 1 || pulled.Tasks[0].Revision != 10 || pulled.LocalAckRevisions[42] != tc.want {
				t.Fatalf("remote read changed the local receipt: %+v err=%v", pulled, err)
			}
		})
	}
}
