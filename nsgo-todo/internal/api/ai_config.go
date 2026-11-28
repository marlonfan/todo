package api

import (
	"context"
	"net/http"
	"strings"
)

const (
	AIProtocolOpenAI    = "openai"
	AIProtocolAnthropic = "anthropic"
)

// AIConfig mirrors the todo backend's /api/ai/config contract.
type AIConfig struct {
	Protocol         string `json:"protocol"`
	BaseURL          string `json:"base_url"`
	APIKey           string `json:"api_key"`
	ModelID          string `json:"model_id"`
	SystemPrompt     string `json:"system_prompt,omitempty"`
	UserProfile      string `json:"user_profile,omitempty"`
	AllowTaskContext bool   `json:"allow_task_context,omitempty"`
}

func NormalizeAIProtocol(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case AIProtocolAnthropic, "a_protocol":
		return AIProtocolAnthropic
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

func (c AIConfig) Normalized() AIConfig {
	p := NormalizeAIProtocol(c.Protocol)
	base := strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
	if base == "" {
		base = DefaultAIBaseURL(p)
	}
	return AIConfig{
		Protocol:         p,
		BaseURL:          base,
		APIKey:           strings.TrimSpace(c.APIKey),
		ModelID:          strings.TrimSpace(c.ModelID),
		SystemPrompt:     strings.TrimSpace(c.SystemPrompt),
		UserProfile:      strings.TrimSpace(c.UserProfile),
		AllowTaskContext: c.AllowTaskContext,
	}
}

func (c AIConfig) Ready() bool {
	n := c.Normalized()
	return n.BaseURL != "" && n.APIKey != "" && n.ModelID != ""
}

// GetAIConfig fetches the signed-in user's saved LLM settings from /api/ai/config.
func (c *Client) GetAIConfig(ctx context.Context) (AIConfig, bool, error) {
	var resp struct {
		Configured bool      `json:"configured"`
		Config     *AIConfig `json:"config"`
	}
	if err := c.Do(ctx, http.MethodGet, "/ai/config", nil, &resp, 0); err != nil {
		return AIConfig{}, false, err
	}
	if !resp.Configured || resp.Config == nil {
		return AIConfig{}, false, nil
	}
	cfg := resp.Config.Normalized()
	return cfg, cfg.Ready(), nil
}

// SaveAIConfig updates the user's LLM settings on /api/ai/config.
func (c *Client) SaveAIConfig(ctx context.Context, cfg AIConfig) (AIConfig, error) {
	norm := cfg.Normalized()
	allow := norm.AllowTaskContext
	req := map[string]any{
		"protocol":           norm.Protocol,
		"base_url":           norm.BaseURL,
		"api_key":            norm.APIKey,
		"model_id":           norm.ModelID,
		"system_prompt":      norm.SystemPrompt,
		"user_profile":       norm.UserProfile,
		"allow_task_context": allow,
	}
	var resp struct {
		Configured bool      `json:"configured"`
		Config     *AIConfig `json:"config"`
	}
	if err := c.Do(ctx, http.MethodPut, "/ai/config", req, &resp, 0); err != nil {
		return AIConfig{}, err
	}
	if resp.Config != nil {
		return resp.Config.Normalized(), nil
	}
	return norm, nil
}
