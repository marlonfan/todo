package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"todo-app/internal/api"
	"todo-app/internal/api/handler"
	"todo-app/internal/config"
	"todo-app/internal/database"
	"todo-app/internal/notify"
	"todo-app/internal/notify/ntfy"
	"todo-app/internal/notify/telegram"
	"todo-app/internal/notify/webhook"
	"todo-app/internal/repository"
	"todo-app/internal/scheduler"
	"todo-app/internal/service"
	"todo-app/migrations"

	"github.com/gin-gonic/gin"
)

//go:embed web/dist
var webFS embed.FS

func main() {
	configPath := flag.String("config", "config.yaml", "Path to config file")
	flag.Parse()

	// Load config
	var cfg *config.Config
	var err error
	if _, err = os.Stat(*configPath); err == nil {
		cfg, err = config.Load(*configPath)
		if err != nil {
			log.Fatalf("Failed to load config: %v", err)
		}
	} else {
		cfg = config.Default()
		log.Println("Using default config")
	}

	// Connect to database
	db, err := database.NewDB(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations
	if err := migrations.Migrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migrated successfully")

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	taskActivityRepo := repository.NewTaskActivityRepository(db)
	catRepo := repository.NewCategoryRepository(db)
	notifyRepo := repository.NewNotificationRepository(db)
	caldavRepo := repository.NewCaldavRepository(db)
	taskMutationReceiptRepo := repository.NewTaskMutationReceiptRepository(db)

	// Initialize notification registry
	registry := notify.NewRegistry()
	if cfg.Plugins.Telegram.Enabled {
		registry.Register(telegram.New())
		log.Println("Telegram plugin registered")
	}
	if cfg.Plugins.Ntfy.Enabled {
		registry.Register(ntfy.New())
		log.Println("Ntfy plugin registered")
	}
	if cfg.Plugins.Webhook.Enabled {
		registry.Register(webhook.New())
		log.Println("Webhook plugin registered")
	}

	// Initialize services
	authService := service.NewAuthService(userRepo, &cfg.JWT)
	caldavService := service.NewCaldavService(caldavRepo, cfg.JWT.Secret)
	taskService := service.NewTaskService(taskRepo, taskActivityRepo, catRepo, userRepo, notifyRepo)
	taskService.SetCaldavService(caldavService)
	catService := service.NewCategoryService(catRepo)
	notifyService := service.NewNotifyService(notifyRepo, userRepo, taskRepo, registry)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService, notifyService)
	taskHandler := handler.NewTaskHandler(taskService, notifyService, taskMutationReceiptRepo)
	catHandler := handler.NewCategoryHandler(catService)
	calendarHandler := handler.NewCalendarHandler(taskService, caldavService)
	notifyHandler := handler.NewNotifyHandler(notifyService)
	caldavHandler := handler.NewCaldavHandler(caldavService)

	// Setup router
	router := api.NewRouter(
		authHandler,
		taskHandler,
		catHandler,
		calendarHandler,
		notifyHandler,
		caldavHandler,
		cfg,
	).Setup()

	// Setup static file serving
	setupStaticFiles(router)

	// Start notification scheduler
	notifyScheduler := scheduler.NewNotifyScheduler(notifyService, cfg.Notify.CheckInterval)
	notifyScheduler.Start()
	defer notifyScheduler.Stop()
	log.Printf("Notification scheduler started with interval %v", cfg.Notify.CheckInterval)

	caldavScheduler := scheduler.NewCaldavScheduler(caldavService, cfg.Caldav.CheckInterval)
	caldavScheduler.Start()
	defer caldavScheduler.Stop()
	log.Printf("CalDAV scheduler started with interval %v", cfg.Caldav.CheckInterval)

	// Start server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Server starting on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func setupStaticFiles(r *gin.Engine) {
	// Try to serve from embedded files first
	staticFS, err := fs.Sub(webFS, "web/dist")
	if err != nil {
		log.Printf("Warning: Could not open embedded web files: %v", err)
		return
	}

	// Create assets sub-filesystem
	assetsFS, err := fs.Sub(staticFS, "assets")
	if err != nil {
		log.Printf("Warning: Could not open assets directory: %v", err)
		return
	}

	// Serve static files from assets directory
	// URL: /assets/xxx -> assetsFS/xxx
	r.StaticFS("/assets", http.FS(assetsFS))

	// Serve index.html for root path and non-API routes (SPA behavior)
	r.NoRoute(func(c *gin.Context) {
		// Check if it's an API route
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(http.StatusNotFound, gin.H{"error": "API endpoint not found"})
			return
		}

		// Serve real static files first (manifest, service worker, icons, etc.)
		requestPath := strings.TrimPrefix(path.Clean(c.Request.URL.Path), "/")
		if requestPath != "" && requestPath != "." {
			if f, err := staticFS.Open(requestPath); err == nil {
				if info, statErr := f.Stat(); statErr == nil && !info.IsDir() {
					f.Close()
					c.FileFromFS(requestPath, http.FS(staticFS))
					return
				}
				f.Close()
			}
		}

		// Serve index.html for all other routes
		indexFile, err := staticFS.Open("index.html")
		if err != nil {
			c.String(http.StatusInternalServerError, "index.html not found")
			return
		}
		defer indexFile.Close()

		stat, err := indexFile.Stat()
		if err != nil {
			c.String(http.StatusInternalServerError, "Could not read index.html")
			return
		}

		content := make([]byte, stat.Size())
		_, err = indexFile.Read(content)
		if err != nil {
			c.String(http.StatusInternalServerError, "Could not read index.html")
			return
		}

		c.Data(http.StatusOK, "text/html", content)
	})
}
