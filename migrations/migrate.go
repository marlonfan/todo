package migrations

import (
	"todo-app/internal/models"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&models.User{},
		&models.UserAIConfig{},
		&models.Prompt{},
		&models.Category{},
		&models.Task{},
		&models.TaskDeleteLog{},
		&models.TaskOccurrenceStatus{},
		&models.TaskOccurrenceOverride{},
		&models.TaskOccurrence{},
		&models.TaskActivity{},
		&models.TaskMutationReceipt{},
		&models.TaskCategory{},
		&models.Notification{},
		&models.UserNotifySetting{},
		&models.CaldavSource{},
		&models.CaldavCalendar{},
		&models.CaldavEventCache{},
	); err != nil {
		return err
	}

	if err := backfillTaskOccurrences(db); err != nil {
		return err
	}
	return backfillTaskStatusTimestamps(db)
}
