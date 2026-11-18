package api

import (
	"context"
	"fmt"
	"time"
)

// AIConfig is deliberately never part of Session, Cache or Preferences.
// The existing Todo service returns the credential to its signed-in owner.
type AIConfig struct {
	Protocol         string `json:"protocol"`
	BaseURL          string `json:"base_url"`
	APIKey           string `json:"api_key"`
	ModelID          string `json:"model_id"`
	SystemPrompt     string `json:"system_prompt"`
	UserProfile      string `json:"user_profile"`
	AllowTaskContext bool   `json:"allow_task_context"`
}
type AIConfigResponse struct {
	Configured bool     `json:"configured"`
	Config     AIConfig `json:"config"`
}
type Prompt struct {
	ID      int64  `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}
type AskHistory struct {
	ID            int64     `json:"id"`
	PromptID      *int64    `json:"prompt_id"`
	PromptTitle   string    `json:"prompt_title"`
	PromptContent string    `json:"prompt_content"`
	Input         string    `json:"input"`
	Reasoning     string    `json:"reasoning"`
	Output        string    `json:"output"`
	Status        string    `json:"status"`
	FinishReason  string    `json:"finish_reason"`
	CreatedAt     time.Time `json:"created_at"`
}
type AskHistoryPage struct {
	Items      []AskHistory `json:"items"`
	NextCursor int64        `json:"next_cursor"`
	HasMore    bool         `json:"has_more"`
}

func (c *Client) AIConfiguration(ctx context.Context) (AIConfigResponse, error) {
	var out AIConfigResponse
	err := c.Do(ctx, "GET", "/ai/config", nil, &out, 0)
	return out, err
}
func (c *Client) Prompts(ctx context.Context) ([]Prompt, error) {
	var out []Prompt
	err := c.Do(ctx, "GET", "/prompts", nil, &out, 0)
	return out, err
}
func (c *Client) AskHistories(ctx context.Context, before int64) (AskHistoryPage, error) {
	var out AskHistoryPage
	err := c.Do(ctx, "GET", fmt.Sprintf("/prompts/history?limit=50&before_id=%d", before), nil, &out, 0)
	return out, err
}
