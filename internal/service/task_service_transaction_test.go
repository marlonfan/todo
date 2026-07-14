package service

import (
	"fmt"
	"testing"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"
	"todo-app/migrations"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateTaskRollsBackWhenCategoryWriteFails(t *testing.T) {
	t.Parallel()
	dsn := fmt.Sprintf("file:task-service-transaction-%d?mode=memory&cache=shared&_foreign_keys=on", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatal(err)
	}

	userRepo := repository.NewUserRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	user := &models.User{Username: "transaction-user", Email: "transaction@example.com", PasswordHash: "hash", Timezone: "UTC"}
	if err := userRepo.Create(user); err != nil {
		t.Fatal(err)
	}
	category := &models.Category{UserID: user.ID, Name: "blocked"}
	if err := categoryRepo.Create(category); err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`
		CREATE TRIGGER reject_task_category
		BEFORE INSERT ON task_categories
		BEGIN
			SELECT RAISE(FAIL, 'forced category failure');
		END;
	`).Error; err != nil {
		t.Fatal(err)
	}

	taskRepo := repository.NewTaskRepository(db)
	svc := NewTaskService(
		taskRepo,
		repository.NewTaskActivityRepository(db),
		categoryRepo,
		userRepo,
		repository.NewNotificationRepository(db),
	)
	_, err = svc.Create(user.ID, &models.CreateTaskRequest{Title: "must rollback", CategoryIDs: []int64{category.ID}})
	if err == nil {
		t.Fatal("expected category association failure")
	}

	var count int64
	if err := db.Model(&models.Task{}).Where("user_id = ?", user.ID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("expected task insert to roll back, found %d task(s)", count)
	}
}

func TestUpdateTaskRollsBackBaseAndRevisionWhenCategoryWriteFails(t *testing.T) {
	t.Parallel()
	dsn := fmt.Sprintf("file:task-service-update-transaction-%d?mode=memory&cache=shared&_foreign_keys=on", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatal(err)
	}

	userRepo := repository.NewUserRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	user := &models.User{Username: "update-user", Email: "update@example.com", PasswordHash: "hash", Timezone: "UTC"}
	if err := userRepo.Create(user); err != nil {
		t.Fatal(err)
	}
	category := &models.Category{UserID: user.ID, Name: "blocked"}
	if err := categoryRepo.Create(category); err != nil {
		t.Fatal(err)
	}

	taskRepo := repository.NewTaskRepository(db)
	svc := NewTaskService(taskRepo, nil, categoryRepo, userRepo, repository.NewNotificationRepository(db))
	task, err := svc.Create(user.ID, &models.CreateTaskRequest{Title: "original"})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`
		CREATE TRIGGER reject_task_category_update
		BEFORE INSERT ON task_categories
		BEGIN
			SELECT RAISE(FAIL, 'forced category failure');
		END;
	`).Error; err != nil {
		t.Fatal(err)
	}

	_, err = svc.Update(
		user.ID,
		task.ID,
		&models.UpdateTaskRequest{Title: "changed", CategoryIDs: []int64{category.ID}},
		map[string]bool{"title": true, "category_ids": true},
		nil,
		nil,
	)
	if err == nil {
		t.Fatal("expected category association failure")
	}

	stored, err := taskRepo.GetByIDAndUser(task.ID, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Title != "original" || stored.Revision != 1 {
		t.Fatalf("expected original task and revision after rollback, got title=%q revision=%d", stored.Title, stored.Revision)
	}
}
