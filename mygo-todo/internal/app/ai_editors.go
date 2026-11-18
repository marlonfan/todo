package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

func aiFormError(c *ui.Context, message string) {
	if message != "" {
		ui.Scroll(c.Key("ai-form-error")).MaxHeight(72).Children(func() {
			feedback.Alert(c, message, feedback.AlertProps{Type: feedback.Error})
		})
	}
}

func (a *App) aiEditors(c *ui.Context) {
	open := a.aiConfigDraft != nil
	ui.Modal(c, &open, func() {
		d := a.aiConfigDraft
		if d == nil {
			return
		}
		ui.Text(c, "AI 配置").FontSize(fontTitle).Bold()
		display.Tag(c, "保存到账户", display.TagProps{Size: theme.Small}).AlignSelf(ui.Start)
		_, height := c.Size()
		reserved := float32(265)
		if a.failure != "" {
			reserved += 80
		}
		ui.Scroll(c.Key("ai-config-fields")).Height(max(150, min(480, height-reserved))).Gap(14).Disabled(a.busy).Children(func() {
			layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Gap(8).Children(func() {
				ui.Text(c, "连接模型服务").Bold().FontSize(16)
				ui.Text(c, "API Key 将保存到 Todo 服务端，本机仅临时读取。保存配置不会发送模型请求。").FontSize(13).TextColor(c.Theme().TextMuted)
				if ui.Select(c, &d.Protocol, []string{"openai", "anthropic"}).Label("AI 协议").Changed() {
					a.failure = ""
					if d.BaseURL == "https://api.openai.com/v1" || d.BaseURL == "https://api.anthropic.com/v1" {
						d.BaseURL = "https://api.openai.com/v1"
						if d.Protocol == "anthropic" {
							d.BaseURL = "https://api.anthropic.com/v1"
						}
					}
				}
				ui.Field(c, "模型服务地址", func() {
					if ui.TextInput(c, &d.BaseURL).Placeholder("https://…/v1").Changed() {
						a.failure = ""
					}
				})
				ui.Field(c, "API Key", func() {
					if ui.TextInput(c, &d.APIKey).Password().Changed() {
						a.failure = ""
					}
				})
				ui.Field(c, "模型 ID", func() {
					if ui.TextInput(c, &d.ModelID).Changed() {
						a.failure = ""
					}
				})
			})
			layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
				ui.Text(c, "回复偏好与背景").Bold().FontSize(16)
				ui.Field(c, "AI 系统提示词", func() {
					if ui.TextArea(c, &d.SystemPrompt).Height(100).Changed() {
						a.failure = ""
					}
				})
				ui.Field(c, "使用者背景", func() {
					if ui.TextArea(c, &d.UserProfile).Height(80).Changed() {
						a.failure = ""
					}
				})
				if ui.Checkbox(c, &d.AllowTaskContext, "允许描述生成使用其他任务背景").Changed() {
					a.failure = ""
				}
				ui.Text(c, "描述生成时还需勾选本次请求的背景选项。提示词问答只发送选定提示词和输入内容。").FontSize(12).TextColor(c.Theme().TextMuted)
			})
		})
		aiFormError(c, a.failure)
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "取消 AI 配置", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.aiConfigDraft = nil; a.failure = "" })
			appActionButton(c, "保存 AI 配置", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.saveAIConfig)
		})
	}).Width(600).MaxWidthPercent(95)
	if !open && !a.busy && a.aiConfigDraft != nil {
		a.aiConfigDraft = nil
		a.failure = ""
	}

	open = a.aiPromptDraft != nil
	ui.Modal(c, &open, func() {
		d := a.aiPromptDraft
		if d == nil {
			return
		}
		title := "新建提示词"
		if d.ID != 0 {
			title = "编辑提示词"
		}
		ui.Text(c, title).FontSize(fontTitle).Bold()
		ui.Text(c, "保存常用要求，提问时再填写具体内容。").FontSize(13).TextColor(c.Theme().TextMuted)
		_, height := c.Size()
		reserved := float32(250)
		if a.failure != "" {
			reserved += 80
		}
		ui.Scroll(c.Key("ai-prompt-fields")).Height(max(150, min(420, height-reserved))).Gap(14).Disabled(a.busy).Children(func() {
			layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(14).Children(func() {
				ui.Field(c, "提示词标题", func() {
					if ui.TextInput(c, &d.Title).AutoFocus().Changed() {
						a.failure = ""
					}
				}).Description("1–120 个字符")
				ui.Field(c, "提示词内容", func() {
					if ui.TextArea(c, &d.Content).Height(200).Changed() {
						a.failure = ""
					}
				}).Description("1–20000 个字符；用于说明角色、要求与输出格式")
			})
		})
		aiFormError(c, a.failure)
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "取消提示词编辑", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.aiPromptDraft = nil; a.failure = "" })
			appActionButton(c, "保存提示词", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.savePrompt)
		})
	}).Width(600).MaxWidthPercent(95)
	if !open && !a.busy && a.aiPromptDraft != nil {
		a.aiPromptDraft = nil
		a.failure = ""
	}

	open = a.aiDelete != nil
	ui.Modal(c, &open, func() {
		d := a.aiDelete
		if d == nil {
			return
		}
		ui.Text(c, "确认删除"+d.Kind+"？").FontSize(fontTitle).Bold()
		layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Children(func() { ui.Text(c, d.Title).MaxLines(3) })
		if d.Kind == "提示词" {
			ui.Text(c, "已有问答历史快照会保留。").TextColor(c.Theme().TextMuted)
		}
		aiFormError(c, a.failure)
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "保留 AI 内容", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.aiDelete = nil; a.failure = "" })
			appActionButton(c, "确认删除 AI 内容", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.deleteAIItem)
		})
	}).Width(480).MaxWidthPercent(95)
	if !open && !a.busy && a.aiDelete != nil {
		a.aiDelete = nil
		a.failure = ""
	}
}
