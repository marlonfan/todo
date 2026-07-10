package repository

import (
	"testing"
	"time"
	"todo-app/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEventCollectionStateScansSQLiteAggregateTime(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.CaldavEventCache{}); err != nil {
		t.Fatalf("migrate caldav events: %v", err)
	}
	repo := NewCaldavRepository(db)
	base := time.Date(2026, 7, 10, 8, 0, 0, 0, time.UTC)
	end := base.Add(30 * time.Minute)
	events := []models.CaldavEventCache{
		{UserID: 41, SourceID: 1, CalendarID: 1, EventUID: "included", Title: "Included", StartTime: base, EndTime: &end, UpdatedAt: base.Add(time.Minute)},
		{UserID: 41, SourceID: 1, CalendarID: 1, EventUID: "cancelled", Title: "Cancelled", Status: "cancelled", StartTime: base, EndTime: &end, UpdatedAt: base.Add(2 * time.Minute)},
		{UserID: 41, SourceID: 1, CalendarID: 1, EventUID: "outside", Title: "Outside", StartTime: base.Add(48 * time.Hour), UpdatedAt: base.Add(3 * time.Minute)},
	}
	if err := db.Create(&events).Error; err != nil {
		t.Fatalf("create events: %v", err)
	}

	state, err := repo.EventCollectionStateInRange(41, base.Add(-time.Hour), base.Add(time.Hour))
	if err != nil {
		t.Fatalf("collection state: %v", err)
	}
	if state.Count != 1 || !state.MaxUpdatedAt.Equal(base.Add(time.Minute)) {
		t.Fatalf("state=%+v", state)
	}
}
