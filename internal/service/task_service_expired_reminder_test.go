package service

import (
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestUpdateAllowsExpiredExplicitReminderThatWasAlreadySent(t *testing.T) {
	svc, taskRepo, notifyRepo, userID := newTestTaskServiceWithReminder(t)
	past := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	zeroMinutes := 0
	task := &models.Task{
		UserID:                userID,
		Title:                 "Original title",
		Status:                models.TaskStatusPending,
		StartTime:             &past,
		ReminderPolicy:        models.TaskReminderOffset,
		ReminderMinutesBefore: &zeroMinutes,
		Revision:              1,
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create task: %v", err)
	}
	sentAt := past.Add(7 * time.Second)
	if err := notifyRepo.Create(&models.Notification{
		TaskID:       task.ID,
		Source:       models.NotificationSourceDefaultAuto,
		DeliveryMode: models.NotificationDeliveryCurrentDefault,
		Channel:      models.NotifyChannelNtfy,
		Config:       models.NotifyConfigMap{"topic": "test"},
		NotifyAt:     past,
		Status:       models.NotifyStatusSent,
		SentAt:       &sentAt,
	}); err != nil {
		t.Fatalf("create sent reminder: %v", err)
	}

	expectedRevision := int64(1)
	updated, err := svc.Update(
		userID,
		task.ID,
		&models.UpdateTaskRequest{Title: "Edited after reminder"},
		map[string]bool{"title": true},
		&expectedRevision,
		nil,
	)
	if err != nil {
		t.Fatalf("update unrelated field after reminder was sent: %v", err)
	}
	if updated.Title != "Edited after reminder" || updated.Revision != 2 {
		t.Fatalf("updated task = title %q revision %d", updated.Title, updated.Revision)
	}
}

func TestUpdateExpiredExplicitReminderToFutureSchedulesAgain(t *testing.T) {
	svc, taskRepo, notifyRepo, userID := newTestTaskServiceWithReminder(t)
	past := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	future := time.Now().UTC().Add(2 * time.Hour).Truncate(time.Second)
	zeroMinutes := 0
	task := &models.Task{
		UserID:                userID,
		Title:                 "Move reminder",
		Status:                models.TaskStatusPending,
		StartTime:             &past,
		ReminderPolicy:        models.TaskReminderOffset,
		ReminderMinutesBefore: &zeroMinutes,
		Revision:              1,
	}
	if err := taskRepo.Create(task); err != nil {
		t.Fatalf("create task: %v", err)
	}
	sentAt := past.Add(7 * time.Second)
	if err := notifyRepo.Create(&models.Notification{
		TaskID:       task.ID,
		Source:       models.NotificationSourceDefaultAuto,
		DeliveryMode: models.NotificationDeliveryCurrentDefault,
		Channel:      models.NotifyChannelNtfy,
		Config:       models.NotifyConfigMap{"topic": "test"},
		NotifyAt:     past,
		Status:       models.NotifyStatusSent,
		SentAt:       &sentAt,
	}); err != nil {
		t.Fatalf("create sent reminder: %v", err)
	}

	expectedRevision := int64(1)
	updated, err := svc.Update(
		userID,
		task.ID,
		&models.UpdateTaskRequest{StartTime: &future},
		map[string]bool{"start_time": true},
		&expectedRevision,
		nil,
	)
	if err != nil {
		t.Fatalf("move reminder to future: %v", err)
	}
	if updated.StartTime == nil || !updated.StartTime.UTC().Equal(future) {
		t.Fatalf("updated start time = %v, want %s", updated.StartTime, future.Format(time.RFC3339))
	}
	assertSinglePendingAutoReminder(t, notifyRepo, task.ID, future)
}
