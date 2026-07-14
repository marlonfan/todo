package migrations

import (
	"strings"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigrateCreatesQueryIndexes(t *testing.T) {
	t.Parallel()
	db, err := gorm.Open(sqlite.Open("file:index-migration?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}

	queries := map[string]string{
		"idx_tasks_user_updated_id":                `SELECT id FROM tasks WHERE user_id = 1 AND updated_at > '2026-01-01' ORDER BY updated_at ASC, id ASC`,
		"idx_task_occurrences_user_status_date_id": `SELECT id FROM task_occurrences WHERE user_id = 1 AND status = 'pending' ORDER BY occurrence_date DESC, id DESC`,
		"idx_caldav_events_user_start_id":          `SELECT id FROM caldav_event_caches WHERE user_id = 1 AND start_time < '2026-02-01' ORDER BY start_time ASC, id ASC`,
		"idx_caldav_events_scope_start":            `SELECT id FROM caldav_event_caches WHERE user_id = 1 AND source_id = 2 AND calendar_id = 3 ORDER BY start_time ASC`,
	}
	for indexName, query := range queries {
		var planRows []struct {
			Detail string `gorm:"column:detail"`
		}
		if err := db.Raw("EXPLAIN QUERY PLAN " + query).Scan(&planRows).Error; err != nil {
			t.Fatalf("explain %s: %v", indexName, err)
		}
		var details []string
		for _, row := range planRows {
			details = append(details, row.Detail)
		}
		plan := strings.Join(details, " | ")
		if !strings.Contains(plan, indexName) {
			t.Errorf("query did not use %s: %s", indexName, plan)
		}
	}
}
