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

type NotifyService struct {
	notifyRepo *repository.NotificationRepository
	registry   *notify.Registry
}

func NewNotifyService(notifyRepo *repository.NotificationRepository, registry *notify.Registry) *NotifyService {
	return &NotifyService{
		notifyRepo: notifyRepo,
		registry:   registry,
	}
}

func (s *NotifyService) CreateNotification(userID, taskID int64, req *models.CreateNotificationRequest) (*models.Notification, error) {
	// Validate channel
	notifier, ok := s.registry.Get(string(req.Channel))
	if !ok {
		return nil, errors.New("unsupported notification channel")
	}

	// Validate config
	if err := notifier.ValidateConfig(req.Config); err != nil {
		return nil, err
	}

	notification := &models.Notification{
		TaskID:   taskID,
		Channel:  req.Channel,
		Config:   req.Config,
		NotifyAt: req.NotifyAt.UTC(),
		Status:   models.NotifyStatusPending,
	}

	if err := s.notifyRepo.Create(notification); err != nil {
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
		return s.notifyRepo.SetDefaultUserSetting(userID, remaining[0].ID)
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
	return nil
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
	notifications, err := s.notifyRepo.GetPendingNotifications(time.Now())
	if err != nil {
		return err
	}

	for _, n := range notifications {
		// Fix 7: 先更新状态为 processing，防止多实例重复发送
		if err := s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusProcessing, nil, ""); err != nil {
			log.Printf("Failed to mark notification %d as processing: %v", n.ID, err)
			continue
		}

		notifier, ok := s.registry.Get(string(n.Channel))
		if !ok {
			now := time.Now()
			s.notifyRepo.UpdateStatus(n.ID, models.NotifyStatusFailed, &now, "unsupported channel")
			continue
		}

		msg := &notify.Message{
			TaskID:      n.TaskID,
			Title:       n.Task.Title,
			Description: n.Task.Description,
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
		err := notifier.Send(ctx, n.Task.UserID, n.Config, msg)
		cancel()

		now := time.Now()
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
