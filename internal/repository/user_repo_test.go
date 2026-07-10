package repository

import (
	"strings"
	"testing"
	"time"

	"todo-app/internal/models"
	"todo-app/migrations"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestUpdatePreservesConcurrentCalDAVProperties(t *testing.T) {
	dsn := "file:user-repo-test-" + strings.NewReplacer("/", "-", " ", "-").Replace(t.Name()) + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	repo := NewUserRepository(db)
	user := &models.User{Username: "caldav-settings", Email: "caldav-settings@example.com", PasswordHash: "hash"}
	if err := repo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	stale, err := repo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("load stale user: %v", err)
	}

	updates := map[string]interface{}{
		"cal_dav_calendar_name":  "Apple Todo",
		"cal_dav_calendar_desc":  "Updated by Calendar",
		"cal_dav_calendar_color": "#112233FF",
		"cal_dav_calendar_order": 9,
	}
	if err := repo.UpdateCalDAVCalendarProperties(user.ID, updates); err != nil {
		t.Fatalf("update CalDAV properties: %v", err)
	}
	stale.Timezone = "Asia/Shanghai"
	if err := repo.Update(stale); err != nil {
		t.Fatalf("save stale profile: %v", err)
	}

	got, err := repo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if got.Timezone != "Asia/Shanghai" {
		t.Fatalf("timezone=%q", got.Timezone)
	}
	if got.CalDAVCalendarName != "Apple Todo" || got.CalDAVCalendarDesc != "Updated by Calendar" || got.CalDAVCalendarColor != "#112233FF" || got.CalDAVCalendarOrder != 9 {
		t.Fatalf("CalDAV properties overwritten by stale profile save: %+v", got)
	}
}
