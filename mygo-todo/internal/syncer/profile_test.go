package syncer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func profileValues(t *testing.T, payload map[string]any) api.ProfilePreferences {
	t.Helper()
	values, err := api.NewProfilePreferences(payload)
	if err != nil {
		t.Fatal(err)
	}
	return values
}

func TestProfileQueueMergesLatestPersistsAndKeepsOriginal(t *testing.T) {
	user := api.User{ID: 1, Timezone: "Asia/Shanghai", DefaultReminderEnabled: true}
	original := storage.Cache{Server: "http://example.test", UserID: 1}
	state, err := QueueProfile(original, user, profileValues(t, map[string]any{"timezone": "Europe/London", "default_reminder_enabled": false}))
	if err != nil {
		t.Fatal(err)
	}
	next, err := QueueProfile(state, state.ProfileChanges.Values.Apply(user), profileValues(t, map[string]any{"timezone": "America/New_York"}))
	if err != nil {
		t.Fatal(err)
	}
	if original.ProfileChanges != nil || state.ProfileChanges.Values.Apply(user).Timezone != "Europe/London" {
		t.Fatal("mutated input")
	}
	store := storage.Store{Dir: t.TempDir()}
	if err := store.SaveCache(next); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Cache(next.Server, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	effective, base := restored.ProfileChanges.Values.Apply(user), restored.ProfileChanges.Base.Apply(user)
	if effective.Timezone != "America/New_York" || effective.DefaultReminderEnabled || base.Timezone != "Asia/Shanghai" || !base.DefaultReminderEnabled {
		t.Fatal(effective, base)
	}
	if _, err := QueueProfile(original, api.User{ID: 2}, profileValues(t, map[string]any{"timezone": "UTC"})); err == nil {
		t.Fatal("mixed account queue")
	}
}

func TestProfileReplayAfterLostResponseOnlySendsEditedFields(t *testing.T) {
	user := api.User{ID: 1, Timezone: "Asia/Shanghai", DefaultReminderEnabled: true, DefaultNoonTime: "13:15"}
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "PATCH" || r.URL.Path != "/api/auth/profile" {
			t.Error(r.Method, r.URL)
		}
		var values api.ProfilePreferences
		if err := json.NewDecoder(r.Body).Decode(&values); err != nil {
			t.Error(err)
		}
		if len(values) != 2 || string(values["default_reminder_enabled"]) != "false" || string(values["timezone"]) != `"Europe/London"` {
			t.Error(values)
		}
		user = values.Apply(user)
		if calls == 1 {
			conn, _, err := w.(http.Hijacker).Hijack()
			if err != nil {
				t.Error(err)
				return
			}
			conn.Close()
			return
		}
		json.NewEncoder(w).Encode(user)
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	session := api.Session{Server: server.URL, Token: "jwt", User: user}
	store := storage.Store{Dir: t.TempDir()}
	state, _ := QueueProfile(storage.Cache{Server: server.URL, UserID: 1}, user, profileValues(t, map[string]any{"timezone": "Europe/London", "default_reminder_enabled": false}))
	state, _, err := FlushProfile(context.Background(), client, store, state, session)
	if err == nil || state.ProfileChanges == nil || state.ProfileChanges.Rejected {
		t.Fatal("uncertain result lost intent", state, err)
	}
	state, _ = store.Cache(server.URL, 1)
	state, confirmed, err := FlushProfile(context.Background(), client, store, state, session)
	if err != nil || state.ProfileChanges != nil || calls != 2 || confirmed.DefaultNoonTime != "13:15" || confirmed.DefaultReminderEnabled {
		t.Fatal(state, confirmed, calls, err)
	}
	saved, _ := store.Session()
	if saved.User.Timezone != "Europe/London" {
		t.Fatal(saved)
	}
}

func TestProfileAcknowledgementWriteFailuresKeepDurableIntent(t *testing.T) {
	for _, filename := range []string{"session.json", "cache.json"} {
		t.Run(filename, func(t *testing.T) {
			user := api.User{ID: 1, Timezone: "Europe/London"}
			store := storage.Store{Dir: t.TempDir()}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(user) }))
			defer server.Close()
			client, _ := api.New(server.URL, "jwt")
			state, _ := QueueProfile(storage.Cache{Server: server.URL, UserID: 1}, api.User{ID: 1, Timezone: "UTC"}, profileValues(t, map[string]any{"timezone": "Europe/London"}))
			if err := store.SaveCache(state); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(store.Dir, filename)
			if filename == "cache.json" {
				if err := os.Rename(path, path+".backup"); err != nil {
					t.Fatal(err)
				}
			}
			if err := os.Mkdir(path, 0700); err != nil {
				t.Fatal(err)
			}
			result, confirmed, err := FlushProfile(context.Background(), client, store, state, api.Session{Server: server.URL, User: user})
			if err == nil || result.ProfileChanges == nil || confirmed.Timezone != "Europe/London" || !strings.Contains(err.Error(), "服务器已保存设置") {
				t.Fatal(result, confirmed, err)
			}
			if err := os.Remove(path); err != nil {
				t.Fatal(err)
			}
			if filename == "cache.json" {
				if err := os.Rename(path+".backup", path); err != nil {
					t.Fatal(err)
				}
			}
			persisted, _ := store.Cache(server.URL, 1)
			if persisted.ProfileChanges == nil {
				t.Fatal("lost unacknowledged intent")
			}
			result, _, err = FlushProfile(context.Background(), client, store, persisted, api.Session{Server: server.URL, User: user})
			if err != nil || result.ProfileChanges != nil {
				t.Fatal(result, err)
			}
		})
	}
}

func TestProfileRejectedAndTamperedIntentAreNotRepeated(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(400)
		w.Write([]byte(`{"error":"invalid timezone"}`))
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	store := storage.Store{Dir: t.TempDir()}
	user := api.User{ID: 1, Timezone: "UTC"}
	session := api.Session{Server: server.URL, User: user}
	state, _ := QueueProfile(storage.Cache{Server: server.URL, UserID: 1}, user, profileValues(t, map[string]any{"timezone": "Europe/London"}))
	state, _, err := FlushProfile(context.Background(), client, store, state, session)
	if err == nil || !state.ProfileChanges.Rejected || calls != 1 {
		t.Fatal(state, calls, err)
	}
	state, _, err = FlushProfile(context.Background(), client, store, state, session)
	if err != nil || calls != 1 {
		t.Fatal("repeated rejected patch", calls, err)
	}
	state, _ = QueueProfile(state, user, profileValues(t, map[string]any{"timezone": "Asia/Shanghai"}))
	if state.ProfileChanges.Rejected || state.ProfileChanges.Failure != "" {
		t.Fatal("edit did not allow retry")
	}
	state.ProfileChanges.Values["password"] = json.RawMessage(`"secret"`)
	state, _, err = FlushProfile(context.Background(), client, store, state, session)
	if err == nil || !state.ProfileChanges.Rejected || calls != 1 {
		t.Fatal("tampered sensitive field sent", calls, err)
	}
}
