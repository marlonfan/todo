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
