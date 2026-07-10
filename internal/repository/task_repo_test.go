package repository

import (
	"testing"
	"time"
	"todo-app/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func openTaskRepoTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Category{}, &models.Task{}, &models.TaskDeleteLog{}, &models.TaskCategory{}); err != nil {
		t.Fatalf("migrate task repo tables: %v", err)
	}
	return db
}

func TestListChangedSinceIncludesFullTimestampBoundary(t *testing.T) {
	db := openTaskRepoTestDB(t)
	repo := NewTaskRepository(db)
	base := time.Date(2026, 3, 1, 8, 0, 0, 0, time.UTC)

	user := &models.User{Username: "boundary", Email: "boundary@example.com", PasswordHash: "hash"}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	tasks := []models.Task{
		{UserID: user.ID, Title: "first", Status: models.TaskStatusPending, Revision: 1, CreatedAt: base, UpdatedAt: base.Add(time.Minute)},
		{UserID: user.ID, Title: "boundary-a", Status: models.TaskStatusPending, Revision: 1, CreatedAt: base, UpdatedAt: base.Add(2 * time.Minute)},
		{UserID: user.ID, Title: "boundary-b", Status: models.TaskStatusPending, Revision: 1, CreatedAt: base, UpdatedAt: base.Add(2 * time.Minute)},
	}
	if err := db.Create(&tasks).Error; err != nil {
		t.Fatalf("create tasks: %v", err)
	}

	got, err := repo.ListChangedSince(user.ID, base, 2)
	if err != nil {
		t.Fatalf("list changed since: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("changed rows = %d, want all 3 rows sharing the page boundary", len(got))
	}
	if got[1].Title != "boundary-a" || got[2].Title != "boundary-b" {
		t.Fatalf("unexpected boundary rows: %q, %q", got[1].Title, got[2].Title)
	}
}

func TestCalendarCollectionStateScansSQLiteAggregateTime(t *testing.T) {
	db := openTaskRepoTestDB(t)
	repo := NewTaskRepository(db)
	base := time.Date(2026, 7, 10, 8, 0, 0, 0, time.UTC)

	user := &models.User{Username: "collection-state", Email: "collection-state@example.com", PasswordHash: "hash"}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	tasks := []models.Task{
		{UserID: user.ID, Title: "included-old", Status: models.TaskStatusPending, Revision: 2, CreatedAt: base, UpdatedAt: base.Add(time.Minute)},
		{UserID: user.ID, Title: "included-latest", Status: models.TaskStatusCompleted, Revision: 7, CreatedAt: base, UpdatedAt: base.Add(2 * time.Minute)},
		{UserID: user.ID, Title: "cancelled", Status: models.TaskStatusCancelled, Revision: 9, CreatedAt: base, UpdatedAt: base.Add(3 * time.Minute)},
		{UserID: user.ID, Title: "skipped", Status: models.TaskStatusSkipped, Revision: 10, CreatedAt: base, UpdatedAt: base.Add(4 * time.Minute)},
	}
	if err := db.Create(&tasks).Error; err != nil {
		t.Fatalf("create tasks: %v", err)
	}

	state, err := repo.CalendarCollectionState(user.ID)
	if err != nil {
		t.Fatalf("collection state: %v", err)
	}
	if state.Count != 2 || state.MaxRevision != 7 || !state.MaxUpdatedAt.Equal(base.Add(2*time.Minute)) {
		t.Fatalf("state=%+v", state)
	}
}
