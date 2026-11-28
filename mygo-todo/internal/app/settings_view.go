package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

func settingsSection(c *ui.Context, key string, gap float32, children func()) {
	ui.Column(c.Key(key)).Padding(16, 4, 20, 4).Gap(gap).
		BorderWidth(0, 0, 1, 0).BorderColor(tokensOf(c).BorderSubtle).Children(children)
}

func settingsHeading(c *ui.Context, title, scope string) {
	ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
		ui.Text(c, title).FontSize(13).FontWeight(600).TextColor(tokensOf(c).TextPrimary)
		ui.Text(c, scope).FontSize(11).TextColor(tokensOf(c).TextSecondary)
	})
}

func (a *App) settingsView(c *ui.Context) {
	ui.Scroll(c.Key("settings-content")).Grow(1).MinHeight(0).Padding(24, 24, 52, 24).Children(func() {
		ui.Row(c).Justify(ui.Center).Children(func() {
			ui.Column(c).Width(800).MaxWidthPercent(100).Gap(16).Children(func() {
				ui.Text(c, "账户设置在客户端之间同步；本机偏好只影响当前设备。").FontSize(12).TextColor(c.Theme().TextMuted)
				ui.Column(c.Key("settings-destinations")).Gap(4).Children(func() {
					settingsHeading(c, "连接与服务", "工作空间")
					for _, destination := range []struct{ id, title, description string }{
						{"sync", "同步", "本地修改、冲突与同步状态"},
						{"caldav", "CalDAV 与订阅", "外部日历、订阅及导出"},
						{"notify", "通知渠道", "服务端提醒投递方式"},
						{"ai", "AI 与提示词", "提示词、问答与 AI 配置"},
					} {
						preferenceLink(c.Key(destination.id), destination.title, destination.description, "打开"+destination.title, false, func() { a.changePage(destination.id) })
					}
				})
				a.profilePendingNotice(c)
				settingsSection(c, "account", 14, func() {
					settingsHeading(c, "账户资料", "保存到账户")
					ui.Row(c).Gap(14).AlignItems(ui.Center).Children(func() {
						display.Avatar(c, a.session.User.Username, display.AvatarProps{Size: 52, Shape: display.AvatarCircle, Image: avatarImage(a.avatar), Fallback: display.AvatarText}).Label("设置页账户头像")
						ui.Column(c).MinWidth(0).Grow(1).Gap(4).Children(func() {
							ui.Text(c, a.session.User.Username).Bold()
							ui.Text(c, a.session.User.Email).TextColor(c.Theme().TextMuted)
							ui.Text(c, a.session.Server).FontSize(12).TextColor(c.Theme().TextMuted)
						})
					})
					for _, section := range []string{"账户头像", "修改密码", "任务与日历偏好"} {
						value := ""
						if section == "任务与日历偏好" {
							value = fmt.Sprintf("默认%s视图 · %d 分钟步长", calendarModes[accountCalendarMode(a.session.User.CalendarDefaultView)], taskGranularity(a.session.User))
						}
						preferenceLink(c.Key(section), section, value, section, a.busy, func() { a.openAccountEditor(section) })
					}
					if a.avatarFailure != "" {
						feedback.Alert(c, "无法加载头像", feedback.AlertProps{Type: feedback.Warning, Description: a.avatarFailure})
						appActionButton(c, "重新加载头像", action.ButtonProps{}).AlignSelf(ui.Start).Disabled(a.busy).OnClick(func() { a.avatarSource = ""; a.loadAvatar() })
					}
					ui.Text(c, "头像和密码修改需要联网；时区、提醒及任务偏好可离线保存，联网后自动同步。").FontSize(12).TextColor(c.Theme().TextMuted)
				})
				a.dateAndReminderPreferences(c)
				settingsSection(c, "appearance", 12, func() {
					settingsHeading(c, "外观", "仅本机 · 即时保存")
					preferenceRow(c, "主题", "立即应用并记住选择", func() {
						preferenceChoice(c, "外观", a.theme, []string{"跟随系统", "浅色", "深色"}, a.preferencesError != "", a.setTheme)
					})
				})
				settingsSection(c, "desktop", 12, func() {
					settingsHeading(c, "桌面运行", "仅本机 · 即时生效")
					ui.Column(c.Key("desktop-capabilities")).Gap(4).Children(func() {
						ui.Text(c, desktopCapabilitySummary(a)).FontSize(12).TextColor(c.Theme().TextMuted)
						if !a.trayAvailable {
							ui.Text(c, "当前平台未提供托盘，关闭窗口会直接退出应用。").FontSize(12).TextColor(c.Theme().TextMuted)
						}
					})
					preferenceRow(c, "顶部状态栏显示", "在 macOS 菜单栏图标旁实时展示待办信息，点击图标展开快捷面板", func() {
						preferenceChoice(c, "顶部状态栏显示", trayTitleModeLabel(a.trayTitleMode), []string{"下一项任务", "今日数量", "仅图标"}, a.preferencesError != "", a.setTrayTitleMode)
					})
					startup := a.openAtLogin
					preferenceRow(c, "开机时启动", "登录系统后打开 Todo", func() {
						ui.Switch(c, &startup).Label("开机时启动").Disabled(!a.packaged || a.busy).OnChange(func() {
							if err := mygo.App.SetOpenAtLogin(startup); err != nil {
								a.failure = "设置开机启动失败：" + err.Error()
							} else {
								a.openAtLogin = startup
							}
						})
					})
					if !a.packaged {
						ui.Text(c, "开机启动需要使用打包后的应用。").FontSize(12).TextColor(c.Theme().TextMuted)
					}
					ui.Text(c, "关闭窗口后的行为取决于平台托盘支持；退出应用会停止本地提醒。").FontSize(12).TextColor(c.Theme().TextMuted)
					appButton(c, "发送测试通知", "secondary").AlignSelf(ui.Start).Disabled(a.isPending("settings.notify.test") || a.busy || !a.notificationsAvailable).OnClick(a.testSystemNotification)
				})
				settingsSection(c, "about", 12, func() {
					ui.Text(c, "Todo 0.1.39").Bold()
					ui.Text(c, "Todo · 专注每一个下一步").TextColor(c.Theme().TextMuted)
					ui.Text(c, "退出登录前需先处理待同步的任务与账户偏好。").FontSize(12).TextColor(c.Theme().TextMuted)
					appButton(c, "退出登录", "destructive").AlignSelf(ui.Start).Disabled(a.busy).OnClick(a.logout)
				})
			})
		})
	})
}

func (a *App) dateAndReminderPreferences(c *ui.Context) {
	holder := ui.Column(c.Key("date-reminder-preferences"))
	panel := ui.Local(holder, "panel", func() string {
		if a.profileTimezoneDirty {
			return "timezone"
		}
		return ""
	})
	holder.Children(func() {
		settingsSection(c, "account-dates", 4, func() {
			settingsHeading(c, "日期与提醒", "保存到账户")
			zone := a.profileTimezone
			if a.profileTimezoneDirty {
				zone += " · 尚未保存"
			}
			preferenceLink(c.Key("timezone"), "时区", zone, "编辑账户时区", a.busy, func() { *panel = "timezone" })
			summary := "已关闭"
			if a.profileReminderEnabled {
				summary = "提前 " + a.profileReminderMinutes + " 分钟 · 早间 " + a.profileMorningTime
			}
			if a.profileReminderDirty {
				summary += " · 尚未保存"
			}
			preferenceLink(c.Key("reminders"), "账户默认提醒", summary, "编辑默认提醒", a.busy, func() { *panel = "reminders" })
		})
		settingsSection(c, "local-reminders", 6, func() {
			settingsHeading(c, "本机任务提醒", "仅本机 · 即时保存")
			enabled := a.localReminders
			preferenceRow(c, "在本机发送任务提醒", "退出应用后停止；离线使用已缓存日程", func() {
				ui.Switch(c, &enabled).Label("在本机发送任务提醒").Disabled(a.preferencesError != "").OnChange(func() { a.setLocalReminders(enabled) })
			})
			if a.preferencesError != "" {
				feedback.Alert(c, a.preferencesError, feedback.AlertProps{Type: feedback.Error})
			}
			if a.reminderStatus.Message != "" {
				message := fmt.Sprintf("%s · 待提醒 %d 条", a.reminderStatus.Message, a.reminderStatus.Pending)
				if a.reminderStatus.Failed {
					feedback.Alert(c, message, feedback.AlertProps{Type: feedback.Warning})
				} else {
					ui.Text(c, message).FontSize(12).TextColor(c.Theme().TextMuted)
				}
			}
		})
	})
	open := *panel != ""
	appDialog(c.Key("preference-editor"), &open, func() {
		title := "账户默认提醒"
		if *panel == "timezone" {
			title = "日期与时区"
		}
		ui.Text(c, title).FontSize(fontTitle).FontWeight(600)
		if *panel == "timezone" && a.profileTimezoneDirty {
			display.Tag(c, "时区尚未保存", display.TagProps{Color: display.TagWarning, Size: theme.Small})
		} else if *panel == "reminders" && a.profileReminderDirty {
			display.Tag(c, "默认提醒尚未保存", display.TagProps{Color: display.TagWarning, Size: theme.Small})
		}
		ui.Text(c, "保存后同步到账户").FontSize(12).TextColor(c.Theme().TextMuted)
		_, height := c.Size()
		ui.Scroll(c.Key("preference-fields")).MaxHeight(max(120, height-280)).Gap(12).Disabled(a.busy).Children(func() {
			if *panel == "timezone" {
				ui.Field(c, "时区", func() {
					appInput(c, &a.profileTimezone, "时区").AutoFocus().OnChange(func() { a.profileTimezoneDirty = true; a.failure = "" })
				}).Description("例如 Asia/Shanghai；任务筛选与日程均按账户时区显示。")
			} else {
				preferenceRow(c, "账户默认开启提前提醒", "任务可单独覆盖账户默认值", func() {
					ui.Switch(c, &a.profileReminderEnabled).Label("账户默认开启提前提醒").OnChange(func() { a.profileReminderDirty = true; a.failure = "" })
				})
				ui.Field(c, "默认提前分钟数", func() {
					appInput(c, &a.profileReminderMinutes, "默认提前分钟数").OnChange(func() { a.profileReminderDirty = true; a.failure = "" })
				}).Description("1–10080 分钟")
				ui.Field(c, "全天任务早间时间", func() {
					appInput(c, &a.profileMorningTime, "全天任务早间时间").Placeholder("HH:MM").OnChange(func() { a.profileReminderDirty = true; a.failure = "" })
				}).Description("按账户时区计算，再减去提前分钟数。")
			}
		})
		if a.failure != "" {
			ui.Scroll(c.Key("preference-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Justify(ui.End).Children(func() {
			appButton(c, "收起", "secondary").Label("收起偏好编辑").Disabled(a.busy).OnClick(func() { *panel = "" })
			if *panel == "timezone" {
				primaryButton(c, "保存账户时区").Disabled(a.busy).OnClick(a.saveTimezone)
			} else {
				primaryButton(c, "保存默认提醒").Disabled(a.busy).OnClick(a.saveReminderProfile)
			}
		})
	}).Width(480).MaxWidthPercent(95)
	if !open && !a.busy {
		*panel = ""
	}
}

func (a *App) testSystemNotification() {
	a.runScoped("settings.notify.test", func(ctx context.Context) (func(), error) {
		ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		if !a.notificationsAvailable || !mygo.NotificationsSupported() {
			return nil, errors.New("当前运行环境不支持系统通知，请使用对应平台的打包应用")
		}
		n := mygo.NewNotification(mygo.NotificationOptions{Title: "Todo Native", Body: "原生系统通知已连接。"})
		n.OnClick(a.Show)
		err := n.ShowContext(ctx)
		return func() { a.message = "测试通知已交给系统" }, err
	})
}
