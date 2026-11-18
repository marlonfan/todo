package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"testing"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestStaleReceiptPreservesEveryProjectionThroughFlushAndEmptyPull(t *testing.T) {
	for _, viaFlush := range []bool{false, true} {
		for _, inHistory := range []bool{false, true} {
			for _, change := range []string{"title_description", "status", "occurrence_time", "series_time"} {
				name := change
				if viaFlush {
					name += "/flush"
				}
				if inHistory {
					name += "/history"
				}
				t.Run(name, func(t *testing.T) {
					state := receiptFixture()
					oldStart := *state.Tasks[0].StartTime
					oldEnd := oldStart.Add(time.Hour)
					method, path := "PUT", "/tasks/1"
					body := map[string]any{"instance_id": "one", "occurrence_date": "2026-11-09"}
					switch change {
					case "title_description":
						body["title"], body["description"] = "stale title", "stale description"
					case "status":
						method, path = "PATCH", "/tasks/1/status"
						body["status"] = "completed"
						if inHistory {
							body["status"] = "pending"
						}
					case "occurrence_time":
						method, path = "PATCH", "/tasks/1/occurrences/schedule"
						body["start_time"], body["end_time"], body["all_day"] = oldStart, oldEnd, true
					case "series_time":
						body = map[string]any{"start_time": oldStart.Add(time.Hour), "end_time": oldEnd, "all_day": true}
					}
					state = enqueue(t, state, method, path, body, 7)
					state.Outbox[0].Sent = true // Previously sent; the server replays receipt 8.
					op := state.Outbox[0]
					ack := state.Tasks[0]
					ack.Revision = 8
					newStart := oldStart.Add(48 * time.Hour)
					newEnd := newStart.Add(2 * time.Hour)
					state.SyncCursor = "v1:9"
					state.Tasks[0].Revision = 9
					state.Tasks[0].Title, state.Tasks[0].Description = "new title", "new description"
					state.Tasks[0].StartTime, state.Tasks[0].EndTime = &newStart, &newEnd
					state.Calendar.SeriesRevisions[1] = 9
					row := &state.Next[0]
					row.Title, row.Description = "new title", "new description"
					row.StartTime, row.EndTime = newStart, &newEnd
					if inHistory {
						row.Status, row.CompletedAt = "completed", &newEnd
						state.History.Items = append(state.History.Items, *row)
						state.Next = state.Next[1:]
					}
					for _, events := range [][]api.CalendarEvent{state.Calendar.Events, state.ReminderEvents} {
						events[0].Title, events[0].ExtendedProps.Description = "new title", "new description"
						events[0].Start, events[0].End = newStart.Format(time.RFC3339), newEnd.Format(time.RFC3339)
						if inHistory {
							events[0].ExtendedProps.Status = "completed"
						}
					}
					store := storage.Store{Dir: t.TempDir()}
					writes, reads := 0, 0
					srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						if r.Method == "GET" {
							reads++
							if r.URL.Query().Get("cursor") != "v1:9" {
								t.Error("pull lost the prior cursor")
							}
							_ = json.NewEncoder(w).Encode(api.TaskChanges{NextCursor: "v1:9"})
							return
						}
						writes++
						persisted, err := store.Cache(state.Server, state.UserID)
						if err != nil || len(persisted.Outbox) != 1 || !persisted.Outbox[0].Sent || r.Header.Get("X-Client-Op-Id") != op.ID || r.Header.Get("If-Match") != "7" {
							t.Error("replay identity, guard, or durable Sent changed", err)
						}
						_ = json.NewEncoder(w).Encode(ack)
					}))
					defer srv.Close()
					state.Server = srv.URL
					before := Clone(state)
					client, _ := api.New(srv.URL, "jwt")
					var got storage.Cache
					var err error
					if viaFlush {
						got, err = Flush(context.Background(), client, store, state)
						if err != nil {
							t.Fatal(err)
						}
						got, err = store.Cache(state.Server, state.UserID)
						if err != nil || writes != 1 {
							t.Fatal("ack was not persisted", err, writes)
						}
					} else {
						got = receipt(t, state, op.ID, ack, nil)
					}
					got, err = PullTasks(context.Background(), client, got, 0)
					if err != nil || reads != 1 {
						t.Fatal("empty pull failed", err, reads)
					}
					expected := Clone(before)
					expected.Outbox = nil
					expected.LocalAckRevisions = map[int64]int64{1: 8}
					if !reflect.DeepEqual(Clone(got), Clone(expected)) {
						t.Fatalf("stale receipt changed canonical, title/description/status/time projections, or metadata:\ngot %+v\nwant %+v", got, expected)
					}
					if !reflect.DeepEqual(Clone(state), before) {
						t.Fatal("input mutated")
					}
				})
			}
		}
	}
}

func TestFlushReceiptFailureContract(t *testing.T) {
	for _, status := range []int{400, 404, 409, 408, 429, 503} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			store := storage.Store{Dir: t.TempDir()}
			state := enqueue(t, receiptFixture(), "PATCH", "/tasks/1/occurrences/schedule", map[string]string{"instance_id": "one"}, 7)
			state = enqueue(t, state, "PUT", "/tasks/2", map[string]string{"title": "independent"}, 3)
			calls := 0
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				persisted, err := store.Cache(state.Server, state.UserID)
				if err != nil || !persisted.Outbox[calls-1].Sent {
					t.Error("request sent before Sent was durable", err)
				}
				if calls == 1 {
					w.WriteHeader(status)
					_ = json.NewEncoder(w).Encode(map[string]any{"error": "failure", "latest": api.Task{ID: 1, Revision: 9}})
					return
				}
				_ = json.NewEncoder(w).Encode(api.Task{ID: 2, Revision: 4, Title: "independent"})
			}))
			defer srv.Close()
			state.Server = srv.URL
			client, _ := api.New(srv.URL, "jwt")
			got, err := Flush(context.Background(), client, store, state)
			permanent := status < 500 && status != 408 && status != 429
			wantState, wantCalls := "pending", 1
			if permanent {
				wantState, wantCalls = "rejected", 2
				if status == 409 {
					wantState = "conflict"
				}
			}
			if (err == nil) != permanent || calls != wantCalls || len(got.Outbox) != 3-wantCalls || got.Outbox[0].State != wantState || !got.Outbox[0].Sent || got.Outbox[0].Failure == "" || len(got.LocalAckRevisions) != wantCalls-1 {
				t.Fatal("failure contract changed", got.Outbox, err, calls)
			}
			if permanent && got.Outbox[0].Latest == nil {
				t.Fatal("permanent failure lost its latest snapshot")
			}
			if status == 404 && got.Outbox[0].Failure != "服务端不支持单次改期或任务已删除；本机修改已保留，请升级服务端后点击重新尝试此修改，或放弃此修改。" {
				t.Fatal("schedule failure lost its recovery message")
			}
			persisted, loadErr := store.Cache(state.Server, state.UserID)
			if loadErr != nil || !reflect.DeepEqual(Clone(got), Clone(persisted)) {
				t.Fatal("failure not committed atomically", loadErr)
			}
		})
	}
}

func TestReceiptRebasesOnlySuccessorsSharingItsGuard(t *testing.T) {
	state := receiptFixture()
	state.Tasks[0].Revision = 8 // Fresh canonical; the editor below still holds 7.
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"title": "fresh write"}, 8)
	state.Outbox[0].Sent = true
	op := state.Outbox[0]
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"description": "stale editor autosave"}, 7)
	state = enqueue(t, state, "PATCH", "/tasks/1/status", map[string]string{"status": "completed"}, 8)
	state = enqueue(t, state, "PUT", "/tasks/1", map[string]string{"title": "already sent"}, 8)
	state.Outbox[3].Sent = true
	ack := op.Local
	ack.Revision = 9
	got := receipt(t, state, op.ID, ack, nil)
	if !reflect.DeepEqual(got.Outbox[0], Clone(state).Outbox[1]) || got.Outbox[1].Revision != 9 || got.Outbox[1].Base.Revision != 9 || got.Outbox[1].Local.Revision != 9 || !reflect.DeepEqual(got.Outbox[2], Clone(state).Outbox[3]) {
		t.Fatal("rebased stale editor or sent write, or missed dependent write", got.Outbox)
	}

	store := storage.Store{Dir: t.TempDir()}
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			if r.Header.Get("If-Match") != "8" {
				t.Error("fresh write lost its guard")
			}
			_ = json.NewEncoder(w).Encode(ack)
			return
		}
		if calls != 2 || r.Header.Get("If-Match") != "7" {
			t.Error("stale editor silently authorized by unrelated receipt")
		}
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "revision conflict", "latest": ack})
	}))
	defer srv.Close()
	state.Server = srv.URL
	client, _ := api.New(srv.URL, "jwt")
	got, err := Flush(context.Background(), client, store, state)
	if err != nil || calls != 2 || len(got.Outbox) != 3 || got.Outbox[0].Revision != 7 || got.Outbox[0].State != "conflict" || got.Outbox[1].Revision != 9 || got.Outbox[1].Sent {
		t.Fatal("flush bypassed stale guard or failed to block later writes", got.Outbox, err, calls)
	}
}
