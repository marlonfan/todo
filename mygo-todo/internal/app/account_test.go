package app

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestAccountPreferencesPayloadAndTaskDefaults(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.session.User = api.User{Timezone: "Asia/Shanghai", DefaultTaskStartTime: "08:35", DefaultTimeGranularity: 30, DefaultNoonTime: "12:45", CalendarDefaultView: "timeGridWeek"}
	a.openAccountEditor("任务与日历偏好")
	p, err := a.accountDraft.preferencePayload()
	if err != nil || p["default_task_start_time"] != "08:35" || p["calendar_default_view"] != "timeGridWeek" || p["default_time_granularity"] != 30 {
		t.Fatal(p, err)
	}
	a.accountDraft.Start = "8:35"
	if _, err := a.accountDraft.preferencePayload(); err == nil {
		t.Fatal("accepted noncanonical clock")
	}
	a.accountDraft.Start = "08:35"
	a.accountDraft.Granularity = "25"
	if _, err := a.accountDraft.preferencePayload(); err == nil {
		t.Fatal("accepted unsupported granularity")
	}
	a.closeAccountEditor()
	a.page = "today"
	a.newTask()
	if a.draft.Start.Format("15:04") != "08:35" || !a.draft.HasStart || a.draft.End.Sub(a.draft.Start) != time.Hour {
		t.Fatal(a.draft)
	}
	a.client, _ = api.New(api.DefaultServer, "")
	tt := ui.NewTester(a.view, 900, 760)
	// Date & time shortcuts are directly exposed in the unified schedule popover.
	if err := tt.Click("编辑开始"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 8; i++ {
		node, _ := tt.AccessByRole(ui.RoleButton, "开始时间午间")
		popup, _ := tt.AccessByRole(ui.RolePopup, "属性选项")
		if !node.Offscreen && node.Bounds.Y+node.Bounds.H <= popup.Bounds.Y+popup.Bounds.H-8 {
			break
		}
		tt.Scroll(popup.Bounds.X+popup.Bounds.W-16, popup.Bounds.Y+popup.Bounds.H/2, 0, 160)
	}
	if err := tt.Click("开始时间午间"); err != nil {
		t.Fatal(err)
	}
	if a.draft.Start.Format("15:04") != "12:45" {
		t.Fatal(a.draft.Start)
	}
	if err := tt.Click("开始时间推迟一个步长"); err != nil {
		t.Fatal(err)
	}
	if a.draft.Start.Format("15:04") != "13:15" {
		t.Fatal(a.draft.Start)
	}
	// Explicit calendar slots and editing an existing task keep their own times.
	a.clearTaskSelection()
	a.newCalendarTask(time.Date(2026, 11, 10, 0, 0, 0, 0, a.location()), 14)
	if a.draft.Start.Hour() != 14 || a.draft.Start.Minute() != 0 {
		t.Fatal(a.draft.Start)
	}
	start := a.draft.Start.Add(17 * time.Minute)
	a.editTask(api.Task{ID: 4, StartTime: &start})
	if !a.draft.Start.Equal(start) {
		t.Fatal("editing applied default to existing task")
	}
}
func TestAccountPasswordsAreMaskedValidatedAndWiped(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "settings"
	tt := ui.NewTester(a.view, 900, 760)
	if err := tt.Click("修改密码"); err != nil {
		t.Fatal(err)
	}
	for _, label := range []string{"当前密码", "新密码", "确认新密码"} {
		if n, ok := tt.AccessByRole(ui.RoleTextField, label); !ok || !n.Password {
			t.Fatal(label)
		}
	}
	a.accountDraft.CurrentPassword = "secret-old"
	a.accountDraft.NewPassword = "secret-new"
	a.accountDraft.ConfirmPassword = "different"
	if err := tt.Click("确认修改密码"); err != nil {
		t.Fatal(err)
	}
	if !a.accountEditing || !tt.HasText("两次输入的新密码不一致") {
		t.Fatal(tt.Texts())
	}
	a.accountDraft.ConfirmPassword = "secret-new"
	if _, err := a.accountDraft.passwordPayload(); err != nil {
		t.Fatal(err)
	}
	a.accountDraft.NewPassword = strings.Repeat("密", 25)
	a.accountDraft.ConfirmPassword = a.accountDraft.NewPassword
	if _, err := a.accountDraft.passwordPayload(); err == nil {
		t.Fatal("bcrypt 72-byte bound not checked")
	}
	if err := tt.Click("取消账户编辑"); err != nil {
		t.Fatal(err)
	}
	if a.accountDraft.CurrentPassword != "" || a.accountDraft.NewPassword != "" {
		t.Fatal("cancel retained password")
	}
	a.openAccountEditor("修改密码")
	a.accountDraft.CurrentPassword = "must-wipe"
	a.closeAccountEditor()
	if a.accountEditing || a.accountDraft.CurrentPassword != "" {
		t.Fatal("close retained password")
	}
}
func TestThemePersistenceKeepsOtherPreferencesAndRejectsWriteFailure(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	enabled := false
	if err := store.SavePreferences(storage.Preferences{Theme: "dark", CalendarView: "周", LocalReminders: &enabled}); err != nil {
		t.Fatal(err)
	}
	a := New(store)
	defer a.Close()
	if a.theme != "深色" || a.calendarMode != 1 || a.localReminders {
		t.Fatal(a.preferences)
	}
	// Persistence failure must leave the saved theme selected, without modifying
	// the platform theme or replacing the other preferences.
	a.store.Dir = filepath.Join(store.Dir, "not-a-dir")
	os.WriteFile(a.store.Dir, []byte("x"), 0600)
	a.setTheme("浅色")
	if a.theme != "深色" || a.preferences.Theme != "dark" || a.failure == "" {
		t.Fatal(a.theme, a.preferences, a.failure)
	}
}
func TestAvatarLimitsNormalizationAndCredentialIsolation(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 640, 320))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	png.Encode(&buf, img)
	raw, preview, err := avatarDataURL(buf.Bytes())
	if err != nil || preview == nil {
		t.Fatal(err)
	}
	data, err := avatarBytes(context.Background(), raw)
	if err != nil {
		t.Fatal(err)
	}
	conf, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || conf.Width != 256 || conf.Height != 128 {
		t.Fatal(conf, err)
	}
	for _, bad := range [][]byte{[]byte("not-an-image"), make([]byte, avatarMaxBytes+1)} {
		if _, err := avatarBitmap(bad); err == nil {
			t.Fatal("bad image accepted")
		}
	}
	for _, bad := range []string{"file:///etc/passwd", "https://u:p@example.test/image", "javascript:alert(1)", "data:image/png;base64,%%%"} {
		if _, err := avatarBytes(context.Background(), bad); err == nil {
			t.Fatal(bad)
		}
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
			t.Error("avatar request leaked credentials")
		}
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/image", http.StatusFound)
			return
		}
		w.Write(buf.Bytes())
	}))
	defer server.Close()
	data, err = avatarBytes(context.Background(), server.URL+"/redirect")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := avatarBitmap(data); err != nil {
		t.Fatal(err)
	}
}
func TestSettingsTimezoneInvalidInputKeepsDraft(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "settings"
	a.profileTimezone = "Asia/Shanghai"
	tt := ui.NewTester(a.view, 900, 760)
	if _, ok := tt.AccessByRole(ui.RoleTextField, "时区"); ok {
		t.Fatal("timezone field should be hidden before editing")
	}
	tt.Scroll(700, 520, 0, 260)
	if err := tt.Click("编辑账户时区"); err != nil {
		t.Fatal(err)
	}
	a.profileTimezone, a.profileTimezoneDirty = "No/SuchZone", true
	tt.Frame()
	if err := tt.Click("保存账户时区"); err != nil {
		t.Fatal(err)
	}
	if a.profileTimezone != "No/SuchZone" || !tt.HasText("请输入有效时区，例如 Asia/Shanghai") {
		t.Fatal(tt.Texts())
	}
}

func TestNativeAccountEditorsKeepActionsAndSecretsAtMinimumWindow(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "settings"
	for _, section := range []struct{ title, save string }{{"修改密码", "确认修改密码"}, {"账户头像", "保存头像"}, {"任务与日历偏好", "保存任务偏好"}} {
		a.openAccountEditor(section.title)
		a.failure = strings.Repeat("连接已断开，未能保存。", 100)
		tt := ui.NewTester(a.view, 900, 600)
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			tt.Advance(time.Second)
			for _, label := range []string{"取消账户编辑", section.save} {
				n, ok := tt.AccessByRole(ui.RoleButton, label)
				if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
					t.Fatal("account action outside minimum window", section.title, label, n)
				}
			}
		}
		if section.title == "修改密码" {
			if err := tt.Click("当前密码"); err != nil {
				t.Fatal(err)
			}
			tt.Type("do-not-retain")
			if a.failure != "" {
				t.Fatal("changed password retained old error")
			}
		}
		if err := tt.Click("取消账户编辑"); err != nil {
			t.Fatal(err)
		}
		if a.accountEditing || a.accountDraft.CurrentPassword != "" || a.accountDraft.AvatarURL != "" {
			t.Fatal("cancel retained account draft")
		}
	}
}
