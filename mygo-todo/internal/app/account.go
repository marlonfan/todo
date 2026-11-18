package app

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
)

type accountDraft struct {
	PreferencesBase                               api.ProfilePreferences
	CurrentPassword, NewPassword, ConfirmPassword string
	AvatarURL                                     string
	AvatarPreview                                 *ui.Bitmap
	CalendarView, Granularity                     string
	Start, Noon, Afternoon, Evening               string
}

func accountCalendarMode(view string) int {
	switch view {
	case "timeGridWeek":
		return 1
	case "dayGridMonth":
		return 2
	default:
		return 0
	}
}
func clockOr(raw, fallback string) string {
	if _, err := time.Parse("15:04", raw); err != nil || len(raw) != 5 {
		return fallback
	}
	return raw
}
func taskGranularity(user api.User) int {
	switch user.DefaultTimeGranularity {
	case 5, 10, 15, 30, 60:
		return user.DefaultTimeGranularity
	}
	return 15
}
func (a *App) openAccountEditor(section string) {
	a.accountSection, a.accountEditing = section, true
	u := a.session.User
	a.accountDraft = accountDraft{AvatarURL: u.AvatarURL, AvatarPreview: a.avatar, CalendarView: calendarModes[accountCalendarMode(u.CalendarDefaultView)], Granularity: strconv.Itoa(taskGranularity(u)), Start: clockOr(u.DefaultTaskStartTime, "09:00"), Noon: clockOr(u.DefaultNoonTime, "12:00"), Afternoon: clockOr(u.DefaultAfternoonTime, "15:00"), Evening: clockOr(u.DefaultEveningTime, "20:00")}
	payload, _ := a.accountDraft.preferencePayload()
	a.accountDraft.PreferencesBase, _ = api.NewProfilePreferences(payload)
	a.failure = ""
}
func (a *App) closeAccountEditor() {
	a.accountEditing = false
	a.accountSection = ""
	a.accountDraft = accountDraft{}
}
func (d accountDraft) passwordPayload() (map[string]string, error) {
	if d.CurrentPassword == "" {
		return nil, errors.New("请输入当前密码")
	}
	if utf8.RuneCountInString(d.NewPassword) < 6 || len(d.NewPassword) > 72 {
		return nil, errors.New("新密码至少 6 个字符，且不超过 72 字节")
	}
	if d.NewPassword != d.ConfirmPassword {
		return nil, errors.New("两次输入的新密码不一致")
	}
	return map[string]string{"current_password": d.CurrentPassword, "new_password": d.NewPassword}, nil
}
func (d accountDraft) preferencePayload() (map[string]any, error) {
	views := map[string]string{"日": "timeGridDay", "周": "timeGridWeek", "月": "dayGridMonth"}
	view, ok := views[d.CalendarView]
	if !ok {
		return nil, errors.New("请选择日、周或月视图")
	}
	step, err := strconv.Atoi(d.Granularity)
	if err != nil || (step != 5 && step != 10 && step != 15 && step != 30 && step != 60) {
		return nil, errors.New("时间步长应为 5、10、15、30 或 60 分钟")
	}
	p := map[string]any{"calendar_default_view": view, "default_time_granularity": step}
	for _, v := range []struct{ key, label, value string }{{"default_task_start_time", "默认任务开始时间", d.Start}, {"default_noon_time", "午间快捷时间", d.Noon}, {"default_afternoon_time", "下午快捷时间", d.Afternoon}, {"default_evening_time", "晚间快捷时间", d.Evening}} {
		if _, err := time.Parse("15:04", v.value); err != nil || len(v.value) != 5 {
			return nil, fmt.Errorf("%s应为 HH:MM，例如 09:00", v.label)
		}
		p[v.key] = v.value
	}
	return p, nil
}

// Avatar changes are online operations. Adopt the acknowledged user even when writing
// the local session fails, so the UI never claims the server rolled back.
func (a *App) saveAccountProfile(payload map[string]any, message string, after func()) {
	if a.client == nil || a.busy {
		return
	}
	client, session := a.client, a.session
	a.run(func(ctx context.Context) (func(), error) {
		var user api.User
		if err := client.Do(ctx, "PATCH", "/auth/profile", payload, &user, 0); err != nil {
			return nil, err
		}
		if user.ID != session.User.ID {
			return nil, errors.New("服务端返回的账户不一致，请刷新账户资料")
		}
		session.User, session.Token = user, client.Token()
		saveErr := a.store.SaveSession(session)
		return func() {
			previous := a.session.User.Timezone
			a.session = session
			a.applyProfilePreferences()
			if !a.profileTimezoneDirty {
				a.profileTimezone = a.session.User.Timezone
			}
			if !a.profileReminderDirty {
				a.resetReminderProfile()
			}
			a.loadAvatar()
			a.updateReminders()
			if after != nil {
				after()
			}
			a.message = message
			if previous != a.session.User.Timezone {
				a.selectedDay = a.selectedDay.In(a.location())
				a.refresh()
			}
			if saveErr != nil {
				a.failure = "服务器已保存设置，但本地会话写入失败，请恢复本机存储后刷新：" + saveErr.Error()
			}
		}, nil
	})
}
func (a *App) saveTimezone() {
	zone := strings.TrimSpace(a.profileTimezone)
	if zone == "" {
		a.failure = "请输入有效时区，例如 Asia/Shanghai"
		return
	}
	if _, err := time.LoadLocation(zone); err != nil {
		a.failure = "请输入有效时区，例如 Asia/Shanghai"
		return
	}
	a.saveProfilePreferences(map[string]any{"timezone": zone}, func() { a.profileTimezoneDirty = false; a.profileTimezone = a.session.User.Timezone })
}
func (a *App) saveAccountPreferences() {
	p, err := a.accountDraft.preferencePayload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.saveProfilePreferences(p, func() {
		a.calendarMode = accountCalendarMode(a.session.User.CalendarDefaultView)
		a.focusCalendarWorkingHours()
		// Drop the local last-view override so this account default applies on restart.
		prefs := a.preferences
		prefs.CalendarView = ""
		if a.preferencesError == "" {
			if err := a.store.SavePreferences(prefs); err != nil {
				a.failure = "偏好已保存到本机，但日历视图未更新：" + err.Error()
			} else {
				a.preferences = prefs
			}
		}
		a.closeAccountEditor()
	}, a.accountDraft.PreferencesBase)
}
func (a *App) changePassword() {
	if a.client == nil || a.busy {
		return
	}
	p, err := a.accountDraft.passwordPayload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	client := a.client
	a.run(func(ctx context.Context) (func(), error) {
		if err := client.Do(ctx, "PATCH", "/auth/password", p, nil, 0); err != nil {
			return nil, fmt.Errorf("修改密码失败；请核对当前密码后重试。若连接中断，请先尝试用新密码登录确认结果：%w", err)
		}
		return func() { a.closeAccountEditor(); a.message = "密码已更新，下次登录请使用新密码" }, nil
	})
}
func themeLabel(value string) string {
	switch value {
	case "light":
		return "浅色"
	case "dark":
		return "深色"
	default:
		return "跟随系统"
	}
}
func themeSource(label string) mygo.ThemeSource {
	switch label {
	case "浅色":
		return mygo.ThemeLight
	case "深色":
		return mygo.ThemeDark
	default:
		return mygo.ThemeSystem
	}
}
func (a *App) setTheme(label string) {
	if a.preferencesError != "" {
		a.theme = themeLabel(a.preferences.Theme)
		a.failure = a.preferencesError
		return
	}
	prefs := a.preferences
	prefs.Theme = string(themeSource(label))
	if err := a.store.SavePreferences(prefs); err != nil {
		a.theme = themeLabel(a.preferences.Theme)
		a.failure = "无法保存外观偏好：" + err.Error()
		return
	}
	a.preferences, a.theme = prefs, label
	mygo.Theme.SetSource(themeSource(label))
}
func atClock(day time.Time, raw string) time.Time {
	t, _ := time.Parse("15:04", clockOr(raw, "09:00"))
	return time.Date(day.Year(), day.Month(), day.Day(), t.Hour(), t.Minute(), 0, 0, day.Location())
}

func (a *App) taskTimeShortcuts(c *ui.Context, label string, enabled bool, date *time.Time) {
	if !enabled || a.draft.AllDay {
		return
	}
	t := tokensOf(c)
	u := a.session.User
	pill := func(key, text, accessLabel string, onClick func()) {
		btn := ui.ButtonBase(c.Key(key)).Label(accessLabel).Tooltip(accessLabel).
			Height(24).Padding(0, 7).Radius(5).Background(t.BgSubtle).Center().Cursor(ui.CursorPointer).OnClick(onClick)
		if btn.Hovered() {
			btn.Background(t.BgHover)
		}
		btn.Children(func() {
			ui.Text(c, text).FontSize(11).FontFeatures("tnum").FontWeight(500).TextColor(t.TextSecondary)
		})
	}
	ui.Row(c.Key(label + "-quick")).Gap(4).Wrap().Children(func() {
		for _, v := range []struct{ label, clock string }{
			{"早间", clockOr(u.DefaultMorningTime, "09:00")},
			{"午间", clockOr(u.DefaultNoonTime, "12:00")},
			{"下午", clockOr(u.DefaultAfternoonTime, "15:00")},
			{"晚间", clockOr(u.DefaultEveningTime, "20:00")},
		} {
			slot := v
			pill("slot-"+slot.label, slot.clock, label+slot.label, func() { *date = atClock(*date, slot.clock) })
		}
		step := taskGranularity(u)
		pill("step-minus", fmt.Sprintf("−%dm", step), label+"提前一个步长", func() { *date = date.Add(-time.Duration(step) * time.Minute) })
		pill("step-plus", fmt.Sprintf("+%dm", step), label+"推迟一个步长", func() { *date = date.Add(time.Duration(step) * time.Minute) })
	})
}
