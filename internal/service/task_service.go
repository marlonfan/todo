package service

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

type TaskService struct {
	taskRepo   *repository.TaskRepository
	catRepo    *repository.CategoryRepository
	userRepo   *repository.UserRepository
	notifyRepo *repository.NotificationRepository
}

func NewTaskService(
	taskRepo *repository.TaskRepository,
	catRepo *repository.CategoryRepository,
	userRepo *repository.UserRepository,
	notifyRepo *repository.NotificationRepository,
) *TaskService {
	return &TaskService{
		taskRepo:   taskRepo,
		catRepo:    catRepo,
		userRepo:   userRepo,
		notifyRepo: notifyRepo,
	}
}

func (s *TaskService) Create(userID int64, req *models.CreateTaskRequest) (*models.Task, error) {
	if err := normalizeTaskTimes(req.ClientTimezone, req.StartTimeLocal, req.EndTimeLocal, &req.StartTime, &req.EndTime); err != nil {
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
		RecurrenceRule:    req.RecurrenceRule,
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
		return nil, err
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

func (s *TaskService) Update(userID, taskID int64, req *models.UpdateTaskRequest, fieldMask map[string]bool) (*models.Task, error) {
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

	// Update fields
	if fieldMask["title"] {
		trimmedTitle := strings.TrimSpace(req.Title)
		if trimmedTitle == "" {
			return nil, errors.New("title cannot be empty")
		}
		task.Title = trimmedTitle
	}
	if fieldMask["description"] {
		task.Description = req.Description
	}
	if fieldMask["priority"] && req.Priority != nil {
		task.Priority = *req.Priority
	}
	if fieldMask["status"] {
		if req.Status == "" {
			return nil, errors.New("status cannot be empty")
		}
		task.Status = req.Status
	}
	if fieldMask["start_time"] {
		task.StartTime = req.StartTime
	}
	if fieldMask["end_time"] {
		task.EndTime = req.EndTime
	}
	if fieldMask["due_date"] {
		task.DueDate = req.DueDate
	}
	if fieldMask["all_day"] && req.AllDay != nil {
		task.AllDay = *req.AllDay
	}
	if fieldMask["recurrence_rule"] {
		task.RecurrenceRule = req.RecurrenceRule
	}
	if fieldMask["recurrence_end_date"] {
		task.RecurrenceEndDate = req.RecurrenceEndDate
	}

	if err := s.taskRepo.Update(task); err != nil {
		return nil, err
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
	}

	updatedTask, err := s.taskRepo.GetByID(task.ID)
	if err != nil {
		return nil, err
	}

	if err := s.syncTaskReminder(userID, updatedTask); err != nil {
		return nil, err
	}

	return updatedTask, nil
}

func (s *TaskService) UpdateStatus(userID, taskID int64, status models.TaskStatus, instanceID, occurrenceDate string) error {
	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("task not found")
		}
		return err
	}

	if task.RecurrenceRule != nil {
		date, found, err := parseOccurrenceDate(instanceID, occurrenceDate)
		if err != nil {
			return err
		}
		if found {
			// Store only overrides that differ from the base task status.
			if status == task.Status {
				return s.taskRepo.DeleteOccurrenceStatus(userID, taskID, date)
			}
			return s.taskRepo.UpsertOccurrenceStatus(userID, taskID, date, status)
		}
	}

	task.Status = status
	if err := s.taskRepo.Update(task); err != nil {
		return err
	}
	return s.syncTaskReminder(userID, task)
}

func (s *TaskService) UpdateSchedule(userID, taskID int64, req *models.UpdateTaskScheduleRequest) error {
	task, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("task not found")
		}
		return err
	}

	task.StartTime = req.StartTime
	task.EndTime = req.EndTime
	task.AllDay = req.AllDay

	if err := s.taskRepo.Update(task); err != nil {
		return err
	}
	return s.syncTaskReminder(userID, task)
}

func (s *TaskService) Delete(userID, taskID int64) error {
	// Verify ownership
	_, err := s.taskRepo.GetByIDAndUser(taskID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("task not found")
		}
		return err
	}

	// Delete related notifications first
	if err := s.notifyRepo.DeleteByTask(taskID); err != nil {
		return err
	}

	return s.taskRepo.Delete(taskID)
}

func (s *TaskService) syncTaskReminder(userID int64, task *models.Task) error {
	if task == nil {
		return nil
	}

	if err := s.notifyRepo.DeleteActiveByTask(task.ID); err != nil {
		return err
	}

	if task.StartTime == nil || task.Status != models.TaskStatusPending {
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

	notifyAt := task.StartTime.UTC().Add(-time.Duration(minutes) * time.Minute)
	if !notifyAt.After(time.Now().UTC()) {
		return nil
	}

	notification := &models.Notification{
		TaskID:   task.ID,
		Channel:  defaultSetting.Channel,
		Config:   defaultSetting.Config,
		NotifyAt: notifyAt,
		Status:   models.NotifyStatusPending,
	}
	return s.notifyRepo.Create(notification)
}

// ExpandRecurringTasks expands recurring tasks within a date range
func (s *TaskService) ExpandRecurringTasks(userID int64, start, end time.Time) ([]models.TaskInstance, error) {
	tasks, err := s.taskRepo.GetRecurringTasks(userID, start, end)
	if err != nil {
		return nil, err
	}

	statusOverrides, err := s.taskRepo.GetOccurrenceStatuses(userID, start, end)
	if err != nil {
		return nil, err
	}
	overrideMap := make(map[string]models.TaskStatus, len(statusOverrides))
	for _, override := range statusOverrides {
		instanceID := fmt.Sprintf("%d_%s", override.TaskID, override.OccurrenceDate.UTC().Format("20060102"))
		overrideMap[instanceID] = override.Status
	}

	var instances []models.TaskInstance

	for _, task := range tasks {
		if task.RecurrenceRule == nil {
			continue
		}

		// Fix 4: Convert freq to uppercase for RRULE
		rruleStr := buildRRuleString(task.RecurrenceRule, task.StartTime, task.RecurrenceEndDate)
		rrule, err := rrule.StrToRRule(rruleStr)
		if err != nil {
			// Try with original case if uppercase fails
			continue
		}

		// Get occurrences within range
		occurrences := rrule.Between(start, end, true)

		for _, occ := range occurrences {
			instanceID := fmt.Sprintf("%d_%s", task.ID, occ.Format("20060102"))
			instance := models.TaskInstance{
				InstanceID:   instanceID,
				TaskID:       task.ID,
				Title:        task.Title,
				Description:  task.Description,
				Status:       task.Status,
				Priority:     task.Priority,
				StartTime:    occ,
				AllDay:       task.AllDay,
				IsRecurring:  true,
				OriginalDate: occ,
				Categories:   task.Categories,
			}
			if overrideStatus, ok := overrideMap[instanceID]; ok {
				instance.Status = overrideStatus
			}

			// Calculate end time
			if task.EndTime != nil && task.StartTime != nil {
				duration := task.EndTime.Sub(*task.StartTime)
				endTime := occ.Add(duration)
				instance.EndTime = &endTime
			}

			instances = append(instances, instance)
		}
	}

	return instances, nil
}

var instanceIDPattern = regexp.MustCompile(`^\d+_(\d{8})$`)

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
