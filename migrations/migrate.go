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
		&models.PromptAskHistory{},
		&models.Category{},
		&models.Task{},
		&models.TaskDeleteLog{},
		&models.TaskChangeLog{},
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

	if err := db.Exec("UPDATE tasks SET revision = 1 WHERE revision IS NULL OR revision < 1").Error; err != nil {
		return err
	}
	if err := db.Exec("INSERT INTO task_change_logs (user_id, task_id, is_delete, created_at) SELECT user_id, id, false, updated_at FROM tasks WHERE NOT EXISTS (SELECT 1 FROM task_change_logs c WHERE c.user_id = tasks.user_id AND c.task_id = tasks.id)").Error; err != nil {
		return err
	}
	if err := db.Exec("INSERT INTO task_change_logs (user_id, task_id, is_delete, created_at) SELECT user_id, task_id, true, deleted_at FROM task_delete_logs WHERE NOT EXISTS (SELECT 1 FROM task_change_logs c WHERE c.user_id = task_delete_logs.user_id AND c.task_id = task_delete_logs.task_id AND c.is_delete = true)").Error; err != nil {
		return err
	}

	if err := backfillTaskOccurrences(db); err != nil {
		return err
	}
	return backfillTaskStatusTimestamps(db)
}
