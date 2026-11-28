package app

import (
	"fmt"
	"strings"

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

func (a *App) caldavView(c *ui.Context) {
	ui.Scroll(c.Key("caldav-content")).Grow(1).MinHeight(0).Width(840).MaxWidthPercent(100).AlignSelf(ui.Center).Padding(24).Gap(18).Children(func() {
		ui.Text(c, "连接已有 CalDAV 日历，日程将以只读方式出现在 Todo 日历中。来源配置需要联网。您填写的地址必须能被 Todo 服务器访问。").FontSize(13).TextColor(c.Theme().TextMuted)
		ui.Column(c).Gap(10).Children(func() {
			ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
				ui.Text(c, "外部日历来源").FontSize(fontTitle).FontWeight(600)
				primaryButton(c, "添加 CalDAV 来源").Disabled(a.busy).OnClick(func() { a.editCaldav(api.CaldavSource{}) })
			})
			if a.caldavLoaded {
				active, selected := 0, 0
				for _, source := range a.caldavSources {
					if source.IsActive {
						active++
					}
					for _, calendar := range source.Calendars {
						if calendar.IsSelected {
							selected++
						}
					}
				}
				ui.Text(c, fmt.Sprintf("%d 个来源 · %d 个已启用 · %d 个已选日历", len(a.caldavSources), active, selected)).TextColor(c.Theme().TextMuted)
			}
			ui.Text(c, "同步在服务端后台执行，完成情况以最近同步时间和错误信息为准。").FontSize(12).TextColor(c.Theme().TextMuted)
		})
		if a.caldavNotice != "" {
			feedback.Alert(c, a.caldavNotice, feedback.AlertProps{Type: feedback.Info})
		}
		if len(a.caldavSources) == 0 {
			label := "尚未读取来源，请点击刷新。"
			if a.caldavLoaded {
				label = "还没有 CalDAV 来源，添加一个来源以导入外部日程。"
			}
			appDisplayEmpty(c, display.EmptyProps{Title: "尚无外部日历", Description: label}).Padding(16)
		}
		for _, source := range a.caldavSources {
			ui.Column(c.Key(source.ID)).Padding(12, 0).Gap(8).BorderWidth(0, 0, 1, 0).BorderColor(c.Theme().Border).Children(func() {
				status := "已暂停"
				if source.IsActive {
					status = "已启用"
				}
				preferenceRow(c, source.Name, source.BaseURL, func() {
					ui.Text(c, status).FontSize(12).TextColor(c.Theme().TextMuted)
					iconButton(c, "编辑来源 "+source.Name, lucide.Pencil()).Size(28, 28).Padding(6).Disabled(a.busy).OnClick(func() { a.editCaldav(source) })
					iconButton(c, "同步来源 "+source.Name, lucide.RefreshCw()).Size(28, 28).Padding(6).Disabled(a.isPending("caldav.sync") || a.busy || !source.IsActive).OnClick(func() { a.syncCaldav(source) })
					holder := ui.Box(c.Key("caldav-actions")).Shrink(0)
					open := ui.Local(holder, "open", func() bool { return false })
					holder.Children(func() {
						key := appDropdown(c, open, []overlay.MenuItem{{Key: "delete", Label: "删除来源 " + source.Name, Danger: true, Disabled: a.busy}}, func(trigger ui.Element) {
							styleAppButton(c, trigger, "", "ghost").Label("更多来源操作 "+source.Name).Tooltip("更多操作").Size(28, 28).Padding(6).Disabled(a.busy).Children(func() {
								ui.Icon(c, lucide.Ellipsis()).Size(15, 15).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
							})
						})
						if key == "delete" && !a.busy {
							copy := source
							a.deleteCaldav, a.failure = &copy, ""
						}
					})
				})
				lastSync := "尚未成功同步"
				if source.LastSyncAt != nil {
					lastSync = "最近同步：" + source.LastSyncAt.In(a.location()).Format("2006-01-02 15:04:05")
				}
				ui.Text(c, "用户名："+source.Username+" · "+lastSync).FontSize(12).TextColor(c.Theme().TextMuted)
				if source.LastError != "" {
					feedback.Alert(c, "同步错误："+source.LastError, feedback.AlertProps{Type: feedback.Error})
				}
				for _, calendar := range source.Calendars {
					name := calendar.DisplayName
					if name == "" {
						name = calendar.CalendarURL
					}
					if !calendar.IsSelected {
						name += "（未选择）"
					}
					ui.Text(c, "日历 · "+name).FontSize(12).TextColor(c.Theme().TextMuted).Tooltip(calendar.CalendarURL)
					if calendar.LastError != "" {
						feedback.Alert(c, "日历同步错误："+calendar.LastError, feedback.AlertProps{Type: feedback.Error})
					}
				}
			})
		}
		ui.Divider(c)
		ui.Text(c, "订阅与导出 Todo 日历").FontSize(fontTitle).FontWeight(600)
		ui.Text(c, "在其他日历应用中查看 Todo 任务，或保存为 ICS 文件。").FontSize(13).TextColor(c.Theme().TextMuted)
		if a.subscriptionFailure != "" {
			feedback.Alert(c, "无法读取订阅信息", feedback.AlertProps{Type: feedback.Error, Description: a.subscriptionFailure})
		}
		if sub := a.calendarSubscription; sub != nil {
			webcal := sub.ICSURL
			if _, tail, ok := strings.Cut(webcal, "://"); ok {
				webcal = "webcal://" + tail
			}
			icsCard := ui.Column(c.Key("ics-subscription")).Padding(12, 0).Gap(8).BorderWidth(0, 0, 1, 0).BorderColor(c.Theme().Border)
			icsOpen := ui.Local(icsCard, "expanded", func() bool { return false })
			icsCard.Children(func() {
				ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
					ui.Text(c, "ICS / Webcal 订阅").FontSize(14).Bold().Grow(1)
					appActionButton(c, "导出 ICS 文件", action.ButtonProps{Size: theme.Small}).Disabled(a.busy || sub.ICSURL == "").OnClick(a.exportCalendar)
					label := "显示订阅地址"
					if *icsOpen {
						label = "隐藏订阅地址"
					}
					appActionButton(c, label, action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { *icsOpen = !*icsOpen })
				})
				if *icsOpen {
					ui.Text(c, "订阅地址包含访问凭据，请只分享给可信的人。").FontSize(12).TextColor(c.Theme().TextMuted)
					a.subscriptionField(c, "ICS 订阅地址", sub.ICSURL)
					a.subscriptionField(c, "Webcal 地址", webcal)
				}
			})
			connectionCard := ui.Column(c.Key("caldav-subscription")).Padding(12, 0).Gap(8).BorderWidth(0, 0, 1, 0).BorderColor(c.Theme().Border)
			connectionOpen := ui.Local(connectionCard, "expanded", func() bool { return false })
			connectionCard.Children(func() {
				ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
					ui.Text(c, "CalDAV 连接信息").FontSize(14).Bold().Grow(1)
					label := "显示连接信息"
					if *connectionOpen {
						label = "隐藏连接信息"
					}
					appActionButton(c, label, action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { *connectionOpen = !*connectionOpen })
				})
				if *connectionOpen {
					ui.Text(c, "使用 Todo 用户名和密码登录，按日历应用的要求填写以下地址。").FontSize(12).TextColor(c.Theme().TextMuted)
					for _, field := range []struct{ label, value string }{
						{"CalDAV 日历地址", sub.CalDAVURL}, {"CalDAV 服务地址", sub.RootURL}, {"CalDAV 主体地址", sub.PrincipalURL}, {"CalDAV 日历目录", sub.HomeURL}, {"订阅用户名", sub.Username},
					} {
						a.subscriptionField(c, field.label, field.value)
					}
				}
			})
		}
	})
}

func (a *App) subscriptionField(c *ui.Context, label, value string) {
	ui.Column(c.Key(label)).Gap(4).Children(func() {
		ui.Text(c, label).FontSize(12).TextColor(c.Theme().TextMuted)
		ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
			ui.Text(c, value).SingleLine().Tooltip(value).MinWidth(0).Grow(1).FontSize(12)
			if a.caldavNotice == "已复制"+label+"。" {
				display.Tag(c, "已复制", display.TagProps{Color: display.TagSuccess, Size: theme.Small})
			}
			appActionButton(c, "复制", action.ButtonProps{Size: theme.Small}).Label("复制" + label).Disabled(a.busy || value == "").OnClick(func() {
				c.WriteClipboardThen(value, func(err error) {
					if err != nil {
						a.failure = "复制失败，请重试"
					} else {
						a.caldavNotice = "已复制" + label + "。"
					}
				})
			})
		})
	})
}

func (a *App) caldavEditor(c *ui.Context) {
	wasOpen := a.caldavEditing
	ui.Modal(c, &a.caldavEditing, func() {
		d := &a.caldavDraft
		title := "添加 CalDAV 来源"
		if d.ID != 0 {
			title = "编辑 CalDAV 来源"
		}
		ui.Text(c, title).FontSize(fontTitle).FontWeight(600)
		ui.Text(c, "填写连接信息，再发现并选择要导入的日历。").TextColor(c.Theme().TextMuted)
		_, height := c.Size()
		reserved := float32(250)
		if a.failure != "" {
			reserved += 80
		}
		ui.Scroll(c.Key("caldav-editor")).Height(max(140, min(440, height-reserved))).Gap(14).Disabled(a.busy).Children(func() {
			layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
				ui.Text(c, "连接信息").Bold()
				ui.Field(c, "来源名称", func() {
					if ui.TextInput(c, &d.Name).AutoFocus().Changed() {
						a.failure = ""
					}
				})
				ui.Field(c, "CalDAV 地址", func() {
					if ui.TextInput(c, &d.BaseURL).Placeholder("https://calendar.example.com/dav/").Changed() {
						a.failure = ""
					}
				})
				ui.Field(c, "CalDAV 用户名", func() {
					if ui.TextInput(c, &d.Username).Changed() {
						a.failure = ""
					}
				})
				passwordHint := "填写密码或应用专用密码"
				if d.ID != 0 {
					passwordHint = "留空以保留服务器已保存的密码"
				}
				ui.Field(c, "CalDAV 密码", func() {
					if ui.TextInput(c, &d.Password).Password().Placeholder(passwordHint).Changed() {
						a.failure = ""
					}
				}).Description(passwordHint)
				ui.Text(c, "密码由服务端加密保存，不写入本机缓存。").FontSize(12).TextColor(c.Theme().TextMuted)
			})
			layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Gap(12).Children(func() {
				if ui.Checkbox(c, &d.Active, "启用此来源").Changed() {
					a.failure = ""
				}
				ui.Text(c, "暂停后不再展示此来源的外部日程；重新启用会在服务端同步。").FontSize(12).TextColor(c.Theme().TextMuted)
				if len(d.Choices) == 0 {
					ui.Text(c, "尚未发现日历，请点击下方「发现日历」。").TextColor(c.Theme().TextMuted)
				} else {
					selected := 0
					for _, choice := range d.Choices {
						if choice.Selected {
							selected++
						}
					}
					ui.Text(c, fmt.Sprintf("选择要同步的日历 · 已选 %d / %d", selected, len(d.Choices))).Bold()
					if strings.TrimSpace(d.BaseURL) != d.DiscoveredURL || strings.TrimSpace(d.Username) != d.DiscoveredUsername {
						feedback.Alert(c, "连接已更改，请重新发现日历", feedback.AlertProps{Type: feedback.Warning, Description: "当前列表来自之前的连接，重新发现后再选择并保存。"})
					}
					ui.Row(c).Gap(8).Wrap().Children(func() {
						for _, option := range []struct {
							label    string
							selected bool
						}{{"全选日历", true}, {"清空选择", false}} {
							appActionButton(c, option.label, action.ButtonProps{Size: theme.Small}).Disabled(a.busy).OnClick(func() {
								a.failure = ""
								for i := range d.Choices {
									d.Choices[i].Selected = option.selected
								}
							})
						}
					})
					for i := range d.Choices {
						choice := &d.Choices[i]
						name := choice.Choice.DisplayName
						if name == "" {
							name = choice.Choice.CalendarURL
						}
						if ui.Checkbox(c.Key(choice.Choice.CalendarURL), &choice.Selected, name).Label("选择日历 " + name).Tooltip(choice.Choice.CalendarURL).Changed() {
							a.failure = ""
						}
					}
				}
			})
		})
		if a.isPending("caldav.discover") || a.isPending("caldav.write") || a.busy {
			ui.Text(c, "正在连接服务，请稍候…").FontSize(12).TextColor(c.Theme().TextMuted)
		}
		if a.failure != "" {
			ui.Scroll(c.Key("caldav-editor-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Wrap().Children(func() {
			pending := a.isPending("caldav.discover") || a.isPending("caldav.write") || a.busy
			discoverLabel := "发现日历"
			if a.isPending("caldav.discover") {
				discoverLabel = "发现中…"
			}
			saveLabel := "保存来源"
			if a.isPending("caldav.write") {
				saveLabel = "保存中…"
			}
			appActionButton(c, discoverLabel, action.ButtonProps{}).Disabled(pending).OnClick(a.discoverCaldav)
			ui.Spacer(c)
			appActionButton(c, "取消来源编辑", action.ButtonProps{}).Disabled(pending).OnClick(func() { a.caldavEditing = false; a.caldavDraft = caldavDraft{}; a.failure = "" })
			primaryButton(c, saveLabel).Disabled(pending).OnClick(a.saveCaldav)
		})
	}).Width(600).MaxWidthPercent(95)
	if wasOpen && !a.caldavEditing {
		if a.busy {
			a.caldavEditing = true
		} else {
			a.caldavDraft = caldavDraft{}
		}
	}
	open := a.deleteCaldav != nil
	ui.Modal(c, &open, func() {
		if a.deleteCaldav == nil {
			return
		}
		ui.Text(c, "删除 CalDAV 来源？").FontSize(fontTitle).FontWeight(600)
		ui.Text(c, a.deleteCaldav.Name)
		feedback.Alert(c, "外部服务器上的日历和日程不受影响", feedback.AlertProps{Type: feedback.Warning, Description: "将移除此来源及 Todo 中已缓存的外部日程。Todo 自有任务和待同步的修改会保留。"})
		if a.failure != "" {
			ui.Scroll(c.Key("caldav-delete-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "保留来源", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.deleteCaldav = nil })
			appActionButton(c, "确认删除来源", action.ButtonProps{}).TextColor(c.Theme().Danger).Disabled(a.busy).OnClick(func() { a.writeCaldav("DELETE", fmt.Sprintf("/caldav/sources/%d", a.deleteCaldav.ID), nil) })
		})
	}).Width(480).MaxWidthPercent(95)
	if !open && !a.busy {
		a.deleteCaldav = nil
	}
}
