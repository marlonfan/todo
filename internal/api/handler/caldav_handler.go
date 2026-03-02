package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"

	"github.com/gin-gonic/gin"
)

type CaldavHandler struct {
	caldavService *service.CaldavService
}

func NewCaldavHandler(caldavService *service.CaldavService) *CaldavHandler {
	return &CaldavHandler{caldavService: caldavService}
}

func (h *CaldavHandler) Discover(c *gin.Context) {
	var req models.CaldavDiscoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	items, err := h.caldavService.DiscoverCalendars(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *CaldavHandler) ListSources(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sources, err := h.caldavService.ListSources(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sources)
}

func (h *CaldavHandler) CreateSource(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req models.CaldavUpsertSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	source, err := h.caldavService.CreateSource(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, source)
}

func (h *CaldavHandler) UpdateSource(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sourceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source ID"})
		return
	}
	var req models.CaldavUpsertSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	source, err := h.caldavService.UpdateSource(c.Request.Context(), userID, sourceID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, source)
}

func (h *CaldavHandler) DeleteSource(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sourceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source ID"})
		return
	}
	if err := h.caldavService.DeleteSource(userID, sourceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *CaldavHandler) SyncSource(c *gin.Context) {
	userID := middleware.GetUserID(c)
	sourceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source ID"})
		return
	}
	if err := h.caldavService.SyncSourceNow(c.Request.Context(), userID, sourceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "sync started"})
}

func (h *CaldavHandler) ListReadOnlyTasks(c *gin.Context) {
	userID := middleware.GetUserID(c)
	start, end, clamped, err := parseRange(c.Query("start"), c.Query("end"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if clamped {
		c.Header("X-Caldav-Range-Clamped", "true")
	}
	if c.Query("debug") == "1" {
		tasks, debug, err := h.caldavService.ListReadOnlyTasksWithDebug(userID, start, end)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{
				"error": err.Error(),
				"debug": debug,
				"tasks": tasks,
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"tasks": tasks,
			"debug": debug,
		})
		return
	}
	tasks, err := h.caldavService.ListReadOnlyTasks(userID, start, end)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

func parseRange(startRaw, endRaw string) (time.Time, time.Time, bool, error) {
	const maxSpan = 120 * 24 * time.Hour
	now := time.Now().UTC()
	start := now.AddDate(0, 0, -7)
	end := now.AddDate(0, 3, 0)
	var err error
	if strings.TrimSpace(startRaw) != "" {
		start, err = time.Parse(time.RFC3339, startRaw)
		if err != nil {
			return time.Time{}, time.Time{}, false, err
		}
	}
	if strings.TrimSpace(endRaw) != "" {
		end, err = time.Parse(time.RFC3339, endRaw)
		if err != nil {
			return time.Time{}, time.Time{}, false, err
		}
	}
	start = start.UTC()
	end = end.UTC()
	if !end.After(start) {
		end = start.Add(24 * time.Hour)
	}
	clamped := false
	if end.Sub(start) > maxSpan {
		end = start.Add(maxSpan)
		clamped = true
	}
	return start, end, clamped, nil
}
