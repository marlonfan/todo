package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type TaskHandler struct {
	taskService   *service.TaskService
	notifyService *service.NotifyService
}

func parseIfMatchRevision(c *gin.Context) (*int64, error) {
	value := strings.TrimSpace(c.GetHeader("If-Match"))
	if value == "" {
		return nil, nil
	}
	value = strings.Trim(value, "\"")
	revision, err := strconv.ParseInt(value, 10, 64)
	if err != nil || revision <= 0 {
		return nil, errors.New("invalid If-Match header")
	}
	return &revision, nil
}

func respondTaskError(c *gin.Context, err error) {
	var conflict *service.RevisionConflictError
	if errors.As(err, &conflict) {
		c.JSON(http.StatusConflict, gin.H{
			"error":  "revision conflict",
			"latest": conflict.Latest,
		})
		return
	}
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}

func NewTaskHandler(taskService *service.TaskService, notifyService *service.NotifyService) *TaskHandler {
	return &TaskHandler{
		taskService:   taskService,
		notifyService: notifyService,
	}
}

func (h *TaskHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.Create(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func (h *TaskHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	task, err := h.taskService.GetByID(userID, taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)

	filters := make(map[string]interface{})

	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}

	if catID := c.Query("category_id"); catID != "" {
		if id, err := strconv.ParseInt(catID, 10, 64); err == nil {
			filters["category_id"] = id
		}
	}

	if start := c.Query("start"); start != "" {
		if t, err := time.Parse(time.RFC3339, start); err == nil {
			filters["start"] = t
		}
	}

	if end := c.Query("end"); end != "" {
		if t, err := time.Parse(time.RFC3339, end); err == nil {
			filters["end"] = t
		}
	}

	tasks, err := h.taskService.List(userID, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

func (h *TaskHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	var req models.UpdateTaskRequest
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var raw map[string]json.RawMessage
	if err := c.ShouldBindBodyWith(&raw, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	fieldMask := make(map[string]bool, len(raw))
	for field := range raw {
		fieldMask[field] = true
	}
	if fieldMask["start_time_local"] {
		fieldMask["start_time"] = true
	}
	if fieldMask["end_time_local"] {
		fieldMask["end_time"] = true
	}

	expectedRevision, err := parseIfMatchRevision(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.Update(userID, taskID, &req, fieldMask, expectedRevision)
	if err != nil {
		respondTaskError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) UpdateStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	var req models.UpdateTaskStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expectedRevision, err := parseIfMatchRevision(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.UpdateStatus(userID, taskID, req.Status, req.InstanceID, req.OccurrenceDate, expectedRevision)
	if err != nil {
		respondTaskError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) UpdateSchedule(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	var req models.UpdateTaskScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expectedRevision, err := parseIfMatchRevision(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.taskService.UpdateSchedule(userID, taskID, &req, expectedRevision)
	if err != nil {
		respondTaskError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	expectedRevision, err := parseIfMatchRevision(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.taskService.Delete(userID, taskID, expectedRevision); err != nil {
		respondTaskError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *TaskHandler) CreateNotification(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	// Verify task ownership
	_, err = h.taskService.GetByID(userID, taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	notification, err := h.notifyService.CreateNotification(userID, taskID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, notification)
}

func (h *TaskHandler) ListNotifications(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	// Verify task ownership
	_, err = h.taskService.GetByID(userID, taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	notifications, err := h.notifyService.GetTaskNotifications(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, notifications)
}
