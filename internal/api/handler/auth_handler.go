package handler

import (
	"log"
	"net/http"
	"strings"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService   *service.AuthService
	notifyService *service.NotifyService
}

func NewAuthHandler(authService *service.AuthService, notifyService *service.NotifyService) *AuthHandler {
	return &AuthHandler{
		authService:   authService,
		notifyService: notifyService,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.UserRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authService.Register(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.UserLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := h.authService.Login(&req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("userID")
	user, err := h.authService.GetUserByID(userID.(int64))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
		return
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
		return
	}

	token, err := h.authService.RefreshTokenFromRaw(parts[1])
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	rawUserID, _ := c.Get("userID")
	userID := rawUserID.(int64)

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.authService.UpdateProfile(userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.notifyService != nil && (req.DefaultReminderEnabled != nil || req.DefaultReminderMinutes != nil) {
		if err := h.notifyService.ReconcileUserReminders(userID); err != nil {
			log.Printf("Warning: failed to reconcile reminders after profile update for user %d: %v", userID, err)
		}
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdatePassword(c *gin.Context) {
	rawUserID, _ := c.Get("userID")
	userID := rawUserID.(int64)

	var req models.UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.UpdatePassword(userID, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "password updated successfully"})
}

// ReconcileReminders 重建所有提醒
func (h *AuthHandler) ReconcileReminders(c *gin.Context) {
	rawUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := rawUserID.(int64)

	if h.notifyService == nil {
		c.JSON(http.StatusOK, gin.H{"message": "notification service not available"})
		return
	}

	if err := h.notifyService.ReconcileUserReminders(userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "reminders rebuilt successfully"})
}
