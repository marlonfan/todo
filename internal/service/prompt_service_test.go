package service

import (
	"testing"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newTestPromptService(t *testing.T) *PromptService {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.Prompt{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return NewPromptService(repository.NewPromptRepository(db))
}

func TestPromptServiceCreateUpdateAndUserIsolation(t *testing.T) {
	service := newTestPromptService(t)

	created, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "  Standup coach  ",
		Content: "  Ask concise follow-up questions.  ",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if created.Title != "Standup coach" {
		t.Fatalf("expected trimmed title, got %q", created.Title)
	}
	if created.Content != "Ask concise follow-up questions." {
		t.Fatalf("expected trimmed content, got %q", created.Content)
	}

	if _, err := service.GetByID(2, created.ID); err == nil {
		t.Fatalf("expected prompt to be isolated by user")
	}

	updated, err := service.Update(1, created.ID, &models.UpdatePromptRequest{
		Title: "Decision helper",
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if updated.Title != "Decision helper" {
		t.Fatalf("expected updated title, got %q", updated.Title)
	}
	if updated.Content != "Ask concise follow-up questions." {
		t.Fatalf("expected content to remain unchanged, got %q", updated.Content)
	}
}

func TestPromptServiceRequiresTitleAndContent(t *testing.T) {
	service := newTestPromptService(t)

	if _, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "   ",
		Content: "content",
	}); err == nil {
		t.Fatalf("expected blank title to fail")
	}

	if _, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "title",
		Content: "   ",
	}); err == nil {
		t.Fatalf("expected blank content to fail")
	}
}
