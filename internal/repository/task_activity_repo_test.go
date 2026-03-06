package repository

import (
	"testing"
	"time"
	"todo-app/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openTaskActivityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.TaskActivity{}); err != nil {
		t.Fatalf("migrate task activities: %v", err)
	}
	return db
}

func TestTaskActivityRepoMergeWithinWindow(t *testing.T) {
	db := openTaskActivityTestDB(t)
	repo := NewTaskActivityRepository(db)

	base := time.Date(2026, 3, 6, 8, 0, 0, 0, time.UTC)
	if err := repo.RecordWithMerge(1, 22, base, "manual", models.TaskActivityChanges{
		"title": {From: "A", To: "B"},
	}, 15*time.Minute); err != nil {
		t.Fatalf("record first activity: %v", err)
	}
	if err := repo.RecordWithMerge(1, 22, base.Add(10*time.Minute), "idle", models.TaskActivityChanges{
		"title": {From: "B", To: "C"},
	}, 15*time.Minute); err != nil {
		t.Fatalf("record second activity: %v", err)
	}

	rows, err := repo.ListByTask(1, 22, 20)
	if err != nil {
		t.Fatalf("list activities: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 merged activity, got %d", len(rows))
	}
	titleChange := rows[0].Changes["title"]
	if titleChange.From != "A" || titleChange.To != "C" {
		t.Fatalf("expected merged title change A->C, got %#v", titleChange)
	}
	if !rows[0].OccurredAt.Equal(base.Add(10 * time.Minute)) {
		t.Fatalf("expected merged occurred_at to be latest submit time")
	}
}

func TestTaskActivityRepoMergeDropsNoopChange(t *testing.T) {
	db := openTaskActivityTestDB(t)
	repo := NewTaskActivityRepository(db)

	base := time.Date(2026, 3, 6, 8, 0, 0, 0, time.UTC)
	if err := repo.RecordWithMerge(1, 99, base, "manual", models.TaskActivityChanges{
		"title": {From: "A", To: "B"},
	}, 15*time.Minute); err != nil {
		t.Fatalf("record first activity: %v", err)
	}
	if err := repo.RecordWithMerge(1, 99, base.Add(5*time.Minute), "manual", models.TaskActivityChanges{
		"title": {From: "B", To: "A"},
	}, 15*time.Minute); err != nil {
		t.Fatalf("record second activity: %v", err)
	}

	rows, err := repo.ListByTask(1, 99, 20)
	if err != nil {
		t.Fatalf("list activities: %v", err)
	}
	if len(rows) != 0 {
		t.Fatalf("expected noop merge to remove latest activity, got %d rows", len(rows))
	}
}

func TestTaskActivityRepoKeepsSeparateRowsOutsideWindow(t *testing.T) {
	db := openTaskActivityTestDB(t)
	repo := NewTaskActivityRepository(db)

	base := time.Date(2026, 3, 6, 8, 0, 0, 0, time.UTC)
	if err := repo.RecordWithMerge(1, 7, base, "manual", models.TaskActivityChanges{
		"priority": {From: float64(0), To: float64(1)},
	}, 15*time.Minute); err != nil {
		t.Fatalf("record first activity: %v", err)
	}
	if err := repo.RecordWithMerge(1, 7, base.Add(21*time.Minute), "manual", models.TaskActivityChanges{
		"description": {From: "", To: "updated"},
	}, 15*time.Minute); err != nil {
		t.Fatalf("record second activity: %v", err)
	}

	rows, err := repo.ListByTask(1, 7, 20)
	if err != nil {
		t.Fatalf("list activities: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 separate rows, got %d", len(rows))
	}
}
