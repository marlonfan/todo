package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func (a *App) taskComparison(c *ui.Context, title string, task api.Task, full bool) {
	layout.Block(c, layout.BlockProps{Variant: layout.BlockFilled}).Gap(6).Padding(12).Children(func() {
		ui.Text(c, title).Bold()
		ui.Text(c, task.Title)
		if task.Description != "" {
			if full {
				ui.Text(c, task.Description)
			} else {
				value := []rune(task.Description)
				if len(value) > 160 {
					value = append(value[:160], []rune("…（展开完整版本查看）")...)
				}
				ui.Text(c, string(value))
			}
		}
		status := map[string]string{"pending": "待办", "completed": "已完成", "cancelled": "已取消", "skipped": "已跳过"}[task.Status]
		ui.Text(c, fmt.Sprintf("状态：%s · 优先级：%d", status, task.Priority)).TextColor(c.Theme().TextMuted)
		if !full {
			return
		}
		for _, field := range []struct {
			label string
			date  *time.Time
		}{{"开始", task.StartTime}, {"结束", task.EndTime}, {"截止", task.DueDate}, {"重复结束", task.RecurrenceEndDate}} {
			value := "未设置"
			if field.date != nil {
				value = field.date.In(a.location()).Format("2006-01-02 15:04")
			}
			ui.Text(c, field.label+"："+value).TextColor(c.Theme().TextMuted)
		}
		if task.AllDay {
			ui.Text(c, "全天")
		}
		names := []string{}
		for _, cat := range task.Categories {
			names = append(names, cat.Name)
		}
		categories := strings.Join(names, "、")
		if categories == "" {
			categories = "未设置"
		}
		ui.Text(c, "分类："+categories)
		reminder := map[string]string{"": "跟随账户", "inherit": "跟随账户", "none": "不提醒", "offset": "提前提醒"}[task.ReminderPolicy]
		if task.ReminderMinutesBefore != nil && task.ReminderPolicy == "offset" {
			reminder = fmt.Sprintf("提前 %d 分钟", *task.ReminderMinutesBefore)
		}
		ui.Text(c, "提醒："+reminder)
		if task.Recurring() {
			ui.Text(c, "重复规则："+string(task.RecurrenceRule)).FontSize(12)
		}
	})
}

func (a *App) syncView(c *ui.Context) {
	ui.Scroll(c).Grow(1).Width(840).MaxWidthPercent(100).AlignSelf(ui.Center).Padding(24).Gap(16).Children(func() {
		ui.Text(c, "先保存到本机，再同步到其他设备。编辑期间暂停自动刷新。").TextColor(c.Theme().TextMuted)
		ui.Column(c).Gap(10).Children(func() {
			ui.Row(c).Gap(12).Wrap().AlignItems(ui.Center).Children(func() {
				ui.Text(c, fmt.Sprintf("%d 条本地修改", a.pendingChanges())).FontSize(fontTitle).FontWeight(600)
				primaryButton(c, "立即同步").Disabled(a.busy).OnClick(a.refresh)
			})
			counts := map[string]int{}
			for _, op := range a.cache.CategoryOutbox {
				counts[op.State]++
			}
			if change := a.cache.ProfileChanges; change != nil {
				if change.Rejected {
					counts["rejected"]++
				} else {
					counts["pending"]++
				}
			}
			for _, op := range a.cache.Outbox {
				counts[op.State]++
			}
			ui.Row(c).Gap(8).Wrap().Children(func() {
				for _, status := range []struct {
					state, label string
					color        display.TagColor
				}{
					{"pending", "等待提交", display.TagProcessing}, {"conflict", "版本冲突", display.TagWarning}, {"rejected", "需要处理", display.TagError},
				} {
					if counts[status.state] > 0 {
						display.Tag(c, fmt.Sprintf("%s %d", status.label, counts[status.state]), display.TagProps{Color: status.color, Size: theme.Small})
					}
				}
			})
			last := "尚未完成首次同步"
			if !a.syncedAt.IsZero() {
				last = "最近同步：" + a.syncedAt.In(a.location()).Format("2006-01-02 15:04:05")
			}
			ui.Text(c, last+" · 每 15 秒自动同步").FontSize(12).TextColor(c.Theme().TextMuted)
		})
		if a.pendingChanges() == 0 {
			appEmptyState(c, "所有本地修改均已同步", "新的任务与账户偏好修改会先保存在本机，联网后自动提交。", "", nil)
		}
		a.profileSyncCard(c)
		a.categorySyncCards(c)
		blocked := map[int64]bool{}
		if a.reauthRequired {
			a.syncReauthentication(c)
		}
		for _, op := range a.cache.Outbox {
			card := layout.Block(c.Key(op.ID), layout.BlockProps{Variant: layout.BlockOutlined}).Gap(12).Padding(16)
			full := ui.Local(card, "full", func() bool { return false })
			card.Children(func() {
				label := map[string]string{"pending": "等待提交", "conflict": "版本冲突", "rejected": "需要处理"}[op.State]
				color := display.TagProcessing
				if op.State == "conflict" {
					color = display.TagWarning
				}
				if op.State == "rejected" {
					color = display.TagError
				}
				if op.State == "pending" && blocked[op.TaskID] {
					label, color = "等待前序修改处理", display.TagWarning
				}
				var dependencies struct {
					IDs []int64 `json:"category_ids"`
				}
				_ = json.Unmarshal(op.Body, &dependencies)
				for _, id := range dependencies.IDs {
					if id < 0 {
						label, color = "等待分类同步", display.TagWarning
						break
					}
				}
				ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
					ui.Text(c, mutationName(op)).Bold()
					display.Tag(c, label, display.TagProps{Color: color, Size: theme.Small})
				})
				ui.Text(c, op.Local.Title).FontSize(16).Bold()
				if !op.CreatedAt.IsZero() {
					ui.Text(c, "保存于本机："+op.CreatedAt.In(a.location()).Format("2006-01-02 15:04:05")).FontSize(12).TextColor(c.Theme().TextMuted)
				}
				var scope struct {
					InstanceID     string  `json:"instance_id"`
					OccurrenceDate string  `json:"occurrence_date"`
					Description    *string `json:"description"`
				}
				_ = json.Unmarshal(op.Body, &scope)
				if scope.InstanceID != "" {
					display.Tag(c, "仅 "+scope.OccurrenceDate+" 本次", display.TagProps{Size: theme.Small, Color: display.TagInfo})
				}
				if op.Suffix == "/occurrences/schedule" {
					var schedule struct {
						Start  time.Time  `json:"start_time"`
						End    *time.Time `json:"end_time"`
						AllDay bool       `json:"all_day"`
						Reset  bool       `json:"reset_schedule"`
					}
					_ = json.Unmarshal(op.Body, &schedule)
					ui.Text(c, "仅 "+scope.OccurrenceDate+" 本次时间").Bold()
					if schedule.Reset {
						ui.Text(c, "恢复本次的系列时间")
					} else {
						ui.Text(c, "开始："+schedule.Start.In(a.location()).Format("2006-01-02 15:04"))
						end := "未设置"
						if schedule.End != nil {
							end = schedule.End.In(a.location()).Format("2006-01-02 15:04")
						}
						ui.Text(c, "结束："+end)
						if schedule.AllDay {
							ui.Text(c, "全天")
						}
					}
				}
				if scope.InstanceID != "" && scope.Description != nil {
					ui.Text(c, "仅 "+scope.OccurrenceDate+" 本次描述").Bold()
					if *scope.Description == "" {
						ui.Text(c, "清空本次描述")
					} else {
						ui.Scroll(c).MaxHeight(120).Children(func() { ui.Text(c, *scope.Description) })
					}
				}
				if op.Suffix == "/status" {
					var fields struct {
						Status         string `json:"status"`
						InstanceID     string `json:"instance_id"`
						OccurrenceDate string `json:"occurrence_date"`
					}
					_ = json.Unmarshal(op.Body, &fields)
					label := map[string]string{"pending": "恢复待办", "completed": "完成", "cancelled": "取消", "skipped": "跳过"}[fields.Status]
					if fields.InstanceID != "" {
						label += " · 仅 " + fields.OccurrenceDate + " 本次"
					}
					ui.Text(c, label)
				}
				if op.Failure != "" {
					feedback.Alert(c, "此修改尚未提交", feedback.AlertProps{Type: feedback.Warning, Description: op.Failure})
				}
				if op.State == "conflict" && op.Latest != nil {
					ui.Text(c, "核对版本差异，再选择覆盖或放弃。").TextColor(c.Theme().TextMuted)
					ui.Row(c).Gap(8).Wrap().Children(func() {
						appActionButton(c, "用本地修改覆盖此版本", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
							a.changeOutbox(func(state storage.Cache) (storage.Cache, error) { return syncer.Resolve(state, op.ID) })
						})
						a.syncDiscardButton(c, op)
					})
					if op.Method == "DELETE" {
						feedback.Alert(c, "本地操作为删除整个任务", feedback.AlertProps{Type: feedback.Warning, Description: "覆盖后将删除服务器上的此任务。"})
					} else {
						ui.Text(c, "覆盖只提交这条本地操作；后续修改仍按顺序提交。").FontSize(12).TextColor(c.Theme().TextMuted)
					}
					label := "展开完整版本"
					if *full {
						label = "收起完整版本"
					}
					appActionButton(c, label, action.ButtonProps{Variant: action.Text, Size: theme.Small}).AlignSelf(ui.Start).OnClick(func() { *full = !*full })
					if fields := syncChangedFields(op); len(fields) > 0 {
						ui.Text(c, "差异字段："+strings.Join(fields, "、")).TextColor(c.Theme().TextMuted)
					}
					ui.Text(c, "简览显示标题、描述和状态；展开后核对时间、分类、提醒与重复规则。").FontSize(12).TextColor(c.Theme().TextMuted)
					a.taskComparison(c, "最初读取", op.Base, *full)
					if scope.InstanceID == "" {
						a.taskComparison(c, "本地修改", op.Local, *full)
					} else {
						ui.Text(c, "本地修改仅作用于上述本次实例；这里比较整个系列的背景信息。").TextColor(c.Theme().TextMuted)
					}
					a.taskComparison(c, "服务器最新", *op.Latest, *full)
				}
				if op.State == "rejected" {
					appActionButton(c, "重新尝试此修改", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
						a.changeOutbox(func(state storage.Cache) (storage.Cache, error) {
							state = syncer.Clone(state)
							for i := range state.Outbox {
								if state.Outbox[i].ID == op.ID {
									state.Outbox[i].State, state.Outbox[i].Failure = "pending", ""
								}
							}
							return state, nil
						})
					})
				}
				if op.State != "conflict" || op.Latest == nil {
					a.syncDiscardButton(c, op)
				}
			})
			if op.State != "pending" {
				blocked[op.TaskID] = true
			}
		}
	})
}

func (a *App) syncReauthentication(c *ui.Context) {
	layout.Block(c.Key("reauthentication"), layout.BlockProps{Variant: layout.BlockOutlined}).Gap(12).Padding(16).Children(func() {
		ui.Text(c, "重新验证当前账户").FontSize(16).Bold()
		if a.reauthRequired {
			feedback.Alert(c, "登录已失效，本地修改已保留", feedback.AlertProps{Type: feedback.Warning, Description: "验证当前账户后继续同步，不会清除本机队列。"})
		} else {
			ui.Text(c, "登录失效时在此验证，待同步内容会保留。").TextColor(c.Theme().TextMuted)
		}
		ui.Field(c, "当前账户密码", func() { ui.TextInput(c, &a.reauthPassword).Password().OnSubmit(a.reauthenticate).MaxWidth(360) })
		appActionButton(c, "验证并继续同步", action.ButtonProps{}).AlignSelf(ui.Start).Disabled(a.busy).OnClick(a.reauthenticate)
	})
}

func (a *App) syncDiscardButton(c *ui.Context, op storage.Mutation) {
	appActionButton(c, "放弃此任务全部待同步修改", action.ButtonProps{}).AlignSelf(ui.Start).Disabled(a.busy).OnClick(func() {
		id := op.TaskID
		a.discardSyncID = &id
	})
}

// Instance operations keep their intended changes in Body, not Local. Compare
// only series context for them, so the UI never invents an edited local series.
func syncChangedFields(op storage.Mutation) []string {
	if op.Latest == nil {
		return nil
	}
	versions := []api.Task{op.Base, *op.Latest}
	var scope struct {
		InstanceID string `json:"instance_id"`
	}
	_ = json.Unmarshal(op.Body, &scope)
	if scope.InstanceID == "" {
		versions = append(versions, op.Local)
	}
	values := []map[string]json.RawMessage{}
	for _, task := range versions {
		b, _ := json.Marshal(task)
		var fields map[string]json.RawMessage
		_ = json.Unmarshal(b, &fields)
		values = append(values, fields)
	}
	labels := []string{}
	for _, field := range []struct{ key, label string }{
		{"title", "标题"}, {"description", "描述"}, {"status", "状态"}, {"priority", "优先级"},
		{"start_time", "开始时间"}, {"end_time", "结束时间"}, {"due_date", "截止时间"}, {"all_day", "全天"},
		{"categories", "分类"}, {"reminder_policy", "提醒策略"}, {"reminder_minutes_before", "提前分钟数"},
		{"recurrence_rule", "重复规则"}, {"recurrence_end_date", "重复结束"},
	} {
		for _, v := range values[1:] {
			if string(v[field.key]) != string(values[0][field.key]) {
				labels = append(labels, field.label)
				break
			}
		}
	}
	return labels
}

func (a *App) syncConfirmation(c *ui.Context) {
	open := a.discardSyncID != nil
	ui.Modal(c, &open, func() {
		if a.discardSyncID == nil {
			return
		}
		id, count := *a.discardSyncID, 0
		for _, op := range a.cache.Outbox {
			if op.TaskID == id {
				count++
			}
		}
		ui.Text(c, "放弃此任务的本地修改？").FontSize(fontTitle).Bold()
		feedback.Alert(c, fmt.Sprintf("将移除这项任务的 %d 条待同步修改", count), feedback.AlertProps{Type: feedback.Warning, Description: "保留服务器上的版本。已送达服务器的操作不会撤销。"})
		ui.Row(c).Gap(10).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "保留本地修改", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.discardSyncID = nil })
			appActionButton(c, "确认放弃本地修改", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
				a.changeOutbox(func(state storage.Cache) (storage.Cache, error) { return syncer.Discard(state, id), nil })
			})
		})
	}).Width(500)
	if !open && !a.busy {
		a.discardSyncID = nil
	}
}
