package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"gorm.io/gorm"
)

type TaskService struct {
	taskRepo         *repository.TaskRepository
	taskActivityRepo *repository.TaskActivityRepository
	catRepo          *repository.CategoryRepository
	userRepo         *repository.UserRepository
	notifyRepo       *repository.NotificationRepository
	caldavSvc        *CaldavService
}

type RevisionConflictError struct {
	Latest *models.Task
}

type TaskActivityMeta struct {
	SubmittedAt  *time.Time
	SubmitSource string
}

const taskActivityMergeWindow = 15 * time.Minute

func (e *RevisionConflictError) Error() string {
	return "revision conflict"
}

func checkRevision(expected *int64, task *models.Task) error {
	if expected == nil || task == nil {
		return nil
	}
	if task.Revision <= 0 {
		task.Revision = 1
	}
	if *expected == task.Revision {
		return nil
	}
	return &RevisionConflictError{Latest: task}
}

func NewTaskService(
	taskRepo *repository.TaskRepository,
	taskActivityRepo *repository.TaskActivityRepository,
	catRepo *repository.CategoryRepository,
	userRepo *repository.UserRepository,
	notifyRepo *repository.NotificationRepository,
) *TaskService {
	return &TaskService{
		taskRepo:         taskRepo,
		taskActivityRepo: taskActivityRepo,
		catRepo:          catRepo,
		userRepo:         userRepo,
		notifyRepo:       notifyRepo,
	}
}

func (s *TaskService) SetCaldavService(caldavSvc *CaldavService) {
	s.caldavSvc = caldavSvc
}

func (s *TaskService) Create(userID int64, req *models.CreateTaskRequest) (*models.Task, error) {
	if err := normalizeTaskTimes(req.ClientTimezone, req.StartTimeLocal, req.EndTimeLocal, &req.StartTime, &req.EndTime); err != nil {
		return nil, err
	}
	normalizedRule, err := normalizeAndValidateRecurrenceRule(req.RecurrenceRule, req.StartTime, req.DueDate)
	if err != nil {
		return nil, err
	}
	if err := validateTaskTimeRange(req.StartTime, req.EndTime); err != nil {
		return nil, err
	}

	// Validate categories
	if len(req.CategoryIDs) > 0 {
		for _, catID := range req.CategoryIDs {
			_, err := s.catRepo.GetByIDAndUser(catID, userID)
			if err != nil {
				return nil, fmt.Errorf("invalid category ID %d", catID)
			}
		}
	}

	task := &models.Task{
		UserID:            userID,
		Title:             req.Title,
		Description:       req.Description,
		Priority:          req.Priority,
		StartTime:         req.StartTime,
		EndTime:           req.EndTime,
		DueDate:           req.DueDate,
		AllDay:            req.AllDay,
		Revision:          1,
		RecurrenceRule:    normalizedRule,
		RecurrenceEndDate: req.RecurrenceEndDate,
	}

	if err := s.taskRepo.Create(task); err != nil {
		return nil, err
	}

	// Set categories in transaction
	if len(req.CategoryIDs) > 0 {
		if err := s.taskRepo.UpdateCategories(task.ID, req.CategoryIDs); err != nil {
			return nil, err
		}
	}

	// Reload with categories
	savedTask, err := s.taskRepo.GetByID(task.ID)
	if err != nil {
		return nil, err
	}

	if err := s.syncTaskReminder(userID, savedTask); err != nil {
		log.Printf("Warning: failed to sync reminder after task create for user %d task %d: %v", userID, savedTask.ID, err)
	}

	return savedTask, nil
}

func (s *TaskService) GetByID(userID, taskID int64) (*models.Task, error) {
	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	return task, nil
}

func (s *TaskService) List(userID int64, filters map[string]interface{}) ([]models.Task, error) {
	return s.taskRepo.List(userID, filters)
}

func (s *TaskService) ListOccurrences(
	userID int64,
	statuses []models.TaskStatus,
	limit,
	cursor int,
) ([]models.TaskInstance, int, bool, error) {
	rows, hasMore, err := s.taskRepo.ListTaskOccurrencesByStatus(userID, statuses, limit, cursor)
	if err != nil {
		return nil, cursor, false, err
	}
	if len(rows) == 0 {
		return []models.TaskInstance{}, cursor, false, nil
	}

	taskIDSet := make(map[int64]struct{}, len(rows))
	for _, row := range rows {
		if row.TaskID > 0 {
			taskIDSet[row.TaskID] = struct{}{}
		}
	}
	taskIDs := make([]int64, 0, len(taskIDSet))
	for taskID := range taskIDSet {
		taskIDs = append(taskIDs, taskID)
	}
	tasks, err := s.taskRepo.GetTasksByIDsAndUser(userID, taskIDs)
	if err != nil {
		return nil, cursor, false, err
	}
	taskByID := make(map[int64]*models.Task, len(tasks))
	for i := range tasks {
		taskByID[tasks[i].ID] = &tasks[i]
	}

	tz := s.resolveUserTimezone(userID)
	instances := make([]models.TaskInstance, 0, len(rows))
	for _, row := range rows {
		task := taskByID[row.TaskID]
		if task == nil || task.RecurrenceRule == nil {
			continue
		}
		instance := taskInstanceFromOccurrenceRow(task, &row, tz)
		instances = append(instances, instance)
	}

	nextCursor := cursor + len(rows)
	return instances, nextCursor, hasMore, nil
}

func (s *TaskService) ListNextPendingOccurrences(userID int64, from time.Time) ([]models.TaskInstance, error) {
	recurringTasks, err := s.taskRepo.ListRecurringTasks(userID)
	if err != nil {
		return nil, err
	}
	if len(recurringTasks) == 0 {
		return []models.TaskInstance{}, nil
	}

	taskIDs := make([]int64, 0, len(recurringTasks))
	for _, task := range recurringTasks {
		if task.ID > 0 {
			taskIDs = append(taskIDs, task.ID)
		}
	}

	tz := s.resolveUserTimezone(userID)
	loc := loadLocationOrUTC(tz)

	// Compute "start of today" in the user's local timezone so that today's
	// occurrences are included even when the user's UTC offset shifts midnight
	// to a different UTC date (e.g. UTC+8: local 00:00 = UTC-1 16:00 yesterday).
	fromRef := from
	if fromRef.IsZero() {
		fromRef = time.Now()
	}
	fromLocal := fromRef.In(loc)
	fromDate := time.Date(fromLocal.Year(), fromLocal.Month(), fromLocal.Day(), 0, 0, 0, 0, loc).UTC()
	horizon := fromDate.AddDate(3, 0, 0)
	rows, err := s.taskRepo.ListTaskOccurrencesForTasksInRange(userID, taskIDs, fromDate, horizon)
	if err != nil {
		return nil, err
	}

	occurrenceByTaskDate := make(map[string]*models.TaskOccurrence, len(rows))
	for i := range rows {
		row := &rows[i]
		key := fmt.Sprintf("%d|%s", row.TaskID, row.OccurrenceDate.UTC().Format("2006-01-02"))
		occurrenceByTaskDate[key] = row
	}
	instances := make([]models.TaskInstance, 0, len(recurringTasks))
	for i := range recurringTasks {
		task := &recurringTasks[i]
		if task.RecurrenceRule == nil {
			continue
		}
		occurrences := buildTaskOccurrenceStarts(task, fromDate, horizon, tz)
		for _, occurrenceStart := range occurrences {
			localOcc := occurrenceStart.In(loc)
			// Encode local calendar date as UTC 00:00 (occurrenceDate convention).
			dateOnly := time.Date(localOcc.Year(), localOcc.Month(), localOcc.Day(), 0, 0, 0, 0, time.UTC)
			key := fmt.Sprintf("%d|%s", task.ID, dateOnly.Format("2006-01-02"))
			override := occurrenceByTaskDate[key]
			status := task.Status
			if override != nil && override.Status != "" {
				status = override.Status
			}
			if status != models.TaskStatusPending {
				continue
			}

			instance := models.TaskInstance{
				InstanceID:   buildOccurrenceInstanceID(task.ID, dateOnly),
				TaskID:       task.ID,
				Title:        task.Title,
				Description:  "",
				Status:       status,
				Priority:     task.Priority,
				StartTime:    occurrenceStart.UTC(),
				AllDay:       task.AllDay,
				IsRecurring:  true,
				OriginalDate: dateOnly,
				Categories:   task.Categories,
			}
			if task.EndTime != nil && task.StartTime != nil {
				duration := task.EndTime.Sub(*task.StartTime)
				if duration > 0 {
					end := occurrenceStart.UTC().Add(duration)
					instance.EndTime = &end
				}
			}
			if override != nil {
				if override.InstanceID != "" {
					instance.InstanceID = override.InstanceID
				}
				if override.Description != "" {
					instance.Description = override.Description
				}
				if override.StartTime != nil {
					instance.StartTime = override.StartTime.UTC()
				}
				if override.EndTime != nil {
					end := override.EndTime.UTC()
					instance.EndTime = &end
				}
				instance.AllDay = override.AllDay
			}
			instances = append(instances, instance)
			break
		}
	}

	sort.Slice(instances, func(i, j int) bool {
		if !instances[i].StartTime.Equal(instances[j].StartTime) {
			return instances[i].StartTime.Before(instances[j].StartTime)
		}
		if instances[i].TaskID != instances[j].TaskID {
			return instances[i].TaskID < instances[j].TaskID
		}
		return instances[i].InstanceID < instances[j].InstanceID
	})

	return instances, nil
}

func (s *TaskService) ListActivities(userID, taskID int64, limit int) ([]models.TaskActivity, error) {
	if _, err := s.taskRepo.GetByIDAndUser(taskID, userID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	if s.taskActivityRepo == nil {
		return []models.TaskActivity{}, nil
	}
	return s.taskActivityRepo.ListByTask(userID, taskID, limit)
}

func (s *TaskService) Update(
	userID, taskID int64,
	req *models.UpdateTaskRequest,
	fieldMask map[string]bool,
	expectedRevision *int64,
	activityMeta *TaskActivityMeta,
) (*models.Task, error) {
	if err := normalizeTaskTimes(req.ClientTimezone, req.StartTimeLocal, req.EndTimeLocal, &req.StartTime, &req.EndTime); err != nil {
		return nil, err
	}

	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	wasRecurring := task.RecurrenceRule != nil
	if err := checkRevision(expectedRevision, task); err != nil {
		return nil, err
	}
	updateTZ := s.resolveUserTimezone(userID)
	updateLoc := loadLocationOrUTC(updateTZ)
	occurrenceDateValue, hasOccurrenceContext, err := parseOccurrenceDate(req.InstanceID, req.OccurrenceDate)
	if err != nil {
		return nil, err
	}
	beforeSnapshot := snapshotTaskForActivity(task)
	baseChanged := false
	categoriesChanged := false
	var completedAnchorDate time.Time
	hasCompletedAnchor := false
	var occurrenceStatusValue *models.TaskStatus
	var occurrenceDescriptionValue *string

	// Update fields
	if fieldMask["title"] {
		trimmedTitle := strings.TrimSpace(req.Title)
		if trimmedTitle == "" {
			return nil, errors.New("title cannot be empty")
		}
		if task.Title != trimmedTitle {
			task.Title = trimmedTitle
			baseChanged = true
		}
	}
	if fieldMask["description"] {
		if task.RecurrenceRule != nil && hasOccurrenceContext {
			next := req.Description
			occurrenceDescriptionValue = &next
		} else {
			if task.Description != req.Description {
				task.Description = req.Description
				baseChanged = true
			}
		}
	}
	if fieldMask["priority"] && req.Priority != nil {
		if task.Priority != *req.Priority {
			task.Priority = *req.Priority
			baseChanged = true
		}
	}
	if fieldMask["status"] {
		if req.Status == "" {
			return nil, errors.New("status cannot be empty")
		}
		if task.RecurrenceRule != nil && hasOccurrenceContext {
			next := req.Status
			occurrenceStatusValue = &next
		} else {
			if task.Status != req.Status {
				task.Status = req.Status
				baseChanged = true
			}
		}
	}
	if fieldMask["start_time"] {
		task.StartTime = req.StartTime
		baseChanged = true
	}
	if fieldMask["end_time"] {
		task.EndTime = req.EndTime
		baseChanged = true
	}
	if fieldMask["due_date"] {
		task.DueDate = req.DueDate
		baseChanged = true
	}
	if fieldMask["all_day"] && req.AllDay != nil {
		if task.AllDay != *req.AllDay {
			task.AllDay = *req.AllDay
			baseChanged = true
		}
	}
	if fieldMask["recurrence_rule"] {
		normalizedRule, err := normalizeAndValidateRecurrenceRule(req.RecurrenceRule, task.StartTime, task.DueDate)
		if err != nil {
			return nil, err
		}
		task.RecurrenceRule = normalizedRule
		baseChanged = true
		// Recurring task base should stay pending; keep the original completion on anchor occurrence only.
		if task.RecurrenceRule != nil && task.Status == models.TaskStatusCompleted {
			task.Status = models.TaskStatusPending
			baseChanged = true
			if anchor, ok := resolveTaskOccurrenceAnchorDate(task); ok {
				localAnchor := anchor.In(updateLoc)
				// Encode local calendar date as UTC 00:00 (occurrenceDate convention).
				completedAnchorDate = time.Date(localAnchor.Year(), localAnchor.Month(), localAnchor.Day(), 0, 0, 0, 0, time.UTC)
				hasCompletedAnchor = true
			}
		}
	}
	if fieldMask["recurrence_end_date"] {
		task.RecurrenceEndDate = req.RecurrenceEndDate
		baseChanged = true
	}
	if baseChanged {
		if err := validateTaskTimeRange(task.StartTime, task.EndTime); err != nil {
			return nil, err
		}
	}

	if baseChanged {
		if task.Revision <= 0 {
			task.Revision = 1
		}
		task.Revision += 1

		if err := s.taskRepo.Update(task); err != nil {
			return nil, err
		}
	}
	if hasCompletedAnchor {
		completedStatus := models.TaskStatusCompleted
		if err := s.upsertRecurringOccurrence(task, completedAnchorDate, &completedStatus, nil); err != nil {
			return nil, err
		}
	}
	recurrenceJustEnabled := !wasRecurring && task.RecurrenceRule != nil
	if recurrenceJustEnabled && !hasOccurrenceContext {
		description := task.Description
		if strings.TrimSpace(description) != "" {
			if anchor, ok := resolveTaskOccurrenceAnchorDate(task); ok {
				localAnchor := anchor.In(updateLoc)
				// Encode local calendar date as UTC 00:00 (occurrenceDate convention).
				anchorDate := time.Date(localAnchor.Year(), localAnchor.Month(), localAnchor.Day(), 0, 0, 0, 0, time.UTC)
				if err := s.upsertRecurringOccurrence(task, anchorDate, nil, &description); err != nil {
					return nil, err
				}
			}
		}
	}
	if task.RecurrenceRule != nil && hasOccurrenceContext && (occurrenceStatusValue != nil || occurrenceDescriptionValue != nil) {
		if err := s.upsertRecurringOccurrence(task, occurrenceDateValue, occurrenceStatusValue, occurrenceDescriptionValue); err != nil {
			return nil, err
		}
		if occurrenceStatusValue != nil && !baseChanged {
			if err := s.syncTaskReminder(userID, task); err != nil {
				log.Printf("Warning: failed to sync reminder after recurring occurrence update for user %d task %d: %v", userID, task.ID, err)
			}
		}
	}

	// Update categories
	if fieldMask["category_ids"] {
		// Validate categories
		for _, catID := range req.CategoryIDs {
			_, err := s.catRepo.GetByIDAndUser(catID, userID)
			if err != nil {
				return nil, fmt.Errorf("invalid category ID %d", catID)
			}
		}
		if err := s.taskRepo.UpdateCategories(task.ID, req.CategoryIDs); err != nil {
			return nil, err
		}
		categoriesChanged = true
	}

	updatedTask := task
	if baseChanged || categoriesChanged {
		updatedTask, err = s.taskRepo.GetByID(task.ID)
		if err != nil {
			return nil, err
		}
		afterSnapshot := snapshotTaskForActivity(updatedTask)
		if err := s.recordTaskActivity(userID, updatedTask.ID, beforeSnapshot, afterSnapshot, activityMeta); err != nil {
			log.Printf("Warning: failed to record task activity after task update for user %d task %d: %v", userID, updatedTask.ID, err)
		}

		if err := s.syncTaskReminder(userID, updatedTask); err != nil {
			log.Printf("Warning: failed to sync reminder after task update for user %d task %d: %v", userID, updatedTask.ID, err)
		}
	}

	return updatedTask, nil
}

func (s *TaskService) UpdateStatus(
	userID, taskID int64,
	status models.TaskStatus,
	instanceID, occurrenceDate string,
	expectedRevision *int64,
	activityMeta *TaskActivityMeta,
) (*models.Task, error) {
	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	if err := checkRevision(expectedRevision, task); err != nil {
		return nil, err
	}
	beforeSnapshot := snapshotTaskForActivity(task)

	if task.RecurrenceRule != nil {
		date, found, err := parseOccurrenceDate(instanceID, occurrenceDate)
		if err != nil {
			return nil, err
		}
		if found {
			if err := s.upsertRecurringOccurrence(task, date, &status, nil); err != nil {
				return nil, err
			}
			if err := s.syncTaskReminder(userID, task); err != nil {
				log.Printf("Warning: failed to sync reminder after recurring occurrence status update for user %d task %d: %v", userID, task.ID, err)
			}
			return task, nil
		}
	}

	task.Status = status
	if task.Revision <= 0 {
		task.Revision = 1
	}
	task.Revision += 1
	if err := s.taskRepo.Update(task); err != nil {
		return nil, err
	}
	if err := s.syncTaskReminder(userID, task); err != nil {
		log.Printf("Warning: failed to sync reminder after task status update for user %d task %d: %v", userID, task.ID, err)
	}
	updatedTask, err := s.taskRepo.GetByID(task.ID)
	if err != nil {
		return nil, err
	}
	afterSnapshot := snapshotTaskForActivity(updatedTask)
	if err := s.recordTaskActivity(userID, updatedTask.ID, beforeSnapshot, afterSnapshot, activityMeta); err != nil {
		log.Printf("Warning: failed to record task activity after task status update for user %d task %d: %v", userID, updatedTask.ID, err)
	}
	return updatedTask, nil
}

func requiresRecurringOccurrenceContext(task *models.Task, status models.TaskStatus, hasOccurrenceContext bool) bool {
	return false
}

func (s *TaskService) UpdateSchedule(
	userID, taskID int64,
	req *models.UpdateTaskScheduleRequest,
	expectedRevision *int64,
	activityMeta *TaskActivityMeta,
) (*models.Task, error) {
	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("task not found")
		}
		return nil, err
	}
	if err := checkRevision(expectedRevision, task); err != nil {
		return nil, err
	}
	beforeSnapshot := snapshotTaskForActivity(task)

	task.StartTime = req.StartTime
	task.EndTime = req.EndTime
	task.AllDay = req.AllDay
	if err := validateTaskTimeRange(task.StartTime, task.EndTime); err != nil {
		return nil, err
	}
	if task.Revision <= 0 {
		task.Revision = 1
	}
	task.Revision += 1

	if err := s.taskRepo.Update(task); err != nil {
		return nil, err
	}
	if err := s.syncTaskReminder(userID, task); err != nil {
		log.Printf("Warning: failed to sync reminder after task schedule update for user %d task %d: %v", userID, task.ID, err)
	}
	updatedTask, err := s.taskRepo.GetByID(task.ID)
	if err != nil {
		return nil, err
	}
	afterSnapshot := snapshotTaskForActivity(updatedTask)
	if err := s.recordTaskActivity(userID, updatedTask.ID, beforeSnapshot, afterSnapshot, activityMeta); err != nil {
		log.Printf("Warning: failed to record task activity after task schedule update for user %d task %d: %v", userID, updatedTask.ID, err)
	}
	return updatedTask, nil
}

func (s *TaskService) Delete(userID, taskID int64, expectedRevision *int64) error {
	// Verify ownership
	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("task not found")
		}
		return err
	}
	if err := checkRevision(expectedRevision, task); err != nil {
		return err
	}

	// Delete related notifications first
	if err := s.notifyRepo.DeleteByTask(taskID); err != nil {
		return err
	}
	return s.taskRepo.DeleteWithDeleteLog(userID, taskID, time.Now().UTC())
}

func (s *TaskService) ListChangedSince(userID int64, since time.Time, limit int) ([]models.Task, []models.TaskDeleteLog, error) {
	changed, err := s.taskRepo.ListChangedSince(userID, since, limit)
	if err != nil {
		return nil, nil, err
	}
	deleted, err := s.taskRepo.ListDeletedSince(userID, since, limit)
	if err != nil {
		return nil, nil, err
	}
	return changed, deleted, nil
}

func (s *TaskService) resolveUserTimezone(userID int64) string {
	user, err := s.userRepo.GetByID(userID)
	if err != nil || user == nil || user.Timezone == "" {
		return "UTC"
	}
	return user.Timezone
}

func (s *TaskService) syncTaskReminder(userID int64, task *models.Task) error {
	if task == nil {
		return nil
	}

	if err := s.notifyRepo.DeleteActiveByTask(task.ID); err != nil {
		return err
	}

	if task.Status != models.TaskStatusPending {
		return nil
	}

	now := time.Now().UTC()
	var reminderStart *time.Time
	if task.RecurrenceRule != nil {
		nextStart, err := s.resolveNextPendingRecurringReminderStart(userID, task, now)
		if err != nil {
			return err
		}
		reminderStart = nextStart
	} else if task.StartTime != nil {
		start := task.StartTime.UTC()
		reminderStart = &start
	}
	if reminderStart == nil {
		return nil
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if !user.DefaultReminderEnabled {
		return nil
	}

	defaultSetting, err := s.notifyRepo.GetDefaultSetting(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	minutes := user.DefaultReminderMinutes
	if minutes <= 0 {
		minutes = 5
	}

	notifyAt := reminderStart.UTC().Add(-time.Duration(minutes) * time.Minute)
	if !notifyAt.After(now) {
		return nil
	}

	notification := &models.Notification{
		TaskID:       task.ID,
		Source:       models.NotificationSourceDefaultAuto,
		DeliveryMode: models.NotificationDeliveryCurrentDefault,
		Channel:      defaultSetting.Channel,
		Config:       defaultSetting.Config,
		NotifyAt:     notifyAt,
		NextRetryAt:  &notifyAt,
		DedupeKey:    fmt.Sprintf("%d|%s|%s", task.ID, models.NotificationSourceDefaultAuto, notifyAt.UTC().Format(time.RFC3339)),
		RetryCount:   0,
		Status:       models.NotifyStatusPending,
	}
	return s.notifyRepo.ReplaceActiveByTaskSource(notification)
}

func (s *TaskService) resolveNextPendingRecurringReminderStart(userID int64, task *models.Task, from time.Time) (*time.Time, error) {
	if task == nil || task.RecurrenceRule == nil {
		return nil, nil
	}

	fromUTC := from.UTC()
	if fromUTC.IsZero() {
		fromUTC = time.Now().UTC()
	}
	fromDate := fromUTC.Truncate(24 * time.Hour)
	horizon := fromDate.AddDate(3, 0, 0)
	rows, err := s.taskRepo.ListTaskOccurrencesForTasksInRange(userID, []int64{task.ID}, fromDate, horizon)
	if err != nil {
		return nil, err
	}
	occurrenceByDate := make(map[string]*models.TaskOccurrence, len(rows))
	for i := range rows {
		row := &rows[i]
		occurrenceByDate[row.OccurrenceDate.UTC().Format("2006-01-02")] = row
	}

	tz := s.resolveUserTimezone(userID)
	loc := loadLocationOrUTC(tz)
	occurrences := buildTaskOccurrenceStarts(task, fromDate, horizon, tz)
	for _, occurrenceStart := range occurrences {
		localOcc := occurrenceStart.In(loc)
		// Encode local calendar date as UTC 00:00 (occurrenceDate convention).
		dateOnly := time.Date(localOcc.Year(), localOcc.Month(), localOcc.Day(), 0, 0, 0, 0, time.UTC)
		override := occurrenceByDate[dateOnly.Format("2006-01-02")]

		status := task.Status
		if override != nil && override.Status != "" {
			status = override.Status
		}
		if status != models.TaskStatusPending {
			continue
		}

		startTime := occurrenceStart.UTC()
		if override != nil && override.StartTime != nil {
			startTime = override.StartTime.UTC()
		}
		if !startTime.After(fromUTC) {
			continue
		}
		return &startTime, nil
	}

	return nil, nil
}

type taskActivitySnapshot struct {
	Title             string
	Description       string
	Priority          models.Priority
	Status            models.TaskStatus
	StartTime         *time.Time
	EndTime           *time.Time
	DueDate           *time.Time
	AllDay            bool
	CategoryIDs       []int64
	RecurrenceRule    *models.RecurrenceRule
	RecurrenceEndDate *time.Time
}

func snapshotTaskForActivity(task *models.Task) taskActivitySnapshot {
	if task == nil {
		return taskActivitySnapshot{}
	}
	return taskActivitySnapshot{
		Title:             task.Title,
		Description:       task.Description,
		Priority:          task.Priority,
		Status:            task.Status,
		StartTime:         cloneTimePointer(task.StartTime),
		EndTime:           cloneTimePointer(task.EndTime),
		DueDate:           cloneTimePointer(task.DueDate),
		AllDay:            task.AllDay,
		CategoryIDs:       normalizeCategoryIDs(task.Categories),
		RecurrenceRule:    cloneRecurrenceRule(task.RecurrenceRule),
		RecurrenceEndDate: cloneTimePointer(task.RecurrenceEndDate),
	}
}

func cloneTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	next := value.UTC()
	return &next
}

func cloneRecurrenceRule(rule *models.RecurrenceRule) *models.RecurrenceRule {
	if rule == nil {
		return nil
	}
	cloned := &models.RecurrenceRule{
		Freq:             rule.Freq,
		Interval:         rule.Interval,
		Count:            rule.Count,
		LunarMonth:       rule.LunarMonth,
		LunarDay:         rule.LunarDay,
		LunarIsLeapMonth: rule.LunarIsLeapMonth,
	}
	if len(rule.ByDay) > 0 {
		cloned.ByDay = append([]string(nil), rule.ByDay...)
	}
	if len(rule.ByMonth) > 0 {
		cloned.ByMonth = append([]int(nil), rule.ByMonth...)
	}
	if len(rule.ByDate) > 0 {
		cloned.ByDate = append([]int(nil), rule.ByDate...)
	}
	return cloned
}

func normalizeCategoryIDs(categories []models.Category) []int64 {
	if len(categories) == 0 {
		return []int64{}
	}
	ids := make([]int64, 0, len(categories))
	for _, category := range categories {
		if category.ID <= 0 {
			continue
		}
		ids = append(ids, category.ID)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

func normalizeActivityTime(value *time.Time) interface{} {
	if value == nil {
		return nil
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func normalizeActivityRecurrence(rule *models.RecurrenceRule) interface{} {
	if rule == nil {
		return nil
	}
	raw, err := json.Marshal(rule)
	if err != nil {
		return nil
	}
	var normalized interface{}
	if err := json.Unmarshal(raw, &normalized); err != nil {
		return nil
	}
	return normalized
}

func normalizeActivityValue(value interface{}) interface{} {
	raw, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var normalized interface{}
	if err := json.Unmarshal(raw, &normalized); err != nil {
		return value
	}
	return normalized
}

func activityValuesEqual(left, right interface{}) bool {
	return reflect.DeepEqual(normalizeActivityValue(left), normalizeActivityValue(right))
}

func appendActivityFieldChange(
	changes models.TaskActivityChanges,
	field string,
	from interface{},
	to interface{},
) {
	if activityValuesEqual(from, to) {
		return
	}
	changes[field] = models.TaskActivityFieldChange{
		From: normalizeActivityValue(from),
		To:   normalizeActivityValue(to),
	}
}

func buildTaskActivityChanges(before, after taskActivitySnapshot) models.TaskActivityChanges {
	changes := models.TaskActivityChanges{}
	appendActivityFieldChange(changes, "title", before.Title, after.Title)
	appendActivityFieldChange(changes, "description", before.Description, after.Description)
	appendActivityFieldChange(changes, "priority", before.Priority, after.Priority)
	appendActivityFieldChange(changes, "status", before.Status, after.Status)
	appendActivityFieldChange(changes, "start_time", normalizeActivityTime(before.StartTime), normalizeActivityTime(after.StartTime))
	appendActivityFieldChange(changes, "end_time", normalizeActivityTime(before.EndTime), normalizeActivityTime(after.EndTime))
	appendActivityFieldChange(changes, "due_date", normalizeActivityTime(before.DueDate), normalizeActivityTime(after.DueDate))
	appendActivityFieldChange(changes, "all_day", before.AllDay, after.AllDay)
	appendActivityFieldChange(changes, "category_ids", before.CategoryIDs, after.CategoryIDs)
	appendActivityFieldChange(
		changes,
		"recurrence_rule",
		normalizeActivityRecurrence(before.RecurrenceRule),
		normalizeActivityRecurrence(after.RecurrenceRule),
	)
	appendActivityFieldChange(
		changes,
		"recurrence_end_date",
		normalizeActivityTime(before.RecurrenceEndDate),
		normalizeActivityTime(after.RecurrenceEndDate),
	)
	return changes
}

func resolveActivityOccurredAt(meta *TaskActivityMeta) time.Time {
	if meta == nil || meta.SubmittedAt == nil {
		return time.Now().UTC()
	}
	submitted := meta.SubmittedAt.UTC()
	if submitted.IsZero() {
		return time.Now().UTC()
	}
	clockSkew := submitted.Sub(time.Now().UTC())
	if clockSkew > 24*time.Hour || clockSkew < -24*time.Hour {
		return time.Now().UTC()
	}
	return submitted
}

func (s *TaskService) recordTaskActivity(
	userID, taskID int64,
	before, after taskActivitySnapshot,
	meta *TaskActivityMeta,
) error {
	if s.taskActivityRepo == nil {
		return nil
	}
	changes := buildTaskActivityChanges(before, after)
	if len(changes) == 0 {
		return nil
	}
	return s.taskActivityRepo.RecordWithMerge(
		userID,
		taskID,
		resolveActivityOccurredAt(meta),
		func() string {
			if meta == nil {
				return ""
			}
			return meta.SubmitSource
		}(),
		changes,
		taskActivityMergeWindow,
	)
}

// ExpandRecurringTasks expands recurring tasks within a date range
func (s *TaskService) ExpandRecurringTasks(userID int64, start, end time.Time) ([]models.TaskInstance, error) {
	tasks, err := s.taskRepo.GetRecurringTasks(userID, start, end)
	if err != nil {
		return nil, err
	}
	occurrenceRows, err := s.taskRepo.ListTaskOccurrencesInRange(userID, start, end)
	if err != nil {
		return nil, err
	}
	occurrenceByTaskDate := make(map[string]*models.TaskOccurrence, len(occurrenceRows))
	for i := range occurrenceRows {
		row := &occurrenceRows[i]
		key := fmt.Sprintf("%d|%s", row.TaskID, row.OccurrenceDate.UTC().Format("2006-01-02"))
		occurrenceByTaskDate[key] = row
	}

	tz := s.resolveUserTimezone(userID)
	loc := loadLocationOrUTC(tz)
	var instances []models.TaskInstance

	for _, task := range tasks {
		if task.RecurrenceRule == nil {
			continue
		}
		occurrences := buildTaskOccurrenceStarts(&task, start, end, tz)
		for _, occurrenceStart := range occurrences {
			localOcc := occurrenceStart.In(loc)
			// Encode local calendar date as UTC 00:00 (occurrenceDate convention).
			dateOnly := time.Date(localOcc.Year(), localOcc.Month(), localOcc.Day(), 0, 0, 0, 0, time.UTC)
			instanceID := buildOccurrenceInstanceID(task.ID, dateOnly)
			instance := models.TaskInstance{
				InstanceID:   instanceID,
				TaskID:       task.ID,
				Title:        task.Title,
				Description:  "",
				Status:       task.Status,
				Priority:     task.Priority,
				StartTime:    occurrenceStart.UTC(),
				AllDay:       task.AllDay,
				IsRecurring:  true,
				OriginalDate: dateOnly,
				Categories:   task.Categories,
			}

			// Calculate end time
			if task.EndTime != nil && task.StartTime != nil {
				duration := task.EndTime.Sub(*task.StartTime)
				if duration > 0 {
					endTime := occurrenceStart.UTC().Add(duration)
					instance.EndTime = &endTime
				}
			}

			overrideKey := fmt.Sprintf("%d|%s", task.ID, dateOnly.Format("2006-01-02"))
			if override := occurrenceByTaskDate[overrideKey]; override != nil {
				if override.InstanceID != "" {
					instance.InstanceID = override.InstanceID
				}
				if override.Status != "" {
					instance.Status = override.Status
				}
				instance.Description = override.Description
				if override.StartTime != nil {
					instance.StartTime = override.StartTime.UTC()
				}
				if override.EndTime != nil {
					endTime := override.EndTime.UTC()
					instance.EndTime = &endTime
				}
				instance.AllDay = override.AllDay
			}

			instances = append(instances, instance)
		}
	}

	return instances, nil
}

func (s *TaskService) upsertRecurringOccurrence(
	task *models.Task,
	occurrenceDate time.Time,
	status *models.TaskStatus,
	description *string,
) error {
	if task == nil {
		return nil
	}
	dateOnly := occurrenceDate.UTC().Truncate(24 * time.Hour)
	tz := s.resolveUserTimezone(task.UserID)
	baseStart, baseEnd := deriveOccurrenceRangeFromTask(task, dateOnly, tz)

	existing, err := s.taskRepo.GetTaskOccurrence(task.UserID, task.ID, dateOnly)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	occurrence := &models.TaskOccurrence{
		UserID:         task.UserID,
		TaskID:         task.ID,
		OccurrenceDate: dateOnly,
		InstanceID:     buildOccurrenceInstanceID(task.ID, dateOnly),
		Status:         task.Status,
		Description:    "",
		StartTime:      cloneTimePointer(baseStart),
		EndTime:        cloneTimePointer(baseEnd),
		AllDay:         task.AllDay,
	}
	if existing != nil {
		occurrence = existing
	}
	if occurrence.InstanceID == "" {
		occurrence.InstanceID = buildOccurrenceInstanceID(task.ID, dateOnly)
	}
	if occurrence.Status == "" {
		occurrence.Status = task.Status
		if occurrence.Status == "" {
			occurrence.Status = models.TaskStatusPending
		}
	}
	occurrence.AllDay = task.AllDay
	if occurrence.StartTime == nil && baseStart != nil {
		occurrence.StartTime = cloneTimePointer(baseStart)
	}
	if occurrence.EndTime == nil && baseEnd != nil {
		occurrence.EndTime = cloneTimePointer(baseEnd)
	}
	if status != nil {
		occurrence.Status = *status
	}
	if description != nil {
		occurrence.Description = *description
	}

	if taskOccurrenceMatchesSeriesDefault(occurrence, task, baseStart, baseEnd) {
		return s.taskRepo.DeleteTaskOccurrence(task.UserID, task.ID, dateOnly)
	}
	return s.taskRepo.UpsertTaskOccurrence(occurrence)
}

func taskOccurrenceMatchesSeriesDefault(
	occurrence *models.TaskOccurrence,
	task *models.Task,
	baseStart *time.Time,
	baseEnd *time.Time,
) bool {
	if occurrence == nil || task == nil {
		return false
	}
	if occurrence.Status != task.Status {
		return false
	}
	if strings.TrimSpace(occurrence.Description) != "" {
		return false
	}
	effectiveStart := occurrence.StartTime
	if effectiveStart == nil {
		effectiveStart = baseStart
	}
	effectiveEnd := occurrence.EndTime
	if effectiveEnd == nil {
		effectiveEnd = baseEnd
	}
	if !timesEqual(effectiveStart, baseStart) {
		return false
	}
	if !timesEqual(effectiveEnd, baseEnd) {
		return false
	}
	if occurrence.AllDay != task.AllDay {
		return false
	}
	return true
}

func taskInstanceFromOccurrenceRow(task *models.Task, row *models.TaskOccurrence, userTimezone string) models.TaskInstance {
	baseStart, baseEnd := deriveOccurrenceRangeFromTask(task, row.OccurrenceDate, userTimezone)
	start := cloneTimePointer(baseStart)
	end := cloneTimePointer(baseEnd)
	allDay := task.AllDay
	if row.StartTime != nil {
		start = cloneTimePointer(row.StartTime)
	}
	if row.EndTime != nil {
		end = cloneTimePointer(row.EndTime)
	}
	allDay = row.AllDay
	if start == nil {
		dateOnly := row.OccurrenceDate.UTC().Truncate(24 * time.Hour)
		start = &dateOnly
	}

	instanceID := strings.TrimSpace(row.InstanceID)
	if instanceID == "" {
		instanceID = buildOccurrenceInstanceID(task.ID, row.OccurrenceDate)
	}

	instance := models.TaskInstance{
		InstanceID:   instanceID,
		TaskID:       task.ID,
		Title:        task.Title,
		Description:  row.Description,
		Status:       row.Status,
		Priority:     task.Priority,
		StartTime:    start.UTC(),
		AllDay:       allDay,
		IsRecurring:  true,
		OriginalDate: row.OccurrenceDate.UTC().Truncate(24 * time.Hour),
		Categories:   task.Categories,
	}
	if instance.Status == "" {
		instance.Status = task.Status
	}
	if end != nil {
		normalized := end.UTC()
		instance.EndTime = &normalized
	}
	return instance
}

// deriveOccurrenceRangeFromTask computes the start/end UTC instants for one
// occurrence of a recurring task.
//
// occurrenceDate encoding convention: values are stored as
// time.Date(Y, M, D, 0, 0, 0, 0, time.UTC) where Y/M/D are the user's *local*
// calendar date, NOT a UTC date. The time.UTC location tag is only a storage
// marker — the semantic meaning is "local date, time portion stripped". All
// write paths (ExpandRecurringTasks, ListNextPendingOccurrences, Update, etc.)
// follow this convention. Consumers must interpret Y/M/D as local-date, not as
// a UTC instant.
func deriveOccurrenceRangeFromTask(task *models.Task, occurrenceDate time.Time, userTimezone string) (*time.Time, *time.Time) {
	if task == nil {
		return nil, nil
	}
	// occurrenceDate carries a local Y/M/D encoded as UTC 00:00; extract it directly.
	date := occurrenceDate.UTC().Truncate(24 * time.Hour)
	anchor := task.StartTime
	if anchor == nil {
		anchor = task.DueDate
	}
	if anchor == nil {
		start := date
		return &start, nil
	}

	loc := loadLocationOrUTC(userTimezone)
	localAnchor := anchor.In(loc)
	start := time.Date(
		date.Year(),
		date.Month(),
		date.Day(),
		localAnchor.Hour(),
		localAnchor.Minute(),
		localAnchor.Second(),
		localAnchor.Nanosecond(),
		loc,
	).UTC()

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

func timesEqual(left, right *time.Time) bool {
	if left == nil && right == nil {
		return true
	}
	if left == nil || right == nil {
		return false
	}
	return left.UTC().Equal(right.UTC())
}

var instanceIDPattern = regexp.MustCompile(`^\d+_(\d{8})$`)

func buildOccurrenceInstanceID(taskID int64, occurrenceDate time.Time) string {
	return fmt.Sprintf("%d_%s", taskID, occurrenceDate.UTC().Format("20060102"))
}

func resolveTaskOccurrenceAnchorDate(task *models.Task) (time.Time, bool) {
	if task == nil {
		return time.Time{}, false
	}
	if task.StartTime != nil {
		return task.StartTime.UTC(), true
	}
	if task.DueDate != nil {
		return task.DueDate.UTC(), true
	}
	return time.Time{}, false
}

func parseOccurrenceDate(instanceID, occurrenceDate string) (time.Time, bool, error) {
	if trimmed := strings.TrimSpace(occurrenceDate); trimmed != "" {
		parsed, err := time.Parse("2006-01-02", trimmed)
		if err != nil {
			return time.Time{}, false, errors.New("occurrence_date must use YYYY-MM-DD format")
		}
		return parsed.UTC().Truncate(24 * time.Hour), true, nil
	}

	trimmedInstanceID := strings.TrimSpace(instanceID)
	if trimmedInstanceID == "" {
		return time.Time{}, false, nil
	}

	matches := instanceIDPattern.FindStringSubmatch(trimmedInstanceID)
	if len(matches) != 2 {
		return time.Time{}, false, errors.New("invalid instance_id format")
	}

	parsed, err := time.Parse("20060102", matches[1])
	if err != nil {
		return time.Time{}, false, errors.New("invalid instance_id date")
	}
	return parsed.UTC().Truncate(24 * time.Hour), true, nil
}

func buildRRuleString(rule *models.RecurrenceRule, dtStart *time.Time, until *time.Time) string {
	if dtStart == nil {
		dtStart = &time.Time{}
	}

	rruleStr := fmt.Sprintf("DTSTART:%s\n", dtStart.UTC().Format("20060102T150405Z"))

	// Fix 4: Ensure FREQ is uppercase
	freq := strings.ToUpper(rule.Freq)
	rruleStr += fmt.Sprintf("RRULE:FREQ=%s", freq)

	if rule.Interval > 0 {
		rruleStr += fmt.Sprintf(";INTERVAL=%d", rule.Interval)
	}

	if len(rule.ByDay) > 0 {
		rruleStr += ";BYDAY="
		for i, day := range rule.ByDay {
			if i > 0 {
				rruleStr += ","
			}
			// Ensure day codes are uppercase
			rruleStr += strings.ToUpper(day)
		}
	}

	if len(rule.ByDate) > 0 {
		monthDays := make([]string, 0, len(rule.ByDate))
		for _, day := range rule.ByDate {
			if day < 1 || day > 31 {
				continue
			}
			monthDays = append(monthDays, strconv.Itoa(day))
		}
		if len(monthDays) > 0 {
			rruleStr += ";BYMONTHDAY=" + strings.Join(monthDays, ",")
		}
	}

	if until != nil {
		rruleStr += fmt.Sprintf(";UNTIL=%s", until.UTC().Format("20060102T150405Z"))
	}

	if rule.Count > 0 {
		rruleStr += fmt.Sprintf(";COUNT=%d", rule.Count)
	}

	return rruleStr
}

func normalizeTaskTimes(clientTimezone, startLocal, endLocal string, start, end **time.Time) error {
	startLocal = strings.TrimSpace(startLocal)
	endLocal = strings.TrimSpace(endLocal)
	clientTimezone = strings.TrimSpace(clientTimezone)

	if startLocal == "" && endLocal == "" {
		return nil
	}

	if clientTimezone == "" {
		return errors.New("client_timezone is required when local time fields are provided")
	}

	loc, err := time.LoadLocation(clientTimezone)
	if err != nil {
		return errors.New("invalid client_timezone")
	}

	if startLocal != "" {
		parsed, err := parseClientLocalTime(startLocal, loc)
		if err != nil {
			return fmt.Errorf("invalid start_time_local: %w", err)
		}
		utc := parsed.UTC()
		*start = &utc
	}

	if endLocal != "" {
		parsed, err := parseClientLocalTime(endLocal, loc)
		if err != nil {
			return fmt.Errorf("invalid end_time_local: %w", err)
		}
		utc := parsed.UTC()
		*end = &utc
	}

	return nil
}

func parseClientLocalTime(value string, loc *time.Location) (time.Time, error) {
	layouts := []string{
		"2006-01-02T15:04:05.000",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if parsed, err := time.ParseInLocation(layout, value, loc); err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, errors.New("unsupported datetime format")
}

func validateTaskTimeRange(start, end *time.Time) error {
	if start == nil || end == nil {
		return nil
	}
	if end.Before(*start) {
		return errors.New("end_time must be greater than or equal to start_time")
	}
	return nil
}
