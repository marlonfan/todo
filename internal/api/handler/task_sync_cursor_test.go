package handler

import (
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestResolveTaskSyncCursorDoesNotAdvancePastFullChangedStream(t *testing.T) {
	since := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	changedBoundary := since.Add(10 * time.Minute)
	laterDeleted := since.Add(30 * time.Minute)
	now := since.Add(time.Hour)

	nextSince, hasMore := resolveTaskSyncCursor(
		since,
		[]models.Task{
			{UpdatedAt: since.Add(5 * time.Minute)},
			{UpdatedAt: changedBoundary},
		},
		[]models.TaskDeleteLog{
			{DeletedAt: laterDeleted},
		},
		2,
		now,
	)

	if !hasMore {
		t.Fatalf("hasMore = false, want true")
	}
	if !nextSince.Equal(changedBoundary) {
		t.Fatalf("nextSince = %s, want changed boundary %s", nextSince, changedBoundary)
	}
}

func TestResolveTaskSyncCursorAdvancesToNowWhenFullyDrained(t *testing.T) {
	since := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	now := since.Add(time.Hour)

	nextSince, hasMore := resolveTaskSyncCursor(
		since,
		[]models.Task{{UpdatedAt: since.Add(5 * time.Minute)}},
		[]models.TaskDeleteLog{{DeletedAt: since.Add(10 * time.Minute)}},
		10,
		now,
	)

	if hasMore {
		t.Fatalf("hasMore = true, want false")
	}
	if !nextSince.Equal(now) {
		t.Fatalf("nextSince = %s, want now %s", nextSince, now)
	}
}

func TestParseTaskSyncWaitDuration(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want time.Duration
	}{
		{name: "empty", raw: "", want: 0},
		{name: "seconds", raw: "7", want: 7 * time.Second},
		{name: "duration", raw: "1500ms", want: 1500 * time.Millisecond},
		{name: "negative", raw: "-1", want: 0},
		{name: "clamped", raw: "120", want: taskSyncMaxWaitDuration},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseTaskSyncWaitDuration(tt.raw)
			if err != nil {
				t.Fatalf("parseTaskSyncWaitDuration(%q): %v", tt.raw, err)
			}
			if got != tt.want {
				t.Fatalf("wait duration = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestParseTaskSyncWaitDurationRejectsInvalid(t *testing.T) {
	if _, err := parseTaskSyncWaitDuration("not-a-duration"); err == nil {
		t.Fatalf("parseTaskSyncWaitDuration returned nil error for invalid input")
	}
}
