package app

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/ai"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestAIContextOptInAndAuthoritativeDraft(t *testing.T) {
	p := aiPanel{Description: true, Task: api.Task{ID: 4, Title: "当前草稿", Description: "新描述"}, ContextTasks: []api.Task{{ID: 4, Title: "旧标题"}, {ID: 5, Title: "其他任务的私人背景"}}, Input: "需求"}
	cfg := ai.DefaultConfig()
	cfg.UserProfile = "账户背景"
	system, input := descriptionMessages(cfg, &p)
	if !strings.Contains(system, "账户背景") || !strings.Contains(input, "当前草稿") || strings.Contains(input, "其他任务的私人背景") || strings.Contains(input, "旧标题") {
		t.Fatal(system, input)
	}
	p.IncludeContext = true
	_, input = descriptionMessages(cfg, &p)
	if !strings.Contains(input, "其他任务的私人背景") || strings.Contains(input, "旧标题") {
		t.Fatal(input)
	}
	cfg.AllowTaskContext = false
	_, input = descriptionMessages(cfg, &p)
	if strings.Contains(input, "其他任务的私人背景") {
		t.Fatal("account opt out ignored")
	}
	cfg.AllowTaskContext = true
	p.ContextTasks = nil
	for i := range 500 {
		p.ContextTasks = append(p.ContextTasks, api.Task{ID: int64(i + 10), Title: strings.Repeat("任务", 500), Description: strings.Repeat("描述", 500)})
	}
	_, input = descriptionMessages(cfg, &p)
	if len(input) > 30000 {
		t.Fatal("unbounded context", len(input))
	}
	var payload map[string]any
	i := strings.Index(input, "{\n")
	if err := json.Unmarshal([]byte(input[i:]), &payload); err != nil {
		t.Fatal("truncated JSON", err)
	}
}
func TestNativeAIEditorMasksAndWipesKeyAndPromptValidation(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "ai"
	a.aiLoaded = true
	cfg := ai.DefaultConfig()
	cfg.APIKey = "must-not-persist"
	a.aiConfigDraft = &cfg
	tt := ui.NewTester(a.view, 900, 760)
	if n, ok := tt.AccessByRole(ui.RoleTextField, "API Key"); !ok || !n.Password {
		t.Fatal("AI key is not masked")
	}
	if err := tt.Click("取消 AI 配置"); err != nil {
		t.Fatal(err)
	}
	if a.aiConfigDraft != nil {
		t.Fatal("cancel retained API key")
	}
	if err := tt.Click("新建提示词"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("保存提示词"); err != nil {
		t.Fatal(err)
	}
	if a.aiPromptDraft == nil || !tt.HasText("提示词标题应为 1–120 个字符") {
		t.Fatal(tt.Texts())
	}
	a.aiConfigDraft = &cfg
	a.aiPanel = &aiPanel{Result: ai.Result{Text: "private-output"}}
	a.clearAI()
	if a.aiConfigDraft != nil || a.aiPanel != nil || a.aiPromptDraft != nil {
		t.Fatal("account cleanup retained AI data")
	}
}
func TestAIApplyEditsOnlyDraftAndProtectsChangedTask(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.editTask(api.Task{ID: 7, Title: "任务", Description: "原文"})
	a.openDescriptionAI(false)
	p := a.aiPanel
	p.Result = ai.Result{Text: "```markdown\n- AI 建议\n```"}
	a.newTask() // keyboard/tray action must not replace the underlying draft
	if a.draft.Task.ID != 7 {
		t.Fatal("shortcut replaced AI target")
	}
	a.draft.Description = "生成期间修改"
	a.applyAIDescription(false)
	if a.aiPanel == nil || a.draft.Description != "生成期间修改" || p.Failure == "" {
		t.Fatal("concurrent draft overwritten")
	}
	a.draft.Description = "原文"
	a.applyAIDescription(true)
	if a.aiPanel != nil || a.draft.Description != "原文\n\n- AI 建议" || len(a.cache.Outbox) != 0 || !a.editing {
		t.Fatal("AI wrote task before explicit save", a.draft)
	}
	a.selectedOccurrence = &api.Task{ID: 7, InstanceID: "7_20261110", Title: "任务", Description: "本次原文"}
	a.occurrenceEditing = true
	a.occurrenceDescription = "本次原文"
	a.openDescriptionAI(true)
	a.aiPanel.Result.Text = "本次建议"
	a.applyAIDescription(false)
	if a.occurrenceDescription != "本次建议" || a.draft.Description != "原文\n\n- AI 建议" || len(a.cache.Outbox) != 0 {
		t.Fatal("occurrence AI changed series")
	}
}
func TestNativeMarkdownDescriptionPreview(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.editTask(api.Task{ID: 2, Title: "测试", Description: "## 完成标准\n\n- [ ] 进行验证\n"})
	tt := ui.NewTester(a.view, 900, 760)
	rich, ok := tt.AccessByRole(ui.RoleTextField, "备注")
	if !ok || !strings.Contains(rich.Value, "完成标准") || strings.Contains(rich.Value, "## ") {
		t.Fatalf("saved Markdown must open directly in WYSIWYG mode: %+v", rich)
	}
	if err := tt.Click("切换为 Markdown 源码编辑"); err != nil {
		t.Fatal(err)
	}
	raw, ok := tt.AccessByRole(ui.RoleTextField, "备注")
	if !ok || !strings.Contains(raw.Value, "## 完成标准") {
		t.Fatalf("source mode did not expose raw Markdown: %+v", raw)
	}
	if err := tt.Click("切换为所见即所得编辑"); err != nil {
		t.Fatal(err)
	}
	rich, ok = tt.AccessByRole(ui.RoleTextField, "备注")
	if !ok || !strings.Contains(rich.Value, "完成标准") || strings.Contains(rich.Value, "## ") {
		t.Fatalf("WYSIWYG mode not restored: %+v", rich)
	}
}

func TestAIPreviewResetsReasoningAndSourceForEachConversation(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	for _, open := range []func(){
		func() { a.openAsk(api.Prompt{Title: "新的提问"}) },
		func() {
			a.openAskHistory(api.AskHistory{PromptTitle: "历史", Output: "回复", Reasoning: "previous-reasoning", Status: "completed"})
		},
		func() { a.editTask(api.Task{ID: 1, Title: "任务"}); a.openDescriptionAI(false) },
	} {
		a.aiPanel = nil
		a.aiOutputMode, a.aiReasoningOpen, a.failure = 1, true, "上次失败"
		open()
		if a.aiPanel == nil || a.aiOutputMode != 0 || a.aiReasoningOpen || a.failure != "" {
			t.Fatal("new conversation inherited previous source/reasoning/error state")
		}
	}
}

func TestAIEditorsKeepActionsVisibleAndClearStaleErrors(t *testing.T) {
	for _, kind := range []string{"config", "prompt", "delete"} {
		t.Run(kind, func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			a.client, _ = api.New(api.DefaultServer, "")
			a.page, a.aiLoaded = "ai", true
			cancel, save, field := "取消 AI 配置", "保存 AI 配置", "模型服务地址"
			switch kind {
			case "config":
				cfg := ai.DefaultConfig()
				cfg.APIKey = "must-wipe-on-dismiss"
				a.aiConfigDraft = &cfg
			case "prompt":
				a.aiPromptDraft = &api.Prompt{Title: "草稿", Content: strings.Repeat("内容", 10000)}
				cancel, save, field = "取消提示词编辑", "保存提示词", "提示词标题"
			case "delete":
				a.aiDelete = &aiDelete{Kind: "提示词", ID: 2, Title: strings.Repeat("长标题", 100)}
				cancel, save, field = "保留 AI 内容", "确认删除 AI 内容", ""
			}
			a.failure = strings.Repeat("服务器暂时无法访问，草稿仍然保留。", 100)
			tt := ui.NewTester(a.view, 900, 600)
			for _, dark := range []bool{false, true} {
				tt.SetDark(dark)
				tt.Advance(time.Second)
				for _, label := range []string{cancel, save} {
					n, ok := tt.AccessByRole(ui.RoleButton, label)
					if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
						t.Fatal("AI editor action outside minimum window", label, n)
					}
				}
			}
			if field != "" {
				if err := tt.Click(field); err != nil {
					t.Fatal(err)
				}
				tt.Type("changed")
				if a.failure != "" {
					t.Fatal("changed AI field retained stale error")
				}
			}
			if err := tt.Click(cancel); err != nil {
				t.Fatal(err)
			}
			if a.aiConfigDraft != nil || a.aiPromptDraft != nil || a.aiDelete != nil || a.failure != "" {
				t.Fatal("cancel retained AI draft or failure")
			}
		})
	}
}

func TestAIResponseKeepsStopAndAdoptionActionsAtMinimumWindow(t *testing.T) {
	for _, running := range []bool{false, true} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		a.openAsk(api.Prompt{Title: strings.Repeat("任务", 120), Content: "输入要求"})
		a.aiPanel.Description, a.aiPanel.Running = true, running
		a.aiPanel.Result = ai.Result{Text: strings.Repeat("## 任务建议\n\n- 进行验证\n\n", 100), Reasoning: "hidden-reasoning"}
		a.aiPanel.Failure = strings.Repeat("错误说明", 1000)
		tt := ui.NewTester(a.view, 900, 600)
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			tt.Advance(time.Second)
			labels := []string{"复制 AI 回复", "追加到描述草稿", "替换描述草稿", "关闭 AI 预览"}
			if running {
				labels = append(labels, "停止生成")
			}
			for _, label := range labels {
				n, ok := tt.AccessByRole(ui.RoleButton, label)
				if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
					t.Fatal("AI response action outside minimum window", label, n)
				}
			}
			if tt.HasText("hidden-reasoning") {
				t.Fatal("reasoning expanded by default")
			}
		}
		a.Close()
	}
}
