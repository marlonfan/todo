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

func parseClientSubmittedAt(c *gin.Context) *time.Time {
	raw := strings.TrimSpace(c.GetHeader("X-Client-Submitted-At"))
	if raw == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil
		}
	}
	normalized := parsed.UTC()
	return &normalized
}

func parseTaskActivityMeta(c *gin.Context) *service.TaskActivityMeta {
	meta := &service.TaskActivityMeta{
		SubmittedAt:  parseClientSubmittedAt(c),
		SubmitSource: strings.TrimSpace(c.GetHeader("X-Client-Submit-Source")),
	}
	if meta.SubmittedAt == nil && meta.SubmitSource == "" {
		return nil
	}
	return meta
}

func parseOccurrenceStatuses(raw string) ([]models.TaskStatus, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []models.TaskStatus{
			models.TaskStatusCompleted,
			models.TaskStatusCancelled,
		}, nil
	}
	parts := strings.Split(trimmed, ",")
	seen := make(map[models.TaskStatus]struct{})
	statuses := make([]models.TaskStatus, 0, len(parts))
	for _, part := range parts {
		value := models.TaskStatus(strings.TrimSpace(part))
		switch value {
		case models.TaskStatusPending, models.TaskStatusCompleted, models.TaskStatusCancelled:
		default:
			return nil, errors.New("invalid status filter")
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		statuses = append(statuses, value)
	}
	if len(statuses) == 0 {
		return nil, errors.New("status filter cannot be empty")
	}
	return statuses, nil
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
	if strings.Contains(strings.ToLower(err.Error()), "task not found") {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
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

func (h *TaskHandler) ListOccurrences(c *gin.Context) {
	userID := middleware.GetUserID(c)

	statuses, err := parseOccurrenceStatuses(c.Query("status"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	limit := 200
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
			return
		}
		if parsed > 500 {
			parsed = 500
		}
		limit = parsed
	}

	cursor := 0
	if raw := strings.TrimSpace(c.Query("cursor")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cursor"})
			return
		}
		cursor = parsed
	}

	items, nextCursor, hasMore, err := h.taskService.ListOccurrences(userID, statuses, limit, cursor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items":       items,
		"next_cursor": nextCursor,
		"has_more":    hasMore,
	})
}

func (h *TaskHandler) ListNextOccurrences(c *gin.Context) {
	userID := middleware.GetUserID(c)

	from := time.Now().UTC()
	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from date format"})
			return
		}
		from = parsed.UTC()
	}

	items, err := h.taskService.ListNextPendingOccurrences(userID, from)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *TaskHandler) ListActivities(c *gin.Context) {
	userID := middleware.GetUserID(c)

	taskID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}

	limit := 200
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
			return
		}
		if parsed > 500 {
			parsed = 500
		}
		limit = parsed
	}

	activities, err := h.taskService.ListActivities(userID, taskID, limit)
	if err != nil {
		if strings.Contains(err.Error(), "task not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, activities)
}

func (h *TaskHandler) Sync(c *gin.Context) {
	userID := middleware.GetUserID(c)

	since := time.Unix(0, 0).UTC()
	if raw := strings.TrimSpace(c.Query("since")); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid since date format"})
			return
		}
		since = parsed.UTC()
	}

	limit := 500
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
			return
		}
		if parsed > 2000 {
			parsed = 2000
		}
		limit = parsed
	}

	changed, deleted, err := h.taskService.ListChangedSince(userID, since, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	nextSince := since
	for _, task := range changed {
		if task.UpdatedAt.After(nextSince) {
			nextSince = task.UpdatedAt
		}
	}
	for _, item := range deleted {
		if item.DeletedAt.After(nextSince) {
			nextSince = item.DeletedAt
		}
	}
	hasMore := len(changed) >= limit || len(deleted) >= limit
	now := time.Now().UTC()
	if !hasMore && now.After(nextSince) {
		nextSince = now
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks":      changed,
		"deleted":    deleted,
		"next_since": nextSince.Format(time.RFC3339),
		"has_more":   hasMore,
		"server_at":  now.Format(time.RFC3339),
	})
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

	task, err := h.taskService.Update(userID, taskID, &req, fieldMask, expectedRevision, parseTaskActivityMeta(c))
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

	task, err := h.taskService.UpdateStatus(
		userID,
		taskID,
		req.Status,
		req.InstanceID,
		req.OccurrenceDate,
		expectedRevision,
		parseTaskActivityMeta(c),
	)
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

	task, err := h.taskService.UpdateSchedule(userID, taskID, &req, expectedRevision, parseTaskActivityMeta(c))
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
