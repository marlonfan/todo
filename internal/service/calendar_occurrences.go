package service

import (
	"strings"
	"time"
	"todo-app/internal/models"
)

// Detached components share the series UID. Their RECURRENCE-ID always names
// the original slot, even after moving across days or changing VALUE=DATE.
func (s *CalendarExportService) taskOccurrenceComponents(task *models.Task, uid string, user *models.User) ([]string, error) {
	rows, err := s.taskSvc.taskRepo.ListTaskOccurrences(task.UserID, task.ID)
	if err != nil {
		return nil, err
	}
	loc := taskCalendarLocation(task, user)
	var components []string
	for _, row := range rows {
		if !validOccurrenceDate(task, row.OccurrenceDate, user.Timezone) {
			continue
		}
		start, end := deriveOccurrenceRangeFromTask(task, row.OccurrenceDate, user.Timezone)
		if start == nil {
			continue
		}
		status := row.Status
		if status == "" {
			status = task.Status
		}
		if !row.ScheduleOverride && status == task.Status && row.Title == "" && row.Description == "" && row.DeletedAt == nil && row.CompletedAt == nil {
			continue
		}
		child := *task
		child.RecurrenceRule, child.RecurrenceEndDate = nil, nil
		child.StartTime, child.EndTime, child.AllDay = start, end, task.AllDay
		child.Description, child.Status = row.Description, status
		if strings.TrimSpace(row.Title) != "" {
			child.Title = row.Title
		}
		child.CompletedAt, child.DeletedAt = row.CompletedAt, row.DeletedAt
		if row.DeletedAt != nil {
			child.Status = models.TaskStatusCancelled
		}
		if row.ScheduleOverride {
			child.StartTime, child.EndTime, child.AllDay = row.StartTime, row.EndTime, row.AllDay
		}
		identity := "RECURRENCE-ID:" + start.UTC().Format("20060102T150405Z")
		if task.AllDay {
			identity = "RECURRENCE-ID;VALUE=DATE:" + row.OccurrenceDate.Format("20060102")
		} else if loc != time.UTC {
			identity = "RECURRENCE-ID;TZID=" + loc.String() + ":" + start.In(loc).Format("20060102T150405")
		}
		component := s.taskToComponent(&child, uid, user)
		if child.Status == models.TaskStatusCompleted || child.Status == models.TaskStatusSkipped {
			component = strings.Replace(component, "BEGIN:VEVENT\r\n", "BEGIN:VEVENT\r\nX-TODO-STATUS:"+string(child.Status)+"\r\n", 1)
		}
		component = strings.Replace(component, "BEGIN:VEVENT\r\n", "BEGIN:VEVENT\r\n"+identity+"\r\n", 1)
		components = append(components, component)
	}
	return components, nil
}
