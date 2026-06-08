package service

import (
	"testing"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newTestAIConfigService(t *testing.T) *AIConfigService {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.UserAIConfig{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return NewAIConfigService(repository.NewAIConfigRepository(db))
}

func TestAIConfigServiceGetMissingReturnsNil(t *testing.T) {
	service := newTestAIConfigService(t)

	config, err := service.GetConfig(1)
	if err != nil {
		t.Fatalf("GetConfig returned error: %v", err)
	}
	if config != nil {
		t.Fatalf("expected nil config, got %#v", config)
	}
}

func TestAIConfigServiceSaveAndUpdateConfig(t *testing.T) {
	service := newTestAIConfigService(t)
	allowContext := false

	saved, err := service.SaveConfig(1, &models.AIConfigRequest{
		Protocol:         "a_protocol",
		BaseURL:          "https://api.example.com/v1/",
		APIKey:           " secret-key ",
		ModelID:          "claude-test",
		SystemPrompt:     "Be useful.",
		UserProfile:      "Prefers concise answers.",
		AllowTaskContext: &allowContext,
	})
	if err != nil {
		t.Fatalf("SaveConfig returned error: %v", err)
	}
	if saved.Protocol != models.AIProtocolAnthropic {
		t.Fatalf("expected protocol %q, got %q", models.AIProtocolAnthropic, saved.Protocol)
	}
	if saved.BaseURL != "https://api.example.com/v1" {
		t.Fatalf("expected trimmed base URL, got %q", saved.BaseURL)
	}
	if saved.APIKey != "secret-key" {
		t.Fatalf("expected trimmed API key, got %q", saved.APIKey)
	}
	if saved.AllowTaskContext {
		t.Fatalf("expected task context to be disabled")
	}

	allowContext = true
	updated, err := service.SaveConfig(1, &models.AIConfigRequest{
		Protocol:         models.AIProtocolOpenAI,
		ModelID:          "gpt-test",
		AllowTaskContext: &allowContext,
	})
	if err != nil {
		t.Fatalf("second SaveConfig returned error: %v", err)
	}
	if updated.Protocol != models.AIProtocolOpenAI {
		t.Fatalf("expected protocol %q, got %q", models.AIProtocolOpenAI, updated.Protocol)
	}
	if updated.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("expected default OpenAI base URL, got %q", updated.BaseURL)
	}
	if updated.ModelID != "gpt-test" {
		t.Fatalf("expected updated model ID, got %q", updated.ModelID)
	}
	if !updated.AllowTaskContext {
		t.Fatalf("expected task context to be enabled")
	}
}
