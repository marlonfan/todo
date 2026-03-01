package service

import (
	"strings"
	"testing"
	"time"

	"todo-app/internal/models"
)

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
