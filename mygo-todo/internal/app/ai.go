package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"todo-native/internal/ai"
	"todo-native/internal/api"
)

type aiPanel struct {
	Prompt                                  api.Prompt
	Input                                   string
	Result                                  ai.Result
	Running, Saved, FromHistory             bool
	Failure, Notice                         string
	Cancel                                  context.CancelFunc
	Description, Occurrence, IncludeContext bool
	Task                                    api.Task
	ContextTasks                            []api.Task
	BaseDescription                         string
	SentInput                               string
}
type aiDelete struct {
	Kind  string
	ID    int64
	Title string
}

func (a *App) loadAI() {
	if a.client == nil || a.busy || a.win == nil {
		return
	}
	client := a.client
	a.run(func(ctx context.Context) (func(), error) {
		prompts, err := client.Prompts(ctx)
		if err != nil {
			return nil, err
		}
		history, err := client.AskHistories(ctx, 0)
		if err != nil {
			return nil, err
		}
		return func() { a.aiPrompts, a.aiHistory, a.aiLoaded = prompts, history, true }, nil
	})
}
func (a *App) editAIConfig() {
	if a.client == nil || a.busy {
		return
	}
	client := a.client
	a.run(func(ctx context.Context) (func(), error) {
		out, err := client.AIConfiguration(ctx)
		if err != nil {
			return nil, err
		}
		cfg := out.Config
		if !out.Configured {
			cfg = ai.DefaultConfig()
		}
		if cfg.Protocol == "a_protocol" {
			cfg.Protocol = "anthropic"
		}
		return func() { a.aiConfigDraft = &cfg }, nil
	})
}
func (a *App) saveAIConfig() {
	if a.aiConfigDraft == nil || a.client == nil || a.busy {
		return
	}
	cfg := *a.aiConfigDraft
	cfg.BaseURL = strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	cfg.APIKey = strings.TrimSpace(cfg.APIKey)
	cfg.ModelID = strings.TrimSpace(cfg.ModelID)
	if err := ai.ValidateConfig(cfg, false); err != nil {
		a.failure = err.Error()
		return
	}
	client := a.client
	a.run(func(ctx context.Context) (func(), error) {
		if err := client.Do(ctx, "PUT", "/ai/config", cfg, nil, 0); err != nil {
			return nil, err
		}
		return func() { a.aiConfigDraft = nil; a.message = "已保存 AI 配置" }, nil
	})
}
func promptPayload(p api.Prompt) (map[string]string, error) {
	title, content := strings.TrimSpace(p.Title), strings.TrimSpace(p.Content)
	if title == "" || utf8.RuneCountInString(title) > 120 {
		return nil, errors.New("提示词标题应为 1–120 个字符")
	}
	if content == "" || utf8.RuneCountInString(content) > 20000 {
		return nil, errors.New("提示词内容应为 1–20000 个字符")
	}
	return map[string]string{"title": title, "content": content}, nil
}
func (a *App) savePrompt() {
	if a.aiPromptDraft == nil || a.client == nil || a.busy {
		return
	}
	p := *a.aiPromptDraft
	body, err := promptPayload(p)
	if err != nil {
		a.failure = err.Error()
		return
	}
	method, path := "POST", "/prompts"
	if p.ID > 0 {
		method, path = "PUT", fmt.Sprintf("/prompts/%d", p.ID)
	}
	client := a.client
	a.run(func(ctx context.Context) (func(), error) {
		var saved api.Prompt
		if err := client.Do(ctx, method, path, body, &saved, 0); err != nil {
			var connection *api.ConnectionError
			if method == "POST" && errors.As(err, &connection) {
				return nil, errors.New("提示词保存结果未确认，请关闭编辑并刷新列表后确认是否已创建")
			}
			return nil, err
		}
		return func() {
			a.aiPrompts = slices.DeleteFunc(a.aiPrompts, func(p api.Prompt) bool { return p.ID == saved.ID })
			a.aiPrompts = append([]api.Prompt{saved}, a.aiPrompts...)
			a.aiPromptDraft = nil
			a.message = "已保存提示词"
		}, nil
	})
}
func (a *App) deleteAIItem() {
	if a.aiDelete == nil || a.client == nil || a.busy {
		return
	}
	item, client := *a.aiDelete, a.client
	path := fmt.Sprintf("/prompts/%d", item.ID)
	if item.Kind == "历史" {
		path = fmt.Sprintf("/prompts/history/%d", item.ID)
	}
	a.run(func(ctx context.Context) (func(), error) {
		if err := client.Do(ctx, "DELETE", path, nil, nil, 0); err != nil {
			return nil, err
		}
		return func() {
			if item.Kind == "历史" {
				a.aiHistory.Items = slices.DeleteFunc(a.aiHistory.Items, func(h api.AskHistory) bool { return h.ID == item.ID })
			} else {
				a.aiPrompts = slices.DeleteFunc(a.aiPrompts, func(p api.Prompt) bool { return p.ID == item.ID })
			}
			a.aiDelete = nil
			a.message = "已删除" + item.Kind
		}, nil
	})
}
func (a *App) moreAIHistory() {
	if !a.aiHistory.HasMore || a.busy || a.client == nil {
		return
	}
	client, cursor := a.client, a.aiHistory.NextCursor
	a.run(func(ctx context.Context) (func(), error) {
		page, err := client.AskHistories(ctx, cursor)
		if err != nil {
			return nil, err
		}
		return func() {
			for _, item := range page.Items {
				if !slices.ContainsFunc(a.aiHistory.Items, func(h api.AskHistory) bool { return h.ID == item.ID }) {
					a.aiHistory.Items = append(a.aiHistory.Items, item)
				}
			}
			a.aiHistory.NextCursor, a.aiHistory.HasMore = page.NextCursor, page.HasMore
		}, nil
	})
}
func (a *App) resetAIPreview() {
	a.aiOutputMode, a.aiReasoningOpen, a.failure = 0, false, ""
}

func (a *App) openAsk(prompt api.Prompt) {
	a.resetAIPreview()
	a.aiPanel = &aiPanel{Prompt: prompt}
}
func (a *App) openAskHistory(h api.AskHistory) {
	a.resetAIPreview()
	id := int64(0)
	if h.PromptID != nil {
		id = *h.PromptID
	}
	a.aiPanel = &aiPanel{Prompt: api.Prompt{ID: id, Title: h.PromptTitle, Content: h.PromptContent}, Input: h.Input, Result: ai.Result{Text: h.Output, Reasoning: h.Reasoning, FinishReason: h.FinishReason, Incomplete: h.Status != "completed"}, Saved: true, FromHistory: true, Notice: "历史快照；原提示词删除或更改后，此处仍保留当时的内容。"}
	a.failure = ""
}
func (a *App) openDescriptionAI(occurrence bool) {
	var task api.Task
	if occurrence {
		if a.selectedOccurrence == nil || a.selectedOccurrence.ReadOnly {
			return
		}
		task = *a.selectedOccurrence
		task.Description = a.occurrenceDescription
	} else {
		if !a.editing || a.draft.Task.ReadOnly {
			return
		}
		d := a.draft
		task = d.Task
		task.Title, task.Description, task.AllDay = d.Title, d.Description, d.AllDay
		task.StartTime, task.EndTime, task.DueDate = nil, nil, nil
		if d.HasStart {
			v := d.Start
			task.StartTime = &v
		}
		if d.HasEnd {
			v := d.End
			task.EndTime = &v
		}
		if d.HasDue {
			v := d.Due
			task.DueDate = &v
		}
		task.Categories = nil
		for _, cat := range a.categories {
			if d.Categories[cat.ID] {
				task.Categories = append(task.Categories, cat)
			}
		}
	}
	if strings.TrimSpace(task.Title) == "" {
		a.failure = "请先填写任务标题，再生成描述"
		return
	}
	tasks := append([]api.Task(nil), a.tasks...)
	a.resetAIPreview()
	a.aiPanel = &aiPanel{Description: true, Occurrence: occurrence, Task: task, ContextTasks: tasks, BaseDescription: task.Description, Input: "请将当前任务整理为清晰、可执行的行动清单和完成标准。"}
	a.failure = ""
}
func descriptionMessages(config api.AIConfig, p *aiPanel) (string, string) {
	system := strings.TrimSpace(config.SystemPrompt)
	if system == "" {
		system = ai.DefaultSystem
	}
	if strings.TrimSpace(config.UserProfile) != "" {
		system += "\n\n使用者人设与背景：\n" + config.UserProfile
	}
	// Keep JSON valid and explicitly bound both task count and byte size. The
	// edited task is authoritative and excluded from the other-task snapshot.
	current := taskAISummary(p.Task)
	background := []map[string]any{}
	if p.IncludeContext && config.AllowTaskContext {
		size := 0
		for _, t := range p.ContextTasks {
			if t.ID == p.Task.ID && t.ID != 0 {
				continue
			}
			row := taskAISummary(t)
			b, _ := json.Marshal(row)
			if len(background) >= 160 || size+len(b) > 26000 {
				break
			}
			background = append(background, row)
			size += len(b)
		}
	}
	payload := map[string]any{"当前任务（唯一权威）": current, "其他任务背景（本机缓存，可能不完整）": background, "其他任务背景已启用": p.IncludeContext && config.AllowTaskContext}
	b, _ := json.MarshalIndent(payload, "", "  ")
	input := "请生成可直接用于当前任务的 Markdown 描述，只输出正文。保留已有事实、时间和约束，不编造；背景任务只作参考，缺失的信息列为待确认。不要输出推理过程。\n额外要求：" + p.Input + "\n" + string(b)
	return system, input
}
func taskAISummary(t api.Task) map[string]any {
	truncate := func(s string) string {
		r := []rune(s)
		if len(r) > 520 {
			return string(r[:519]) + "…"
		}
		return s
	}
	names := []string{}
	for _, c := range t.Categories {
		names = append(names, truncate(c.Name))
	}
	return map[string]any{"id": t.ID, "title": truncate(t.Title), "description": truncate(t.Description), "status": t.Status, "priority": t.Priority, "all_day": t.AllDay, "categories": names, "start_time": t.StartTime, "end_time": t.EndTime, "due_date": t.DueDate, "recurrence_rule": t.RecurrenceRule}
}
func (a *App) generateAI() {
	p := a.aiPanel
	if p == nil || p.Running || a.busy || a.client == nil || a.win == nil {
		return
	}
	input := strings.TrimSpace(p.Input)
	if input == "" || utf8.RuneCountInString(input) > 200000 {
		p.Failure = "请输入 1–200000 个字符的提问内容"
		return
	}
	if p.FromHistory {
		p.Failure = "历史记录为只读，请关闭后从提示词列表发起新问答"
		return
	}
	ctx, cancel := context.WithCancel(a.ctx)
	p.Cancel, p.Running = cancel, true
	p.Result = ai.Result{}
	p.Failure, p.Notice, p.Saved = "", "", false
	p.SentInput = input
	client, epoch, win := a.client, a.epoch, a.win
	// Snapshot all mutable inputs on the UI thread before starting a worker.
	snapshot := *p
	go func() {
		cfg, err := client.AIConfiguration(ctx)
		result := ai.Result{}
		if err == nil && !cfg.Configured {
			err = errors.New("请先打开 AI 配置，填写模型服务、API Key 和模型 ID")
		}
		if err == nil {
			system := snapshot.Prompt.Content
			request := input
			if snapshot.Description {
				system, request = descriptionMessages(cfg.Config, &snapshot)
			}
			last := time.Time{}
			result, err = ai.Generate(ctx, cfg.Config, system, request, func(r ai.Result) {
				if time.Since(last) < 45*time.Millisecond {
					return
				}
				last = time.Now()
				if win.IsDestroyed() {
					return
				}
				win.Update(func() {
					if a.epoch == epoch && a.aiPanel == p && p.Running {
						p.Result = r
					}
				})
			})
		}
		cfg = api.AIConfigResponse{}
		cancel()
		if win.IsDestroyed() {
			return
		}
		win.Update(func() {
			if a.epoch != epoch || a.aiPanel != p {
				return
			}
			p.Running, p.Cancel = false, nil
			p.Result = result
			if errors.Is(err, context.Canceled) {
				p.Result.Incomplete = true
				p.Result.FinishReason = "stopped"
				p.Notice = "已停止；收到的内容已保留，可能不完整。"
			} else if errors.Is(err, context.DeadlineExceeded) {
				p.Result.Incomplete = true
				p.Failure = "模型请求超时；已保留收到的内容，可检查服务后重试。"
			} else if err != nil {
				p.Result.Incomplete = true
				p.Failure = err.Error()
			}
			if p.Result.Text != "" && !p.Description {
				a.saveAskHistory()
			}
		})
	}()
}
func (a *App) saveAskHistory() {
	p := a.aiPanel
	if p == nil || p.Description || p.FromHistory || p.Saved || p.Running || a.busy || a.client == nil || p.Result.Text == "" {
		return
	}
	status := "completed"
	if p.Result.Incomplete {
		status = "incomplete"
	}
	if p.Result.FinishReason == "stopped" {
		status = "stopped"
	}
	body := map[string]any{"prompt_id": p.Prompt.ID, "input": p.SentInput, "output": p.Result.Text, "reasoning": p.Result.Reasoning, "status": status, "finish_reason": p.Result.FinishReason}
	client := a.client
	a.run(func(ctx context.Context) (func(), error) {
		var saved api.AskHistory
		err := client.Do(ctx, "POST", "/prompts/history", body, &saved, 0)
		return func() {
			if err != nil {
				p.Notice = "历史保存结果未确认；请先复制回答以保留内容，关闭后刷新历史确认。"
				return
			}
			p.Saved = true
			p.Notice = "已保存问答历史"
			a.aiHistory.Items = append([]api.AskHistory{saved}, a.aiHistory.Items...)
		}, nil
	})
}
func (a *App) applyAIDescription(appendText bool) {
	p := a.aiPanel
	if p == nil || !p.Description || p.Running || a.busy {
		return
	}
	text := ai.CleanDescription(p.Result.Text)
	if text == "" {
		p.Failure = "当前没有可采用的描述正文"
		return
	}
	target := &a.draft.Description
	if p.Occurrence {
		if a.selectedOccurrence == nil || !a.occurrenceEditing || a.selectedOccurrence.InstanceID != p.Task.InstanceID {
			p.Failure = "本次实例编辑已关闭，请重新打开后再生成"
			return
		}
		target = &a.occurrenceDescription
	} else if !a.editing || a.draft.Task.ID != p.Task.ID {
		p.Failure = "任务编辑已关闭，请重新打开后再生成"
		return
	}
	if *target != p.BaseDescription {
		p.Failure = "任务描述已在生成期间变化，请关闭预览后检查草稿再试"
		return
	}
	if appendText && strings.TrimSpace(*target) != "" {
		text = *target + "\n\n" + text
	}
	*target = text
	a.aiPanel = nil
	a.message = "AI 描述已填入草稿，请检查后保存任务"
}
func (a *App) clearAI() {
	if a.aiPanel != nil && a.aiPanel.Cancel != nil {
		a.aiPanel.Cancel()
	}
	a.aiPanel, a.aiConfigDraft, a.aiPromptDraft, a.aiDelete = nil, nil, nil, nil
	a.aiPrompts, a.aiHistory, a.aiLoaded = nil, api.AskHistoryPage{}, false
	a.aiSearch = ""
}
