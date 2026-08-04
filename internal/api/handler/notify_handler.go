package handler

import (
	"net/http"
	"strconv"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
)

type NotifyHandler struct {
	notifyService *service.NotifyService
}

func NewNotifyHandler(notifyService *service.NotifyService) *NotifyHandler {
	return &NotifyHandler{notifyService: notifyService}
}

func (h *NotifyHandler) GetSettings(c *gin.Context) {
	userID := middleware.GetUserID(c)

	settings, err := h.notifyService.GetUserSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.NotifySettingResponses(settings))
}

func (h *NotifyHandler) CreateSetting(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.CreateNotifySettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	setting, err := h.notifyService.CreateUserSetting(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, setting.ToResponse())
}

func (h *NotifyHandler) DeleteSetting(c *gin.Context) {
	userID := middleware.GetUserID(c)

	settingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid setting ID"})
		return
	}

	if err := h.notifyService.DeleteUserSetting(userID, settingID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *NotifyHandler) SetDefaultSetting(c *gin.Context) {
	userID := middleware.GetUserID(c)

	settingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid setting ID"})
		return
	}

	if err := h.notifyService.SetDefaultUserSetting(userID, settingID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "default setting updated"})
}

func (h *NotifyHandler) Test(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.TestNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.notifyService.TestNotification(userID, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "test notification sent"})
}

func (h *NotifyHandler) GetChannels(c *gin.Context) {
	channels := h.notifyService.ListChannels()
	c.JSON(http.StatusOK, gin.H{"channels": channels})
}
