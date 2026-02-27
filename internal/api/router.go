package api

import (
	"net/http"
	"todo-app/internal/api/handler"
	"todo-app/internal/api/middleware"
	"todo-app/internal/config"

	"github.com/gin-gonic/gin"
)

type Router struct {
	authHandler     *handler.AuthHandler
	taskHandler     *handler.TaskHandler
	categoryHandler *handler.CategoryHandler
	calendarHandler *handler.CalendarHandler
	notifyHandler   *handler.NotifyHandler
	cfg             *config.Config
}

func NewRouter(
	authHandler *handler.AuthHandler,
	taskHandler *handler.TaskHandler,
	categoryHandler *handler.CategoryHandler,
	calendarHandler *handler.CalendarHandler,
	notifyHandler *handler.NotifyHandler,
	cfg *config.Config,
) *Router {
	return &Router{
		authHandler:     authHandler,
		taskHandler:     taskHandler,
		categoryHandler: categoryHandler,
		calendarHandler: calendarHandler,
		notifyHandler:   notifyHandler,
		cfg:             cfg,
	}
}

func (r *Router) Setup() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS middleware
	router.Use(middleware.CORS())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API routes
	api := router.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", r.authHandler.Register)
			auth.POST("/login", r.authHandler.Login)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.JWTAuth(&r.cfg.JWT))
		{
			// Auth
			protected.GET("/auth/me", r.authHandler.Me)
			protected.POST("/auth/refresh", r.authHandler.Refresh)
			protected.PATCH("/auth/profile", r.authHandler.UpdateProfile)

			// Tasks
			protected.GET("/tasks", r.taskHandler.List)
			protected.POST("/tasks", r.taskHandler.Create)
			protected.GET("/tasks/:id", r.taskHandler.Get)
			protected.PUT("/tasks/:id", r.taskHandler.Update)
			protected.DELETE("/tasks/:id", r.taskHandler.Delete)
			protected.PATCH("/tasks/:id/status", r.taskHandler.UpdateStatus)
			protected.PATCH("/tasks/:id/schedule", r.taskHandler.UpdateSchedule)
			protected.GET("/tasks/:id/instances", r.calendarHandler.GetInstances)
			protected.GET("/tasks/:id/notifications", r.taskHandler.ListNotifications)
			protected.POST("/tasks/:id/notifications", r.taskHandler.CreateNotification)

			// Categories
			protected.GET("/categories", r.categoryHandler.List)
			protected.POST("/categories", r.categoryHandler.Create)
			protected.GET("/categories/:id", r.categoryHandler.Get)
			protected.PUT("/categories/:id", r.categoryHandler.Update)
			protected.DELETE("/categories/:id", r.categoryHandler.Delete)

			// Calendar
			protected.GET("/calendar", r.calendarHandler.GetEvents)

			// Notifications
			protected.GET("/notify/settings", r.notifyHandler.GetSettings)
			protected.POST("/notify/settings", r.notifyHandler.CreateSetting)
			protected.DELETE("/notify/settings/:id", r.notifyHandler.DeleteSetting)
			protected.PATCH("/notify/settings/:id/default", r.notifyHandler.SetDefaultSetting)
			protected.POST("/notify/test", r.notifyHandler.Test)
			protected.GET("/notify/channels", r.notifyHandler.GetChannels)
		}
	}

	return router
}
