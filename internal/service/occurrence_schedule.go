package service

import (
	"errors"
	"gorm.io/gorm"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"
)

// Date is encoded as UTC midnight but denotes a calendar date in the account
// timezone. Verify membership against the actual recurrence, including COUNT.
func validOccurrenceDate(task *models.Task, date time.Time, tz string) bool {
	loc := loadLocationOrUTC(tz)
	day := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, loc)
	for _, start := range buildTaskOccurrenceStarts(task, day.UTC(), day.AddDate(0, 0, 1).UTC(), tz) {
		if start.In(loc).Format("2006-01-02") == date.Format("2006-01-02") {
			return true
		}
	}
	return false
}

func (s *TaskService) UpdateOccurrenceSchedule(userID, taskID int64, req *models.UpdateTaskOccurrenceScheduleRequest, revision *int64, meta *TaskActivityMeta) (*models.Task, error) {
	var task *models.Task
	err := s.withTaskTransaction(userID, func(scoped *TaskService) error {
		var err error
		task, err = scoped.taskRepo.GetByIDAndUser(taskID, userID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("task not found")
		}
		if err != nil {
			return err
		}
		if err = checkRevision(revision, task); err != nil {
			return err
		}
		date, found, err := parseOccurrenceDate(req.InstanceID, req.OccurrenceDate)
		if err != nil {
			return err
		}
		if !found || task.RecurrenceRule == nil {
			return errors.New("a recurring occurrence is required")
		}
		if req.InstanceID != "" && req.InstanceID != buildOccurrenceInstanceID(task.ID, date) {
			return errors.New("instance_id does not match task and original date")
		}
		tz := scoped.resolveUserTimezone(userID)
		if !validOccurrenceDate(task, date, tz) {
			return errors.New("date is not an occurrence of this series")
		}
		baseStart, baseEnd := deriveOccurrenceRangeFromTask(task, date, tz)
		row, err := scoped.taskRepo.GetTaskOccurrence(userID, taskID, date)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if row == nil {
			row = &models.TaskOccurrence{UserID: userID, TaskID: taskID, OccurrenceDate: date, InstanceID: buildOccurrenceInstanceID(task.ID, date), Status: task.Status, CompletedAt: cloneTimePointer(task.CompletedAt), DeletedAt: cloneTimePointer(task.DeletedAt), StartTime: baseStart, EndTime: baseEnd, AllDay: task.AllDay}
		}
		before := snapshotTaskForActivity(task)
		before.StartTime, before.EndTime, before.AllDay = cloneTimePointer(row.StartTime), cloneTimePointer(row.EndTime), row.AllDay
		if req.Reset {
			row.StartTime, row.EndTime, row.AllDay, row.ScheduleOverride = baseStart, baseEnd, task.AllDay, false
		} else {
			if req.StartTime == nil || req.StartTime.IsZero() {
				return errors.New("occurrence start_time is required")
			}
			if req.EndTime != nil && !req.EndTime.After(*req.StartTime) {
				return errors.New("occurrence end_time must be after start_time")
			}
			if err := validateTaskTimeRange(req.StartTime, req.EndTime); err != nil {
				return err
			}
			row.StartTime, row.EndTime, row.AllDay, row.ScheduleOverride = cloneTimePointer(req.StartTime), cloneTimePointer(req.EndTime), req.AllDay, true
		}
		if taskOccurrenceMatchesSeriesDefault(row, task, baseStart, baseEnd) {
			err = scoped.taskRepo.DeleteTaskOccurrence(userID, taskID, date)
		} else {
			err = scoped.taskRepo.UpsertTaskOccurrence(row)
		}
		if err != nil {
			return err
		}
		if err = scoped.touchTaskForSync(task); err != nil {
			return err
		}
		after := snapshotTaskForActivity(task)
		after.StartTime, after.EndTime, after.AllDay = cloneTimePointer(row.StartTime), cloneTimePointer(row.EndTime), row.AllDay
		if scoped.taskActivityRepo != nil {
			changes := models.TaskActivityChanges{}
			value := func(v taskActivitySnapshot) any {
				return map[string]any{"start_time": normalizeActivityTime(v.StartTime), "end_time": normalizeActivityTime(v.EndTime), "all_day": v.AllDay}
			}
			appendActivityFieldChange(changes, "occurrence_schedule:"+date.Format("2006-01-02"), value(before), value(after))
			if len(changes) > 0 {
				source := ""
				if meta != nil {
					source = meta.SubmitSource
				}
				if err = scoped.taskActivityRepo.RecordWithMerge(userID, taskID, resolveActivityOccurredAt(meta), source, changes, taskActivityMergeWindow); err != nil {
					return err
				}
			}
		}
		return scoped.syncTaskReminder(userID, task)
	})
	if err == nil {
		s.notifyTaskChanged(userID)
	}
	return task, err
}

// Shared by immediate scheduling and periodic rollover, preserving the chosen
// instance's all-day flag and moved instances outside the generated window.
func nextPendingReminderInstance(repo *repository.TaskRepository, task *models.Task, from time.Time, tz, morning string) (*models.TaskInstance, error) {
	if task == nil || task.RecurrenceRule == nil {
		return nil, nil
	}
	if from.IsZero() {
		from = time.Now().UTC()
	}
	start := from.UTC().Truncate(24*time.Hour).AddDate(-3, 0, 0)
	end := from.UTC().Truncate(24*time.Hour).AddDate(3, 0, 0)
	latest, err := repo.ListLatestTaskOccurrenceDates(task.UserID, []int64{task.ID})
	if err != nil {
		return nil, err
	}
	if date, ok := latest[task.ID]; ok {
		end = extendRecurringSearchHorizon(end, date, task.RecurrenceRule)
	}
	rows, err := repo.ListTaskOccurrencesForTasksInRange(task.UserID, []int64{task.ID}, start, end)
	if err != nil {
		return nil, err
	}
	byDate := map[string]*models.TaskOccurrence{}
	for i := range rows {
		byDate[rows[i].OccurrenceDate.Format("2006-01-02")] = &rows[i]
	}
	var earliest *models.TaskInstance
	var earliestReminder time.Time
	add := func(row *models.TaskOccurrence) {
		instance := taskInstanceFromOccurrenceRow(task, row, tz)
		reminder := resolveReminderStartForTask(instance.StartTime, instance.AllDay, tz, morning)
		if instance.Status == models.TaskStatusPending && (earliest == nil || reminder.Before(earliestReminder)) {
			earliest = &instance
			earliestReminder = reminder
		}
	}
	loc := loadLocationOrUTC(tz)
	for _, occ := range buildTaskOccurrenceStarts(task, start, end, tz) {
		local := occ.In(loc)
		date := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
		row := byDate[date.Format("2006-01-02")]
		if row == nil {
			row = &models.TaskOccurrence{OccurrenceDate: date, Status: task.Status, AllDay: task.AllDay}
		}
		if !row.ScheduleOverride {
			add(row)
		}
	}
	for i := range rows {
		if rows[i].ScheduleOverride && validOccurrenceDate(task, rows[i].OccurrenceDate, tz) {
			add(&rows[i])
		}
	}
	return earliest, nil
}
