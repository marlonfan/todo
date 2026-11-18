package handler

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"strconv"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"
)

func (h *TaskHandler) UpdateOccurrenceSchedule(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task ID"})
		return
	}
	var req models.UpdateTaskOccurrenceScheduleRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	revision, err := parseIfMatchRevision(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, _, err := h.taskService.ExecuteMutation(userID, parseClientOpID(c), "occurrence_schedule", id, mutationFingerprint(c, req, nil), func(scoped *service.TaskService) (*models.Task, error) {
		return scoped.UpdateOccurrenceSchedule(userID, id, &req, revision, parseTaskActivityMeta(c))
	})
	if err != nil {
		respondTaskError(c, err)
		return
	}
	c.JSON(http.StatusOK, task)
}
