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
		&models.TaskDeleteLog{},
		&models.TaskOccurrenceStatus{},
		&models.TaskActivity{},
		&models.TaskCategory{},
		&models.Notification{},
		&models.UserNotifySetting{},
		&models.CaldavSource{},
		&models.CaldavCalendar{},
		&models.CaldavEventCache{},
	)
}
