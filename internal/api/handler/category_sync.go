package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"todo-app/internal/api/middleware"
	"todo-app/internal/models"
	"todo-app/internal/service"
)

// Sync is a dedicated endpoint, so old servers cannot silently ignore operation
// IDs and create duplicates when an offline client replays an uncertain request.
func (h *CategoryHandler) Sync(c *gin.Context) {
	var request struct {
		Method     string                        `json:"method" binding:"required,oneof=POST PUT DELETE"`
		CategoryID int64                         `json:"category_id"`
		Category   *models.CreateCategoryRequest `json:"category"`
	}
	opID := strings.TrimSpace(c.GetHeader("X-Client-Op-Id"))
	if opID == "" || len(opID) > 128 {
		c.JSON(400, gin.H{"error": "valid X-Client-Op-Id required"})
		return
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if (request.Method == "POST" && request.CategoryID != 0) || (request.Method != "POST" && request.CategoryID <= 0) {
		c.JSON(400, gin.H{"error": "invalid category ID"})
		return
	}
	if request.Method != "DELETE" {
		if request.Category == nil {
			c.JSON(400, gin.H{"error": "category is required"})
			return
		}
		request.Category.Name = strings.TrimSpace(request.Category.Name)
		if err := binding.Validator.ValidateStruct(request.Category); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
	} else {
		request.Category = nil
	}
	raw, _ := json.Marshal(request)
	hash := sha256.Sum256(raw)
	category, replayed, err := h.catService.ExecuteMutation(middleware.GetUserID(c), opID, request.Method, request.CategoryID, hex.EncodeToString(hash[:]), request.Category)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrOperationMismatch) {
			status = 409
		}
		if errors.Is(err, service.ErrMutationPersistence) {
			status = 500
		}
		if errors.Is(err, service.ErrCategoryNotFound) {
			status = 404
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"category": category, "replayed": replayed})
}
