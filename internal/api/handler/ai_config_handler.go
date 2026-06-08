package handler

import (
	"net/http"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
)

type AIConfigHandler struct {
	aiConfigService *service.AIConfigService
}

func NewAIConfigHandler(aiConfigService *service.AIConfigService) *AIConfigHandler {
	return &AIConfigHandler{aiConfigService: aiConfigService}
}

func (h *AIConfigHandler) Get(c *gin.Context) {
	rawUserID, _ := c.Get("userID")
	userID := rawUserID.(int64)

	config, err := h.aiConfigService.GetConfig(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if config == nil {
		c.JSON(http.StatusOK, gin.H{"configured": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"configured": true,
		"config":     config,
	})
}

func (h *AIConfigHandler) Save(c *gin.Context) {
	rawUserID, _ := c.Get("userID")
	userID := rawUserID.(int64)

	var req models.AIConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config, err := h.aiConfigService.SaveConfig(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"configured": true,
		"config":     config,
	})
}
