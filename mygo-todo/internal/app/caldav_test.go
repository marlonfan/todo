package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func TestCaldavDraftDiscoverySelectionAndBlankPassword(t *testing.T) {
	choices := []api.CaldavChoice{{CalendarURL: "https://calendar.example.test/work/", DisplayName: "工作"}, {CalendarURL: "https://calendar.example.test/private/", DisplayName: "个人"}}
	d := caldavDraft{Name: "测试", BaseURL: "https://calendar.example.test/dav/", Username: "user", Password: "secret", Active: true}
	r, err := d.connection()
	if err != nil {
		t.Fatal(err)
	}
	d.discovered(append(choices, choices[0]), r)
	if len(d.Choices) != 2 || !d.Choices[0].Selected || !d.Choices[1].Selected {
		t.Fatal(d.Choices)
	}
	d.Choices[0].Selected, d.Choices[1].Selected = false, false
	d.discovered(choices, r)
	if _, err := d.payload(); err == nil {
		t.Fatal("deselect-all was silently reset")
	}
	d.Choices[0].Selected = true
	p, err := d.payload()
	if err != nil || len(p.Calendars) != 1 || p.Password != "secret" {
		t.Fatal(p, err)
	}
	d.ID, d.Password = 5, ""
	if p, err = d.payload(); err != nil || p.Password != "" || !p.IsActive {
		t.Fatal(p, err)
	}
	d.BaseURL = "https://other.example.test/dav/"
	if _, err := d.payload(); err == nil {
		t.Fatal("stale calendar selection accepted after endpoint change")
	}
	d = draftCaldav(api.CaldavSource{ID: 5, BaseURL: r.BaseURL, Username: r.Username, IsActive: false, Calendars: []api.CaldavCalendar{{CalendarURL: choices[0].CalendarURL, IsSelected: true}}})
	if d.Active || d.Password != "" || !d.Choices[0].Selected {
		t.Fatal(d)
	}
	for _, invalid := range []caldavDraft{
		{BaseURL: "file:///tmp/calendar", Username: "u", Password: "p"},
		{BaseURL: "https://u:p@example.test/", Username: "u", Password: "p"},
		{BaseURL: r.BaseURL, Username: "u"},
		{BaseURL: r.BaseURL, Password: "p"},
	} {
		if _, err := invalid.connection(); err == nil {
			t.Fatal("invalid connection accepted")
		}
	}
}

func TestCaldavInvalidationPreservesQueuedTasksAndRecurringEvents(t *testing.T) {
	state, _ := calendarFixture()
	external := api.CalendarEvent{ID: "external"}
	external.ExtendedProps.ReadOnly = true
	state.Calendar.Events = append(state.Calendar.Events, external)
	state.ReminderEvents = append(state.ReminderEvents, state.Calendar.Events...)
	var err error
	state, err = syncer.Enqueue(state, "POST", "/tasks", map[string]string{"title": "离线任务"}, 0)
	if err != nil {
		t.Fatal(err)
	}
	updated := invalidateExternalCalendars(state)
	if len(updated.Outbox) != 1 || updated.Outbox[0].ID != state.Outbox[0].ID || len(updated.Calendar.Events) != 1 || len(updated.ReminderEvents) != 1 || !updated.Calendar.SavedAt.IsZero() {
		t.Fatal("external invalidation discarded local work", updated)
	}
	if len(state.Calendar.Events) != 2 || state.Calendar.SavedAt.IsZero() {
		t.Fatal("canonical input was mutated")
	}
}

func TestNativeCaldavEditorAndSubscriptionCopy(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page, a.caldavLoaded = "caldav", true
	a.caldavSources = []api.CaldavSource{{ID: 3, Name: "日历来源", BaseURL: "https://calendar.example.test/dav/", Username: "user", IsActive: false, LastError: "认证失败", Calendars: []api.CaldavCalendar{{CalendarURL: "https://calendar.example.test/work/", DisplayName: "工作", IsSelected: true}}}}
	a.calendarSubscription = &api.CalendarSubscription{ICSURL: "http://127.0.0.1:8080/feeds/calendar/token.ics", Username: "user"}
	tt := ui.NewTester(a.view, 900, 760)
	for i := 0; i < 4; i++ {
		if err := clickNavigation(tt, "日历"); err != nil {
			t.Fatal(err)
		}
		if err := clickNavigation(tt, "设置"); err != nil {
			t.Fatal(err)
		}
		if err := tt.Click("打开CalDAV 与订阅"); err != nil {
			t.Fatal(err)
		}
		if a.page != "caldav" || a.calendarMode != 2 {
			t.Fatal("calendar and CalDAV reused interactive state", a.page, a.calendarMode)
		}
	}
	if !tt.HasText("已暂停") || !tt.HasText("同步错误：认证失败") {
		t.Fatal(tt.Texts())
	}
	tt.Scroll(700, 450, 0, 280)
	if _, ok := tt.AccessByRole(ui.RoleButton, "复制ICS 订阅地址"); ok {
		t.Fatal("subscription token was visible before expanding")
	}
	if err := tt.Click("显示订阅地址"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("复制ICS 订阅地址"); err != nil {
		t.Fatal(err)
	}
	if tt.Clipboard() != a.calendarSubscription.ICSURL {
		t.Fatalf("wrong subscription copied: got %q, page=%s mode=%d notice=%s texts=%v", tt.Clipboard(), a.page, a.calendarMode, a.caldavNotice, tt.Texts())
	}
	if err := tt.Click("隐藏订阅地址"); err != nil {
		t.Fatal(err)
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "复制ICS 订阅地址"); ok {
		t.Fatal("subscription token stayed visible after collapsing")
	}
	tt.Scroll(700, 450, 0, -700)
	if err := tt.Click("编辑来源 日历来源"); err != nil {
		t.Fatal(err)
	}
	if a.caldavDraft.Password != "" || a.caldavDraft.Active {
		t.Fatal("edit changed credentials or enabled paused source")
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "CalDAV 密码"); !ok {
		t.Fatal("missing native password field")
	}
	a.caldavDraft.Password = "sensitive"
	if err := tt.Click("取消来源编辑"); err != nil {
		t.Fatal(err)
	}
	if a.caldavDraft.Password != "" {
		t.Fatal("cancel retained password")
	}
	if _, ok := tt.AccessByRole(ui.RoleMenuItem, "删除来源 日历来源"); ok {
		t.Fatal("delete should be inside the closed source menu")
	}
	if err := tt.Click("更多来源操作 日历来源"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("删除来源 日历来源"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("外部服务器上的日历和日程不受影响") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("保留来源"); err != nil || a.deleteCaldav != nil {
		t.Fatal(err)
	}
}

func TestCalendarFileExportPreservesChosenPath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "日历")
	data := []byte("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")
	if err := saveCalendarFile(path, data); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(path)
	if err != nil || string(got) != string(data) {
		t.Fatal(string(got), err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Fatal("temporary export files leaked", entries)
	}
	if err := saveCalendarFile(filepath.Join(dir, "missing", "x.ics"), data); err == nil {
		t.Fatal("failed write reported success")
	}
}

func TestNativeCaldavLongEditorKeepsActionsAndValidatesSelection(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.editCaldav(api.CaldavSource{ID: 4, Name: "多日历来源", BaseURL: "https://calendar.example.test/dav/", Username: "user", IsActive: true})
	a.caldavDraft.Password = "do-not-retain"
	for i := 0; i < 40; i++ {
		a.caldavDraft.Choices = append(a.caldavDraft.Choices, caldavSelection{Choice: api.CaldavChoice{CalendarURL: fmt.Sprintf("https://calendar.example.test/%d/", i), DisplayName: fmt.Sprintf("工作日历 %d", i)}, Selected: true})
	}
	a.failure = strings.Repeat("远端服务暂时不可用。", 100)
	tt := ui.NewTester(a.view, 900, 600)
	assertActions := func(labels ...string) {
		t.Helper()
		for _, label := range labels {
			n, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
				t.Fatal("CalDAV action outside minimum window", label, n)
			}
		}
	}
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		tt.Advance(time.Second)
		assertActions("发现日历", "取消来源编辑", "保存来源")
	}
	secret, ok := tt.AccessByRole(ui.RoleTextField, "CalDAV 密码")
	if !ok || !secret.Password {
		t.Fatal("missing native password input")
	}
	if err := tt.Click("来源名称"); err != nil {
		t.Fatal(err)
	}
	tt.Type("更新")
	if a.failure != "" {
		t.Fatal("changed draft retained stale error", a.failure)
	}
	tt.Frame()
	tt.Scroll(500, 300, 0, 450)
	if err := tt.Click("清空选择"); err != nil {
		t.Fatal(err)
	}
	for _, choice := range a.caldavDraft.Choices {
		if choice.Selected {
			t.Fatal("clear left a selected calendar")
		}
	}
	if err := tt.Click("保存来源"); err != nil {
		t.Fatal(err)
	}
	if a.failure != "请至少选择一个日历" || !a.caldavEditing {
		t.Fatal(a.failure)
	}
	// Restoring the window content height can shift the scroll position.
	a.failure = ""
	tt.Frame()
	if err := tt.Click("全选日历"); err != nil {
		t.Fatal(err)
	}
	for _, choice := range a.caldavDraft.Choices {
		if !choice.Selected {
			t.Fatal("select all skipped a calendar")
		}
	}
	a.caldavDraft.BaseURL = "https://other.example.test/dav/"
	tt.Frame()
	if !tt.HasText("连接已更改，请重新发现日历") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("保存来源"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(a.failure, "请重新发现日历") || !a.caldavEditing || a.caldavDraft.Password == "" {
		t.Fatal("stale discovery was accepted or draft lost", a.failure)
	}
	assertActions("发现日历", "取消来源编辑", "保存来源")
	if err := tt.Click("取消来源编辑"); err != nil {
		t.Fatal(err)
	}
	if a.caldavDraft.Password != "" || a.caldavEditing {
		t.Fatal("cancel retained credentials")
	}
	a.deleteCaldav = &api.CaldavSource{ID: 4, Name: strings.Repeat("长来源名称", 20)}
	a.failure = strings.Repeat("服务暂时不可用。", 100)
	tt.Frame()
	assertActions("保留来源", "确认删除来源")
	if err := tt.Click("保留来源"); err != nil {
		t.Fatal(err)
	}
	if a.deleteCaldav != nil {
		t.Fatal("cancel retained deletion")
	}
}
