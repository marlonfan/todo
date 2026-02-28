package repository

import (
	"errors"
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
)

type TaskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(task *models.Task) error {
	return r.db.Create(task).Error
}

func (r *TaskRepository) GetByID(id int64) (*models.Task, error) {
	var task models.Task
	err := r.db.Preload("Categories").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskRepository) GetByIDAndUser(id, userID int64) (*models.Task, error) {
	var task models.Task
	err := r.db.Preload("Categories").Where("id = ? AND user_id = ?", id, userID).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskRepository) List(userID int64, filters map[string]interface{}) ([]models.Task, error) {
	var tasks []models.Task
	query := r.db.Preload("Categories").Where("user_id = ?", userID)

	if status, ok := filters["status"].(string); ok && status != "" {
		query = query.Where("status = ?", status)
	}

	if categoryID, ok := filters["category_id"].(int64); ok && categoryID > 0 {
		query = query.Joins("JOIN task_categories ON task_categories.task_id = tasks.id").
			Where("task_categories.category_id = ?", categoryID)
	}

	start, hasStart := filters["start"].(time.Time)
	end, hasEnd := filters["end"].(time.Time)

	if hasStart && hasEnd {
		query = query.Where(`(
			start_time IS NOT NULL AND COALESCE(end_time, start_time) >= ? AND start_time <= ?
		) OR (
			start_time IS NULL AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?
		)`, start, end, start, end)
	} else if hasStart {
		query = query.Where(`(
			start_time IS NOT NULL AND COALESCE(end_time, start_time) >= ?
		) OR (
			start_time IS NULL AND due_date IS NOT NULL AND due_date >= ?
		)`, start, start)
	} else if hasEnd {
		query = query.Where(`(
			start_time IS NOT NULL AND start_time <= ?
		) OR (
			start_time IS NULL AND due_date IS NOT NULL AND due_date <= ?
		)`, end, end)
	}

	err := query.Order("start_time ASC, due_date ASC").Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) Update(task *models.Task) error {
	return r.db.Save(task).Error
}

func (r *TaskRepository) Delete(id int64) error {
	// Fix 3: 使用事务清理关联表
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 删除 task_categories 关联
		if err := tx.Exec("DELETE FROM task_categories WHERE task_id = ?", id).Error; err != nil {
			return err
		}

		// 2. 删除任务
		if err := tx.Delete(&models.Task{}, id).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *TaskRepository) UpdateCategories(taskID int64, categoryIDs []int64) error {
	// Fix 3: 使用事务确保原子性
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 删除现有关联
		if err := tx.Exec("DELETE FROM task_categories WHERE task_id = ?", taskID).Error; err != nil {
			return err
		}

		// 插入新关联
		for _, catID := range categoryIDs {
			if err := tx.Exec("INSERT INTO task_categories (task_id, category_id) VALUES (?, ?)", taskID, catID).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *TaskRepository) GetRecurringTasks(userID int64, start, end time.Time) ([]models.Task, error) {
	var tasks []models.Task
	err := r.db.Preload("Categories").
		Where("user_id = ?", userID).
		Where("recurrence_rule IS NOT NULL").
		Where("(start_time <= ? OR (start_time IS NULL AND due_date <= ?))", end, end).
		Where("(recurrence_end_date IS NULL OR recurrence_end_date >= ?)", start).
		Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) GetReminderTasks(userID int64) ([]models.Task, error) {
	var tasks []models.Task
	err := r.db.
		Where("user_id = ? AND status = ? AND start_time IS NOT NULL", userID, models.TaskStatusPending).
		Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) GetOccurrenceStatus(userID, taskID int64, occurrenceDate time.Time) (*models.TaskOccurrenceStatus, error) {
	var status models.TaskOccurrenceStatus
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	err := r.db.
		Where("user_id = ? AND task_id = ? AND occurrence_date = ?", userID, taskID, dateOnly).
		First(&status).Error
	if err != nil {
		return nil, err
	}
	return &status, nil
}

func (r *TaskRepository) UpsertOccurrenceStatus(userID, taskID int64, occurrenceDate time.Time, status models.TaskStatus) error {
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)

	existing, err := r.GetOccurrenceStatus(userID, taskID, dateOnly)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		return r.db.Create(&models.TaskOccurrenceStatus{
			UserID:         userID,
			TaskID:         taskID,
			OccurrenceDate: dateOnly,
			Status:         status,
		}).Error
	}

	return r.db.Model(&models.TaskOccurrenceStatus{}).
		Where("id = ?", existing.ID).
		Update("status", status).Error
}

func (r *TaskRepository) DeleteOccurrenceStatus(userID, taskID int64, occurrenceDate time.Time) error {
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	return r.db.
		Where("user_id = ? AND task_id = ? AND occurrence_date = ?", userID, taskID, dateOnly).
		Delete(&models.TaskOccurrenceStatus{}).Error
}

func (r *TaskRepository) GetOccurrenceStatuses(userID int64, start, end time.Time) ([]models.TaskOccurrenceStatus, error) {
	var statuses []models.TaskOccurrenceStatus
	startDate := start.UTC().Truncate(24 * time.Hour)
	endDate := end.UTC().Truncate(24 * time.Hour)

	err := r.db.
		Where("user_id = ? AND occurrence_date >= ? AND occurrence_date <= ?", userID, startDate, endDate).
		Find(&statuses).Error
	return statuses, err
}
