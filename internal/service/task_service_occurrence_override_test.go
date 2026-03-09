package service

import (
	"errors"
	"fmt"
	"testing"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"
	"todo-app/migrations"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newTestTaskService(t *testing.T) (*TaskService, *repository.TaskRepository, int64) {
	t.Helper()

	dsn := fmt.Sprintf("file:task-service-occurrence-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	taskRepo := repository.NewTaskRepository(db)
	userRepo := repository.NewUserRepository(db)
	catRepo := repository.NewCategoryRepository(db)
	notifyRepo := repository.NewNotificationRepository(db)

	user := &models.User{
		Username:               "tester",
		Email:                  "tester@example.com",
		PasswordHash:           "hash",
		Timezone:               "UTC",
		DefaultReminderEnabled: false,
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	svc := NewTaskService(taskRepo, nil, catRepo, userRepo, notifyRepo)
	return svc, taskRepo, user.ID
}

func newTestTaskServiceWithReminder(t *testing.T) (*TaskService, *repository.TaskRepository, *repository.NotificationRepository, int64) {
	t.Helper()

	dsn := fmt.Sprintf("file:task-service-reminder-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	taskRepo := repository.NewTaskRepository(db)
	userRepo := repository.NewUserRepository(db)
	catRepo := repository.NewCategoryRepository(db)
	notifyRepo := repository.NewNotificationRepository(db)

	user := &models.User{
		Username:               "reminder_tester",
		Email:                  "reminder_tester@example.com",
		PasswordHash:           "hash",
		Timezone:               "UTC",
		DefaultReminderEnabled: true,
		DefaultReminderMinutes: 5,
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := notifyRepo.CreateUserSetting(&models.UserNotifySetting{
		UserID:    user.ID,
		Channel:   models.NotifyChannelNtfy,
		Config:    models.NotifyConfigMap{"topic": "test"},
		IsDefault: true,
	}); err != nil {
		t.Fatalf("create default notify setting: %v", err)
	}

	svc := NewTaskService(taskRepo, nil, catRepo, userRepo, notifyRepo)
	return svc, taskRepo, notifyRepo, user.ID
}

func assertSinglePendingAutoReminder(t *testing.T, notifyRepo *repository.NotificationRepository, taskID int64, expectedNotifyAt time.Time) {
	t.Helper()

	notifications, err := notifyRepo.GetByTask(taskID)
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}

	active := make([]models.Notification, 0, 1)
	for _, item := range notifications {
		if item.Source != models.NotificationSourceDefaultAuto {
			continue
		}
		if item.Status != models.NotifyStatusPending {
			continue
		}
		active = append(active, item)
	}
	if len(active) != 1 {
		t.Fatalf("pending default_auto notifications = %d, want 1", len(active))
	}
	if !active[0].NotifyAt.UTC().Equal(expectedNotifyAt.UTC()) {
		t.Fatalf(
			"notify_at = %s, want %s",
			active[0].NotifyAt.UTC().Format(time.RFC3339),
			expectedNotifyAt.UTC().Format(time.RFC3339),
		)
	}
}

func TestUpdateRecurringDescriptionWithOccurrenceOverride(t *testing.T) {
	svc, taskRepo, userID := newTestTaskService(t)

	start := time.Date(2026, 3, 9, 9, 0, 0, 0, time.UTC)
	task := &models.Task{
		UserID:      userID,
		Title:       "Recurring task",
		Description: "base description",
		Status:      models.TaskStatusPending,
		Priority:    models.PriorityMedium,
		StartTime:   &start,
		Revision:    1,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "daily",
			Interval: 1,
		},
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create task: %v", err)
	}

	occurrenceInstanceID := fmt.Sprintf("%d_20260310", task.ID)
	revision := int64(1)
	_, err := svc.Update(
		userID,
		task.ID,
		&models.UpdateTaskRequest{
			Description:    "instance description",
			InstanceID:     occurrenceInstanceID,
			OccurrenceDate: "2026-03-10",
		},
		map[string]bool{"description": true},
		&revision,
		nil,
	)
	if err != nil {
		t.Fatalf("update recurring occurrence description: %v", err)
	}

	reloadedTask, err := taskRepo.GetByID(task.ID)
	if err != nil {
		t.Fatalf("reload task: %v", err)
	}
	if reloadedTask.Description != "base description" {
		t.Fatalf("base description changed unexpectedly: %q", reloadedTask.Description)
	}

	occurrenceDate, _, _ := parseOccurrenceDate("", "2026-03-10")
	occurrence, err := taskRepo.GetTaskOccurrence(userID, task.ID, occurrenceDate)
	if err != nil {
		t.Fatalf("load occurrence record: %v", err)
	}
	if occurrence.Description != "instance description" {
		t.Fatalf("occurrence description = %q, want instance description", occurrence.Description)
	}

	rangeStart := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	rangeEnd := time.Date(2026, 3, 11, 23, 59, 59, 0, time.UTC)
	instances, err := svc.ExpandRecurringTasks(userID, rangeStart, rangeEnd)
	if err != nil {
		t.Fatalf("expand recurring tasks: %v", err)
	}
	found := false
	foundNext := false
	for _, instance := range instances {
		if instance.InstanceID == occurrenceInstanceID {
			found = true
			if instance.Description != "instance description" {
				t.Fatalf("instance description = %q, want instance description", instance.Description)
			}
		}
		if instance.InstanceID == fmt.Sprintf("%d_20260311", task.ID) {
			foundNext = true
			if instance.Description != "" {
				t.Fatalf("non-overridden occurrence description = %q, want empty", instance.Description)
			}
		}
	}
	if !found {
		t.Fatalf("expected recurring instance %s in expanded list", occurrenceInstanceID)
	}
	if !foundNext {
		t.Fatalf("expected recurring instance %d_20260311 in expanded list", task.ID)
	}

	revision = reloadedTask.Revision
	_, err = svc.Update(
		userID,
		task.ID,
		&models.UpdateTaskRequest{
			Description:    "",
			OccurrenceDate: "2026-03-10",
		},
		map[string]bool{"description": true},
		&revision,
		nil,
	)
	if err != nil {
		t.Fatalf("clear occurrence override: %v", err)
	}

	_, err = taskRepo.GetTaskOccurrence(userID, task.ID, occurrenceDate)
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected occurrence deletion, got err=%v", err)
	}
}

func TestUpdateRecurringOccurrenceDescriptionKeepsSeriesStatus(t *testing.T) {
	svc, taskRepo, userID := newTestTaskService(t)

	start := time.Date(2026, 3, 9, 9, 0, 0, 0, time.UTC)
	task := &models.Task{
		UserID:      userID,
		Title:       "Recurring task",
		Description: "base description",
		Status:      models.TaskStatusPending,
		Priority:    models.PriorityMedium,
		StartTime:   &start,
		Revision:    1,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "weekly",
			Interval: 1,
			ByDay:    []string{"TU"},
		},
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create task: %v", err)
	}

	occurrenceDate, _, _ := parseOccurrenceDate("", "2026-03-10")
	if err := taskRepo.UpsertTaskOccurrence(&models.TaskOccurrence{
		UserID:         userID,
		TaskID:         task.ID,
		OccurrenceDate: occurrenceDate,
		InstanceID:     fmt.Sprintf("%d_20260310", task.ID),
		Status:         models.TaskStatusCompleted,
		Description:    "",
		StartTime:      &occurrenceDate,
		AllDay:         false,
	}); err != nil {
		t.Fatalf("seed occurrence status: %v", err)
	}

	revision := int64(1)
	_, err := svc.Update(
		userID,
		task.ID,
		&models.UpdateTaskRequest{
			Description:    "instance description",
			Status:         models.TaskStatusCompleted,
			OccurrenceDate: "2026-03-10",
		},
		map[string]bool{
			"description": true,
			"status":      true,
		},
		&revision,
		nil,
	)
	if err != nil {
		t.Fatalf("update recurring occurrence with description+status: %v", err)
	}

	reloadedTask, err := taskRepo.GetByID(task.ID)
	if err != nil {
		t.Fatalf("reload task: %v", err)
	}
	if reloadedTask.Status != models.TaskStatusPending {
		t.Fatalf("series status changed unexpectedly: %q", reloadedTask.Status)
	}

	occurrence, err := taskRepo.GetTaskOccurrence(userID, task.ID, occurrenceDate)
	if err != nil {
		t.Fatalf("load occurrence record: %v", err)
	}
	if occurrence.Status != models.TaskStatusCompleted {
		t.Fatalf("occurrence status = %q, want completed", occurrence.Status)
	}
	if occurrence.Description != "instance description" {
		t.Fatalf("occurrence description = %q, want instance description", occurrence.Description)
	}
}

func TestRecurringOccurrenceCompletedReschedulesReminderToNextPendingInstance(t *testing.T) {
	svc, taskRepo, notifyRepo, userID := newTestTaskServiceWithReminder(t)

	start := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
	created, err := svc.Create(userID, &models.CreateTaskRequest{
		Title:     "Recurring reminder task",
		StartTime: &start,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "daily",
			Interval: 1,
		},
	})
	if err != nil {
		t.Fatalf("create recurring task: %v", err)
	}

	firstDate := start.UTC().Truncate(24 * time.Hour)
	secondStart := start.AddDate(0, 0, 1)
	assertSinglePendingAutoReminder(t, notifyRepo, created.ID, start.Add(-5*time.Minute))

	revision := created.Revision
	_, err = svc.UpdateStatus(
		userID,
		created.ID,
		models.TaskStatusCompleted,
		buildOccurrenceInstanceID(created.ID, firstDate),
		firstDate.Format("2006-01-02"),
		&revision,
		nil,
	)
	if err != nil {
		t.Fatalf("complete recurring occurrence: %v", err)
	}

	assertSinglePendingAutoReminder(t, notifyRepo, created.ID, secondStart.Add(-5*time.Minute))

	occurrence, err := taskRepo.GetTaskOccurrence(userID, created.ID, firstDate)
	if err != nil {
		t.Fatalf("load occurrence override: %v", err)
	}
	if occurrence.Status != models.TaskStatusCompleted {
		t.Fatalf("occurrence status = %q, want completed", occurrence.Status)
	}
}

func TestRecurringOccurrenceCancelledReschedulesReminderToNextPendingInstance(t *testing.T) {
	svc, _, notifyRepo, userID := newTestTaskServiceWithReminder(t)

	start := time.Now().UTC().Add(72 * time.Hour).Truncate(time.Minute)
	created, err := svc.Create(userID, &models.CreateTaskRequest{
		Title:     "Recurring reminder task cancel",
		StartTime: &start,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "daily",
			Interval: 1,
		},
	})
	if err != nil {
		t.Fatalf("create recurring task: %v", err)
	}

	firstDate := start.UTC().Truncate(24 * time.Hour)
	secondStart := start.AddDate(0, 0, 1)
	assertSinglePendingAutoReminder(t, notifyRepo, created.ID, start.Add(-5*time.Minute))

	revision := created.Revision
	_, err = svc.UpdateStatus(
		userID,
		created.ID,
		models.TaskStatusCancelled,
		buildOccurrenceInstanceID(created.ID, firstDate),
		firstDate.Format("2006-01-02"),
		&revision,
		nil,
	)
	if err != nil {
		t.Fatalf("cancel recurring occurrence: %v", err)
	}

	assertSinglePendingAutoReminder(t, notifyRepo, created.ID, secondStart.Add(-5*time.Minute))
}
