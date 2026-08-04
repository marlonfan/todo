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
	caldavHandler   *handler.CaldavHandler
	exportHandler   *handler.CalendarExportHandler
	aiConfigHandler *handler.AIConfigHandler
	promptHandler   *handler.PromptHandler
	cfg             *config.Config
}

func NewRouter(
	authHandler *handler.AuthHandler,
	taskHandler *handler.TaskHandler,
	categoryHandler *handler.CategoryHandler,
	calendarHandler *handler.CalendarHandler,
	notifyHandler *handler.NotifyHandler,
	caldavHandler *handler.CaldavHandler,
	exportHandler *handler.CalendarExportHandler,
	aiConfigHandler *handler.AIConfigHandler,
	promptHandler *handler.PromptHandler,
	cfg *config.Config,
) *Router {
	return &Router{
		authHandler:     authHandler,
		taskHandler:     taskHandler,
		categoryHandler: categoryHandler,
		calendarHandler: calendarHandler,
		notifyHandler:   notifyHandler,
		caldavHandler:   caldavHandler,
		exportHandler:   exportHandler,
		aiConfigHandler: aiConfigHandler,
		promptHandler:   promptHandler,
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

	if r.exportHandler != nil {
		router.GET("/feeds/calendar/:token", r.exportHandler.ServeFeed)
		router.GET("/.well-known/caldav", r.exportHandler.RedirectWellKnown)
		router.OPTIONS("/.well-known/caldav", r.exportHandler.DAVOptions)
		router.Handle("PROPFIND", "/.well-known/caldav", r.exportHandler.RedirectWellKnown)
		router.OPTIONS("/dav", r.exportHandler.DAVOptions)
		router.GET("/dav", r.exportHandler.DAVGet)
		router.Handle("PROPFIND", "/dav", r.exportHandler.DAVPropfind)
		router.Handle("PROPPATCH", "/dav", r.exportHandler.DAVProppatch)
		router.Handle("REPORT", "/dav", r.exportHandler.DAVReport)
		router.OPTIONS("/dav/*path", r.exportHandler.DAVOptions)
		router.GET("/dav/*path", r.exportHandler.DAVGet)
		router.PUT("/dav/*path", r.exportHandler.DAVPut)
		router.DELETE("/dav/*path", r.exportHandler.DAVDelete)
		router.Handle("PROPFIND", "/dav/*path", r.exportHandler.DAVPropfind)
		router.Handle("PROPPATCH", "/dav/*path", r.exportHandler.DAVProppatch)
		router.Handle("REPORT", "/dav/*path", r.exportHandler.DAVReport)
		router.POST("/dav/*path", r.exportHandler.DAVMethodNotAllowed)
		router.PATCH("/dav/*path", r.exportHandler.DAVMethodNotAllowed)
	}

	// API routes
	api := router.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", r.authHandler.Register)
			auth.POST("/login", r.authHandler.Login)
			auth.POST("/refresh", r.authHandler.Refresh)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.JWTAuth(&r.cfg.JWT))
		{
			// Auth
			protected.GET("/auth/me", r.authHandler.Me)
			protected.PATCH("/auth/profile", r.authHandler.UpdateProfile)
			protected.PATCH("/auth/password", r.authHandler.UpdatePassword)
			protected.POST("/auth/reconcile-reminders", r.authHandler.ReconcileReminders)

			// AI config
			protected.GET("/ai/config", r.aiConfigHandler.Get)
			protected.PUT("/ai/config", r.aiConfigHandler.Save)

			// Prompts
			protected.GET("/prompts", r.promptHandler.List)
			protected.POST("/prompts", r.promptHandler.Create)
			protected.GET("/prompts/history", r.promptHandler.ListAskHistory)
			protected.POST("/prompts/history", r.promptHandler.CreateAskHistory)
			protected.DELETE("/prompts/history/:id", r.promptHandler.DeleteAskHistory)
			protected.GET("/prompts/:id", r.promptHandler.Get)
			protected.PUT("/prompts/:id", r.promptHandler.Update)
			protected.DELETE("/prompts/:id", r.promptHandler.Delete)

			// Tasks
			protected.GET("/tasks", r.taskHandler.List)
			protected.GET("/tasks/sync", r.taskHandler.Sync)
			protected.GET("/tasks/occurrences", r.taskHandler.ListOccurrences)
			protected.GET("/tasks/next-occurrences", r.taskHandler.ListNextOccurrences)
			protected.POST("/tasks", r.taskHandler.Create)
			protected.GET("/tasks/:id", r.taskHandler.Get)
			protected.PUT("/tasks/:id", r.taskHandler.Update)
			protected.DELETE("/tasks/:id", r.taskHandler.Delete)
			protected.PATCH("/tasks/:id/status", r.taskHandler.UpdateStatus)
			protected.PATCH("/tasks/:id/schedule", r.taskHandler.UpdateSchedule)
			protected.GET("/tasks/:id/instances", r.calendarHandler.GetInstances)
			protected.GET("/tasks/:id/activities", r.taskHandler.ListActivities)
			protected.GET("/tasks/:id/notifications", r.taskHandler.ListNotifications)
			protected.POST("/tasks/:id/notifications", r.taskHandler.CreateNotification)
			protected.PATCH("/tasks/:id/notifications/:notificationId", r.taskHandler.UpdateNotification)
			protected.DELETE("/tasks/:id/notifications/:notificationId", r.taskHandler.DeleteNotification)

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

			// CalDAV
			protected.GET("/calendar/subscription", r.exportHandler.GetSubscriptionInfo)
			protected.POST("/caldav/discover", r.caldavHandler.Discover)
			protected.GET("/caldav/sources", r.caldavHandler.ListSources)
			protected.POST("/caldav/sources", r.caldavHandler.CreateSource)
			protected.PUT("/caldav/sources/:id", r.caldavHandler.UpdateSource)
			protected.DELETE("/caldav/sources/:id", r.caldavHandler.DeleteSource)
			protected.POST("/caldav/sources/:id/sync", r.caldavHandler.SyncSource)
			protected.GET("/caldav/tasks", r.caldavHandler.ListReadOnlyTasks)
		}
	}

	return router
}
