package app

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

func notificationStatus(status string) string {
	labels := map[string]string{"pending": "等待发送", "processing": "发送中", "sent": "已发送", "failed": "发送失败", "abandoned": "已停止重试"}
	if label := labels[status]; label != "" {
		return label
	}
	return status
}
func (a *App) taskCenterView(c *ui.Context) {
	open := a.taskCenter != nil
	appDialog(c, &open, func() {
		p := a.taskCenter
		if p == nil {
			return
		}
		t := tokensOf(c)
		ui.Text(c, "提醒与活动记录").FontSize(fontTitle).FontWeight(600).TextColor(t.TextPrimary)
		ui.Text(c, p.Task.Title).FontSize(fontTask).TextColor(t.TextSecondary)
		ui.Text(c, "显示服务器已保存的数据，不含尚未同步或编辑中的修改。").FontSize(12).TextColor(t.TextTertiary)
		if p.Task.Recurring() {
			ui.Text(c, "服务端提醒针对整个重复系列；此处不是单次实例提醒。").FontSize(12).TextColor(t.TextSecondary)
		}
		appSegmented(c, &p.Tab, []string{"服务端提醒", "活动记录"}, action.SegmentedProps{}).Disabled(a.busy || p.Editing)
		_, height := c.Size()
		reserved := float32(290)
		if p.Task.Recurring() {
			reserved += 36
		}
		if a.failure != "" {
			reserved += 80
		}
		ui.Scroll(c.Key(fmt.Sprintf("task-center-%d", p.Tab))).Height(max(120, min(420, height-reserved))).Gap(14).Children(func() {
			if !p.Loaded {
				ui.Text(c, "正在读取服务器数据…")
			}
			if p.Tab == 1 {
				a.taskActivities(c, p)
				return
			}
			if p.NotificationError != "" {
				feedback.Alert(c, "提醒读取失败", feedback.AlertProps{Type: feedback.Error, Description: p.NotificationError})
			}
			if p.SettingError != "" {
				feedback.Alert(c, "渠道读取失败", feedback.AlertProps{Type: feedback.Warning, Description: p.SettingError})
			}
			if p.Editing {
				a.manualReminderFields(c, p)
				return
			}
			ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
				appActionButton(c, "添加手动提醒", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy || !p.Loaded || p.NotificationError != "").OnClick(a.newManualReminder)
				if p.Loaded {
					display.Tag(c, fmt.Sprintf("%d 条提醒", len(p.Notifications)), display.TagProps{Size: theme.Small})
				}
			})
			if p.Loaded && p.NotificationError == "" && len(p.Notifications) == 0 {
				appDisplayEmpty(c, display.EmptyProps{Title: "此任务没有服务端提醒", Description: "添加手动提醒，或在任务编辑器中设置自动提醒策略。"})
			}
			for _, n := range p.Notifications {
				layout.Block(c.Key(n.ID), layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(10).Children(func() {
					source := "手动提醒"
					if n.Source == "default_auto" {
						source = "自动提醒"
					}
					ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
						ui.Text(c, fmt.Sprintf("%s #%d", source, n.ID)).Bold()
						display.Tag(c, notificationStatus(n.Status), display.TagProps{Color: notificationStatusColor(n.Status), Size: theme.Small})
					})
					ui.Text(c, n.NotifyAt.In(a.location()).Format("2006-01-02 15:04")+" · "+channelName(n.Channel))
					delivery := "使用创建时保存的渠道配置"
					if n.DeliveryMode == "current_default" {
						delivery = "发送时使用当前默认渠道"
					}
					ui.Text(c, delivery).FontSize(12).TextColor(c.Theme().TextMuted)
					if n.SentAt != nil {
						ui.Text(c, "发送时间："+n.SentAt.In(a.location()).Format("2006-01-02 15:04:05")).FontSize(12)
					}
					if n.Source != "manual" {
						ui.Text(c, "请在任务编辑器中调整自动提醒策略。").FontSize(12).TextColor(c.Theme().TextMuted)
						return
					}
					ui.Row(c).Gap(8).Wrap().Children(func() {
						appActionButton(c, fmt.Sprintf("改时提醒 #%d", n.ID), action.ButtonProps{}).Disabled(a.busy).OnClick(func() {
							p.Editing, p.EditID, p.At = true, n.ID, n.NotifyAt.In(a.location())
							p.OperationID, p.OperationBody = "", nil
						})
						appActionButton(c, fmt.Sprintf("删除提醒 #%d", n.ID), action.ButtonProps{Variant: action.Text}).TextColor(c.Theme().Danger).Disabled(a.busy).OnClick(func() { p.DeleteID = n.ID })
					})
					if p.DeleteID == n.ID {
						feedback.Alert(c, "确认删除此手动提醒？", feedback.AlertProps{Type: feedback.Warning})
						ui.Row(c).Gap(8).Wrap().Children(func() {
							appActionButton(c, "保留提醒", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { p.DeleteID = 0 })
							appActionButton(c, "确认删除提醒", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() { a.deleteManualReminder(n.ID) })
						})
					}
				})
			}
		})
		if a.failure != "" {
			ui.Scroll(c.Key("task-center-failure")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			if p.Editing {
				a.manualReminderActions(c, p)
			} else {
				refreshLbl := "刷新提醒与记录"
				if a.isPending("taskcenter.load") {
					refreshLbl = "加载中…"
				}
				appActionButton(c, refreshLbl, action.ButtonProps{}).Disabled(a.isPending("taskcenter.load") || a.busy).OnClick(a.loadTaskCenter)
			}
			appActionButton(c, "关闭提醒与记录", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.taskCenter = nil; a.failure = "" })
		})
	}).Width(710).MaxWidthPercent(95)
	if !open && !a.busy {
		a.taskCenter = nil
	}
}
func (a *App) manualReminderFields(c *ui.Context, p *taskCenter) {
	layout.Block(c.Key("manual-reminder-editor"), layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(14).Disabled(a.busy).Children(func() {
		label := "新建手动提醒"
		if p.EditID != 0 {
			label = "改时并重新排队"
		}
		ui.Text(c, label).Bold()
		ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
			appDatePickerField(c, &p.At, "服务端提醒日期", nil)
			ui.TimeInput(c, &p.At).Label("服务端提醒时刻")
		})
		ui.Text(c, "按账户时区 "+a.location().String()+" 保存，时间必须晚于现在。").FontSize(12).TextColor(c.Theme().TextMuted)
		if p.EditID == 0 {
			ui.Field(c, "提醒投递方式", func() { ui.Select(c, &p.Delivery, []string{"使用默认渠道", "指定配置"}) })
			if p.Delivery == "指定配置" {
				notifyConfigFields(c, &p.Config, a.notifyChoices())
			} else {
				label := "尚无默认渠道，请在侧栏通知渠道页面配置。"
				for _, s := range a.notifySettings {
					if s.IsDefault {
						label = "默认：" + settingTitle(s) + "；本次创建会保存该配置的快照。"
					}
				}
				ui.Text(c, label).TextColor(c.Theme().TextMuted)
			}
		} else {
			ui.Text(c, "保留此提醒原有渠道配置，已发送的提醒也会重新排队。").TextColor(c.Theme().TextMuted)
		}
	})
}

func (a *App) manualReminderActions(c *ui.Context, p *taskCenter) {
	appActionButton(c, "保存手动提醒", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.saveManualReminder)
	appActionButton(c, "取消提醒编辑", action.ButtonProps{}).Disabled(a.busy).OnClick(func() {
		p.Editing = false
		p.Config = notifyDraft{}
		p.OperationID, p.OperationBody = "", nil
		a.failure = ""
	})
}

func notificationStatusColor(status string) display.TagColor {
	switch status {
	case "sent":
		return display.TagSuccess
	case "failed", "abandoned":
		return display.TagError
	case "processing":
		return display.TagProcessing
	default:
		return display.TagColor("")
	}
}

var activityFields = map[string]string{"title": "标题", "description": "描述", "priority": "优先级", "status": "状态", "start_time": "开始时间", "end_time": "结束时间", "due_date": "截止日期", "all_day": "全天", "category_ids": "分类", "recurrence_rule": "重复规则", "recurrence_end_date": "重复结束日期", "reminder_policy": "提醒策略", "reminder_minutes_before": "提前分钟", "occurrence_date": "实例日期", "instance_id": "实例"}

func (a *App) activityValue(field string, raw json.RawMessage) string {
	if strings.HasPrefix(field, "caldav_occurrence:") && len(raw) > 0 && string(raw) != "null" {
		var value map[string]json.RawMessage
		if json.Unmarshal(raw, &value) == nil {
			return "标题 " + a.activityValue("title", value["title"]) + " · 状态 " + a.activityValue("status", value["status"]) + " · 开始 " + a.activityValue("start_time", value["start_time"]) + " · 结束 " + a.activityValue("end_time", value["end_time"]) + " · 全天 " + a.activityValue("all_day", value["all_day"]) + " · 描述 " + a.activityValue("description", value["description"])
		}
	}
	if strings.HasPrefix(field, "occurrence_schedule:") {
		var value map[string]json.RawMessage
		if json.Unmarshal(raw, &value) == nil {
			return "开始 " + a.activityValue("start_time", value["start_time"]) + " · 结束 " + a.activityValue("end_time", value["end_time"]) + " · 全天 " + a.activityValue("all_day", value["all_day"])
		}
	}
	if len(raw) == 0 || string(raw) == "null" {
		return "未设置"
	}
	var text string
	if json.Unmarshal(raw, &text) == nil {
		if text == "" {
			return "空"
		}
		if field == "status" {
			if label := map[string]string{"pending": "待办", "completed": "已完成", "cancelled": "已取消", "skipped": "已跳过"}[text]; label != "" {
				return label
			}
		}
		if field == "reminder_policy" {
			if label := map[string]string{"inherit": "跟随账户", "none": "不提醒", "offset": "提前提醒"}[text]; label != "" {
				return label
			}
		}
		if value, err := time.Parse(time.RFC3339Nano, text); err == nil {
			return value.In(a.location()).Format("2006-01-02 15:04:05")
		}
		return text
	}
	if field == "all_day" {
		if string(raw) == "true" {
			return "是"
		}
		return "否"
	}
	if field == "priority" {
		if label := map[string]string{"-1": "低", "0": "普通", "1": "高"}[string(raw)]; label != "" {
			return label
		}
	}
	if field == "category_ids" {
		var ids []int64
		if json.Unmarshal(raw, &ids) == nil {
			if len(ids) == 0 {
				return "无分类"
			}
			var names []string
			for _, id := range ids {
				name := "#" + strconv.FormatInt(id, 10)
				for _, cat := range a.categories {
					if cat.ID == id {
						name = cat.Name
						break
					}
				}
				names = append(names, name)
			}
			return strings.Join(names, "、")
		}
	}
	if field == "recurrence_rule" {
		d := recurrenceDraft(raw)
		if d.Frequency != "" {
			parts := []string{d.Frequency, "间隔 " + d.Interval}
			if d.Weekdays != "" {
				parts = append(parts, d.Weekdays)
			}
			if d.Dates != "" {
				parts = append(parts, "日期 "+d.Dates)
			}
			if d.Months != "" {
				parts = append(parts, "月份 "+d.Months)
			}
			if d.Frequency == "农历每年" {
				parts = append(parts, d.LunarMonth+"月"+d.LunarDay+"日")
				if d.LunarLeap {
					parts = append(parts, "优先闰月")
				}
			}
			if d.Count != "0" {
				parts = append(parts, "共 "+d.Count+" 次")
			}
			return strings.Join(parts, " · ")
		}
	}
	return string(raw)
}
func (a *App) taskActivities(c *ui.Context, p *taskCenter) {
	if p.ActivityError != "" {
		feedback.Alert(c, "活动读取失败", feedback.AlertProps{Type: feedback.Error, Description: p.ActivityError})
	}
	if p.Loaded && p.ActivityError == "" && len(p.Activities) == 0 {
		appDisplayEmpty(c, display.EmptyProps{Title: "暂无活动记录", Description: "任务保存到服务器后，变更记录会显示在这里。"})
	}
	for _, activity := range p.Activities {
		layout.Block(c.Key(activity.ID), layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
			source := activity.SubmitSource
			if source == "mygo-native" {
				source = "原生客户端"
			}
			if source == "caldav" {
				source = "CalDAV"
			}
			if source == "" {
				source = "其他客户端"
			}
			ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
				ui.Text(c, activity.OccurredAt.In(a.location()).Format("2006-01-02 15:04:05")).Bold()
				display.Tag(c, source, display.TagProps{Size: theme.Small})
			})
			fields := make([]string, 0, len(activity.Changes))
			for field := range activity.Changes {
				fields = append(fields, field)
			}
			slices.Sort(fields)
			for _, field := range fields {
				change := activity.Changes[field]
				label := activityFields[field]
				if strings.HasPrefix(field, "occurrence_schedule:") {
					label = "仅 " + strings.TrimPrefix(field, "occurrence_schedule:") + " 本次时间"
				}
				if strings.HasPrefix(field, "caldav_occurrence:") {
					label = "仅 " + strings.TrimPrefix(field, "caldav_occurrence:") + " 本次日程（CalDAV）"
				}
				if label == "" {
					label = field
				}
				layout.Block(c.Key(field), layout.BlockProps{Variant: layout.BlockFilled}).Padding(12).Gap(6).Children(func() {
					ui.Text(c, label).Bold()
					ui.Text(c, "原值："+a.activityValue(field, change.From)).TextColor(c.Theme().TextMuted)
					ui.Text(c, "新值："+a.activityValue(field, change.To))
				})
			}
		})
	}
	if len(p.Activities) >= p.ActivityLimit {
		if p.ActivityLimit < 500 {
			appActionButton(c, "读取最近 500 条活动", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { p.ActivityLimit = 500; a.loadTaskCenter() })
		} else {
			ui.Text(c, "仅显示最近 500 条；当前服务不提供更早记录的分页。").FontSize(12)
		}
	}
}
