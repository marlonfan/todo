package handler

import (
	"net/http"
	"strconv"
	"time"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
)

type CalendarHandler struct {
	taskService   *service.TaskService
	caldavService *service.CaldavService
}

func NewCalendarHandler(taskService *service.TaskService, caldavService *service.CaldavService) *CalendarHandler {
	return &CalendarHandler{taskService: taskService, caldavService: caldavService}
}

func (h *CalendarHandler) GetEvents(c *gin.Context) {
	userID := middleware.GetUserID(c)

	startStr := c.Query("start")
	endStr := c.Query("end")

	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start and end parameters are required"})
		return
	}

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start date format"})
		return
	}

	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end date format"})
		return
	}

	// Get regular tasks
	filters := map[string]interface{}{
		"start": start,
		"end":   end,
	}
	tasks, err := h.taskService.List(userID, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get recurring task instances
	instances, err := h.taskService.ExpandRecurringTasks(userID, start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert to FullCalendar events
	var events []models.CalendarEvent

	// Add regular tasks
	for _, task := range tasks {
		// Soft-deleted tasks should not appear on calendar.
		if task.Status == models.TaskStatusCancelled {
			continue
		}
		// Skip recurring tasks (they will be handled by instances)
		if task.RecurrenceRule != nil && task.StartTime != nil {
			continue
		}
		event := taskToEvent(&task)
		events = append(events, event)
	}

	// Add recurring instances
	for _, instance := range instances {
		if instance.Status == models.TaskStatusCancelled {
			continue
		}
		event := instanceToEvent(&instance)
		events = append(events, event)
	}

	if h.caldavService != nil {
		externalEvents, err := h.caldavService.ListCalendarEvents(userID, start, end)
		if err == nil {
			events = append(events, externalEvents...)
		}
	}

	c.JSON(http.StatusOK, events)
}

func (h *CalendarHandler) GetInstances(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	startStr := c.Query("start")
	endStr := c.Query("end")

	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start and end parameters are required"})
		return
	}

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start date format"})
		return
	}

	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end date format"})
		return
	}

	// Verify task ownership
	_, err = h.taskService.GetByID(userID, taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	// Get instances
	allInstances, err := h.taskService.ExpandRecurringTasks(userID, start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Filter by task ID
	var instances []models.TaskInstance
	for _, inst := range allInstances {
		if inst.TaskID == taskID {
			instances = append(instances, inst)
		}
	}

	c.JSON(http.StatusOK, instances)
}

func taskToEvent(task *models.Task) models.CalendarEvent {
	event := models.CalendarEvent{
		ID:       strconv.FormatInt(task.ID, 10),
		Title:    task.Title,
		AllDay:   task.AllDay,
		Editable: true,
		ExtendedProps: models.ExtendedProps{
			TaskID:      task.ID,
			Description: task.Description,
			Priority:    task.Priority,
			Status:      task.Status,
			IsRecurring: task.RecurrenceRule != nil,
		},
	}

	if task.StartTime != nil {
		event.Start = task.StartTime.Format(time.RFC3339)
		if task.EndTime != nil {
			event.End = task.EndTime.Format(time.RFC3339)
		}
	} else if task.DueDate != nil {
		event.Start = task.DueDate.Format(time.RFC3339)
		event.AllDay = true
	}

	// Set color based on priority
	event.BackgroundColor = getPriorityColor(task.Priority)
	event.BorderColor = getPriorityColor(task.Priority)

	return event
}

func instanceToEvent(instance *models.TaskInstance) models.CalendarEvent {
	event := models.CalendarEvent{
		ID:       instance.InstanceID,
		Title:    instance.Title,
		AllDay:   instance.AllDay,
		Editable: true,
		ExtendedProps: models.ExtendedProps{
			TaskID:      instance.TaskID,
			Description: instance.Description,
			Priority:    instance.Priority,
			Status:      instance.Status,
			IsRecurring: instance.IsRecurring,
			InstanceID:  instance.InstanceID,
		},
	}

	event.Start = instance.StartTime.Format(time.RFC3339)
	if instance.EndTime != nil {
		event.End = instance.EndTime.Format(time.RFC3339)
	}

	// Set color based on priority
	event.BackgroundColor = getPriorityColor(instance.Priority)
	event.BorderColor = getPriorityColor(instance.Priority)

	return event
}

func getPriorityColor(priority models.Priority) string {
	switch priority {
	case models.PriorityHigh:
		return "#ef4444" // red
	case models.PriorityLow:
		return "#22c55e" // green
	default:
		return "#3788d8" // blue (medium)
	}
}
