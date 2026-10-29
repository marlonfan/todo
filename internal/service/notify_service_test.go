package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"todo-app/internal/models"
	"todo-app/internal/notify"
)

type savedSettingNotifier struct {
	testSuccessNotifier
	config map[string]string
}

func (n *savedSettingNotifier) Send(_ context.Context, _ int64, config map[string]string, _ *notify.Message) error {
	n.sent++
	n.config = config
	return nil
}

func TestNotificationUsesOwnedSavedSettingWithoutExposingConfig(t *testing.T) {
	svc, _, _, repo, userID, _ := newNotifyRolloverTestServices(t)
	settings, err := repo.GetUserSettings(userID)
	if err != nil || len(settings) != 1 {
		t.Fatalf("settings=%v error=%v", settings, err)
	}
	plugin := &savedSettingNotifier{}
	svc.registry.Register(plugin)
	request := &models.TestNotificationRequest{SettingID: settings[0].ID, Config: models.NotifyConfigMap{"topic": "untrusted-client"}}
	if err := svc.TestNotification(userID, request); err != nil {
		t.Fatal(err)
	}
	if plugin.sent != 1 || plugin.config["topic"] != "unit-test" {
		t.Fatalf("send count=%d config=%v", plugin.sent, plugin.config)
	}
	if err := svc.TestNotification(userID+1, request); err == nil {
		t.Fatal("another user's saved setting must not be usable")
	}
	if plugin.sent != 1 {
		t.Fatal("unauthorized test sent a notification")
	}
	if err := svc.TestNotification(userID, &models.TestNotificationRequest{Channel: models.NotifyChannelNtfy, Config: models.NotifyConfigMap{"topic": "draft"}}); err != nil {
		t.Fatal(err)
	}
	if plugin.sent != 2 || plugin.config["topic"] != "draft" {
		t.Fatal("draft notification config must still work")
	}
}

func TestBuildDedupeKeyStable(t *testing.T) {
	at := time.Date(2026, 3, 1, 12, 30, 0, 0, time.UTC)
	key := buildDedupeKey(42, models.NotificationSourceDefaultAuto, at)
	if key == "" {
		t.Fatalf("dedupe key should not be empty")
	}
	if !strings.Contains(key, "42|default_auto|") {
		t.Fatalf("unexpected dedupe key format: %s", key)
	}
}

func TestNextRetryDelayCapped(t *testing.T) {
	if got := nextRetryDelay(0); got != time.Minute {
		t.Fatalf("retry delay(0) = %v, want %v", got, time.Minute)
	}
	if got := nextRetryDelay(1); got != 2*time.Minute {
		t.Fatalf("retry delay(1) = %v, want %v", got, 2*time.Minute)
	}
	if got := nextRetryDelay(10); got != maxRetryDelay {
		t.Fatalf("retry delay should cap at %v, got %v", maxRetryDelay, got)
	}
}
