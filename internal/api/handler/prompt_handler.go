package handler

import (
	"net/http"
	"strconv"
	"strings"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
)

type PromptHandler struct {
	promptService *service.PromptService
}

func NewPromptHandler(promptService *service.PromptService) *PromptHandler {
	return &PromptHandler{promptService: promptService}
}

func (h *PromptHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.CreatePromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	prompt, err := h.promptService.Create(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, prompt)
}

func (h *PromptHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)

	prompts, err := h.promptService.ListByUser(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prompts)
}

func (h *PromptHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)

	promptID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid prompt ID"})
		return
	}

	prompt, err := h.promptService.GetByID(userID, promptID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prompt)
}

func (h *PromptHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)

	promptID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid prompt ID"})
		return
	}

	var req models.UpdatePromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	prompt, err := h.promptService.Update(userID, promptID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, prompt)
}

func (h *PromptHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)

	promptID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid prompt ID"})
		return
	}

	if err := h.promptService.Delete(userID, promptID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *PromptHandler) CreateAskHistory(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.CreatePromptAskHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	history, err := h.promptService.CreateAskHistory(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, history)
}

func (h *PromptHandler) ListAskHistory(c *gin.Context) {
	userID := middleware.GetUserID(c)

	limit := 100
	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid history limit"})
			return
		}
		limit = parsed
	}

	beforeID := int64(0)
	if rawBeforeID := strings.TrimSpace(c.Query("before_id")); rawBeforeID != "" {
		parsed, err := strconv.ParseInt(rawBeforeID, 10, 64)
		if err != nil || parsed < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid history cursor"})
			return
		}
		beforeID = parsed
	}

	history, err := h.promptService.ListAskHistory(userID, beforeID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

func (h *PromptHandler) DeleteAskHistory(c *gin.Context) {
	userID := middleware.GetUserID(c)

	historyID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid history ID"})
		return
	}

	if err := h.promptService.DeleteAskHistory(userID, historyID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
