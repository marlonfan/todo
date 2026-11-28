package app

import (
	"bytes"
	"context"
	"fmt"

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

func (a *App) pendingChanges() int {
	count := len(a.cache.Outbox) + len(a.cache.CategoryOutbox)
	if a.cache.ProfileChanges != nil {
		count++
	}
	return count
}

func (a *App) applyProfilePreferences() {
	if change := a.cache.ProfileChanges; change != nil && change.Values.Validate() == nil {
		a.session.User = change.Values.Apply(a.session.User)
	}
}

func changedProfilePreferences(payload map[string]any, user api.User, baseline api.ProfilePreferences) (api.ProfilePreferences, error) {
	values, err := api.NewProfilePreferences(payload)
	if err != nil {
		return nil, err
	}
	if baseline == nil {
		baseline = values.From(user)
	}
	for key, original := range baseline {
		if bytes.Equal(original, values[key]) {
			delete(values, key)
		}
	}
	return values, nil
}

func (a *App) saveProfilePreferences(payload map[string]any, after func(), baseline ...api.ProfilePreferences) {
	if a.busy || a.client == nil {
		return
	}
	if a.cacheError != "" {
		a.failure = a.cacheError
		return
	}
	var original api.ProfilePreferences
	if len(baseline) > 0 {
		original = baseline[0]
	}
	values, err := changedProfilePreferences(payload, a.session.User, original)
	if err != nil {
		a.failure = err.Error()
		return
	}
	// Only fields actually edited in this section go into the sparse PATCH.
	// In particular, saving reminders cannot submit an unsaved timezone draft.
	if len(values) == 0 {
		if after != nil {
			after()
		}
		a.message = "偏好未改变"
		return
	}
	state, err := syncer.QueueProfile(a.cache, a.session.User, values)
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.runScoped("profile.save", func(context.Context) (func(), error) {
		if err := a.store.SaveCache(state); err != nil {
			return nil, fmt.Errorf("无法保存账户偏好，请保留当前输入后重试：%w", err)
		}
		return func() {
			a.adoptCache(state)
			a.message = "账户偏好已保存到本机，等待同步"
			if after != nil {
				after()
			}
			a.refresh()
		}, nil
	})
}

func (a *App) retryProfilePreferences() {
	a.changeOutbox(func(state storage.Cache) (storage.Cache, error) {
		state = syncer.Clone(state)
		if state.ProfileChanges != nil {
			state.ProfileChanges.Rejected, state.ProfileChanges.Failure = false, ""
		}
		return state, nil
	})
}

func (a *App) discardProfilePreferences() {
	if a.busy || a.cache.ProfileChanges == nil {
		return
	}
	state := syncer.Clone(a.cache)
	base := state.ProfileChanges.Base
	state.ProfileChanges = nil
	a.runScoped("profile.discard", func(context.Context) (func(), error) {
		if err := a.store.SaveCache(state); err != nil {
			return nil, err
		}
		return func() {
			a.session.User = base.Apply(a.session.User)
			a.discardProfile = false
			a.adoptCache(state)
			if a.preferences.CalendarView == "" {
				a.calendarMode = accountCalendarMode(a.session.User.CalendarDefaultView)
				a.focusCalendarWorkingHours()
			}
			a.message = "已移除本机偏好队列；联网后读取账户实际设置"
			a.refresh()
		}, nil
	})
}

func (a *App) profilePendingNotice(c *ui.Context) {
	if a.cache.ProfileChanges == nil {
		return
	}
	feedback.Alert(c, "账户偏好待同步", feedback.AlertProps{Type: feedback.Info, Description: "已在本机生效，联网后自动提交。可在同步页面查看详情、重试或放弃。"})
	appActionButton(c, "查看偏好同步状态", action.ButtonProps{Variant: action.Text, Size: theme.Small}).AlignSelf(ui.Start).OnClick(func() { a.page = "sync" })
}

func (a *App) profileSyncCard(c *ui.Context) {
	change := a.cache.ProfileChanges
	if change == nil {
		return
	}
	layout.Block(c.Key("profile-pending"), layout.BlockProps{Variant: layout.BlockOutlined}).Padding(16).Gap(12).Children(func() {
		ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
			ui.Text(c, "账户偏好").FontSize(18).Bold()
			label, color := "等待提交", display.TagProcessing
			if change.Rejected {
				label, color = "需要处理", display.TagError
			}
			display.Tag(c, label, display.TagProps{Color: color, Size: theme.Small})
		})
		ui.Text(c, "这些设置已在本机生效；只同步以下改过的字段。").TextColor(c.Theme().TextMuted)
		for _, label := range change.Values.Labels() {
			ui.Text(c, label)
		}
		if change.Failure != "" {
			ui.Scroll(c).MaxHeight(110).Children(func() {
				feedback.Alert(c, "账户偏好尚未提交", feedback.AlertProps{Type: feedback.Warning, Description: change.Failure})
			})
		}
		ui.Row(c).Gap(8).Wrap().Children(func() {
			appActionButton(c, "重新同步账户偏好", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.retryProfilePreferences)
			appActionButton(c, "放弃本机账户偏好", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.discardProfile = true })
		})
	})
}

func (a *App) profileDiscardConfirmation(c *ui.Context) {
	open := a.discardProfile
	ui.Modal(c, &open, func() {
		ui.Text(c, "放弃本机账户偏好？").FontSize(fontTitle).Bold()
		feedback.Alert(c, "将移除待同步的账户偏好", feedback.AlertProps{Type: feedback.Warning, Description: "联网后重新读取账户实际设置。已送达服务器的设置不会撤销；任务修改仍然保留。"})
		ui.Row(c).Gap(8).Wrap().Justify(ui.End).Children(func() {
			appActionButton(c, "保留账户偏好", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.discardProfile = false })
			appActionButton(c, "确认放弃账户偏好", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(a.discardProfilePreferences)
		})
	}).Width(500).MaxWidthPercent(95)
	if !open && !a.busy {
		a.discardProfile = false
	}
}
