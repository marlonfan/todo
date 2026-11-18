package app

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
	"todo-native/internal/reminders"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

// ReminderDelivery is replaced only in the e2e-tagged executable with an isolated sink.
var ReminderDelivery reminders.Deliver = func(ctx context.Context, candidate reminders.Candidate) error {
	if !mygo.NotificationsSupported() {
		return errors.New("请使用打包后的原生应用以启用系统通知")
	}
	n := mygo.NewNotification(mygo.NotificationOptions{ID: candidate.ID, Group: "todo-local-reminders", Title: candidate.Title, Subtitle: candidate.Start.Format("01月02日 15:04"), Body: candidate.Body})
	n.OnClick(func() { n.Close() })
	if err := n.ShowContext(ctx); err != nil {
		if errors.Is(err, mygo.ErrNotificationsDenied) {
			return errors.New("系统通知权限未开启，请在系统设置中允许 Todo Native 发送通知")
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return errors.New("等待系统通知授权超时")
		}
		if errors.Is(err, context.Canceled) {
			return errors.New("任务或提醒设置已变更，本次发送已撤销")
		}
		return errors.New("系统暂时无法接收通知，请检查系统通知设置")
	}
	return nil
}

func (a *App) startReminders() {
	ctx, cancel := context.WithCancel(context.Background())
	a.stopReminders = cancel
	a.reminderRunner = reminders.New(a.store, ReminderDelivery, func(status reminders.Status) {
		if a.win == nil || a.win.IsDestroyed() {
			return
		}
		mygo.RunOnMain(func() {
			if a.win == nil || a.win.IsDestroyed() {
				return
			}
			if status.Scope == reminders.Scope(a.session.Server, a.session.User.ID) && status != a.reminderStatus {
				a.reminderStatus = status
				a.win.Invalidate()
			}
		})
	})
	a.updateReminders()
	go a.reminderRunner.Run(ctx)
}

func (a *App) updateReminders() {
	if a.reminderRunner == nil {
		return
	}
	a.reminderRunner.Update(reminders.Input{Server: a.session.Server, User: a.session.User, Cache: syncer.Clone(a.cache), Enabled: a.client != nil && a.localReminders && a.preferencesError == "" && a.cacheError == ""})
}

func (a *App) setLocalReminders(enabled bool) {
	if a.preferencesError != "" {
		a.failure = a.preferencesError
		return
	}
	prefs := a.preferences
	prefs.LocalReminders = &enabled
	if err := a.store.SavePreferences(prefs); err != nil {
		a.failure = "无法保存本机提醒偏好：" + err.Error()
		return
	}
	a.preferences, a.localReminders = prefs, enabled
	a.updateReminders()
	if !enabled {
		mygo.ClearNotifications()
	}
}

func (a *App) resetReminderProfile() {
	a.profileReminderEnabled = a.session.User.DefaultReminderEnabled
	minutes := a.session.User.DefaultReminderMinutes
	if minutes <= 0 {
		minutes = 5
	}
	a.profileReminderMinutes = strconv.Itoa(minutes)
	a.profileMorningTime = a.session.User.DefaultMorningTime
	if a.profileMorningTime == "" {
		a.profileMorningTime = "09:00"
	}
	a.profileReminderDirty = false
	payload, _ := reminderProfilePayload(a.profileReminderEnabled, a.profileReminderMinutes, a.profileMorningTime)
	a.profileReminderBase, _ = api.NewProfilePreferences(payload)
}

func reminderProfilePayload(enabled bool, rawMinutes, morning string) (map[string]any, error) {
	minutes, err := strconv.Atoi(rawMinutes)
	if err != nil || minutes < 1 || minutes > 10080 {
		return nil, errors.New("默认提前分钟数应为 1–10080 的整数")
	}
	if _, err := time.Parse("15:04", morning); err != nil || len(morning) != 5 {
		return nil, errors.New("全天提醒时间应为 HH:MM，例如 09:00")
	}
	return map[string]any{"default_reminder_enabled": enabled, "default_reminder_minutes": minutes, "default_morning_time": morning}, nil
}

func (a *App) saveReminderProfile() {
	payload, err := reminderProfilePayload(a.profileReminderEnabled, a.profileReminderMinutes, a.profileMorningTime)
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.saveProfilePreferences(payload, a.resetReminderProfile, a.profileReminderBase)
}

// Registered before App.Run, so clicks can also reopen a terminated app.
// Persisted targets are scoped to the currently signed-in server and account.
func (a *App) OpenReminder(id string) {
	if !strings.HasPrefix(id, "todo-") {
		return
	}
	a.Show()
	if a.win == nil {
		a.pendingReminder = id
		return
	}
	a.win.Update(func() {
		if a.client == nil {
			return
		}
		ledger, err := a.store.ReminderLedger()
		if err != nil {
			a.failure = "无法读取通知对应的任务，请从任务列表打开"
			return
		}
		record, ok := ledger.Records[id]
		if !ok || record.Scope != reminders.Scope(a.session.Server, a.session.User.ID) {
			a.message = "这条通知属于其他账户或已过期"
			return
		}
		if a.busy {
			a.pendingReminder = id
			a.message = "同步结束后将打开通知对应的任务"
			return
		}
		if a.aiPanel != nil || a.aiConfigDraft != nil || a.aiPromptDraft != nil || a.aiDelete != nil || a.accountEditing || a.editing || a.categoryEditing || a.notifyEditing || a.deleteNotify != nil || a.taskCenter != nil || a.selectedOccurrence != nil || a.deleteTask != nil || a.deleteCategory != nil || a.discardSyncID != nil {
			a.message = "请先结束当前操作，再点击通知打开任务"
			return
		}
		if task, ok := a.reminderTarget(record); ok {
			a.openTask(task)
			return
		}
		a.message = "此通知对应的任务或实例已删除或尚未缓存，请刷新任务列表"
	})
}

func (a *App) openPendingReminder() {
	if a.win == nil || a.busy || a.pendingReminder == "" {
		return
	}
	id := a.pendingReminder
	a.pendingReminder = ""
	a.OpenReminder(id)
}

func (a *App) reminderTarget(record storage.ReminderRecord) (api.Task, bool) {
	for _, task := range projectTasks(a.tasks, a.nextOccurrences, a.history.Items) {
		if reminders.TaskKey(a.cache, task.ID) == record.TaskKey && task.InstanceID == record.InstanceID {
			return task, true
		}
	}
	view := syncer.View(a.cache)
	for _, task := range a.tasks {
		if reminders.TaskKey(a.cache, task.ID) != record.TaskKey {
			continue
		}
		if record.InstanceID == "" {
			return task, true
		}
		// Calendar instances may be later than the earliest overdue list row.
		for _, event := range view.ReminderEvents {
			props := event.ExtendedProps
			if props.TaskID != task.ID || props.InstanceID != record.InstanceID {
				continue
			}
			datePart, valid := strings.CutPrefix(record.InstanceID, fmt.Sprintf("%d_", task.ID))
			date, err := time.Parse("20060102", datePart)
			if !valid || err != nil {
				continue
			}
			start, err := eventDate(event.Start, a.location())
			if err != nil {
				continue
			}
			task.InstanceID, task.OccurrenceDate = record.InstanceID, date.Format("2006-01-02")
			task.StartTime, task.DueDate, task.EndTime = &start, nil, nil
			if end, err := eventDate(event.End, a.location()); err == nil {
				task.EndTime = &end
			}
			task.Title, task.Description, task.AllDay = event.Title, props.Description, event.AllDay
			if props.Status != "" {
				task.Status = props.Status
			}
			return task, true
		}
	}
	return api.Task{}, false
}

func (a *App) reminderSettingsView(c *ui.Context) {
	settingsSection(c, "local-reminders", 12, func() {
		settingsHeading(c, "本机任务提醒", "仅本机 · 即时保存")
		enabled := a.localReminders
		ui.Checkbox(c, &enabled, "在本机发送任务提醒").Disabled(a.preferencesError != "").OnChange(func() { a.setLocalReminders(enabled) })
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
		ui.Text(c, "关闭窗口后继续提醒；退出应用后停止。离线使用已缓存日程，重新打开时仅补发最近 15 分钟的提醒。").FontSize(12).TextColor(c.Theme().TextMuted)
	})
	settingsSection(c, "account-reminders", 12, func() {
		settingsHeading(c, "账户默认提醒", "保存到账户")
		if a.profileReminderDirty {
			display.Tag(c, "默认提醒尚未保存", display.TagProps{Color: display.TagWarning, Size: theme.Small})
		}
		ui.Checkbox(c, &a.profileReminderEnabled, "账户默认开启提前提醒").Disabled(a.busy).OnChange(func() { a.profileReminderDirty = true; a.failure = "" })
		ui.Field(c, "默认提前分钟数", func() {
			ui.TextInput(c, &a.profileReminderMinutes).Width(180).Disabled(a.busy).OnChange(func() { a.profileReminderDirty = true; a.failure = "" })
		}).Description("1–10080 分钟")
		ui.Field(c, "全天任务早间时间", func() {
			ui.TextInput(c, &a.profileMorningTime).Width(180).Disabled(a.busy).OnChange(func() { a.profileReminderDirty = true; a.failure = "" })
		}).Description("按账户时区计算，再减去提前分钟数；任务可单独选择不提醒或自定义提前量。")
		appActionButton(c, "保存默认提醒", action.ButtonProps{}).AlignSelf(ui.Start).Disabled(a.busy).OnClick(a.saveReminderProfile)
		ui.Text(c, "账户默认设置会同步至其他客户端；本机开关仅影响当前设备。离线编辑重复系列后，联网同步前暂缓该系列提醒。").FontSize(12).TextColor(c.Theme().TextMuted)
	})
}
