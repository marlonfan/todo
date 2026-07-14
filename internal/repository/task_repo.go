package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TaskRepository struct {
	db *gorm.DB
}

type TaskCalendarCollectionState struct {
	Count        int64
	MaxUpdatedAt time.Time
	MaxRevision  int64
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) WithTransaction(fn func(*gorm.DB) error) error {
	return r.db.Transaction(fn)
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

func (r *TaskRepository) GetByCalDAVRef(userID int64, uid, href string) (*models.Task, error) {
	var task models.Task
	query := r.db.Preload("Categories").Where("user_id = ?", userID)
	switch {
	case uid != "" && href != "":
		query = query.Where("cal_dav_uid = ? OR cal_dav_href = ?", uid, href)
	case uid != "":
		query = query.Where("cal_dav_uid = ?", uid)
	case href != "":
		query = query.Where("cal_dav_href = ?", href)
	default:
		return nil, gorm.ErrRecordNotFound
	}
	if err := query.First(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *TaskRepository) ListByIDsAndUser(userID int64, ids []int64) ([]models.Task, error) {
	if len(ids) == 0 {
		return []models.Task{}, nil
	}
	var tasks []models.Task
	err := r.db.Preload("Categories").
		Where("user_id = ? AND id IN ?", userID, ids).
		Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) ListByCalDAVHrefs(userID int64, hrefs []string) ([]models.Task, error) {
	if len(hrefs) == 0 {
		return []models.Task{}, nil
	}
	var tasks []models.Task
	err := r.db.Preload("Categories").
		Where("user_id = ? AND cal_dav_href IN ?", userID, hrefs).
		Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) CalendarCollectionState(userID int64) (TaskCalendarCollectionState, error) {
	var row struct {
		Count        int64
		MaxUpdatedAt nullableDBTime
		MaxRevision  sql.NullInt64
	}
	err := r.db.Model(&models.Task{}).
		Select("COUNT(*) AS count, MAX(updated_at) AS max_updated_at, MAX(revision) AS max_revision").
		Where("user_id = ?", userID).
		Where("deleted_at IS NULL").
		Where("status NOT IN ?", []models.TaskStatus{models.TaskStatusCancelled, models.TaskStatusSkipped}).
		Scan(&row).Error
	if err != nil {
		return TaskCalendarCollectionState{}, err
	}
	state := TaskCalendarCollectionState{Count: row.Count}
	if row.MaxUpdatedAt.Valid {
		state.MaxUpdatedAt = row.MaxUpdatedAt.Time.UTC()
	}
	if row.MaxRevision.Valid {
		state.MaxRevision = row.MaxRevision.Int64
	}
	return state, nil
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
		if err := tx.Where("task_id = ?", id).Delete(&models.TaskOccurrenceStatus{}).Error; err != nil {
			return err
		}
		if err := tx.Where("task_id = ?", id).Delete(&models.TaskOccurrenceOverride{}).Error; err != nil {
			return err
		}
		if err := tx.Where("task_id = ?", id).Delete(&models.TaskOccurrence{}).Error; err != nil {
			return err
		}

		// 2. 删除任务
		if err := tx.Delete(&models.Task{}, id).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *TaskRepository) DeleteWithDeleteLog(userID, taskID int64, deletedAt time.Time) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&models.TaskDeleteLog{
			UserID:    userID,
			TaskID:    taskID,
			DeletedAt: deletedAt.UTC(),
		}).Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM task_categories WHERE task_id = ?", taskID).Error; err != nil {
			return err
		}
		if err := tx.Where("task_id = ?", taskID).Delete(&models.TaskOccurrenceStatus{}).Error; err != nil {
			return err
		}
		if err := tx.Where("task_id = ?", taskID).Delete(&models.TaskOccurrenceOverride{}).Error; err != nil {
			return err
		}
		if err := tx.Where("task_id = ?", taskID).Delete(&models.TaskOccurrence{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.Task{}, taskID).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *TaskRepository) CreateDeleteLog(userID, taskID int64, deletedAt time.Time) error {
	record := &models.TaskDeleteLog{
		UserID:    userID,
		TaskID:    taskID,
		DeletedAt: deletedAt.UTC(),
	}
	return r.db.Create(record).Error
}

func (r *TaskRepository) ListChangedSince(userID int64, since time.Time, limit int) ([]models.Task, error) {
	if limit <= 0 {
		limit = 500
	}
	if limit > 2000 {
		limit = 2000
	}
	var tasks []models.Task
	err := r.db.Preload("Categories").
		Where("user_id = ? AND updated_at > ?", userID, since.UTC()).
		Order("updated_at asc, id asc").
		Limit(limit + 1).
		Find(&tasks).Error
	if err != nil || len(tasks) <= limit {
		return tasks, err
	}

	boundary := tasks[limit-1].UpdatedAt.UTC()
	prefix := make([]models.Task, 0, limit)
	for _, task := range tasks[:limit] {
		if task.UpdatedAt.UTC().Before(boundary) {
			prefix = append(prefix, task)
		}
	}

	var boundaryRows []models.Task
	err = r.db.Preload("Categories").
		Where("user_id = ? AND updated_at = ?", userID, boundary).
		Order("id asc").
		Find(&boundaryRows).Error
	if err != nil {
		return nil, err
	}
	return append(prefix, boundaryRows...), nil
}

func (r *TaskRepository) ListDeletedSince(userID int64, since time.Time, limit int) ([]models.TaskDeleteLog, error) {
	if limit <= 0 {
		limit = 500
	}
	if limit > 2000 {
		limit = 2000
	}
	var logs []models.TaskDeleteLog
	err := r.db.
		Where("user_id = ? AND deleted_at > ?", userID, since.UTC()).
		Order("deleted_at asc, id asc").
		Limit(limit + 1).
		Find(&logs).Error
	if err != nil || len(logs) <= limit {
		return logs, err
	}

	boundary := logs[limit-1].DeletedAt.UTC()
	prefix := make([]models.TaskDeleteLog, 0, limit)
	for _, log := range logs[:limit] {
		if log.DeletedAt.UTC().Before(boundary) {
			prefix = append(prefix, log)
		}
	}

	var boundaryRows []models.TaskDeleteLog
	err = r.db.
		Where("user_id = ? AND deleted_at = ?", userID, boundary).
		Order("id asc").
		Find(&boundaryRows).Error
	if err != nil {
		return nil, err
	}
	return append(prefix, boundaryRows...), nil
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

func (r *TaskRepository) ListRecurringTasks(userID int64) ([]models.Task, error) {
	var tasks []models.Task
	err := r.db.Preload("Categories").
		Where("user_id = ?", userID).
		Where("recurrence_rule IS NOT NULL").
		Order("start_time ASC, due_date ASC, id ASC").
		Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) GetTasksByIDsAndUser(userID int64, taskIDs []int64) ([]models.Task, error) {
	if len(taskIDs) == 0 {
		return []models.Task{}, nil
	}
	var tasks []models.Task
	err := r.db.Preload("Categories").
		Where("user_id = ? AND id IN ?", userID, taskIDs).
		Find(&tasks).Error
	return tasks, err
}

func (r *TaskRepository) GetReminderTasks(userID int64) ([]models.Task, error) {
	var tasks []models.Task
	err := r.db.
		Where("user_id = ? AND status = ? AND (start_time IS NOT NULL OR due_date IS NOT NULL)", userID, models.TaskStatusPending).
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

func (r *TaskRepository) GetOccurrenceOverride(userID, taskID int64, occurrenceDate time.Time) (*models.TaskOccurrenceOverride, error) {
	var override models.TaskOccurrenceOverride
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	err := r.db.
		Where("user_id = ? AND task_id = ? AND occurrence_date = ?", userID, taskID, dateOnly).
		First(&override).Error
	if err != nil {
		return nil, err
	}
	return &override, nil
}

func (r *TaskRepository) UpsertOccurrenceDescription(userID, taskID int64, occurrenceDate time.Time, description string) error {
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	existing, err := r.GetOccurrenceOverride(userID, taskID, dateOnly)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return r.db.Create(&models.TaskOccurrenceOverride{
			UserID:         userID,
			TaskID:         taskID,
			OccurrenceDate: dateOnly,
			Description:    description,
		}).Error
	}

	return r.db.Model(&models.TaskOccurrenceOverride{}).
		Where("id = ?", existing.ID).
		Update("description", description).Error
}

func (r *TaskRepository) DeleteOccurrenceOverride(userID, taskID int64, occurrenceDate time.Time) error {
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	return r.db.
		Where("user_id = ? AND task_id = ? AND occurrence_date = ?", userID, taskID, dateOnly).
		Delete(&models.TaskOccurrenceOverride{}).Error
}

func (r *TaskRepository) GetOccurrenceOverrides(userID int64, start, end time.Time) ([]models.TaskOccurrenceOverride, error) {
	var overrides []models.TaskOccurrenceOverride
	startDate := start.UTC().Truncate(24 * time.Hour)
	endDate := end.UTC().Truncate(24 * time.Hour)

	err := r.db.
		Where("user_id = ? AND occurrence_date >= ? AND occurrence_date <= ?", userID, startDate, endDate).
		Find(&overrides).Error
	return overrides, err
}

func (r *TaskRepository) GetTaskOccurrence(userID, taskID int64, occurrenceDate time.Time) (*models.TaskOccurrence, error) {
	var occurrence models.TaskOccurrence
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	err := r.db.
		Where("user_id = ? AND task_id = ? AND occurrence_date = ?", userID, taskID, dateOnly).
		First(&occurrence).Error
	if err != nil {
		return nil, err
	}
	return &occurrence, nil
}

func (r *TaskRepository) UpsertTaskOccurrence(occurrence *models.TaskOccurrence) error {
	if occurrence == nil {
		return nil
	}
	occurrence.OccurrenceDate = occurrence.OccurrenceDate.UTC().Truncate(24 * time.Hour)
	if occurrence.Status == "" {
		occurrence.Status = models.TaskStatusPending
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "task_id"},
			{Name: "occurrence_date"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"instance_id",
			"status",
			"completed_at",
			"deleted_at",
			"description",
			"start_time",
			"end_time",
			"all_day",
			"updated_at",
		}),
	}).Create(occurrence).Error
}

func (r *TaskRepository) DeleteTaskOccurrence(userID, taskID int64, occurrenceDate time.Time) error {
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	return r.db.
		Where("user_id = ? AND task_id = ? AND occurrence_date = ?", userID, taskID, dateOnly).
		Delete(&models.TaskOccurrence{}).Error
}

func (r *TaskRepository) ListTaskOccurrencesInRange(userID int64, start, end time.Time) ([]models.TaskOccurrence, error) {
	startDate := start.UTC().Truncate(24 * time.Hour)
	endDate := end.UTC().Truncate(24 * time.Hour)
	var rows []models.TaskOccurrence
	err := r.db.
		Where("user_id = ? AND occurrence_date >= ? AND occurrence_date <= ?", userID, startDate, endDate).
		Order("occurrence_date ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *TaskRepository) ListTaskOccurrencesForTasksInRange(
	userID int64,
	taskIDs []int64,
	start,
	end time.Time,
) ([]models.TaskOccurrence, error) {
	if len(taskIDs) == 0 {
		return []models.TaskOccurrence{}, nil
	}
	startDate := start.UTC().Truncate(24 * time.Hour)
	endDate := end.UTC().Truncate(24 * time.Hour)
	var rows []models.TaskOccurrence
	err := r.db.
		Where("user_id = ? AND task_id IN ? AND occurrence_date >= ? AND occurrence_date <= ?", userID, taskIDs, startDate, endDate).
		Order("occurrence_date ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *TaskRepository) ListLatestTaskOccurrenceDates(userID int64, taskIDs []int64) (map[int64]time.Time, error) {
	if len(taskIDs) == 0 {
		return map[int64]time.Time{}, nil
	}
	rows, err := r.db.
		Model(&models.TaskOccurrence{}).
		Select("task_id, MAX(occurrence_date) AS occurrence_date").
		Where("user_id = ? AND task_id IN ?", userID, taskIDs).
		Group("task_id").
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	latestByTask := make(map[int64]time.Time)
	for rows.Next() {
		var taskID int64
		var rawOccurrenceDate interface{}
		if err := rows.Scan(&taskID, &rawOccurrenceDate); err != nil {
			return nil, err
		}
		occurrenceDate, err := parseScannedTime(rawOccurrenceDate)
		if err != nil {
			return nil, err
		}
		if taskID <= 0 || occurrenceDate.IsZero() {
			continue
		}
		latestByTask[taskID] = occurrenceDate.UTC().Truncate(24 * time.Hour)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return latestByTask, nil
}

func parseScannedTime(value interface{}) (time.Time, error) {
	switch typed := value.(type) {
	case nil:
		return time.Time{}, nil
	case time.Time:
		return typed, nil
	case []byte:
		return parseScannedTimeString(string(typed))
	case string:
		return parseScannedTimeString(typed)
	default:
		return time.Time{}, fmt.Errorf("unsupported time scan type %T", value)
	}
}

func parseScannedTimeString(value string) (time.Time, error) {
	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported time value %q", value)
}

func (r *TaskRepository) ListTaskOccurrencesByStatus(
	userID int64,
	statuses []models.TaskStatus,
	limit,
	offset int,
) ([]models.TaskOccurrence, bool, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	if offset < 0 {
		offset = 0
	}
	query := r.db.Where("user_id = ?", userID)
	if len(statuses) > 0 {
		query = query.Where("status IN ?", statuses)
	}
	var rows []models.TaskOccurrence
	err := query.
		Order("occurrence_date DESC, id DESC").
		Offset(offset).
		Limit(limit + 1).
		Find(&rows).Error
	if err != nil {
		return nil, false, err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	return rows, hasMore, nil
}
