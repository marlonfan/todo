package app

import (
	"os"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func TestProfileDiffKeepsUneditedFieldsAfterRefreshWhileDraftIsOpen(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.session.User = api.User{ID: 1, DefaultReminderEnabled: false, DefaultReminderMinutes: 5, DefaultMorningTime: "09:00", DefaultTaskStartTime: "09:00", DefaultNoonTime: "12:00"}
	a.resetReminderProfile()
	a.profileReminderEnabled, a.profileReminderDirty = true, true
	// A foreground profile read adopts newer remote values while preserving the
	// open dirty form. Unchanged form values must not become edits to these fields.
	a.session.User.DefaultReminderMinutes, a.session.User.DefaultMorningTime = 23, "08:30"
	payload, _ := reminderProfilePayload(a.profileReminderEnabled, a.profileReminderMinutes, a.profileMorningTime)
	values, err := changedProfilePreferences(payload, a.session.User, a.profileReminderBase)
	if err != nil || len(values) != 1 || string(values["default_reminder_enabled"]) != "true" {
		t.Fatal(values, err)
	}
	a.openAccountEditor("任务与日历偏好")
	a.accountDraft.Start = "08:35"
	a.session.User.DefaultNoonTime = "14:20"
	payload, _ = a.accountDraft.preferencePayload()
	values, err = changedProfilePreferences(payload, a.session.User, a.accountDraft.PreferencesBase)
	if err != nil || len(values) != 1 || string(values["default_task_start_time"]) != `"08:35"` {
		t.Fatal(values, err)
	}
}

func TestOfflineProfileRestoresDefaultsAndPreservesUnsavedDrafts(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	session := api.Session{Server: api.DefaultServer, Token: "cached", User: api.User{ID: 1, Timezone: "UTC", DefaultReminderMinutes: 5}}
	values, _ := api.NewProfilePreferences(map[string]any{"timezone": "Asia/Shanghai", "default_reminder_minutes": 17, "default_task_start_time": "08:35", "calendar_default_view": "timeGridWeek"})
	state, err := syncer.QueueProfile(storage.Cache{Server: session.Server, UserID: 1}, session.User, values)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	a := New(store)
	defer a.Close()
	if a.profileTimezone != "Asia/Shanghai" || a.profileReminderMinutes != "17" || a.calendarMode != 1 || a.pendingChanges() != 1 {
		t.Fatal(a.session.User, a.profileTimezone, a.profileReminderMinutes, a.calendarMode)
	}
	a.page = "today"
	a.newTask()
	if a.draft.Start.Format("15:04") != "08:35" || a.location().String() != "Asia/Shanghai" {
		t.Fatal(a.draft.Start, a.location())
	}
	a.profileTimezone, a.profileTimezoneDirty = "Europe/London", true
	a.profileReminderMinutes, a.profileReminderDirty = "23", true
	a.adoptCache(state)
	if a.profileTimezone != "Europe/London" || a.profileReminderMinutes != "23" {
		t.Fatal("background adoption overwrote drafts")
	}
	a.logout()
	if a.client == nil || a.failure == "" {
		t.Fatal("logout discarded pending profile")
	}
	if _, err := store.Session(); err != nil {
		t.Fatal(err)
	}
}

func TestProfilePendingNativeCardAndConfirmationInBothThemes(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	a := New(store)
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "cached")
	a.session.User = api.User{ID: 1, Timezone: "UTC"}
	values, _ := api.NewProfilePreferences(map[string]any{"timezone": "Europe/London", "default_reminder_enabled": false})
	a.cache.ProfileChanges = &storage.ProfileChanges{Values: values, Rejected: true, Failure: "服务端暂不接受此设置"}
	a.page = "sync"
	for _, dark := range []bool{false, true} {
		tt := ui.NewTester(a.view, 900, 600)
		tt.SetDark(dark)
		tt.Advance(time.Second)
		if tt.HasText("所有本地修改均已同步") || !tt.HasText("1 条本地修改") || !tt.HasText("时区：Europe/London") || !tt.HasText("账户默认提前提醒：关闭") {
			t.Fatal(tt.Texts())
		}
		tt.Scroll(500, 350, 0, 240)
		if err := tt.Click("放弃本机账户偏好"); err != nil {
			t.Fatal(err)
		}
		if !a.discardProfile || a.canApplyRemote() {
			t.Fatal("confirmation did not pause remote commits")
		}
		for _, label := range []string{"保留账户偏好", "确认放弃账户偏好"} {
			n, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok || n.Offscreen || n.Bounds.Y+n.Bounds.H > 600 {
				t.Fatal(label, n)
			}
		}
		if err := tt.Click("保留账户偏好"); err != nil {
			t.Fatal(err)
		}
		if a.discardProfile || a.cache.ProfileChanges == nil {
			t.Fatal("cancel discarded intent")
		}
	}
	if _, err := os.Stat(store.Dir); err != nil {
		t.Fatal(err)
	}
}
