package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/notify"
	"todo-app/internal/repository"

	"gorm.io/gorm"
)

const processingLockTTL = 15 * time.Minute
const pendingBatchLimit = 200
const dedupeWindow = 10 * time.Minute
const maxRetryDelay = 30 * time.Minute

type NotifyService struct {
	notifyRepo *repository.NotificationRepository
	userRepo   *repository.UserRepository
	taskRepo   *repository.TaskRepository
	registry   *notify.Registry
}

func NewNotifyService(
	notifyRepo *repository.NotificationRepository,
	userRepo *repository.UserRepository,
	taskRepo *repository.TaskRepository,
	registry *notify.Registry,
) *NotifyService {
	return &NotifyService{
		notifyRepo: notifyRepo,
		userRepo:   userRepo,
		taskRepo:   taskRepo,
		registry:   registry,
	}
}

func buildDedupeKey(taskID int64, source models.NotificationSource, notifyAt time.Time) string {
	return fmt.Sprintf("%d|%s|%s", taskID, source, notifyAt.UTC().Format(time.RFC3339))
}

func nextRetryDelay(retryCount int) time.Duration {
	if retryCount < 0 {
		retryCount = 0
	}
	delay := time.Minute * time.Duration(1<<retryCount)
	if delay > maxRetryDelay {
		return maxRetryDelay
	}
	return delay
}

func cloneNotifyConfig(input models.NotifyConfigMap) models.NotifyConfigMap {
	if input == nil {
		return models.NotifyConfigMap{}
	}
	output := make(models.NotifyConfigMap, len(input))
	for k, v := range input {
		output[k] = v
	}
	return output
}

func (s *NotifyService) resolveDeliveryTarget(n *models.Notification, userID int64) (models.NotifyChannel, models.NotifyConfigMap, error) {
	if n == nil {
		return "", nil, errors.New("notification is nil")
	}

	if n.DeliveryMode == models.NotificationDeliveryCurrentDefault {
		setting, err := s.notifyRepo.GetDefaultSetting(userID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", nil, errors.New("no default notification setting")
			}
			return "", nil, err
		}
		return setting.Channel, cloneNotifyConfig(setting.Config), nil
	}

	return n.Channel, cloneNotifyConfig(n.Config), nil
}

func (s *NotifyService) CreateNotification(userID, taskID int64, req *models.CreateNotificationRequest) (*models.Notification, error) {
	channel := req.Channel
	config := req.Config
	if channel == "" {
		setting, err := s.notifyRepo.GetDefaultSetting(userID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errors.New("no default notification setting")
			}
			return nil, err
		}
		channel = setting.Channel
		config = setting.Config
	}

	notifier, ok := s.registry.Get(string(channel))
	if !ok {
		return nil, errors.New("unsupported notification channel")
	}
	if err := notifier.ValidateConfig(config); err != nil {
		return nil, err
	}

	notification := &models.Notification{
		TaskID:        taskID,
		Source:        models.NotificationSourceManual,
		DeliveryMode:  models.NotificationDeliveryLockedSnapshot,
		Channel:       channel,
		Config:        cloneNotifyConfig(config),
		NotifyAt:      req.NotifyAt.UTC(),
		NextRetryAt:   func() *time.Time { t := req.NotifyAt.UTC(); return &t }(),
		DedupeKey:     buildDedupeKey(taskID, models.NotificationSourceManual, req.NotifyAt.UTC()),
		RetryCount:    0,
		LastAttemptAt: nil,
		Status:        models.NotifyStatusPending,
	}

	// Keep only one active reminder per task to avoid duplicates when users edit repeatedly.
	if err := s.notifyRepo.ReplaceActiveByTaskSource(notification); err != nil {
		return nil, err
	}

	return notification, nil
}

func (s *NotifyService) GetUserSettings(userID int64) ([]models.UserNotifySetting, error) {
	return s.notifyRepo.GetUserSettings(userID)
}

func (s *NotifyService) CreateUserSetting(userID int64, req *models.CreateNotifySettingRequest) (*models.UserNotifySetting, error) {
	// Validate channel
	notifier, ok := s.registry.Get(string(req.Channel))
	if !ok {
		return nil, errors.New("unsupported notification channel")
	}

	// Validate config
	if err := notifier.ValidateConfig(req.Config); err != nil {
		return nil, err
	}

	settings, err := s.notifyRepo.GetUserSettings(userID)
	if err != nil {
		return nil, err
	}

	setting := &models.UserNotifySetting{
		UserID:    userID,
		Channel:   req.Channel,
		Config:    req.Config,
		IsDefault: len(settings) == 0,
	}

	if err := s.notifyRepo.CreateUserSetting(setting); err != nil {
		return nil, err
	}
	if req.IsDefault && len(settings) > 0 {
		if err := s.notifyRepo.SetDefaultUserSetting(userID, setting.ID); err != nil {
			return nil, err
		}
		setting.IsDefault = true
	}
	if setting.IsDefault {
		if err := s.ReconcileUserReminders(userID); err != nil {
			return nil, err
		}
	}

	return setting, nil
}

func (s *NotifyService) DeleteUserSetting(userID, settingID int64) error {
	settings, err := s.notifyRepo.GetUserSettings(userID)
	if err != nil {
		return err
	}

	found := false
	for _, s := range settings {
		if s.ID == settingID {
			found = true
			break
		}
	}

	if !found {
		return errors.New("setting not found")
	}

	if err := s.notifyRepo.DeleteUserSetting(settingID); err != nil {
		return err
	}

	remaining, err := s.notifyRepo.GetUserSettings(userID)
	if err != nil {
		return err
	}
	hasDefault := false
	for _, setting := range remaining {
		if setting.IsDefault {
			hasDefault = true
			break
		}
	}
	if !hasDefault && len(remaining) > 0 {
		if err := s.notifyRepo.SetDefaultUserSetting(userID, remaining[0].ID); err != nil {
			return err
		}
	}

	if err := s.ReconcileUserReminders(userID); err != nil {
		return err
	}

	return nil
}

func (s *NotifyService) SetDefaultUserSetting(userID, settingID int64) error {
	if err := s.notifyRepo.SetDefaultUserSetting(userID, settingID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("setting not found")
		}
		return err
	}
	return s.ReconcileUserReminders(userID)
}

func (s *NotifyService) TestNotification(userID int64, req *models.TestNotificationRequest) error {
	notifier, ok := s.registry.Get(string(req.Channel))
	if !ok {
		return errors.New("unsupported notification channel")
	}

	if err := notifier.ValidateConfig(req.Config); err != nil {
		return err
	}

	msg := &notify.Message{
		TaskID:      0,
		Title:       "Test Notification",
		Description: "This is a test notification from Todo App",
		UserID:      userID,
	}

	return notifier.Send(context.Background(), userID, req.Config, msg)
}

func (s *NotifyService) ProcessPendingNotifications() error {
	now := time.Now().UTC()
	processingStaleBefore := now.Add(-processingLockTTL)
	notifications, err := s.notifyRepo.GetPendingNotifications(now, processingStaleBefore, pendingBatchLimit)
	if err != nil {
		return err
	}

	for _, n := range notifications {
		if n.Task == nil {
			retryAt := time.Now().UTC().Add(nextRetryDelay(n.RetryCount))
			_ = s.notifyRepo.MarkFailedRetry(n.ID, retryAt, "task not found")
			continue
		}
		claimed, err := s.notifyRepo.TryMarkProcessing(n.ID, processingStaleBefore)
		if err != nil {
			log.Printf("Failed to mark notification %d as processing: %v", n.ID, err)
			continue
		}
		if !claimed {
			continue
		}

		deliverChannel, deliverConfig, err := s.resolveDeliveryTarget(&n, n.Task.UserID)
		if err != nil {
			log.Printf("Failed to resolve delivery target for notification %d: %v", n.ID, err)
			retryAt := time.Now().UTC().Add(nextRetryDelay(n.RetryCount))
			_ = s.notifyRepo.MarkFailedRetry(n.ID, retryAt, err.Error())
			continue
		}

		notifier, ok := s.registry.Get(string(deliverChannel))
		if !ok {
			retryAt := time.Now().UTC().Add(nextRetryDelay(n.RetryCount))
			_ = s.notifyRepo.MarkFailedRetry(n.ID, retryAt, "unsupported channel")
			continue
		}
		if err := notifier.ValidateConfig(deliverConfig); err != nil {
			retryAt := time.Now().UTC().Add(nextRetryDelay(n.RetryCount))
			_ = s.notifyRepo.MarkFailedRetry(n.ID, retryAt, err.Error())
			continue
		}

		recentSent, err := s.notifyRepo.HasRecentSentByDedupeKey(n.DedupeKey, time.Now().UTC().Add(-dedupeWindow))
		if err != nil {
			log.Printf("Failed to check dedupe for notification %d: %v", n.ID, err)
		}
		if recentSent {
			markAt := time.Now().UTC()
			_ = s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusSent, &markAt, "dedupe_suppressed")
			continue
		}

		msg := &notify.Message{
			TaskID:      n.TaskID,
			Title:       n.Task.Title,
			Description: n.Task.Description,
			NotifyAt:    &n.NotifyAt,
			UserID:      n.Task.UserID,
			Timezone:    s.resolveUserTimezone(n.Task.UserID, n.Task.User),
		}

		if n.Task.DueDate != nil {
			msg.DueDate = n.Task.DueDate
		} else if n.Task.StartTime != nil {
			msg.DueDate = n.Task.StartTime
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		if deliverConfig == nil {
			deliverConfig = models.NotifyConfigMap{}
		}
		deliverConfig["idempotency_key"] = n.DedupeKey
		err = notifier.Send(ctx, n.Task.UserID, deliverConfig, msg)
		cancel()

		now := time.Now().UTC()
		if err != nil {
			log.Printf("Failed to send notification %d: %v", n.ID, err)
			retryAt := now.Add(nextRetryDelay(n.RetryCount))
			_ = s.notifyRepo.MarkFailedRetry(n.ID, retryAt, err.Error())
		} else {
			_ = s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusSent, &now, "")
		}
	}

	return nil
}

func (s *NotifyService) resolveNextPendingRecurringReminderStart(task *models.Task, from time.Time) (*time.Time, error) {
	if task == nil || task.RecurrenceRule == nil {
		return nil, nil
	}

	fromUTC := from.UTC()
	if fromUTC.IsZero() {
		fromUTC = time.Now().UTC()
	}
	fromDate := fromUTC.Truncate(24 * time.Hour)
	searchStart := fromDate.AddDate(-3, 0, 0)
	horizon := fromDate.AddDate(3, 0, 0)
	latestOccurrenceDates, err := s.taskRepo.ListLatestTaskOccurrenceDates(task.UserID, []int64{task.ID})
	if err != nil {
		return nil, err
	}
	if latestDate, ok := latestOccurrenceDates[task.ID]; ok {
		horizon = extendRecurringSearchHorizon(horizon, latestDate, task.RecurrenceRule)
	}
	rows, err := s.taskRepo.ListTaskOccurrencesForTasksInRange(task.UserID, []int64{task.ID}, searchStart, horizon)
	if err != nil {
		return nil, err
	}
	occurrenceByDate := make(map[string]*models.TaskOccurrence, len(rows))
	for i := range rows {
		row := &rows[i]
		occurrenceByDate[row.OccurrenceDate.UTC().Format("2006-01-02")] = row
	}

	tz := s.resolveUserTimezone(task.UserID, nil)
	loc := loadLocationOrUTC(tz)
	occurrences := buildTaskOccurrenceStarts(task, searchStart, horizon, tz)
	var earliestPending *time.Time
	for _, occurrenceStart := range occurrences {
		localOcc := occurrenceStart.In(loc)
		dateOnly := time.Date(localOcc.Year(), localOcc.Month(), localOcc.Day(), 0, 0, 0, 0, time.UTC)
		override := occurrenceByDate[dateOnly.Format("2006-01-02")]

		status := task.Status
		if override != nil && override.Status != "" {
			status = override.Status
		}
		if status != models.TaskStatusPending {
			continue
		}

		startTime := occurrenceStart.UTC()
		if override != nil && override.StartTime != nil {
			startTime = override.StartTime.UTC()
		}
		if earliestPending == nil || startTime.Before(*earliestPending) {
			next := startTime
			earliestPending = &next
		}
	}

	return earliestPending, nil
}

func (s *NotifyService) resolveUserTimezone(userID int64, taskUser *models.User) string {
	if taskUser != nil && taskUser.Timezone != "" {
		return taskUser.Timezone
	}
	if user, err := s.userRepo.GetByID(userID); err == nil && user != nil && user.Timezone != "" {
		return user.Timezone
	}
	return "UTC"
}

func (s *NotifyService) ListChannels() []string {
	return s.registry.List()
}

// GetTaskNotifications 获取任务的通知列表
func (s *NotifyService) GetTaskNotifications(taskID int64) ([]models.Notification, error) {
	return s.notifyRepo.GetByTask(taskID)
}

// DeleteNotification 删除通知
func (s *NotifyService) DeleteNotification(notificationID int64) error {
	return s.notifyRepo.Delete(notificationID)
}

func (s *NotifyService) ReconcileUserReminders(userID int64) error {
	if err := s.notifyRepo.DeleteActiveByUser(userID); err != nil {
		return err
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if !user.DefaultReminderEnabled {
		return nil
	}

	defaultSetting, err := s.notifyRepo.GetDefaultSetting(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	tasks, err := s.taskRepo.GetReminderTasks(userID)
	if err != nil {
		return err
	}

	minutes := user.DefaultReminderMinutes
	if minutes <= 0 {
		minutes = 5
	}

	now := time.Now().UTC()
	for _, task := range tasks {
		var reminderStart *time.Time
		if task.RecurrenceRule != nil {
			nextStart, err := s.resolveNextPendingRecurringReminderStart(&task, now)
			if err != nil {
				return err
			}
			reminderStart = nextStart
		} else if task.StartTime != nil {
			start := task.StartTime.UTC()
			reminderStart = &start
		}
		if reminderStart == nil {
			continue
		}
		resolvedStart := resolveReminderStartForTask(
			reminderStart.UTC(),
			task.AllDay,
			user.Timezone,
			user.DefaultMorningTime,
		)
		notifyAt := resolvedStart.Add(-time.Duration(minutes) * time.Minute)
		if !notifyAt.After(now) {
			continue
		}

		notification := &models.Notification{
			TaskID:       task.ID,
			Source:       models.NotificationSourceDefaultAuto,
			DeliveryMode: models.NotificationDeliveryCurrentDefault,
			// Keep a snapshot fallback for compatibility/debug; runtime still reads current default.
			Channel:     defaultSetting.Channel,
			Config:      cloneNotifyConfig(defaultSetting.Config),
			NotifyAt:    notifyAt,
			NextRetryAt: &notifyAt,
			DedupeKey:   buildDedupeKey(task.ID, models.NotificationSourceDefaultAuto, notifyAt),
			RetryCount:  0,
			Status:      models.NotifyStatusPending,
		}
		if err := s.notifyRepo.ReplaceActiveByTaskSource(notification); err != nil {
			return err
		}
	}

	return nil
}
