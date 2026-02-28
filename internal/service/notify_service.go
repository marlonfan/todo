package service

import (
	"context"
	"errors"
	"log"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/notify"
	"todo-app/internal/repository"

	"gorm.io/gorm"
)

const processingLockTTL = 15 * time.Minute

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
		TaskID:   taskID,
		Channel:  channel,
		Config:   config,
		NotifyAt: req.NotifyAt.UTC(),
		Status:   models.NotifyStatusPending,
	}

	// Keep only one active reminder per task to avoid duplicates when users edit repeatedly.
	if err := s.notifyRepo.ReplaceActiveByTask(notification); err != nil {
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
	notifications, err := s.notifyRepo.GetPendingNotifications(now, processingStaleBefore)
	if err != nil {
		return err
	}

	for _, n := range notifications {
		claimed, err := s.notifyRepo.TryMarkProcessing(n.ID, processingStaleBefore)
		if err != nil {
			log.Printf("Failed to mark notification %d as processing: %v", n.ID, err)
			continue
		}
		if !claimed {
			continue
		}

		notifier, ok := s.registry.Get(string(n.Channel))
		if !ok {
			now := time.Now().UTC()
			s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusFailed, &now, "unsupported channel")
			continue
		}

		msg := &notify.Message{
			TaskID:      n.TaskID,
			Title:       n.Task.Title,
			Description: n.Task.Description,
			NotifyAt:    &n.NotifyAt,
			UserID:      n.Task.UserID,
			Timezone:    "UTC",
		}
		if n.Task.User != nil && n.Task.User.Timezone != "" {
			msg.Timezone = n.Task.User.Timezone
		}

		if n.Task.DueDate != nil {
			msg.DueDate = n.Task.DueDate
		} else if n.Task.StartTime != nil {
			msg.DueDate = n.Task.StartTime
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err = notifier.Send(ctx, n.Task.UserID, n.Config, msg)
		cancel()

		now := time.Now().UTC()
		if err != nil {
			log.Printf("Failed to send notification %d: %v", n.ID, err)
			s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusFailed, &now, err.Error())
		} else {
			s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusSent, &now, "")
		}
	}

	return nil
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
		if task.StartTime == nil {
			continue
		}
		notifyAt := task.StartTime.UTC().Add(-time.Duration(minutes) * time.Minute)
		if !notifyAt.After(now) {
			continue
		}

		notification := &models.Notification{
			TaskID:   task.ID,
			Channel:  defaultSetting.Channel,
			Config:   defaultSetting.Config,
			NotifyAt: notifyAt,
			Status:   models.NotifyStatusPending,
		}
		if err := s.notifyRepo.Create(notification); err != nil {
			return err
		}
	}

	return nil
}
