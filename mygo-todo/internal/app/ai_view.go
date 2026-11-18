package app

import (
	"fmt"
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

func (a *App) aiView(c *ui.Context) {
	ui.Column(c.Key("ai-workspace")).Grow(1).MinHeight(0).Width(840).MaxWidthPercent(100).AlignSelf(ui.Center).Padding(24).Gap(14).Children(func() {
		ui.Column(c).Gap(8).Children(func() {
			ui.Row(c).Gap(10).Wrap().AlignItems(ui.Center).Children(func() {
				ui.Text(c, "提示词和问答").FontSize(fontTitle).FontWeight(600)
				display.Tag(c, "需要联网", display.TagProps{Size: theme.Small})
			})
			ui.Text(c, "把常用要求保存为提示词，生成回复后再决定如何使用。").TextColor(c.Theme().TextMuted)
			ui.Row(c).Gap(8).Wrap().Children(func() {
				primaryButton(c, "新建提示词").Disabled(a.busy).OnClick(func() { a.aiPromptDraft = &api.Prompt{}; a.failure = "" })
			})
			preferenceLink(c.Key("ai-config"), "AI 配置", "服务连接与模型", "AI 配置", a.busy, a.editAIConfig)
		})
		ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
			appSegmented(c, &a.aiTab, []string{"提示词", "问答历史"}, action.SegmentedProps{}).Width(260).MaxWidthPercent(100).Label("AI 工作区")
			appSearchBar(c, &a.aiSearch, field.SearchBarProps{Placeholder: "搜索提示词或历史"}).Width(320).MaxWidthPercent(100).Label("搜索提示词或历史")
		})
		scope := fmt.Sprintf("%d 个提示词 · 搜索标题与内容", len(a.aiPrompts))
		if a.aiTab == 1 {
			scope = fmt.Sprintf("已加载 %d 条问答 · 搜索已加载的标题、输入与回复", len(a.aiHistory.Items))
		}
		ui.Text(c, scope).FontSize(12).TextColor(c.Theme().TextMuted)
		ui.Scroll(c.Key("ai-list")).Grow(1).MinHeight(0).Gap(0).Children(func() {
			query := strings.ToLower(strings.TrimSpace(a.aiSearch))
			shown := 0
			if a.aiTab == 0 {
				for _, p := range a.aiPrompts {
					if query != "" && !strings.Contains(strings.ToLower(p.Title+"\n"+p.Content), query) {
						continue
					}
					shown++
					a.aiPromptCard(c.Key(p.ID), p)
				}
			} else {
				for _, h := range a.aiHistory.Items {
					if query != "" && !strings.Contains(strings.ToLower(h.PromptTitle+"\n"+h.Input+"\n"+h.Output), query) {
						continue
					}
					shown++
					a.aiHistoryCard(c.Key(h.ID), h)
				}
			}
			if shown == 0 {
				title, description := "还没有提示词", "新建提示词，保存常用的提问方式。"
				if a.aiTab == 1 {
					title, description = "还没有问答历史", "使用提示词生成的回复会自动保存到这里。"
				}
				if query != "" {
					title, description = "没有匹配的内容", "尝试其他关键词，或清空搜索。"
				}
				if !a.aiLoaded {
					title, description = "尚未读取 AI 内容", "请点击刷新读取提示词和历史。"
				}
				appDisplayEmpty(c, display.EmptyProps{Title: title, Description: description}).Padding(20)
			}
			if a.aiTab == 1 && a.aiHistory.HasMore {
				appActionButton(c, "读取更早问答历史", action.ButtonProps{}).Disabled(a.busy).OnClick(a.moreAIHistory)
			}
		})
	})
}

func (a *App) aiPromptCard(c *ui.Context, p api.Prompt) {
	ui.Column(c).Padding(12, 0).Gap(6).BorderWidth(0, 0, 1, 0).BorderColor(c.Theme().Border).Children(func() {
		ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
			ui.Text(c, p.Title).Bold().FontSize(14).MaxLines(1).Grow(1).MinWidth(0)
			primaryButton(c, "提问", theme.Small).Height(26).Label("使用提示词 " + p.Title).Disabled(a.busy).OnClick(func() { a.openAsk(p) })
			iconButton(c, "编辑提示词 "+p.Title, lucide.Pencil()).Size(28, 28).Padding(6).Disabled(a.busy).OnClick(func() { copy := p; a.aiPromptDraft = &copy; a.failure = "" })
			holder := ui.Box(c.Key("prompt-actions")).Shrink(0)
			open := ui.Local(holder, "open", func() bool { return false })
			holder.Children(func() {
				key := appDropdown(c, open, []overlay.MenuItem{{Key: "delete", Label: "删除提示词 " + p.Title, Danger: true, Disabled: a.busy}}, func(trigger ui.Element) {
					styleAppButton(c, trigger, "", "ghost").Label("更多提示词操作 "+p.Title).Tooltip("更多操作").Size(28, 28).Padding(6).Disabled(a.busy).Children(func() {
						ui.Icon(c, lucide.Ellipsis()).Size(15, 15).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
					})
				})
				if key == "delete" && !a.busy {
					a.aiDelete = &aiDelete{Kind: "提示词", ID: p.ID, Title: p.Title}
					a.failure = ""
				}
			})
		})
		ui.Text(c, p.Content).FontSize(12).MaxLines(2).TextColor(c.Theme().TextMuted)
	})
}

func (a *App) aiHistoryCard(c *ui.Context, h api.AskHistory) {
	ui.Column(c).Padding(12, 0).Gap(6).BorderWidth(0, 0, 1, 0).BorderColor(c.Theme().Border).Children(func() {
		ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
			ui.Text(c, h.PromptTitle).Bold().FontSize(14).MaxLines(1).Grow(1).MinWidth(0)
			color := display.TagSuccess
			if h.Status != "completed" {
				color = display.TagWarning
			}
			display.Tag(c, historyStatus(h.Status), display.TagProps{Color: color, Size: theme.Small})
			ui.Text(c, h.CreatedAt.In(a.location()).Format("2006-01-02 15:04")).FontSize(11.5).TextColor(c.Theme().TextMuted)
			iconButton(c, fmt.Sprintf("查看问答历史 #%d", h.ID), lucide.Eye()).Size(28, 28).Padding(6).OnClick(func() { a.openAskHistory(h) })
			holder := ui.Box(c.Key("history-actions")).Shrink(0)
			open := ui.Local(holder, "open", func() bool { return false })
			holder.Children(func() {
				key := appDropdown(c, open, []overlay.MenuItem{{Key: "delete", Label: fmt.Sprintf("删除问答历史 #%d", h.ID), Danger: true, Disabled: a.busy}}, func(trigger ui.Element) {
					styleAppButton(c, trigger, "", "ghost").Label(fmt.Sprintf("更多问答历史操作 #%d", h.ID)).Tooltip("更多操作").Size(28, 28).Padding(6).Disabled(a.busy).Children(func() {
						ui.Icon(c, lucide.Ellipsis()).Size(15, 15).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
					})
				})
				if key == "delete" && !a.busy {
					a.aiDelete = &aiDelete{Kind: "历史", ID: h.ID, Title: h.Input}
					a.failure = ""
				}
			})
		})
		ui.Text(c, h.Input).FontSize(12.5).MaxLines(2)
		ui.Text(c, h.Output).FontSize(12).MaxLines(2).TextColor(c.Theme().TextMuted)
	})
}

func historyStatus(status string) string {
	switch status {
	case "stopped":
		return "已停止（部分内容）"
	case "incomplete":
		return "未完整结束"
	default:
		return "已完成"
	}
}
