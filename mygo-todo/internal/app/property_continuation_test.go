package app

import (
	"github.com/egoist/mygo/ui"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestPropertyDependentInputsStayReachable(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.draft = draftFrom(api.Task{Title: "属性草稿"}, time.Now())
	tt := ui.NewTester(func(c *ui.Context) { a.taskMetadata(c, &a.draft) }, 800, 1000)
	click := func(label string) {
		t.Helper()
		if err := tt.Click(label); err != nil {
			t.Fatal(err)
		}
	}
	// Two actions from the detail reach an editable offset; no reopen required.
	click("编辑提醒")
	click("提前提醒")
	if a.draft.Reminder != "提前提醒" {
		t.Fatal("selection feedback lost")
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "提前分钟"); !ok {
		t.Fatal("offset input unreachable after selection")
	}
	click("提前分钟")
	tt.Type("15")
	if a.draft.ReminderMinutes == "" {
		t.Fatal("offset input did not accept typing")
	}
	tt.Key(0, ui.KeyEscape)
	if _, open := tt.AccessByRole(ui.RolePopup, "属性选项"); open || !tt.Focused("编辑提醒") {
		t.Fatal("Escape must close and restore reminder trigger")
	}
	// Two actions from the detail reach repeat rule fields directly in the same session.
	click("编辑重复")
	click("每周")
	if a.draft.Repeat != "每周" {
		t.Fatal("repeat feedback lost")
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "重复次数"); !ok {
		t.Fatal("advanced count unreachable without reopening")
	}
	tt.Key(0, ui.KeyEscape)
	if !tt.Focused("编辑重复") {
		t.Fatal("repeat trigger focus not restored")
	}
	if len(a.cache.Outbox) != 0 {
		t.Fatal("new task properties must await creation")
	}
}

func TestPropertyDateCalendarImmediatelyReachable(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.draft = draftFrom(api.Task{Title: "日期草稿"}, time.Now())
	tt := ui.NewTester(func(c *ui.Context) { a.taskMetadata(c, &a.draft) }, 800, 900)
	if err := tt.Click("编辑开始"); err != nil {
		t.Fatal(err)
	}
	// Opening a calendar must not enable an unset date or enqueue a save.
	if a.draft.HasStart {
		t.Fatal("opening date panel enabled start")
	}
	if _, ok := tt.AccessByRole(ui.RoleTable, "选择开始时间"); !ok {
		t.Fatal("inline calendar missing on first open")
	}
	if err := tt.Click("明天"); err != nil {
		t.Fatal(err)
	}
	if !a.draft.HasStart {
		t.Fatal("date selection did not enable date")
	}
	if len(a.cache.Outbox) != 0 {
		t.Fatal("new task queued before confirmation")
	}
}
