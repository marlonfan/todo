package migrations

import (
	"todo-app/internal/models"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Category{},
		&models.Task{},
		&models.TaskOccurrenceStatus{},
		&models.TaskCategory{},
		&models.Notification{},
		&models.UserNotifySetting{},
	)
}
