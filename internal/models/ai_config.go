package models

import (
	"strings"
	"time"
)

const (
	AIProtocolOpenAI    = "openai"
	AIProtocolAnthropic = "anthropic"
)

type UserAIConfig struct {
	ID               int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID           int64     `json:"user_id" gorm:"uniqueIndex;not null"`
	Protocol         string    `json:"protocol" gorm:"size:20;default:'openai'"`
	BaseURL          string    `json:"base_url" gorm:"type:text"`
	APIKey           string    `json:"api_key" gorm:"type:text"`
	ModelID          string    `json:"model_id" gorm:"size:200"`
	SystemPrompt     string    `json:"system_prompt" gorm:"type:text"`
	UserProfile      string    `json:"user_profile" gorm:"type:text"`
	AllowTaskContext bool      `json:"allow_task_context"`
	CreatedAt        time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type AIConfigRequest struct {
	Protocol         string `json:"protocol" binding:"omitempty,oneof=openai anthropic a_protocol"`
	BaseURL          string `json:"base_url" binding:"omitempty,max=2000"`
	APIKey           string `json:"api_key" binding:"omitempty,max=20000"`
	ModelID          string `json:"model_id" binding:"omitempty,max=200"`
	SystemPrompt     string `json:"system_prompt" binding:"omitempty,max=20000"`
	UserProfile      string `json:"user_profile" binding:"omitempty,max=20000"`
	AllowTaskContext *bool  `json:"allow_task_context"`
}

type AIConfigResponse struct {
	Protocol         string    `json:"protocol"`
	BaseURL          string    `json:"base_url"`
	APIKey           string    `json:"api_key"`
	ModelID          string    `json:"model_id"`
	SystemPrompt     string    `json:"system_prompt"`
	UserProfile      string    `json:"user_profile"`
	AllowTaskContext bool      `json:"allow_task_context"`
	UpdatedAt        time.Time `json:"updated_at,omitempty"`
}

func NormalizeAIProtocol(value string) string {
	switch strings.TrimSpace(value) {
	case AIProtocolAnthropic, "a_protocol":
		return AIProtocolAnthropic
	case AIProtocolOpenAI:
		return AIProtocolOpenAI
	default:
		return AIProtocolOpenAI
	}
}

func DefaultAIBaseURL(protocol string) string {
	if NormalizeAIProtocol(protocol) == AIProtocolAnthropic {
		return "https://api.anthropic.com/v1"
	}
	return "https://api.openai.com/v1"
}

func NormalizeAIBaseURL(value string, protocol string) string {
	baseURL := strings.TrimRight(strings.TrimSpace(value), "/")
	if baseURL != "" {
		return baseURL
	}
	return DefaultAIBaseURL(protocol)
}

func (c *UserAIConfig) ToResponse() AIConfigResponse {
	protocol := NormalizeAIProtocol(c.Protocol)
	return AIConfigResponse{
		Protocol:         protocol,
		BaseURL:          NormalizeAIBaseURL(c.BaseURL, protocol),
		APIKey:           strings.TrimSpace(c.APIKey),
		ModelID:          strings.TrimSpace(c.ModelID),
		SystemPrompt:     strings.TrimSpace(c.SystemPrompt),
		UserProfile:      c.UserProfile,
		AllowTaskContext: c.AllowTaskContext,
		UpdatedAt:        c.UpdatedAt,
	}
}
