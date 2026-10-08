package service

import (
	"errors"
	"fmt"
	"gorm.io/gorm"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
	"todo-app/internal/config"
	"todo-app/internal/database"
	"todo-app/internal/models"
	"todo-app/internal/repository"
	"todo-app/migrations"
)

func consistencyTestService(t *testing.T, driver string) (*TaskService, *gorm.DB, int64) {
	t.Helper()
	cfg := config.DatabaseConfig{Driver: "sqlite", DSN: filepath.Join(t.TempDir(), "consistency.db")}
	if driver == "postgres" {
		dsn := os.Getenv("TODO_TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TODO_TEST_POSTGRES_DSN is not configured")
		}
		base, err := database.NewDB(&config.DatabaseConfig{Driver: driver, DSN: dsn})
		if err != nil {
			t.Fatal(err)
		}
		schema := fmt.Sprintf("todo_test_%d", time.Now().UnixNano())
		if err = base.Exec("CREATE SCHEMA " + schema).Error; err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { base.Exec("DROP SCHEMA " + schema + " CASCADE"); sqlDB, _ := base.DB(); sqlDB.Close() })
		if parsed, err := url.Parse(dsn); err == nil && parsed.Scheme != "" {
			q := parsed.Query()
			q.Set("search_path", schema)
			parsed.RawQuery = q.Encode()
			dsn = parsed.String()
		} else {
			dsn += " search_path=" + schema
		}
		cfg = config.DatabaseConfig{Driver: driver, DSN: dsn}
	}
	db, err := database.NewDB(&cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB, _ := db.DB(); sqlDB.Close() })
	if err = migrations.Migrate(db); err != nil {
		t.Fatal(err)
	}
	user := &models.User{Username: "consistency", Email: "consistency@example.com", PasswordHash: "hash"}
	if err = db.Create(user).Error; err != nil {
		t.Fatal(err)
	}
	svc := NewTaskService(repository.NewTaskRepository(db), nil, repository.NewCategoryRepository(db), repository.NewUserRepository(db), repository.NewNotificationRepository(db))
	return svc, db, user.ID
}

func TestConcurrentTaskRevision(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			svc, _, uid := consistencyTestService(t, driver)
			task, err := svc.Create(uid, &models.CreateTaskRequest{Title: "original"})
			if err != nil {
				t.Fatal(err)
			}
			revision := task.Revision
			var wg sync.WaitGroup
			start := make(chan struct{})
			results := make(chan error, 2)
			for _, title := range []string{"first", "second"} {
				wg.Add(1)
				go func(title string) {
					defer wg.Done()
					<-start
					_, err := svc.Update(uid, task.ID, &models.UpdateTaskRequest{Title: title}, map[string]bool{"title": true}, &revision, nil)
					results <- err
				}(title)
			}
			close(start)
			wg.Wait()
			close(results)
			success, conflicts := 0, 0
			for err := range results {
				var conflict *RevisionConflictError
				if err == nil {
					success++
				} else if errors.As(err, &conflict) {
					conflicts++
				} else {
					t.Fatal(err)
				}
			}
			if success != 1 || conflicts != 1 {
				t.Fatalf("success=%d conflicts=%d", success, conflicts)
			}
			stored, err := svc.GetByID(uid, task.ID)
			if err != nil {
				t.Fatal(err)
			}
			if stored.Revision != 2 {
				t.Fatalf("revision=%d", stored.Revision)
			}
		})
	}
}

func TestSyncJournalIncludesDelayedCommitAndDeletion(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			svc, db, uid := consistencyTestService(t, driver)
			task, err := svc.Create(uid, &models.CreateTaskRequest{Title: "before"})
			if err != nil {
				t.Fatal(err)
			}
			_, _, cursor, _, err := svc.ListChangesAfter(uid, 0, 200)
			if err != nil {
				t.Fatal(err)
			}
			tx := db.Begin()
			if tx.Error != nil {
				t.Fatal(tx.Error)
			}
			defer tx.Rollback()
			task.Title = "after"
			task.Revision++
			if err = repository.NewTaskRepository(tx).UpdateIfRevision(task, task.Revision-1); err != nil {
				t.Fatal(err)
			}
			items, deleted, next, _, err := svc.ListChangesAfter(uid, cursor, 200)
			if err != nil {
				t.Fatal(err)
			}
			if len(items) != 0 || len(deleted) != 0 || next != cursor {
				t.Fatal("cursor advanced past uncommitted transaction")
			}
			if err = tx.Commit().Error; err != nil {
				t.Fatal(err)
			}
			items, _, next, _, err = svc.ListChangesAfter(uid, cursor, 1)
			if err != nil {
				t.Fatal(err)
			}
			if len(items) != 1 || items[0].Title != "after" || next <= cursor {
				t.Fatal("delayed commit was skipped")
			}
			if err = svc.Delete(uid, task.ID, nil); err != nil {
				t.Fatal(err)
			}
			items, deleted, _, _, err = svc.ListChangesAfter(uid, next, 1)
			if err != nil {
				t.Fatal(err)
			}
			if len(items) != 0 || len(deleted) != 1 || deleted[0].TaskID != task.ID {
				t.Fatal("missing deletion tombstone")
			}
		})
	}
}

func TestMutationReceiptFailureRollsBackAndReplaySurvivesDeletion(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			svc, db, uid := consistencyTestService(t, driver)
			mutate := func(s *TaskService) (*models.Task, error) {
				return s.Create(uid, &models.CreateTaskRequest{Title: "atomic"})
			}
			if err := db.Callback().Create().Before("gorm:create").Register("reject_test_receipt", func(tx *gorm.DB) {
				if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "TaskMutationReceipt" {
					tx.AddError(errors.New("forced receipt failure"))
				}
			}); err != nil {
				t.Fatal(err)
			}
			_, _, err := svc.ExecuteMutation(uid, "same-op", "create", 0, "same-payload", mutate)
			db.Callback().Create().Remove("reject_test_receipt")
			if !errors.Is(err, ErrMutationPersistence) {
				t.Fatalf("got %v", err)
			}
			var count int64
			db.Model(&models.Task{}).Count(&count)
			if count != 0 {
				t.Fatal("task committed without receipt")
			}
			db.Model(&models.TaskChangeLog{}).Count(&count)
			if count != 0 {
				t.Fatal("journal committed without task")
			}
			first, replay, err := svc.ExecuteMutation(uid, "same-op", "create", 0, "same-payload", mutate)
			if err != nil || replay {
				t.Fatal(err)
			}
			second, replay, err := svc.ExecuteMutation(uid, "same-op", "create", 0, "same-payload", mutate)
			if err != nil || !replay || first.ID != second.ID {
				t.Fatal("retry created another task", err)
			}
			if err = svc.Delete(uid, first.ID, nil); err != nil {
				t.Fatal(err)
			}
			_, replay, err = svc.ExecuteMutation(uid, "same-op", "create", 0, "same-payload", mutate)
			if err != nil || !replay {
				t.Fatal(err)
			}
			db.Model(&models.Task{}).Count(&count)
			if count != 0 {
				t.Fatal("replay resurrected deleted task")
			}
			_, _, err = svc.ExecuteMutation(uid, "same-op", "create", 0, "different-payload", mutate)
			if !errors.Is(err, ErrOperationMismatch) {
				t.Fatal("op ID reuse accepted")
			}
		})
	}
}

func TestConcurrentCreateReplay(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			svc, db, uid := consistencyTestService(t, driver)
			var wg sync.WaitGroup
			results := make(chan error, 4)
			for i := 0; i < 4; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					_, _, err := svc.ExecuteMutation(uid, "concurrent-op", "create", 0, "payload", func(s *TaskService) (*models.Task, error) {
						return s.Create(uid, &models.CreateTaskRequest{Title: "once"})
					})
					results <- err
				}()
			}
			wg.Wait()
			close(results)
			for err := range results {
				if err != nil {
					t.Fatal(err)
				}
			}
			var count int64
			db.Model(&models.Task{}).Count(&count)
			if count != 1 {
				t.Fatalf("created %d tasks", count)
			}
		})
	}
}

func TestSyncJournalCommitOrderCannotBeOvertaken(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			svc, db, uid := consistencyTestService(t, driver)
			first, err := svc.Create(uid, &models.CreateTaskRequest{Title: "first"})
			if err != nil {
				t.Fatal(err)
			}
			second, err := svc.Create(uid, &models.CreateTaskRequest{Title: "second"})
			if err != nil {
				t.Fatal(err)
			}
			_, _, cursor, _, err := svc.ListChangesAfter(uid, 0, 200)
			if err != nil {
				t.Fatal(err)
			}
			tx := db.Begin()
			defer tx.Rollback()
			first.Title = "delayed"
			first.Revision++
			if err = repository.NewTaskRepository(tx).UpdateIfRevision(first, first.Revision-1); err != nil {
				t.Fatal(err)
			}
			results := make(chan error, 1)
			go func() {
				_, err := svc.Update(uid, second.ID, &models.UpdateTaskRequest{Title: "later"}, map[string]bool{"title": true}, nil, nil)
				results <- err
			}()
			select {
			case err := <-results:
				t.Fatalf("write overtook uncommitted change: %v", err)
			case <-time.After(50 * time.Millisecond):
			}
			if err = tx.Commit().Error; err != nil {
				t.Fatal(err)
			}
			select {
			case err = <-results:
				if err != nil {
					t.Fatal(err)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("writer did not resume")
			}
			tasks, _, next, more, err := svc.ListChangesAfter(uid, cursor, 1)
			if err != nil || len(tasks) != 1 || tasks[0].ID != first.ID || !more {
				t.Fatalf("first page=%+v more=%v err=%v", tasks, more, err)
			}
			tasks, _, _, more, err = svc.ListChangesAfter(uid, next, 1)
			if err != nil || len(tasks) != 1 || tasks[0].ID != second.ID || more {
				t.Fatalf("second page=%+v more=%v err=%v", tasks, more, err)
			}
		})
	}
}

func TestMigrationNormalizesLegacyRevisionAndBackfillIsIdempotent(t *testing.T) {
	for _, driver := range []string{"sqlite", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			svc, db, uid := consistencyTestService(t, driver)
			task, err := svc.Create(uid, &models.CreateTaskRequest{Title: "legacy"})
			if err != nil {
				t.Fatal(err)
			}
			if err = db.Model(&models.Task{}).Where("id = ?", task.ID).Update("revision", 0).Error; err != nil {
				t.Fatal(err)
			}
			if err = db.Where("user_id = ?", uid).Delete(&models.TaskChangeLog{}).Error; err != nil {
				t.Fatal(err)
			}
			for i := 0; i < 2; i++ {
				if err = migrations.Migrate(db); err != nil {
					t.Fatal(err)
				}
			}
			stored, err := svc.GetByID(uid, task.ID)
			if err != nil || stored.Revision != 1 {
				t.Fatalf("legacy revision=%+v %v", stored, err)
			}
			expected := int64(1)
			if _, err = svc.Update(uid, task.ID, &models.UpdateTaskRequest{Title: "edited"}, map[string]bool{"title": true}, &expected, nil); err != nil {
				t.Fatal(err)
			}
			var count int64
			if err = db.Model(&models.TaskChangeLog{}).Where("user_id = ?", uid).Count(&count).Error; err != nil {
				t.Fatal(err)
			}
			if count != 2 {
				t.Fatalf("backfill duplicated entries: %d", count)
			}
		})
	}
}
