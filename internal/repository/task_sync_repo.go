package repository

import (
	"errors"
	"gorm.io/gorm"
	"time"
	"todo-app/internal/models"
)

var ErrTaskRevisionConflict = errors.New("task revision conflict")

// The harmless UPDATE takes a PostgreSQL row lock or SQLite write lock before
// any reads. It also prevents SQLite read-to-write upgrade failures.
func LockTaskUser(tx *gorm.DB, userID int64) error {
	result := tx.Exec("UPDATE users SET id = id WHERE id = ?", userID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func recordTaskChange(tx *gorm.DB, userID, taskID int64, deleted bool) error {
	return tx.Create(&models.TaskChangeLog{UserID: userID, TaskID: taskID, IsDelete: deleted}).Error
}

func (r *TaskRepository) ListChangesAfter(userID, cursor int64, limit int) ([]models.Task, []models.TaskDeleteLog, int64, bool, error) {
	if limit <= 0 {
		limit = 500
	}
	if limit > 2000 {
		limit = 2000
	}
	var rows []models.TaskChangeLog
	err := r.db.Where("user_id = ? AND id > ?", userID, cursor).Order("id ASC").Limit(limit + 1).Find(&rows).Error
	if err != nil {
		return nil, nil, cursor, false, err
	}
	more := len(rows) > limit
	if more {
		rows = rows[:limit]
	}
	next := cursor
	byID := make(map[int64]models.TaskChangeLog)
	for _, row := range rows {
		next = row.ID
		byID[row.TaskID] = row
	}
	ids := make([]int64, 0, len(byID))
	for id, row := range byID {
		if !row.IsDelete {
			ids = append(ids, id)
		}
	}
	tasks, err := r.ListByIDsAndUser(userID, ids)
	if err != nil {
		return nil, nil, cursor, false, err
	}
	present := make(map[int64]bool)
	for _, task := range tasks {
		present[task.ID] = true
	}
	deleted := make([]models.TaskDeleteLog, 0)
	for id, row := range byID {
		// A task may have been deleted after this page was read. Return its tombstone
		// immediately; its later journal entry will be harmlessly replayed.
		if row.IsDelete || !present[id] {
			deleted = append(deleted, models.TaskDeleteLog{UserID: userID, TaskID: id, DeletedAt: row.CreatedAt})
		}
	}
	return tasks, deleted, next, more, nil
}

func (r *TaskRepository) ListChangedSinceSnapshot(userID int64, since time.Time, limit int) ([]models.Task, []models.TaskDeleteLog, time.Time, error) {
	var tasks []models.Task
	var deleted []models.TaskDeleteLog
	var boundary time.Time
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := LockTaskUser(tx, userID); err != nil {
			return err
		}
		boundary = time.Now().UTC()
		scoped := NewTaskRepository(tx)
		var err error
		tasks, err = scoped.ListChangedSince(userID, since, limit)
		if err != nil {
			return err
		}
		deleted, err = scoped.ListDeletedSince(userID, since, limit)
		return err
	})
	return tasks, deleted, boundary, err
}
