package app

import (
	"math"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTaskPropertyPopoverFitsNarrowWindow(t *testing.T) {
	for _, size := range [][2]int{{900, 600}, {960, 648}, {1280, 800}} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		a.editTaskNow(api.Task{ID: 1, Title: "检查日期弹层"})
		tt := ui.NewTester(a.view, size[0], size[1])
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			if err := tt.Click("编辑开始"); err != nil {
				t.Fatal(err)
			}
			panel, ok := tt.AccessByRole(ui.RolePopup, "属性选项")
			if !ok || panel.Bounds.Y < 0 || panel.Bounds.Y+panel.Bounds.H > float32(size[1]) || panel.Bounds.X < 0 || panel.Bounds.X+panel.Bounds.W > float32(size[0]) {
				t.Fatal("property panel outside window", size, panel)
			}
			if err := tt.Click("收起日期与时间"); err != nil {
				t.Fatal(err)
			}
		}
		a.Close()
	}
}

func TestTaskPropertyPopoverKeepsDraftAndDoesNotQueue(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.draft = draftFrom(api.Task{Title: "草稿"}, time.Now())
	tt := ui.NewTester(func(c *ui.Context) { a.taskMetadata(c, &a.draft) }, 800, 700)
	for _, label := range []string{"编辑优先级", "高"} {
		if err := tt.Click(label); err != nil {
			t.Fatal(err)
		}
	}
	if _, open := tt.AccessByRole(ui.RolePopup, "属性选项"); open || !tt.Focused("编辑优先级") {
		t.Fatal("choosing priority must close popup and restore its trigger")
	}
	if a.draft.Priority != "高" || a.taskMetaOpen != "" {
		t.Fatalf("draft priority/close lost: %s %s", a.draft.Priority, a.taskMetaOpen)
	}
	for _, label := range []string{"编辑开始", "明天", "收起日期与时间"} {
		if err := tt.Click(label); err != nil {
			t.Fatal(err)
		}
	}
	tomorrow := time.Now().In(a.location()).AddDate(0, 0, 1).Format("2006-01-02")
	if !a.draft.HasStart || a.draft.Start.Format("2006-01-02") != tomorrow {
		t.Fatal("tomorrow was not applied to draft")
	}
	if err := tt.Click("编辑开始"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("清除日期"); err != nil {
		t.Fatal(err)
	}
	if a.draft.HasStart {
		t.Fatal("clear did not remove start date")
	}
	if a.draft.Start.Format("2006-01-02") != tomorrow {
		t.Fatal("clear destroyed previous date input")
	}
	if len(a.cache.Outbox) != 0 {
		t.Fatal("property editing queued a task before save")
	}
}

func TestParse24HourClock(t *testing.T) {
	valid := []struct {
		in   string
		h, m int
	}{
		{"09:30", 9, 30},
		{"9:5", 9, 5},
		{"09：30", 9, 30},
		{"1430", 14, 30},
		{"930", 9, 30},
		{"0:00", 0, 0},
		{"23:59", 23, 59},
		{"8", 8, 0},
	}
	for _, tc := range valid {
		h, m, ok := parse24HourClock(tc.in)
		if !ok || h != tc.h || m != tc.m {
			t.Fatalf("parse24HourClock(%q) = (%d,%d,%v), want (%d,%d,true)", tc.in, h, m, ok, tc.h, tc.m)
		}
	}
	for _, bad := range []string{"", "24:00", "12:60", "-1:00", "abc", "12345"} {
		if _, _, ok := parse24HourClock(bad); ok {
			t.Fatalf("parse24HourClock(%q) unexpectedly succeeded", bad)
		}
	}
}

func TestSchedulePopover24HourAndKeyValueLayout(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	start := time.Date(2026, 11, 18, 9, 30, 0, 0, time.Local)
	a.editTaskNow(api.Task{ID: 1, Title: "验证24小时制与KV排布", StartTime: &start})

	tt := ui.NewTester(a.view, 1280, 860)
	if err := tt.Click("编辑开始"); err != nil {
		t.Fatal(err)
	}
	for _, text := range tt.Texts() {
		if strings.Contains(text, "AM") || strings.Contains(text, "PM") {
			t.Fatalf("schedule popover leaked 12-hour AM/PM format: %q", text)
		}
		if strings.Contains(text, "选择后自动存入本机") {
			t.Fatalf("schedule popover still shows redundant sync hint: %q", text)
		}
	}

	startField, ok := tt.AccessByRole(ui.RoleTextField, "开始时间时刻")
	if !ok || startField.Value != "09:30" {
		t.Fatalf("expected 24-hour start time 09:30, got %+v", startField)
	}
	if err := tt.Click("开始时间时刻"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type("14:45")
	tt.Key(0, ui.KeyEnter)
	tt.Frame()
	if a.draft.Start.Format("15:04") != "14:45" {
		t.Fatalf("24-hour time edit did not apply: got %s", a.draft.Start.Format("15:04"))
	}

	// Add end time and verify start/end 24h fields share exact vertical column alignment.
	if err := tt.Click("添加结束时间"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if !a.draft.HasEnd || a.draft.End.Format("15:04") != "15:45" {
		t.Fatalf("adding end time did not default to +1h in 24h format: hasEnd=%v end=%s", a.draft.HasEnd, a.draft.End.Format("15:04"))
	}
	startFieldAfter, _ := tt.AccessByRole(ui.RoleTextField, "开始时间时刻")
	endField, ok := tt.AccessByRole(ui.RoleTextField, "结束时间时刻")
	if !ok || endField.Value != "15:45" {
		t.Fatalf("expected 24-hour end time 15:45, got %+v", endField)
	}
	if math.Abs(float64(startFieldAfter.Bounds.X-endField.Bounds.X)) > 1 {
		t.Fatalf("start and end 24h inputs are not vertically aligned: start=%+v end=%+v", startFieldAfter.Bounds, endField.Bounds)
	}
	if err := tt.Click("清除结束时间"); err != nil {
		t.Fatal(err)
	}
	if a.draft.HasEnd {
		t.Fatal("clear end time button did not disable end time")
	}

	// Add & clear due date inline in KV list.
	if err := tt.Click("添加截止日期"); err != nil {
		t.Fatal(err)
	}
	if !a.draft.HasDue {
		t.Fatal("add due date did not enable due date")
	}
	if err := tt.Click("清除截止日期"); err != nil {
		t.Fatal(err)
	}
	if a.draft.HasDue {
		t.Fatal("clear due date did not disable due date")
	}
}

func TestMetadataBarNarrowDrawerAvoidsLonelyOrphan(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.categories = []api.Category{{ID: 1, Name: "核心架构", Emoji: "🚀", Color: "#3B66F5"}}
	start := time.Date(2026, 11, 18, 9, 30, 0, 0, time.Local)
	end := start.Add(time.Hour)
	a.draft = draftFrom(api.Task{
		ID: 1, Title: "窄抽屉元数据测试", Status: "pending", Priority: 1,
		StartTime: &start, EndTime: &end, Categories: a.categories,
	}, start)
	a.draft.Repeat = "每周"
	a.draft.Reminder = "提前提醒"
	a.draft.ReminderMinutes = "15"

	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		ui.Column(c).Width(340).Padding(8).Children(func() {
			a.taskMetadata(c, &a.draft)
		})
	}, 360, 400)
	tt.Frame()
	tt.Frame()

	prio, ok1 := tt.AccessByRole(ui.RoleButton, "编辑优先级")
	cat, ok2 := tt.AccessByRole(ui.RoleButton, "编辑分类")
	rem, ok3 := tt.AccessByRole(ui.RoleButton, "编辑提醒")
	if !ok1 || !ok2 || !ok3 {
		t.Fatalf("missing metadata controls: %v %v %v", ok1, ok2, ok3)
	}
	if math.Abs(float64(rem.Bounds.Y-prio.Bounds.Y)) > 1 || math.Abs(float64(rem.Bounds.Y-cat.Bounds.Y)) > 1 {
		t.Fatalf("reminder chip was orphaned onto a separate row in narrow drawer: prio=%+v cat=%+v rem=%+v", prio.Bounds, cat.Bounds, rem.Bounds)
	}
}
