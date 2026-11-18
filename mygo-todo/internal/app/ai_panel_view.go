package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/markdown"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

func (a *App) aiPanelView(c *ui.Context) {
	p := a.aiPanel
	open := p != nil
	ui.Modal(c, &open, func() {
		if p == nil {
			return
		}
		title, status := p.Prompt.Title, "提示词问答"
		if p.Description {
			title, status = "AI 描述草稿", "采用后仍需保存任务"
		}
		if p.FromHistory {
			status = "只读历史快照"
		}
		ui.Text(c, title).FontSize(fontTitle).FontWeight(600).MaxLines(2)
		display.Tag(c, status, display.TagProps{Size: theme.Small}).AlignSelf(ui.Start)
		_, height := c.Size()
		ui.Scroll(c.Key("ai-answer-content")).Height(max(150, min(520, height-300))).Gap(14).Children(func() {
			layout.Block(c.Key("ai-request"), layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
				ui.Text(c, "输入与要求").Bold().FontSize(16)
				if p.Description {
					ui.Text(c, "将当前编辑中的任务内容发送到所配置的模型服务。生成结果先预览，采用后仍需保存任务。").FontSize(13).TextColor(c.Theme().TextMuted)
					ui.Checkbox(c, &p.IncludeContext, "本次附带其他任务背景").Disabled(p.Running || a.busy).Tooltip("仅在账户 AI 配置也允许时生效，最多 160 个任务并限制总长度")
				} else {
					ui.Text(c, p.Prompt.Content).MaxLines(4).TextColor(c.Theme().TextMuted)
				}
				ui.Field(c, "AI 输入", func() {
					if ui.TextArea(c, &p.Input).Height(100).ReadOnly(p.FromHistory).Disabled(p.Running || a.busy).Changed() {
						p.Failure = ""
						a.failure = ""
					}
				})
				if !p.FromHistory {
					appActionButton(c, "生成 AI 回复", action.ButtonProps{Variant: action.Primary}).AlignSelf(ui.Start).Disabled(p.Running || a.busy).OnClick(a.generateAI)
				}
			})
			if p.Running {
				feedback.Alert(c, "正在接收模型回复…", feedback.AlertProps{Type: feedback.Info})
			}
			if p.Result.Incomplete && p.Result.Text != "" {
				feedback.Alert(c, "回复未完整结束，请检查内容后使用。", feedback.AlertProps{Type: feedback.Warning})
			}
			if p.Result.Reasoning != "" {
				ui.Checkbox(c, &a.aiReasoningOpen, "显示模型返回的思考内容")
				if a.aiReasoningOpen {
					layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Children(func() { ui.Text(c, p.Result.Reasoning).Selectable().FontSize(13) })
				}
			}
			if p.Result.Text != "" {
				layout.Block(c.Key("ai-response"), layout.BlockProps{Variant: layout.BlockFilled}).Padding(16).Gap(12).Children(func() {
					ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
						ui.Text(c, "模型回复").Bold().FontSize(16)
						appSegmented(c, &a.aiOutputMode, []string{"预览", "源码"}, action.SegmentedProps{Size: theme.Small}).Label("AI 回复显示")
					})
					if a.aiOutputMode == 1 {
						ui.TextArea(c, &p.Result.Text).Label("AI 回复源码").ReadOnly(true).Height(220)
					} else {
						// No LoadImage: model Markdown never fetches remote assets automatically.
						markdown.Markdown(c.Key("ai-markdown"), p.Result.Text, markdown.MarkdownProps{Variant: markdown.Chat, Animated: p.Running, Smoothing: markdown.Realtime})
					}
				})
			} else if !p.Running && p.Failure == "" {
				appDisplayEmpty(c, display.EmptyProps{Title: "回复将在这里显示", Description: "填写输入后点击生成，过程中可随时停止。"}).Padding(12)
			}
			if p.Notice != "" {
				feedback.Alert(c, p.Notice, feedback.AlertProps{Type: feedback.Info})
			}
			if p.Failure != "" {
				feedback.Alert(c, p.Failure, feedback.AlertProps{Type: feedback.Error})
			}
			if a.failure != "" {
				feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error})
			}
		})
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			if p.Running {
				appActionButton(c, "停止生成", action.ButtonProps{}).OnClick(func() {
					if p.Cancel != nil {
						p.Cancel()
					}
				})
			}
			if p.Result.Text != "" {
				appActionButton(c, "复制 AI 回复", action.ButtonProps{}).OnClick(func() {
					c.WriteClipboardThen(p.Result.Text, func(err error) {
						if err != nil {
							p.Failure = "复制失败，请重试"
						} else {
							p.Notice = "已复制回复"
						}
					})
				})
				if p.Description {
					appActionButton(c, "追加到描述草稿", action.ButtonProps{}).Disabled(p.Running || a.busy).OnClick(func() { a.applyAIDescription(true) })
					appActionButton(c, "替换描述草稿", action.ButtonProps{Variant: action.Primary}).Disabled(p.Running || a.busy).OnClick(func() { a.applyAIDescription(false) })
				}
			}
			appActionButton(c, "关闭 AI 预览", action.ButtonProps{}).Disabled(p.Running || a.busy).OnClick(func() { a.aiPanel = nil; a.failure = "" })
		})
	}).Width(760).MaxWidthPercent(95)
	if !open && p != nil && !p.Running && !a.busy {
		a.aiPanel = nil
		a.failure = ""
	}
}
