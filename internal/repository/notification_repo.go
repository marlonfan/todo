package repository

import (
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
)

type NotificationRepository struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Create(notification *models.Notification) error {
	return r.db.Create(notification).Error
}

func (r *NotificationRepository) GetByID(id int64) (*models.Notification, error) {
	var notification models.Notification
	err := r.db.First(&notification, id).Error
	if err != nil {
		return nil, err
	}
	return &notification, nil
}

func (r *NotificationRepository) GetByTask(taskID int64) ([]models.Notification, error) {
	var notifications []models.Notification
	err := r.db.Where("task_id = ?", taskID).Order("notify_at DESC").Find(&notifications).Error
	return notifications, err
}

func (r *NotificationRepository) GetPendingNotifications(before, processingStaleBefore time.Time, limit int) ([]models.Notification, error) {
	var notifications []models.Notification
	if limit <= 0 {
		limit = 200
	}
	err := r.db.Preload("Task").Preload("Task.User").
		Where(`COALESCE(next_retry_at, notify_at) <= ? AND (
			status = ? OR
			status = ? OR
			(status = ? AND updated_at <= ?)
		)`, before, models.NotifyStatusPending, models.NotifyStatusFailed, models.NotifyStatusProcessing, processingStaleBefore).
		Order("COALESCE(next_retry_at, notify_at) ASC, id ASC").
		Limit(limit).
		Find(&notifications).Error
	return notifications, err
}

func (r *NotificationRepository) ReplaceActiveByTaskSource(notification *models.Notification) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("task_id = ? AND source = ? AND status IN ?", notification.TaskID, notification.Source, []models.NotifyStatus{
			models.NotifyStatusPending,
			models.NotifyStatusFailed,
			models.NotifyStatusProcessing,
		}).Delete(&models.Notification{}).Error; err != nil {
			return err
		}

		return tx.Create(notification).Error
	})
}

func (r *NotificationRepository) TryMarkProcessing(id int64, processingStaleBefore time.Time) (bool, error) {
	now := time.Now().UTC()
	result := r.db.Model(&models.Notification{}).
		Where(`id = ? AND (
			status IN ? OR
			(status = ? AND updated_at <= ?)
		)`, id, []models.NotifyStatus{models.NotifyStatusPending, models.NotifyStatusFailed}, models.NotifyStatusProcessing, processingStaleBefore).
		Updates(map[string]interface{}{
			"status":          models.NotifyStatusProcessing,
			"error_msg":       "",
			"last_attempt_at": now,
		})

	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func (r *NotificationRepository) UpdateStatus(id int64, status models.NotifyStatus, sentAt *time.Time, errorMsg string) error {
	updates := map[string]interface{}{
		"status":    status,
		"error_msg": errorMsg,
	}
	if sentAt != nil {
		updates["sent_at"] = *sentAt
	}
	if status == models.NotifyStatusSent {
		updates["next_retry_at"] = nil
	}
	return r.db.Model(&models.Notification{}).Where("id = ?", id).Updates(updates).Error
}

func (r *NotificationRepository) MarkFailedRetry(id int64, nextRetryAt time.Time, errorMsg string) error {
	return r.db.Model(&models.Notification{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":          models.NotifyStatusFailed,
			"error_msg":       errorMsg,
			"next_retry_at":   nextRetryAt,
			"retry_count":     gorm.Expr("COALESCE(retry_count, 0) + 1"),
			"last_attempt_at": time.Now().UTC(),
		}).Error
}

func (r *NotificationRepository) HasRecentSentByDedupeKey(dedupeKey string, since time.Time) (bool, error) {
	if dedupeKey == "" {
		return false, nil
	}
	var count int64
	err := r.db.Model(&models.Notification{}).
		Where("dedupe_key = ? AND status = ? AND sent_at IS NOT NULL AND sent_at >= ?", dedupeKey, models.NotifyStatusSent, since).
		Count(&count).Error
	return count > 0, err
}

func (r *NotificationRepository) Delete(id int64) error {
	return r.db.Delete(&models.Notification{}, id).Error
}

func (r *NotificationRepository) DeleteByTask(taskID int64) error {
	return r.db.Where("task_id = ?", taskID).Delete(&models.Notification{}).Error
}

func (r *NotificationRepository) DeleteActiveByTask(taskID int64) error {
	return r.db.Where("task_id = ? AND source = ? AND status IN ?", taskID, models.NotificationSourceDefaultAuto, []models.NotifyStatus{
		models.NotifyStatusPending,
		models.NotifyStatusFailed,
		models.NotifyStatusProcessing,
	}).Delete(&models.Notification{}).Error
}

func (r *NotificationRepository) DeleteActiveByUser(userID int64) error {
	return r.db.Where("source = ? AND status IN ? AND task_id IN (?)", models.NotificationSourceDefaultAuto, []models.NotifyStatus{
		models.NotifyStatusPending,
		models.NotifyStatusFailed,
		models.NotifyStatusProcessing,
	}, r.db.Model(&models.Task{}).Select("id").Where("user_id = ?", userID)).
		Delete(&models.Notification{}).Error
}

// User Notify Settings
func (r *NotificationRepository) GetUserSettings(userID int64) ([]models.UserNotifySetting, error) {
	var settings []models.UserNotifySetting
	err := r.db.Where("user_id = ?", userID).Order("is_default DESC, id ASC").Find(&settings).Error
	return settings, err
}

func (r *NotificationRepository) CreateUserSetting(setting *models.UserNotifySetting) error {
	return r.db.Create(setting).Error
}

func (r *NotificationRepository) DeleteUserSetting(id int64) error {
	return r.db.Delete(&models.UserNotifySetting{}, id).Error
}

func (r *NotificationRepository) GetDefaultSetting(userID int64) (*models.UserNotifySetting, error) {
	var setting models.UserNotifySetting
	err := r.db.Where("user_id = ? AND is_default = ?", userID, true).First(&setting).Error
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *NotificationRepository) ClearDefaultByUser(userID int64) error {
	return r.db.Model(&models.UserNotifySetting{}).
		Where("user_id = ?", userID).
		Update("is_default", false).Error
}

func (r *NotificationRepository) SetDefaultUserSetting(userID, settingID int64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.UserNotifySetting{}).
			Where("user_id = ?", userID).
			Update("is_default", false).Error; err != nil {
			return err
		}

		result := tx.Model(&models.UserNotifySetting{}).
			Where("id = ? AND user_id = ?", settingID, userID).
			Update("is_default", true)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}
