package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
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
const maxDeliveryAttempts = 12
const notificationWorkers = 6

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
	if retryCount >= 5 {
		return maxRetryDelay
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

func (s *NotifyService) CreateNotification(userID, taskID int64, req *models.CreateNotificationRequest, clientOpID string) (*models.Notification, bool, error) {
	clientOpID = strings.TrimSpace(clientOpID)
	if len(clientOpID) > 128 {
		clientOpID = clientOpID[:128]
	}
	if clientOpID != "" {
		existing, err := s.notifyRepo.GetByTaskAndClientOpID(taskID, clientOpID)
		if err == nil {
			return existing, true, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, err
		}
	}
	if !req.NotifyAt.UTC().After(time.Now().UTC()) {
		return nil, false, errors.New("notify_at must be in the future")
	}

	channel := req.Channel
	config := req.Config
	if channel == "" {
		setting, err := s.notifyRepo.GetDefaultSetting(userID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, false, errors.New("no default notification setting")
			}
			return nil, false, err
		}
		channel = setting.Channel
		config = setting.Config
	}

	notifier, ok := s.registry.Get(string(channel))
	if !ok {
		return nil, false, errors.New("unsupported notification channel")
	}
	if err := notifier.ValidateConfig(config); err != nil {
		return nil, false, err
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
	if clientOpID != "" {
		notification.ClientOpID = &clientOpID
	}

	if err := s.notifyRepo.Create(notification); err != nil {
		if clientOpID != "" {
			existing, getErr := s.notifyRepo.GetByTaskAndClientOpID(taskID, clientOpID)
			if getErr == nil {
				return existing, true, nil
			}
		}
		return nil, false, err
	}

	return notification, false, nil
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

// ProcessPendingNotifications bounds both the batch and the number of active sends.
// A worker claims a row only when it is ready to deliver it.
func (s *NotifyService) ProcessPendingNotifications(ctx context.Context) error {
	scoped := *s
	scoped.notifyRepo = s.notifyRepo.WithContext(ctx)
	now := time.Now().UTC()
	stale := now.Add(-processingLockTTL)
	notifications, err := scoped.notifyRepo.GetPendingNotifications(now, stale, pendingBatchLimit)
	if err != nil {
		return err
	}
	// Serialize equal dedupe keys within this batch while unrelated reminders
	// still use the worker pool.
	groups := make([][]models.Notification, 0, len(notifications))
	groupByKey := make(map[string]int)
	for _, n := range notifications {
		if index, ok := groupByKey[n.DedupeKey]; n.DedupeKey != "" && ok {
			groups[index] = append(groups[index], n)
		} else {
			if n.DedupeKey != "" {
				groupByKey[n.DedupeKey] = len(groups)
			}
			groups = append(groups, []models.Notification{n})
		}
	}
	jobs := make(chan []models.Notification)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var failures []error
	for i := 0; i < notificationWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for group := range jobs {
				for _, n := range group {
					if ctx.Err() != nil {
						continue
					}
					if err := scoped.processNotification(ctx, n, stale); err != nil {
						mu.Lock()
						failures = append(failures, err)
						mu.Unlock()
					}
				}
			}
		}()
	}
feed:
	for _, group := range groups {
		select {
		case <-ctx.Done():
			break feed
		case jobs <- group:
		}
	}
	close(jobs)
	wg.Wait()
	return errors.Join(append(failures, ctx.Err())...)
}

func (s *NotifyService) markDeliveryFailure(n models.Notification, err error) error {
	if n.RetryCount >= maxDeliveryAttempts-1 {
		return s.notifyRepo.MarkAbandoned(n.ID, err.Error())
	}
	return s.notifyRepo.MarkFailedRetry(n.ID, time.Now().UTC().Add(nextRetryDelay(n.RetryCount)), err.Error())
}

func (s *NotifyService) processNotification(ctx context.Context, n models.Notification, stale time.Time) (result error) {
	claimed, err := s.notifyRepo.TryMarkProcessing(n.ID, stale)
	if err != nil || !claimed {
		return err
	}
	// Cleanup remains possible after the parent deadline. Canceled sends do not
	// consume the delivery retry budget; successful sends are persisted as sent.
	persist := func(fn func(*repository.NotificationRepository) error) error {
		cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancelCleanup()
		return fn(s.notifyRepo.WithContext(cleanupCtx))
	}
	defer func() {
		if ctx.Err() != nil && result != nil {
			result = errors.Join(result, persist(func(r *repository.NotificationRepository) error { return r.ReleaseProcessing(n.ID) }))
		}
	}()
	if err := ctx.Err(); err != nil {
		return err
	}
	if n.RetryCount >= maxDeliveryAttempts {
		return persist(func(r *repository.NotificationRepository) error {
			return r.MarkAbandoned(n.ID, "delivery attempts exhausted")
		})
	}
	fail := func(err error) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return persist(func(r *repository.NotificationRepository) error {
			scoped := *s
			scoped.notifyRepo = r
			return scoped.markDeliveryFailure(n, err)
		})
	}
	if n.Task == nil {
		return fail(errors.New("task not found"))
	}
	channel, config, err := s.resolveDeliveryTarget(&n, n.Task.UserID)
	if err != nil {
		return fail(err)
	}
	notifier, ok := s.registry.Get(string(channel))
	if !ok {
		return fail(errors.New("unsupported channel"))
	}
	if err := notifier.ValidateConfig(config); err != nil {
		return fail(err)
	}
	recent, err := s.notifyRepo.HasRecentSentByDedupeKey(n.DedupeKey, time.Now().UTC().Add(-dedupeWindow))
	if err != nil {
		return fail(err)
	}
	now := time.Now().UTC()
	if recent {
		return persist(func(r *repository.NotificationRepository) error {
			return r.UpdateStatus(n.ID, models.NotifyStatusSent, &now, "dedupe_suppressed")
		})
	}
	msg := &notify.Message{TaskID: n.TaskID, Title: n.Task.Title, Description: n.Task.Description,
		NotifyAt: &n.NotifyAt, UserID: n.Task.UserID, Timezone: s.resolveUserTimezone(n.Task.UserID, n.Task.User)}
	if n.Task.DueDate != nil {
		msg.DueDate = n.Task.DueDate
	} else {
		msg.DueDate = n.Task.StartTime
	}
	sendCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	if config == nil {
		config = models.NotifyConfigMap{}
	}
	config["idempotency_key"] = n.DedupeKey
	err = notifier.Send(sendCtx, n.Task.UserID, config, msg)
	cancel()
	if err != nil {
		return fail(err)
	}
	now = time.Now().UTC()
	return persist(func(r *repository.NotificationRepository) error {
		return r.UpdateStatus(n.ID, models.NotifyStatusSent, &now, "")
	})
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

func (s *NotifyService) UpdateNotification(
	userID,
	taskID,
	notificationID int64,
	req *models.UpdateNotificationRequest,
) (*models.Notification, error) {
	if _, err := s.taskRepo.GetByIDAndUser(taskID, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	notification, err := s.notifyRepo.GetByID(notificationID)
	if err != nil || notification.TaskID != taskID {
		return nil, errors.New("notification not found")
	}
	if notification.Source != models.NotificationSourceManual {
		return nil, errors.New("automatic reminders must be changed through task reminder policy")
	}
	notifyAt := req.NotifyAt.UTC()
	if !notifyAt.After(time.Now().UTC()) {
		return nil, errors.New("notify_at must be in the future")
	}
	notification.NotifyAt = notifyAt
	notification.NextRetryAt = &notifyAt
	notification.DedupeKey = buildDedupeKey(taskID, models.NotificationSourceManual, notifyAt)
	notification.Status = models.NotifyStatusPending
	notification.RetryCount = 0
	notification.LastAttemptAt = nil
	notification.SentAt = nil
	notification.ErrorMsg = ""
	if err := s.notifyRepo.Update(notification); err != nil {
		return nil, err
	}
	return notification, nil
}

func (s *NotifyService) DeleteTaskNotification(userID, taskID, notificationID int64) error {
	if _, err := s.taskRepo.GetByIDAndUser(taskID, userID); err != nil {
		return errors.New("task not found")
	}
	notification, err := s.notifyRepo.GetByID(notificationID)
	if err != nil || notification.TaskID != taskID {
		return errors.New("notification not found")
	}
	if notification.Source != models.NotificationSourceManual {
		return errors.New("automatic reminders must be changed through task reminder policy")
	}
	return s.notifyRepo.Delete(notificationID)
}

// DeleteNotification 删除通知
func (s *NotifyService) DeleteNotification(notificationID int64) error {
	return s.notifyRepo.Delete(notificationID)
}

func (s *NotifyService) ReconcileUserReminders(userID int64) error {
	return s.taskRepo.WithTransaction(func(tx *gorm.DB) error {
		if err := repository.LockTaskUser(tx, userID); err != nil {
			return err
		}
		scoped := *s
		scoped.taskRepo = repository.NewTaskRepository(tx)
		scoped.notifyRepo = repository.NewNotificationRepository(tx)
		scoped.userRepo = repository.NewUserRepository(tx)
		return scoped.reconcileUserRemindersInTransaction(userID)
	})
}

func (s *NotifyService) reconcileUserRemindersInTransaction(userID int64) error {
	if err := s.notifyRepo.DeleteActiveByUser(userID); err != nil {
		return err
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
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

	now := time.Now().UTC()
	for _, task := range tasks {
		minutes, enabled := resolveTaskReminderMinutes(&task, user)
		if !enabled {
			continue
		}
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
