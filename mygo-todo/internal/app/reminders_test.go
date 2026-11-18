package app

import (
	"encoding/json"
	"github.com/egoist/mygo/ui"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestReminderSettingsAreNativeAndValidate(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "提醒测试"}
	a.page = "settings"
	tt := ui.NewTester(a.view, 1280, 1100)
	if _, ok := tt.AccessByRole(ui.RoleSwitch, "在本机发送任务提醒"); !ok {
		t.Fatal("missing native local reminder switch")
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "默认提前分钟数"); ok {
		t.Fatal("reminder fields should be hidden before editing")
	}
	if err := tt.Click("编辑默认提醒"); err != nil {
		t.Fatal(err)
	}
	if _, ok := tt.AccessByRole(ui.RoleSwitch, "账户默认开启提前提醒"); !ok {
		t.Fatal("missing native account reminder switch")
	}
	a.profileReminderMinutes = "0"
	tt.Frame()
	if err := tt.Click("保存默认提醒"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("默认提前分钟数应为 1–10080 的整数") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("收起偏好编辑"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("编辑默认提醒"); err != nil {
		t.Fatal(err)
	}
	if a.profileReminderMinutes != "0" {
		t.Fatal("closing the editor lost the invalid reminder draft")
	}
	for _, raw := range []string{"25:00", "9:00", "09:60"} {
		if _, err := reminderProfilePayload(true, "5", raw); err == nil {
			t.Fatal(raw)
		}
	}
	if payload, err := reminderProfilePayload(true, "10080", "08:30"); err != nil || payload["default_morning_time"] != "08:30" {
		t.Fatal(payload, err)
	}
	// Persistence does not depend on platform notification authorization.
	a.preferences.LocalReminders = new(bool)
	if err := a.store.SavePreferences(a.preferences); err != nil {
		t.Fatal(err)
	}
	restarted := New(a.store)
	if restarted.localReminders {
		t.Fatal("local switch was not restored")
	}
}

func TestReminderClickTargetsFutureOverriddenOccurrence(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	series := api.Task{ID: 7, Title: "系列", Status: "pending", RecurrenceRule: json.RawMessage("{\"freq\":\"daily\"}")}
	event := api.CalendarEvent{Start: "2026-11-11T01:00:00Z", End: "2026-11-11T02:00:00Z", Title: "被改期的单次"}
	event.ExtendedProps.TaskID = 7
	event.ExtendedProps.InstanceID = "7_20261110"
	event.ExtendedProps.Status = "pending"
	a.adoptCache(storage.Cache{Server: "https://todo.test", UserID: 1, Tasks: []api.Task{series}, ReminderEvents: []api.CalendarEvent{event}})
	target, ok := a.reminderTarget(storage.ReminderRecord{TaskKey: "task:7", InstanceID: "7_20261110"})
	if !ok || target.InstanceID != "7_20261110" || target.OccurrenceDate != "2026-11-10" || target.StartTime.In(a.location()).Day() != 11 || target.Title != event.Title {
		t.Fatalf("wrong notification target: %+v", target)
	}
	if _, ok := a.reminderTarget(storage.ReminderRecord{TaskKey: "task:7", InstanceID: "7_20261112"}); ok {
		t.Fatal("missing occurrence opened entire series")
	}
	if target.StartTime.Equal(time.Time{}) {
		t.Fatal("missing instance start")
	}
}

func TestOpenReminderQueuesColdStartTargetBeforeWindowExists(t *testing.T) {
	a := &App{}
	a.OpenReminder("not-a-todo-reminder")
	if a.pendingReminder != "" {
		t.Fatalf("invalid notification was queued: %q", a.pendingReminder)
	}
	a.OpenReminder("todo-cold-start")
	if a.pendingReminder != "todo-cold-start" {
		t.Fatalf("pending reminder=%q", a.pendingReminder)
	}
}
