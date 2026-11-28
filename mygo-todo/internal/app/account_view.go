package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
)

func (a *App) accountEditor(c *ui.Context) {
	wasOpen := a.accountEditing
	ui.Modal(c, &a.accountEditing, func() {
		d := &a.accountDraft
		ui.Text(c, a.accountSection).FontSize(fontTitle).FontWeight(600)
		if a.accountSection == "任务与日历偏好" {
			ui.Text(c, "保存后在本机生效，联网后自动同步到账户。").TextColor(c.Theme().TextMuted)
		} else {
			ui.Text(c, "保存到账户，需要连接 Todo 服务。").TextColor(c.Theme().TextMuted)
		}
		_, height := c.Size()
		reserved := float32(250)
		if a.failure != "" {
			reserved += 80
		}
		changed := false
		ui.Scroll(c.Key("account-editor")).Height(max(140, min(440, height-reserved))).Gap(14).Disabled(a.busy).Children(func() {
			switch a.accountSection {
			case "修改密码":
				layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
					ui.Field(c, "当前密码", func() { changed = ui.TextInput(c, &d.CurrentPassword).Password().AutoFocus().Changed() || changed })
					ui.Field(c, "新密码", func() { changed = ui.TextInput(c, &d.NewPassword).Password().Changed() || changed }).Description("至少 6 个字符，不超过 72 字节")
					ui.Field(c, "确认新密码", func() { changed = ui.TextInput(c, &d.ConfirmPassword).Password().Changed() || changed })
				})
				ui.Text(c, "密码仅用于此次请求，不会保存到本机文件。取消或关闭窗口会清空输入。").FontSize(12).TextColor(c.Theme().TextMuted)
			case "账户头像":
				layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Padding(14).Gap(12).Children(func() {
					display.Avatar(c, a.session.User.Username, display.AvatarProps{Size: 72, Shape: display.AvatarCircle, Image: avatarImage(d.AvatarPreview), Fallback: display.AvatarText}).Label("头像预览")
					appActionButton(c, "选择本地图片", action.ButtonProps{}).AlignSelf(ui.Start).Disabled(a.busy).OnClick(a.chooseAvatar)
					ui.Text(c, "PNG、JPEG、GIF 或 WebP，最大 1 MB；本地图片缩小至 256 像素后同步到账户。").FontSize(12).TextColor(c.Theme().TextMuted)
				})
				layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
					ui.Field(c, "头像地址", func() {
						if ui.TextInput(c, &d.AvatarURL).Placeholder("https://… 或图片数据").Changed() {
							d.AvatarPreview = nil
							changed = true
						}
					}).Description("也可填写可公开读取的图片地址；保存前会检查图片。")
					appActionButton(c, "移除头像", action.ButtonProps{Variant: action.Text}).TextColor(c.Theme().Danger).AlignSelf(ui.Start).Disabled(a.busy).OnClick(func() { d.AvatarURL = ""; d.AvatarPreview = nil; a.saveAvatar() })
					ui.Text(c, "移除头像会立即保存到账户。").FontSize(12).TextColor(c.Theme().TextMuted)
				})
			case "任务与日历偏好":
				layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
					ui.Text(c, "日历与时间选择").Bold()
					ui.Field(c, "默认日历视图", func() { changed = ui.Select(c, &d.CalendarView, []string{"日", "周", "月"}).Changed() || changed }).Description("本机切换日历视图后会记住上次选择；重新保存默认值会重置该选择。")
					ui.Field(c, "时间步长（分钟）", func() {
						changed = ui.Select(c, &d.Granularity, []string{"5", "10", "15", "30", "60"}).Changed() || changed
					})
				})
				layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
					ui.Text(c, "新建任务与快捷时间").Bold()
					for _, field := range []struct {
						label string
						value *string
					}{{"默认任务开始时间", &d.Start}, {"午间快捷时间", &d.Noon}, {"下午快捷时间", &d.Afternoon}, {"晚间快捷时间", &d.Evening}} {
						ui.Field(c, field.label, func() { changed = ui.TextInput(c, field.value).Placeholder("HH:MM").Width(180).Changed() || changed })
					}
					ui.Text(c, "按账户时区解释。早间快捷时间沿用设置页中的「全天任务早间时间」。新建任务使用默认开始时间；日历时间槽保留点击时刻。").FontSize(12).TextColor(c.Theme().TextMuted)
				})
			}
		})
		if changed {
			a.failure = ""
		}
		if a.failure != "" {
			ui.Scroll(c.Key("account-editor-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			saving := a.isPending("account.profile") || a.isPending("account.password") || a.isPending("avatar.save") || a.isPending("profile.save") || a.busy
			appActionButton(c, "取消账户编辑", action.ButtonProps{}).Disabled(saving).OnClick(func() { a.closeAccountEditor(); a.failure = "" })
			switch a.accountSection {
			case "修改密码":
				lbl := "确认修改密码"
				if a.isPending("account.password") {
					lbl = "修改中…"
				}
				primaryButton(c, lbl).Disabled(saving).OnClick(a.changePassword)
			case "账户头像":
				lbl := "保存头像"
				if a.isPending("avatar.save") || a.isPending("account.profile") {
					lbl = "保存中…"
				}
				primaryButton(c, lbl).Disabled(saving).OnClick(a.saveAvatar)
			case "任务与日历偏好":
				lbl := "保存任务偏好"
				if a.isPending("profile.save") {
					lbl = "保存中…"
				}
				primaryButton(c, lbl).Disabled(saving).OnClick(a.saveAccountPreferences)
			}
		})
	}).Width(580).MaxWidthPercent(95)
	if wasOpen && !a.accountEditing && a.busy {
		a.accountEditing = true
	} else if wasOpen && !a.accountEditing {
		a.closeAccountEditor()
	}
}
