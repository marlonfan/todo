package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNotificationReadsNeverRetainServerCredentials(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer jwt" {
			t.Error("missing auth")
		}
		switch r.URL.Path {
		case "/api/notify/settings":
			fmt.Fprint(w, `[{"id":3,"channel":"telegram","configured":true,"is_default":true,"config":{"bot_token":"never-retain"}}]`)
		case "/api/notify/channels":
			fmt.Fprint(w, `{"channels":["telegram","webhook"]}`)
		case "/api/tasks/4/notifications":
			fmt.Fprint(w, `[{"id":5,"task_id":4,"source":"manual","status":"pending","notify_at":"2026-11-10T01:00:00Z","config":{"token":"never-retain"}}]`)
		case "/api/tasks/4/activities":
			if r.URL.Query().Get("limit") != "500" {
				t.Error(r.URL.String())
			}
			fmt.Fprint(w, `[{"id":1,"task_id":4,"changes":{"title":{"from":"旧标题","to":"新标题"}},"occurred_at":"2026-11-09T00:00:00Z","submit_source":"mygo-native"}]`)
		default:
			t.Error(r.URL.String())
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "jwt")
	settings, err := c.NotifySettings(context.Background())
	if err != nil || len(settings) != 1 || !settings[0].IsDefault {
		t.Fatal(settings, err)
	}
	notifications, err := c.TaskNotifications(context.Background(), 4)
	if err != nil || len(notifications) != 1 || notifications[0].Source != "manual" {
		t.Fatal(notifications, err)
	}
	raw, _ := json.Marshal([]any{settings, notifications})
	if strings.Contains(string(raw), "never-retain") || strings.Contains(string(raw), `"config":`) {
		t.Fatal("credential response retained", string(raw))
	}
	channels, err := c.NotifyChannels(context.Background())
	if err != nil || len(channels) != 2 {
		t.Fatal(channels, err)
	}
	activities, err := c.TaskActivities(context.Background(), 4, 500)
	if err != nil || len(activities) != 1 || string(activities[0].Changes["title"].To) != `"新标题"` {
		t.Fatal(activities, err)
	}
}
