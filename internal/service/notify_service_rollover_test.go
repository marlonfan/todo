package service

import (
	"context"
	"fmt"
	"testing"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/notify"
	"todo-app/internal/repository"
	"todo-app/migrations"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type testSuccessNotifier struct {
	sent int
}

func (n *testSuccessNotifier) Name() string {
	return string(models.NotifyChannelNtfy)
}

func (n *testSuccessNotifier) Send(_ context.Context, _ int64, _ map[string]string, _ *notify.Message) error {
	n.sent++
	return nil
}

func (n *testSuccessNotifier) ValidateConfig(_ map[string]string) error {
	return nil
}

func (n *testSuccessNotifier) DefaultTemplate() string {
	return ""
}

func newNotifyRolloverTestServices(
	t *testing.T,
) (*NotifyService, *TaskService, *repository.TaskRepository, *repository.NotificationRepository, int64, *testSuccessNotifier) {
	t.Helper()

	dsn := fmt.Sprintf("file:notify-rollover-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	taskRepo := repository.NewTaskRepository(db)
	userRepo := repository.NewUserRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	notifyRepo := repository.NewNotificationRepository(db)

	user := &models.User{
		Username:               "notify_rollover_user",
		Email:                  "notify_rollover_user@example.com",
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
		Config:    models.NotifyConfigMap{"topic": "unit-test"},
		IsDefault: true,
	}); err != nil {
		t.Fatalf("create user notify setting: %v", err)
	}

	registry := notify.NewRegistry()
	notifier := &testSuccessNotifier{}
	registry.Register(notifier)

	notifySvc := NewNotifyService(notifyRepo, userRepo, taskRepo, registry)
	taskSvc := NewTaskService(taskRepo, nil, categoryRepo, userRepo, notifyRepo)
	return notifySvc, taskSvc, taskRepo, notifyRepo, user.ID, notifier
}

func seedRecurringTaskAndDueReminder(
	t *testing.T,
	taskRepo *repository.TaskRepository,
	notifyRepo *repository.NotificationRepository,
	userID int64,
) (*models.Task, time.Time) {
	t.Helper()

	start := time.Now().UTC().Truncate(time.Minute).Add(-1 * time.Minute)
	task := &models.Task{
		UserID:    userID,
		Title:     "Recurring notify task",
		Status:    models.TaskStatusPending,
		Priority:  models.PriorityMedium,
		StartTime: &start,
		Revision:  1,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "daily",
			Interval: 1,
		},
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create task: %v", err)
	}

	currentNotifyAt := start.Add(-5 * time.Minute).UTC()
	notification := &models.Notification{
		TaskID:       task.ID,
		Source:       models.NotificationSourceDefaultAuto,
		DeliveryMode: models.NotificationDeliveryCurrentDefault,
		Channel:      models.NotifyChannelNtfy,
		Config:       models.NotifyConfigMap{"topic": "unit-test"},
		NotifyAt:     currentNotifyAt,
		NextRetryAt:  &currentNotifyAt,
		DedupeKey:    buildDedupeKey(task.ID, models.NotificationSourceDefaultAuto, currentNotifyAt),
		RetryCount:   0,
		Status:       models.NotifyStatusPending,
	}
	if err := notifyRepo.ReplaceActiveByTaskSource(notification); err != nil {
		t.Fatalf("seed pending reminder: %v", err)
	}

	return task, start
}

func seedAllDayRecurringTaskAndDueReminder(
	t *testing.T,
	taskRepo *repository.TaskRepository,
	notifyRepo *repository.NotificationRepository,
	userID int64,
) (*models.Task, time.Time) {
	t.Helper()

	start := time.Now().UTC().Truncate(24 * time.Hour).Add(-24 * time.Hour)
	task := &models.Task{
		UserID:    userID,
		Title:     "All-day recurring notify task",
		Status:    models.TaskStatusPending,
		Priority:  models.PriorityMedium,
		StartTime: &start,
		AllDay:    true,
		Revision:  1,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "daily",
			Interval: 1,
		},
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create all-day task: %v", err)
	}

	currentNotifyAt := start.Add(9*time.Hour - 5*time.Minute).UTC()
	notification := &models.Notification{
		TaskID:       task.ID,
		Source:       models.NotificationSourceDefaultAuto,
		DeliveryMode: models.NotificationDeliveryCurrentDefault,
		Channel:      models.NotifyChannelNtfy,
		Config:       models.NotifyConfigMap{"topic": "unit-test"},
		NotifyAt:     currentNotifyAt,
		NextRetryAt:  &currentNotifyAt,
		DedupeKey:    buildDedupeKey(task.ID, models.NotificationSourceDefaultAuto, currentNotifyAt),
		RetryCount:   0,
		Status:       models.NotifyStatusPending,
	}
	if err := notifyRepo.ReplaceActiveByTaskSource(notification); err != nil {
		t.Fatalf("seed all-day pending reminder: %v", err)
	}

	return task, start
}

func TestProcessPendingNotificationsDoesNotAdvanceRecurringReminderBeforeOccurrenceHandled(t *testing.T) {
	notifySvc, taskSvc, taskRepo, notifyRepo, userID, notifier := newNotifyRolloverTestServices(t)
	task, start := seedRecurringTaskAndDueReminder(t, taskRepo, notifyRepo, userID)

	if err := notifySvc.ProcessPendingNotifications(); err != nil {
		t.Fatalf("process pending notifications: %v", err)
	}

	if notifier.sent != 1 {
		t.Fatalf("send count = %d, want 1", notifier.sent)
	}

	notifications, err := notifyRepo.GetByTask(task.ID)
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	active := 0
	for _, item := range notifications {
		if item.Source == models.NotificationSourceDefaultAuto && item.Status == models.NotifyStatusPending {
			active++
		}
	}
	if active != 0 {
		t.Fatalf("pending default_auto notifications = %d, want 0 before occurrence is handled", active)
	}

	firstDate := start.UTC().Truncate(24 * time.Hour)
	_, err = taskSvc.UpdateStatus(
		userID,
		task.ID,
		models.TaskStatusCompleted,
		buildOccurrenceInstanceID(task.ID, firstDate),
		firstDate.Format("2006-01-02"),
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("complete current occurrence: %v", err)
	}

	expectedNextNotifyAt := start.AddDate(0, 0, 1).Add(-5 * time.Minute)
	assertSinglePendingAutoReminder(t, notifyRepo, task.ID, expectedNextNotifyAt)
}

func TestRecurringReminderAdvancesAfterCurrentOccurrenceIsSkipped(t *testing.T) {
	notifySvc, taskSvc, taskRepo, notifyRepo, userID, _ := newNotifyRolloverTestServices(t)
	task, start := seedRecurringTaskAndDueReminder(t, taskRepo, notifyRepo, userID)

	if err := notifySvc.ProcessPendingNotifications(); err != nil {
		t.Fatalf("process pending notifications: %v", err)
	}

	currentOccurrenceDate := start.UTC().Truncate(24 * time.Hour)
	_, err := taskSvc.UpdateStatus(
		userID,
		task.ID,
		models.TaskStatusSkipped,
		buildOccurrenceInstanceID(task.ID, currentOccurrenceDate),
		currentOccurrenceDate.Format("2006-01-02"),
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("skip current occurrence: %v", err)
	}

	expectedNextNotifyAt := start.AddDate(0, 0, 1).Add(-5 * time.Minute)
	assertSinglePendingAutoReminder(t, notifyRepo, task.ID, expectedNextNotifyAt)
}

func TestProcessPendingNotificationsSchedulesNextAllDayRecurringReminderAtMorningTime(t *testing.T) {
	notifySvc, _, taskRepo, notifyRepo, userID, notifier := newNotifyRolloverTestServices(t)
	task, _ := seedAllDayRecurringTaskAndDueReminder(t, taskRepo, notifyRepo, userID)

	if err := notifySvc.ProcessPendingNotifications(); err != nil {
		t.Fatalf("process pending notifications: %v", err)
	}

	if notifier.sent != 1 {
		t.Fatalf("send count = %d, want 1", notifier.sent)
	}

	notifications, err := notifyRepo.GetByTask(task.ID)
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	active := 0
	for _, item := range notifications {
		if item.Source == models.NotificationSourceDefaultAuto && item.Status == models.NotifyStatusPending {
			active++
		}
	}
	if active != 0 {
		t.Fatalf("pending default_auto notifications = %d, want 0 before occurrence is handled", active)
	}
}

func TestReconcileUserRemindersDoesNotSkipPastRecurringBacklog(t *testing.T) {
	notifySvc, _, taskRepo, notifyRepo, userID, _ := newNotifyRolloverTestServices(t)

	start := time.Now().UTC().Truncate(time.Minute).Add(-23 * time.Hour)
	task := &models.Task{
		UserID:    userID,
		Title:     "Recurring reconcile task",
		Status:    models.TaskStatusPending,
		Priority:  models.PriorityMedium,
		StartTime: &start,
		Revision:  1,
		RecurrenceRule: &models.RecurrenceRule{
			Freq:     "daily",
			Interval: 1,
		},
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create recurring task: %v", err)
	}

	if err := notifySvc.ReconcileUserReminders(userID); err != nil {
		t.Fatalf("reconcile reminders: %v", err)
	}

	notifications, err := notifyRepo.GetByTask(task.ID)
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	active := 0
	for _, item := range notifications {
		if item.Source == models.NotificationSourceDefaultAuto && item.Status == models.NotifyStatusPending {
			active++
		}
	}
	if active != 0 {
		t.Fatalf("pending default_auto notifications = %d, want 0 while oldest occurrence is overdue", active)
	}
}
