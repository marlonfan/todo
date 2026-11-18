package app

import (
	"fmt"
	"slices"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

func notifyConfigFields(c *ui.Context, d *notifyDraft, choices []string) bool {
	changed := false
	ui.Field(c, "通知方式", func() { changed = ui.Select(c, &d.Channel, choices).Changed() || changed })
	switch d.Channel {
	case "Telegram":
		ui.Field(c, "Telegram Bot Token", func() { changed = ui.TextInput(c.Key("bot-token"), &d.BotToken).Password().Changed() || changed })
		ui.Field(c, "Telegram Chat ID", func() { changed = ui.TextInput(c.Key("chat-id"), &d.ChatID).Changed() || changed })
	case "ntfy":
		ui.Field(c, "ntfy 服务地址", func() { changed = ui.TextInput(c.Key("ntfy-server"), &d.ServerURL).Changed() || changed })
		ui.Field(c, "ntfy 主题", func() { changed = ui.TextInput(c.Key("ntfy-topic"), &d.Topic).Changed() || changed })
		ui.Field(c, "ntfy 优先级", func() { changed = ui.TextInput(c.Key("ntfy-priority"), &d.Priority).Changed() || changed }).Description("1–5，3 为普通")
		ui.Field(c, "ntfy 访问令牌", func() { changed = ui.TextInput(c.Key("ntfy-token"), &d.Token).Password().Changed() || changed }).Description("可选")
	case "Webhook":
		ui.Field(c, "Webhook 地址", func() { changed = ui.TextInput(c.Key("webhook-url"), &d.URL).Changed() || changed })
		ui.Field(c, "Webhook 请求方式", func() {
			changed = ui.Select(c.Key("webhook-method"), &d.Method, []string{"POST", "PUT"}).Changed() || changed
		})
	}
	return changed
}
func (a *App) notifyView(c *ui.Context) {
	ui.Scroll(c.Key("notify-content")).Grow(1).Width(840).MaxWidthPercent(100).AlignSelf(ui.Center).Padding(24).Gap(16).Children(func() {
		ui.Text(c, "由 Todo 服务发送到其他设备。本机系统通知可在设置中单独管理。").TextColor(c.Theme().TextMuted)
		ui.Column(c).Gap(10).Children(func() {
			ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
				label := "尚未读取渠道"
				if a.notifyLoaded {
					label = fmt.Sprintf("%d 个通知渠道", len(a.notifySettings))
				}
				ui.Text(c, label).FontSize(fontTitle).FontWeight(600)
				primaryButton(c, "添加通知渠道").AlignSelf(ui.Start).Disabled(a.busy || !a.notifyLoaded || len(a.notifyChoices()) == 0).OnClick(func() {
					a.notifyDraft = newNotifyDraft()
					a.notifyDraft.Channel = a.notifyChoices()[0]
					a.notifyEditing = true
					a.message, a.failure, a.notifyDraftResult = "", "", nil
				})
			})
			if a.notifyLoaded {
				ui.Row(c).Gap(8).Wrap().Children(func() {
					for _, choice := range a.notifyChoices() {
						display.Tag(c, choice, display.TagProps{Size: theme.Small})
					}
				})
				label := "默认渠道：尚未配置"
				for _, setting := range a.notifySettings {
					if setting.IsDefault {
						label = "默认渠道：" + settingTitle(setting)
					}
				}
				ui.Text(c, label).TextColor(c.Theme().TextMuted)
			}
		})
		if a.notifyLoaded && len(a.notifyChoices()) == 0 && len(a.notifySettings) > 0 {
			feedback.Alert(c, "服务器未启用可配置的通知方式", feedback.AlertProps{Type: feedback.Warning, Description: "请在服务端启用通知插件后刷新。"})
		}
		if !a.notifyLoaded {
			ui.Text(c, "尚未读取渠道，请点击刷新。")
		} else if len(a.notifySettings) == 0 {
			title, description := "尚未配置服务端通知渠道", "添加一个渠道，用于任务提醒和手动通知。首个渠道会自动成为默认渠道。"
			if len(a.notifyChoices()) == 0 {
				title, description = "服务器未启用通知方式", "请在服务端启用通知插件，再刷新此页面。"
			}
			appEmptyState(c, title, description, "", nil)
		}
		for _, setting := range a.notifySettings {
			ui.Column(c.Key(setting.ID)).Gap(8).Padding(12, 0).BorderWidth(0, 0, 1, 0).BorderColor(c.Theme().Border).Children(func() {
				configured := "未配置"
				if setting.Configured {
					configured = "已配置（凭据由服务端保管）"
				}
				preferenceRow(c, settingTitle(setting), configured, func() {
					if setting.IsDefault {
						display.Tag(c, "默认渠道", display.TagProps{Color: display.TagInfo, Size: theme.Small})
					}
					if !slices.Contains(a.notifyChannels, setting.Channel) {
						display.Tag(c, "服务端未启用", display.TagProps{Color: display.TagWarning, Size: theme.Small})
					}
					iconButton(c, fmt.Sprintf("测试渠道 #%d", setting.ID), lucide.Send()).Size(28, 28).Padding(6).Disabled(a.busy || !setting.Configured || !slices.Contains(a.notifyChannels, setting.Channel)).OnClick(func() { a.testNotify(setting.ID) })
					if !setting.IsDefault {
						appActionButton(c, "设为默认", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Label(fmt.Sprintf("设为默认渠道 #%d", setting.ID)).Disabled(a.busy).OnClick(func() {
							a.notifyAction("PATCH", fmt.Sprintf("/notify/settings/%d/default", setting.ID), nil, "已更改默认渠道", func() {
								for i := range a.notifySettings {
									a.notifySettings[i].IsDefault = a.notifySettings[i].ID == setting.ID
								}
								a.loadNotify()
							})
						})
					}
					holder := ui.Box(c.Key("notify-actions")).Shrink(0)
					open := ui.Local(holder, "open", func() bool { return false })
					holder.Children(func() {
						key := appDropdown(c, open, []overlay.MenuItem{{Key: "delete", Label: fmt.Sprintf("删除渠道 #%d", setting.ID), Danger: true, Disabled: a.busy}}, func(trigger ui.Element) {
							styleAppButton(c, trigger, "", "ghost").Label(fmt.Sprintf("更多渠道操作 #%d", setting.ID)).Tooltip("更多操作").Size(28, 28).Padding(6).Disabled(a.busy).Children(func() {
								ui.Icon(c, lucide.Ellipsis()).Size(15, 15).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
							})
						})
						if key == "delete" && !a.busy {
							copy := setting
							a.deleteNotify, a.failure = &copy, ""
						}
					})
				})
				if result, ok := a.notifyTestResults[setting.ID]; ok {
					a.notifyResultView(c, fmt.Sprintf("渠道 #%d", setting.ID), result)
				}
			})
		}
	})
}
func (a *App) notifyEditor(c *ui.Context) {
	ui.Modal(c, &a.notifyEditing, func() {
		ui.Text(c, "添加通知渠道").FontSize(fontTitle).FontWeight(600)
		ui.Text(c, "配置接收任务提醒的渠道，可先测试再保存。").TextColor(c.Theme().TextMuted)
		_, height := c.Size()
		reserved := float32(250)
		if a.failure != "" {
			reserved += 80
		}
		if a.notifyDraftResult != nil {
			reserved += 100
		}
		ui.Scroll(c.Key("notify-editor")).Height(max(140, min(380, height-reserved))).Gap(14).Disabled(a.busy).Children(func() {
			layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
				ui.Text(c, "渠道配置").Bold()
				if notifyConfigFields(c, &a.notifyDraft, a.notifyChoices()) {
					a.notifyDraftResult, a.message, a.failure = nil, "", ""
				}
			})
			layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Gap(10).Children(func() {
				ui.Checkbox(c, &a.notifyDraft.Default, "设为默认通知渠道")
				ui.Text(c, "首个渠道自动设为默认。凭据由服务端保管，不写入本机缓存；更换配置时请添加新渠道后再删除旧渠道。").FontSize(12).TextColor(c.Theme().TextMuted)
			})
		})
		if a.failure != "" {
			ui.Scroll(c.Key("notify-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		if a.notifyDraftResult != nil {
			ui.Scroll(c.Key("notify-draft-result")).MaxHeight(96).Children(func() { a.notifyResultView(c, "配置", *a.notifyDraftResult) })
		}
		ui.Row(c).Gap(8).Wrap().Children(func() {
			appActionButton(c, "测试填写的配置", action.ButtonProps{}).Disabled(a.busy).OnClick(a.testNotifyDraft)
			ui.Spacer(c)
			appActionButton(c, "取消渠道编辑", action.ButtonProps{}).Disabled(a.busy).OnClick(func() {
				a.notifyEditing = false
				a.notifyDraft = notifyDraft{}
				a.failure = ""
				a.notifyDraftResult = nil
			})
			appActionButton(c, "保存通知渠道", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.saveNotify)
		})
	}).Width(610).MaxWidthPercent(95)
	if !a.notifyEditing {
		a.notifyDraft = notifyDraft{}
		a.notifyDraftResult = nil
	}
	open := a.deleteNotify != nil
	ui.Modal(c, &open, func() {
		if a.deleteNotify == nil {
			return
		}
		setting := *a.deleteNotify
		ui.Text(c, "确认删除通知渠道？").FontSize(fontTitle).FontWeight(600)
		ui.Text(c, settingTitle(setting))
		feedback.Alert(c, "删除后无法再使用此渠道新建提醒", feedback.AlertProps{Type: feedback.Warning, Description: "删除默认渠道后，服务器会选择剩余渠道；已有手动提醒仍使用创建时保存的配置。"})
		if a.failure != "" {
			ui.Scroll(c.Key("notify-delete-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "保留渠道", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.deleteNotify = nil })
			appActionButton(c, "确认删除渠道", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
				a.notifyAction("DELETE", fmt.Sprintf("/notify/settings/%d", setting.ID), nil, "已删除通知渠道", func() {
					a.notifySettings = slices.DeleteFunc(a.notifySettings, func(s api.NotifySetting) bool { return s.ID == setting.ID })
					a.deleteNotify = nil
					delete(a.notifyTestResults, setting.ID)
					a.loadNotify()
				})
			})
		})
	}).Width(520).MaxWidthPercent(95)
	if !open && !a.busy {
		a.deleteNotify = nil
	}
}

func (a *App) notifyResultView(c *ui.Context, label string, result notifyTestResult) {
	description := result.At.In(a.location()).Format("2006-01-02 15:04:05")
	if result.Failure != "" {
		feedback.Alert(c, label+"测试失败", feedback.AlertProps{Type: feedback.Error, Description: description + " · " + result.Failure})
	} else {
		feedback.Alert(c, label+"测试成功", feedback.AlertProps{Type: feedback.Success, Description: description + " · 服务端已完成发送，请在接收端确认。"})
	}
}
