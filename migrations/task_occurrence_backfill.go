package migrations

import (
	"fmt"
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func backfillTaskOccurrences(db *gorm.DB) error {
	var statusCount int64
	if err := db.Model(&models.TaskOccurrenceStatus{}).Count(&statusCount).Error; err != nil {
		return err
	}
	var overrideCount int64
	if err := db.Model(&models.TaskOccurrenceOverride{}).Count(&overrideCount).Error; err != nil {
		return err
	}
	if statusCount == 0 && overrideCount == 0 {
		return nil
	}

	var statusRows []models.TaskOccurrenceStatus
	if err := db.Find(&statusRows).Error; err != nil {
		return err
	}
	var overrideRows []models.TaskOccurrenceOverride
	if err := db.Find(&overrideRows).Error; err != nil {
		return err
	}

	occMap := make(map[string]*models.TaskOccurrence)
	taskIDs := make(map[int64]struct{})

	toKey := func(userID, taskID int64, occurrenceDate time.Time) string {
		date := occurrenceDate.UTC().Truncate(24 * time.Hour)
		return fmt.Sprintf("%d:%d:%s", userID, taskID, date.Format("2006-01-02"))
	}
	ensure := func(userID, taskID int64, occurrenceDate time.Time) *models.TaskOccurrence {
		date := occurrenceDate.UTC().Truncate(24 * time.Hour)
		key := toKey(userID, taskID, date)
		if existing, ok := occMap[key]; ok {
			return existing
		}
		row := &models.TaskOccurrence{
			UserID:         userID,
			TaskID:         taskID,
			OccurrenceDate: date,
		}
		occMap[key] = row
		taskIDs[taskID] = struct{}{}
		return row
	}

	for _, row := range statusRows {
		occ := ensure(row.UserID, row.TaskID, row.OccurrenceDate)
		occ.Status = row.Status
	}
	for _, row := range overrideRows {
		occ := ensure(row.UserID, row.TaskID, row.OccurrenceDate)
		occ.Description = row.Description
	}

	if len(occMap) == 0 || len(taskIDs) == 0 {
		return nil
	}

	idList := make([]int64, 0, len(taskIDs))
	for id := range taskIDs {
		if id > 0 {
			idList = append(idList, id)
		}
	}
	if len(idList) == 0 {
		return nil
	}

	var tasks []models.Task
	if err := db.Where("id IN ?", idList).Find(&tasks).Error; err != nil {
		return err
	}
	taskByID := make(map[int64]*models.Task, len(tasks))
	for i := range tasks {
		taskByID[tasks[i].ID] = &tasks[i]
	}

	records := make([]models.TaskOccurrence, 0, len(occMap))
	for _, occ := range occMap {
		task := taskByID[occ.TaskID]
		if task == nil || task.RecurrenceRule == nil {
			continue
		}
		if occ.InstanceID == "" {
			occ.InstanceID = buildOccurrenceInstanceID(occ.TaskID, occ.OccurrenceDate)
		}
		if occ.Status == "" {
			occ.Status = task.Status
			if occ.Status == "" {
				occ.Status = models.TaskStatusPending
			}
		}
		occ.AllDay = task.AllDay
		start, end := deriveOccurrenceRangeFromTask(task, occ.OccurrenceDate)
		occ.StartTime = start
		occ.EndTime = end
		records = append(records, *occ)
	}
	if len(records) == 0 {
		return nil
	}

	for idx := 0; idx < len(records); idx += 200 {
		end := idx + 200
		if end > len(records) {
			end = len(records)
		}
		chunk := records[idx:end]
		if err := db.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "user_id"},
				{Name: "task_id"},
				{Name: "occurrence_date"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"instance_id",
				"status",
				"description",
				"start_time",
				"end_time",
				"all_day",
				"updated_at",
			}),
		}).Create(&chunk).Error; err != nil {
			return err
		}
	}
	return nil
}

func buildOccurrenceInstanceID(taskID int64, occurrenceDate time.Time) string {
	date := occurrenceDate.UTC().Truncate(24 * time.Hour)
	return fmt.Sprintf("%d_%s", taskID, date.Format("20060102"))
}

func deriveOccurrenceRangeFromTask(task *models.Task, occurrenceDate time.Time) (*time.Time, *time.Time) {
	if task == nil {
		return nil, nil
	}
	date := occurrenceDate.UTC().Truncate(24 * time.Hour)
	anchor := task.StartTime
	if anchor == nil {
		anchor = task.DueDate
	}
	if anchor == nil {
		start := date
		return &start, nil
	}

	base := anchor.UTC()
	start := time.Date(
		date.Year(),
		date.Month(),
		date.Day(),
		base.Hour(),
		base.Minute(),
		base.Second(),
		base.Nanosecond(),
		time.UTC,
	)

	var duration time.Duration
	hasDuration := false
	if task.StartTime != nil && task.EndTime != nil {
		duration = task.EndTime.UTC().Sub(task.StartTime.UTC())
		hasDuration = duration > 0
	} else if task.EndTime != nil && task.DueDate != nil {
		duration = task.EndTime.UTC().Sub(task.DueDate.UTC())
		hasDuration = duration > 0
	}

	if !hasDuration {
		return &start, nil
	}
	end := start.Add(duration)
	return &start, &end
}
