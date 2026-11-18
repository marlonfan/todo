package app

import (
	"encoding/json"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestComplexRecurrenceEditorRoundTrip(t *testing.T) {
	for _, raw := range []string{
		`{"freq":"weekly","interval":2,"byday":["MO","FR"],"count":12}`,
		`{"freq":"monthly","interval":3,"byday":["2MO","-1FR"],"bydate":[1,15,31],"bymonth":[1,6,12],"count":20}`,
		`{"freq":"yearly","interval":1,"bymonth":[6],"bydate":[23]}`,
		`{"freq":"lunar_yearly","interval":2,"lunar_month":6,"lunar_day":30,"lunar_is_leap_month":true,"count":5}`,
	} {
		t.Run(raw, func(t *testing.T) {
			d := recurrenceDraft(json.RawMessage(raw))
			got, err := d.rule(d.Frequency)
			var want recurrenceRule
			_ = json.Unmarshal([]byte(raw), &want)
			if err != nil || !reflect.DeepEqual(got, want) {
				t.Fatalf("round trip: %+v != %+v (%v), draft=%+v", got, want, err, d)
			}
		})
	}
	legacy := recurrenceDraft(json.RawMessage(`{"freq":"lunar","lunar_month":8,"lunar_day":15}`))
	if legacy.Frequency != "农历每年" {
		t.Fatal(legacy)
	}
	future := recurrenceDraft(json.RawMessage(`{"freq":"weekly","future_field":true}`))
	if future.Frequency != "" {
		t.Fatal("unknown fields must remain in preserve mode")
	}
}

func TestNativeRecurrenceMonthChoices(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	start := time.Date(2027, 3, 14, 9, 0, 0, 0, time.UTC)
	a.draft = draftFrom(api.Task{Title: "限定月份计划", StartTime: &start}, start)
	a.draft.Repeat = "每月"
	a.draft.Rule = RecurrenceDraft{Interval: "1", Count: "3", Weekdays: "第2个周日"}
	tt := ui.NewTester(func(c *ui.Context) {
		ui.Column(c).Padding(20).Gap(12).Children(func() {
			taskEditorSection(c, "重复计划", func() { a.recurrenceFields(c) })
		})
	}, 620, 720)
	if !tt.HasText("所有月份 · 点击可限定月份") {
		t.Fatal(tt.Texts())
	}
	for _, name := range []string{"切换限定月份 11月", "切换限定月份 3月"} {
		if err := tt.Click(name); err != nil {
			t.Fatal(err)
		}
	}
	if a.draft.Rule.Months != "3，11" || !tt.HasText("仅在 3，11 月重复") {
		t.Fatal(a.draft.Rule)
	}
	payload, err := a.draft.payload()
	if err != nil || !reflect.DeepEqual(payload["recurrence_rule"].(recurrenceRule).ByMonth, []int{3, 11}) {
		t.Fatal(payload, err)
	}
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		tt.Advance(time.Second)
		for month := 1; month <= 12; month++ {
			node, ok := tt.AccessByRole(ui.RoleButton, fmt.Sprintf("切换限定月份 %d月", month))
			if !ok || node.Offscreen || node.Bounds.X+node.Bounds.W > 620 || node.Bounds.Y+node.Bounds.H > 720 {
				t.Fatal("month button clipped", node)
			}
		}
		if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" {
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			name := "native-recurrence-months-headless-light.png"
			if dark {
				name = "native-recurrence-months-headless-dark.png"
			}
			f, err := os.Create(filepath.Join(dir, name))
			if err != nil {
				t.Fatal(err)
			}
			err = png.Encode(f, tt.Image())
			closeErr := f.Close()
			if err != nil || closeErr != nil {
				t.Fatal(err, closeErr)
			}
		}
	}
	// Editing is a draft until Save. Deselecting every month removes only the
	// restriction, and malformed text is never silently discarded by a click.
	for _, name := range []string{"切换限定月份 3月", "切换限定月份 11月"} {
		if err := tt.Click(name); err != nil {
			t.Fatal(err)
		}
	}
	if a.draft.Rule.Months != "" || len(a.cache.Outbox) != 0 {
		t.Fatal(a.draft.Rule)
	}
	a.draft.Rule.Months = "3，13"
	tt.Frame()
	node, ok := tt.AccessByRole(ui.RoleButton, "切换限定月份 3月")
	if !ok || !node.Disabled {
		t.Fatal("invalid input must disable month buttons", node)
	}
	_ = tt.Click("切换限定月份 3月")
	if a.draft.Rule.Months != "3，13" {
		t.Fatal("invalid draft was discarded")
	}
}

func TestRecurrenceValidationAndInclusiveEndDate(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	start := time.Date(2026, 11, 1, 9, 0, 0, 0, loc)
	d := draftFrom(api.Task{Title: "工作日", StartTime: &start}, start)
	d.Repeat, d.Rule.Interval, d.Rule.Weekdays = "每周", "2", "周一，周五,周一"
	d.HasRepeatEnd, d.RepeatEnd = true, dayStart(start)
	p, err := d.payload()
	if err != nil {
		t.Fatal(err)
	}
	end := p["recurrence_end_date"].(time.Time)
	if end.Hour() != 23 || end.Day() != start.Day() || !end.After(start) || len(p["recurrence_rule"].(recurrenceRule).ByDay) != 2 {
		t.Fatal(p)
	}
	for _, change := range []func(*Draft){
		func(d *Draft) { d.Rule.Interval = "0" },
		func(d *Draft) { d.Rule.Count = "-1" },
		func(d *Draft) { d.Rule.Weekdays = "周八" },
		func(d *Draft) { d.Rule.Weekdays = "第2个周一" },
		func(d *Draft) { d.Rule.Dates = "32" },
		func(d *Draft) { d.Rule.Months = "13" },
		func(d *Draft) { d.Repeat = "农历每年"; d.Rule.LunarDay = "31" },
		func(d *Draft) { d.Repeat = "未知规则" },
		func(d *Draft) { d.HasStart = false },
		func(d *Draft) { d.RepeatEnd = start.AddDate(0, 0, -1) },
	} {
		invalid := d
		change(&invalid)
		if _, err := invalid.payload(); err == nil {
			t.Fatalf("invalid recurrence accepted: %+v", invalid)
		}
	}
	d.Repeat = "不重复"
	p, err = d.payload()
	if err != nil || p["recurrence_rule"] != nil || p["recurrence_end_date"] != nil {
		t.Fatal(p, err)
	}
}

func TestNativeRecurrenceFieldsAndDescriptionCancel(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	start := time.Now()
	a.draft = draftFrom(api.Task{Title: "例会", StartTime: &start, RecurrenceRule: json.RawMessage(`{"freq":"monthly","byday":["2MO"]}`)}, start)
	tt := ui.NewTester(func(c *ui.Context) { ui.Column(c).Padding(12).Gap(8).Children(func() { a.recurrenceFields(c) }) }, 620, 720)
	if err := tt.Click("编辑重复规则"); err != nil {
		t.Fatal(err)
	}
	if a.draft.Repeat != "每月" || a.draft.Rule.Weekdays != "第2个周一" {
		t.Fatal(a.draft)
	}
	if err := tt.Click("工作日"); err != nil {
		t.Fatal(err)
	}
	if a.draft.Rule.Weekdays != "周一，周二，周三，周四，周五" {
		t.Fatal(a.draft.Rule)
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "重复次数"); !ok {
		t.Fatal("missing native count input")
	}

	a.client, _ = api.New(api.DefaultServer, "")
	a.session = api.Session{Server: api.DefaultServer, User: api.User{ID: 1, Timezone: "UTC"}}
	series := api.Task{ID: 1, Title: "系列", Description: "系列描述", Status: "pending", Revision: 7, StartTime: &start, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{series}})
	instance := series
	instance.Title, instance.Description = "本次", "原始描述"
	instance.InstanceID, instance.OccurrenceDate = "1_20261109", "2026-11-09"
	a.openTask(instance)
	tt = ui.NewTester(a.view, 900, 760)
	if err := tt.Click("本次描述"); err != nil {
		t.Fatal(err)
	}
	if a.occurrenceDescription != "原始描述" {
		t.Fatal("description not loaded")
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "本次描述"); !ok {
		t.Fatal("missing native description input")
	}
	if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			tt.Advance(time.Second)
			name := "native-occurrence-title-description-light.png"
			if dark {
				name = "native-occurrence-title-description-dark.png"
			}
			f, err := os.Create(filepath.Join(dir, name))
			if err != nil {
				t.Fatal(err)
			}
			err = png.Encode(f, tt.Image())
			closeErr := f.Close()
			if err != nil || closeErr != nil {
				t.Fatal(err, closeErr)
			}
		}
	}
	a.occurrenceEditing = true
	a.occurrenceDescription = "未保存"
	// A failed local write must preserve cancellation's draft protection.
	a.cacheError = "模拟本机缓存写入失败"
	tt.Frame()
	if err := tt.Click("关闭"); err != nil {
		t.Fatal(err)
	}
	if !a.taskDiscardConfirm || a.occurrenceDescription != "未保存" || a.autosave.failure != a.cacheError || len(a.cache.Outbox) != 0 {
		t.Fatalf("cancel lost the draft: confirm=%v description=%q autosave=%q failure=%q outbox=%d texts=%v", a.taskDiscardConfirm, a.occurrenceDescription, a.autosave.failure, a.failure, len(a.cache.Outbox), tt.Texts())
	}
	if err := tt.Click("放弃并切换"); err != nil {
		t.Fatal(err)
	}
	if a.tasks[0].Description != "系列描述" || len(a.cache.Outbox) != 0 || a.occurrenceEditing || a.selectedOccurrence != nil {
		t.Fatal("discarding failed-save edits leaked or saved edits")
	}
}

func TestClearedOccurrenceDescriptionDoesNotInheritSeries(t *testing.T) {
	now := time.Now()
	series := api.Task{ID: 1, Description: "系列描述", Status: "pending", RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	rows := projectTasks([]api.Task{series}, []api.Occurrence{{TaskID: 1, InstanceID: "1_20261109", OriginalDate: now, StartTime: now, Status: "pending", Description: ""}}, nil)
	if len(rows) != 1 || rows[0].Description != "" || series.Description != "系列描述" {
		t.Fatal(rows)
	}
}
