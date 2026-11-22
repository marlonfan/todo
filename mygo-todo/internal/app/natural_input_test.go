package app

import (
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestNaturalTimeAndPriorityParityWithElectron(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	opts := naturalTimeOptions{
		DefaultStart: "09:00",
		Morning:      "09:00",
		Noon:         "12:00",
		Afternoon:    "15:00",
		Evening:      "20:00",
	}

	nowWed := time.Date(2026, 3, 4, 9, 0, 0, 0, loc)
	if got, ok := parseNaturalTimeFromTitle("下周二和妈妈去打麻将", nowWed, opts); !ok || got.Time.Format("2006-01-02T15:04") != "2026-03-10T09:00" || got.CleanedTitle != "和妈妈去打麻将" || got.Confidence != "high" || got.Ambiguous {
		t.Fatalf("unexpected 下周二 result: ok=%v got=%+v", ok, got)
	}

	if got, ok := parseNaturalTimeFromTitle("周二开会", nowWed, opts); !ok || got.Time.Format("2006-01-02T15:04") != "2026-03-03T09:00" || got.CleanedTitle != "开会" {
		t.Fatalf("unexpected 周二 result: ok=%v got=%+v", ok, got)
	}

	nowSun := time.Date(2026, 3, 1, 9, 0, 0, 0, loc)
	if got, ok := parseNaturalTimeFromTitle("明天早上和团队同步", nowSun, opts); !ok || got.Time.Format("2006-01-02T15:04") != "2026-03-02T09:00" || got.CleanedTitle != "和团队同步" {
		t.Fatalf("unexpected 明天早上 result: ok=%v got=%+v", ok, got)
	}

	if got, ok := parseNaturalTimeFromTitle("后天下午3点见客户", nowSun, opts); !ok || got.Time.Format("2006-01-02T15:04") != "2026-03-03T15:00" || got.CleanedTitle != "见客户" {
		t.Fatalf("unexpected 后天下午3点 result: ok=%v got=%+v", ok, got)
	}

	if got, ok := parseNaturalTimeFromTitle("今晚8点看球", nowSun, opts); !ok || got.Time.Format("2006-01-02T15:04") != "2026-03-01T20:00" || got.CleanedTitle != "看球" {
		t.Fatalf("unexpected 今晚8点 result: ok=%v got=%+v", ok, got)
	}

	if got, ok := parseNaturalTimeFromTitle("next Tuesday 8pm sync", nowSun, opts); !ok || got.Time.Format("2006-01-02T15:04") != "2026-03-10T20:00" || got.CleanedTitle != "sync" {
		t.Fatalf("unexpected english next Tuesday 8pm result: ok=%v got=%+v", ok, got)
	}

	if p, ok := parsePriorityFromTitle("! 买牛奶"); !ok || p.PriorityValue != -1 || p.PriorityLabel != "低" || p.CleanedTitle != "买牛奶" {
		t.Fatalf("unexpected ! priority: ok=%v got=%+v", ok, p)
	}
	if p, ok := parsePriorityFromTitle("买牛奶 !!"); !ok || p.PriorityValue != 0 || p.PriorityLabel != "普通" || p.CleanedTitle != "买牛奶" {
		t.Fatalf("unexpected !! priority: ok=%v got=%+v", ok, p)
	}
	if p, ok := parsePriorityFromTitle("!!! 交房租"); !ok || p.PriorityValue != 1 || p.PriorityLabel != "高" || p.CleanedTitle != "交房租" {
		t.Fatalf("unexpected !!! priority: ok=%v got=%+v", ok, p)
	}
	if p, ok := parsePriorityFromTitle("和妈妈去打麻将！"); ok {
		t.Fatalf("single trailing exclamation punctuation should not parse as priority: %+v", p)
	}
}

func TestQuickAddAndDetailSmartInputAutoApply(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai", DefaultTaskStartTime: "09:00", DefaultAfternoonTime: "15:00"}

	tt := ui.NewTester(a.view, 1280, 800)
	a.beginQuickAdd()
	tt.Frame()
	if err := tt.Click("快捷添加标题"); err != nil {
		t.Fatal(err)
	}
	tt.Type("明天下午3点 见客户 !!!")
	tt.Frame()

	// Verify live preview on quick-add chips before submit
	if !tt.HasText("明天 15:00") || !tt.HasText("高") {
		t.Fatalf("quick-add bar did not live-preview smart date and priority: %v", tt.Texts())
	}

	a.submitQuickTask()
	tt.Frame()
	if len(a.tasks) != 1 {
		t.Fatalf("expected 1 created task, got %d", len(a.tasks))
	}
	created := a.tasks[0]
	tomorrow := dayStart(time.Now().In(loc)).AddDate(0, 0, 1)
	if created.Title != "见客户" || created.Priority != 1 || created.StartTime == nil {
		t.Fatalf("quick-add smart input did not clean title or set priority/time: %+v", created)
	}
	gotStart := created.StartTime.In(loc)
	if gotStart.Year() != tomorrow.Year() || gotStart.Month() != tomorrow.Month() || gotStart.Day() != tomorrow.Day() || gotStart.Hour() != 15 || gotStart.Minute() != 0 {
		t.Fatalf("unexpected parsed start time: %v", gotStart)
	}

	// Verify Task Detail smart recognition pill and 1-click / commit application
	a.editTaskNow(created)
	a.draft.Title = "后天早上10点半 架构走查 !"
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleButton, "应用智能识别属性"); !ok {
		t.Fatalf("expected smart recognition pill in detail metadata: %v", tt.Texts())
	}
	if err := tt.Click("应用智能识别属性"); err != nil {
		t.Fatal(err)
	}
	if a.draft.Title != "架构走查" || a.draft.Priority != "低" || a.draft.Start.Hour() != 10 || a.draft.Start.Minute() != 30 {
		t.Fatalf("smart pill did not apply parsed draft fields: %+v", a.draft)
	}

	// Verify recurrence weekday alignment shifts start date to nearest matching weekday
	monday := time.Date(2026, 11, 16, 9, 0, 0, 0, loc) // Monday
	a.draft.HasStart = true
	a.draft.Start = monday
	a.draft.Repeat = "每周"
	a.draft.Rule.Weekdays = "周三，周五"
	alignDraftStartToRecurrence(&a.draft)
	if a.draft.Start.Weekday() != time.Wednesday || a.draft.Start.Day() != 18 {
		t.Fatalf("expected start date to align to Wednesday Nov 18, got %v", a.draft.Start)
	}
}

func TestLunarCalendarAndCalendarOverlayDrawerWithoutSqueezing(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	// 1. Verify Solar <-> Lunar round trip and natural-language Lunar input
	solarMidAutumn2026 := time.Date(2026, 9, 25, 9, 0, 0, 0, loc)
	lunar, ok := solarToLunar(solarMidAutumn2026)
	if !ok || lunar.Year != 2026 || lunar.Month != 8 || lunar.Day != 15 || lunar.IsLeap || lunar.FullLabel() != "农历八月十五" {
		t.Fatalf("unexpected lunar date for 2026-09-25: ok=%v got=%+v", ok, lunar)
	}
	backSolar, ok := lunarToSolar(2026, 8, 15, false, loc)
	if !ok || backSolar.Format("2006-01-02") != "2026-09-25" {
		t.Fatalf("unexpected solar round-trip: ok=%v got=%v", ok, backSolar)
	}

	opts := naturalTimeOptions{DefaultStart: "09:00", Morning: "09:00", Noon: "12:00", Afternoon: "15:00", Evening: "20:00"}
	now := time.Date(2026, 9, 1, 9, 0, 0, 0, loc)
	if parsed, ok := parseNaturalTimeFromTitle("农历八月十五 买月饼", now, opts); !ok || parsed.Time.Format("2006-01-02T15:04") != "2026-09-25T09:00" || parsed.CleanedTitle != "买月饼" {
		t.Fatalf("unexpected lunar natural language parse: ok=%v got=%+v", ok, parsed)
	}

	// 2. Verify Calendar page keeps 100% full width (zero squeezing) when opening a task in the right-hand overlay drawer
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	a.adoptCache(state)
	a.page = "calendar"
	a.selectedDay = day
	a.calendarMode = 2

	tt := ui.NewTester(a.view, 1400, 900)
	tt.Frame()
	cellBefore, ok := tt.Access("日历日期 2026-11-11")
	if !ok {
		t.Fatal("missing calendar day cell before opening drawer")
	}
	sundayBefore, ok := tt.Access("日历日期 2026-11-15")
	if !ok {
		t.Fatal("missing sunday column before opening drawer")
	}

	if err := tt.Click("日程 2026-11-11 改期后的单次"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	drawer, ok := tt.Access("详情侧边抽屉")
	if !ok {
		t.Fatal("expected right-hand floating drawer to open on calendar event click")
	}
	cellAfter, ok := tt.Access("日历日期 2026-11-11")
	if !ok || cellAfter.Bounds != cellBefore.Bounds {
		t.Fatalf("floating drawer deformed calendar cell: before=%+v after=%+v", cellBefore.Bounds, cellAfter.Bounds)
	}
	sundayAfter, ok := tt.Access("日历日期 2026-11-15")
	if !ok || sundayAfter.Bounds != sundayBefore.Bounds {
		t.Fatalf("floating drawer deformed sunday column: before=%+v after=%+v", sundayBefore.Bounds, sundayAfter.Bounds)
	}
	if drawer.Bounds.X+drawer.Bounds.W < 1399 || drawer.Bounds.W < detailMinWidth {
		t.Fatalf("floating drawer not anchored to right edge: drawer=%+v", drawer.Bounds)
	}

	// 3. Pressing Escape immediately after clicking a calendar event closes the side drawer
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if _, ok := tt.Access("详情侧边抽屉"); ok || a.selectedOccurrence != nil || a.editing {
		t.Fatal("Escape failed to close calendar side drawer when focus remained on calendar event")
	}

	// Re-open, focus inside the drawer title, and verify Escape still closes the drawer on the Calendar page
	if err := tt.Click("日程 2026-11-11 改期后的单次"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if err := tt.Click("本次标题"); err != nil {
		t.Fatal(err)
	}
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if _, ok := tt.Access("详情侧边抽屉"); ok || a.selectedOccurrence != nil || a.editing {
		t.Fatal("Escape failed to close calendar side drawer when title inside drawer was focused")
	}
}

func TestRapidThreeTaskSwitchingInAllTasks(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, loc)
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	a.tasks = []api.Task{
		{ID: 1, Title: "任务一", Status: "pending", Priority: 1, StartTime: &now},
		{ID: 2, Title: "任务二", Status: "pending", Priority: 0, StartTime: &now},
		{ID: 3, Title: "任务三", Status: "pending", Priority: -1, StartTime: &now},
	}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: a.tasks})

	tt := ui.NewTester(a.view, 1280, 800)
	tt.Frame()

	row1, _ := tt.Access("任务行 任务一")
	row2, _ := tt.Access("任务行 任务二")

	// 1. Click Row 1
	tt.ClickAt(row1.Bounds.X+120, row1.Bounds.Y+20)
	tt.Frame()
	if !a.editing || a.draft.Task.ID != 1 {
		t.Fatalf("expected task 1 selected, got %d", a.draft.Task.ID)
	}

	// 2. Middle click on Row 2 near top/bottom edge and while pointer moves toward Row 3 before release
	tt.Press(row2.Bounds.X+120, row2.Bounds.Y+4)
	tt.Frame()
	if !a.editing || a.draft.Task.ID != 2 {
		t.Fatalf("middle press near top edge of row 2 failed to select task 2: got %d", a.draft.Task.ID)
	}
	tt.Release(row2.Bounds.X+120, row2.Bounds.Y+row2.Bounds.H+2)
	tt.Frame()
	if !a.editing || a.draft.Task.ID != 2 {
		t.Fatalf("release during downward motion lost task 2 selection: got %d", a.draft.Task.ID)
	}

	// 3. Click Row 3 in the right-side category handle zone (without dragging)
	handle3, ok := tt.Access("拖动归类 任务三")
	if !ok {
		t.Fatal("missing handle on row 3")
	}
	tt.ClickAt(handle3.Bounds.X+16, handle3.Bounds.Y+16)
	tt.Frame()
	if !a.editing || a.draft.Task.ID != 3 {
		t.Fatalf("clicking right-side handle zone on row 3 failed to select task 3: got %d", a.draft.Task.ID)
	}
}

func TestQuickAddAndTaskSelectionMutualExclusionAcrossPages(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{Timezone: "Asia/Shanghai"}
	now := time.Now().In(a.location())
	a.categories = []api.Category{{ID: 7, Name: "工作"}}
	a.tasks = []api.Task{
		{ID: 1, Title: "任务一", Status: "pending", StartTime: &now, Categories: []api.Category{{ID: 7, Name: "工作"}}},
		{ID: 2, Title: "任务二", Status: "pending", StartTime: &now, Categories: []api.Category{{ID: 7, Name: "工作"}}},
	}

	tt := ui.NewTester(a.view, 1280, 800)
	for _, page := range []string{"all", "today", "upcoming", "category:7"} {
		a.changePage(page)
		tt.Frame()

		// 1. Select Task 1
		row1, ok := tt.Access("任务行 任务一")
		if !ok {
			t.Fatalf("page %s missing row 1", page)
		}
		tt.ClickAt(row1.Bounds.X+120, row1.Bounds.Y+20)
		tt.Frame()
		if !a.taskRowSelected(a.tasks[0]) || a.quick.Open {
			t.Fatalf("page %s: expected task 1 selected and quick.Open false", page)
		}

		// 2. Click "快捷添加标题" -> Quick Add activates AND Task 1 selection is cancelled
		if err := tt.Click("快捷添加标题"); err != nil {
			t.Fatalf("page %s: click quick add: %v", page, err)
		}
		tt.Frame()
		if !a.quick.Open {
			t.Fatalf("page %s: expected quick.Open true after clicking quick-title", page)
		}
		if a.taskRowSelected(a.tasks[0]) || a.editing || a.selectedOccurrence != nil {
			t.Fatalf("page %s: activating quick-add did not clear task 1 selection: editing=%v selectedID=%d", page, a.editing, a.selectedTaskID)
		}

		// 3. While Quick Add is active, click Task 2 -> Quick Add deactivates AND Task 2 becomes selected
		row2, ok := tt.Access("任务行 任务二")
		if !ok {
			t.Fatalf("page %s missing row 2", page)
		}
		tt.ClickAt(row2.Bounds.X+120, row2.Bounds.Y+20)
		tt.Frame()
		if a.quick.Open {
			t.Fatalf("page %s: selecting task 2 did not cancel active quick-add state", page)
		}
		if !a.taskRowSelected(a.tasks[1]) || a.taskRowSelected(a.tasks[0]) {
			t.Fatalf("page %s: expected only task 2 selected after clicking row 2", page)
		}
	}
}

func TestTrayMenuBarTitleAndFlyoutCompanion(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai", DefaultTaskStartTime: "09:00"}
	loc := a.location()
	now := time.Now().In(loc)
	todayTimed := time.Date(now.Year(), now.Month(), now.Day(), 14, 30, 0, 0, loc)
	tomorrowTimed := todayTimed.AddDate(0, 0, 1)
	a.adoptCache(storage.Cache{
		Server: api.DefaultServer,
		UserID: 1,
		Tasks: []api.Task{
			{ID: 1, Title: "架构方案评审", Status: "pending", Priority: 1, StartTime: &todayTimed},
			{ID: 2, Title: "整理发布记录", Status: "pending", AllDay: true, StartTime: &todayTimed},
			{ID: 3, Title: "明日路线图对齐", Status: "pending", StartTime: &tomorrowTimed},
		},
	})

	// 1. Verify macOS Menu Bar live title modes ("next", "count", "icon")
	a.setTrayTitleMode("next")
	titleNext := a.trayStatusTitle(now)
	if !strings.Contains(titleNext, "14:30") || !strings.Contains(titleNext, "架构方案评审") || strings.Contains(titleNext, "·") {
		t.Fatalf("unexpected 'next' tray title: %q", titleNext)
	}
	a.setTrayTitleMode("count")
	titleCount := a.trayStatusTitle(now)
	if titleCount != " 2" {
		t.Fatalf("unexpected 'count' tray title: %q", titleCount)
	}
	a.setTrayTitleMode("icon")
	if got := a.trayStatusTitle(now); got != "" {
		t.Fatalf("expected empty tray title in 'icon' mode, got %q", got)
	}
	a.setTrayTitleMode("next")

	// 2. Render the interactive Menu Bar Flyout view and test quick capture, tab switching, and task completion
	tt := ui.NewTester(a.trayFlyoutView, 328, 420)
	tt.Frame()
	if !tt.HasText("架构方案评审") || !tt.HasText("整理发布记录") {
		t.Fatalf("tray flyout missing today's tasks: %v", tt.Texts())
	}

	// Switch to "最近7天" tab and verify tomorrow's task is shown
	if err := tt.Click("菜单栏切换最近7天"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if !tt.HasText("明日路线图对齐") {
		t.Fatalf("tray flyout upcoming tab missing tomorrow's task: %v", tt.Texts())
	}

	// Switch back to "今日" tab and quick-add a task with natural language priority & time
	if err := tt.Click("菜单栏切换今日"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("菜单栏快捷添加"); err != nil {
		t.Fatal(err)
	}
	tt.Type("今天 16:00 补充回归用例 !!")
	tt.Frame()
	if err := tt.Click("菜单栏添加任务"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if a.trayQuickTitle != "" || !tt.HasText("补充回归用例") {
		t.Fatalf("tray quick add failed to create and project task: %v", tt.Texts())
	}

	// Complete a task directly from the Menu Bar Flyout
	if err := tt.Click("菜单栏完成 架构方案评审"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if len(a.cache.Outbox) < 2 {
		t.Fatalf("expected status mutation in outbox after completing from tray, got %d", len(a.cache.Outbox))
	}
}

func TestLongTaskDetailNeverOverflowsTopOrBottom(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}

	var lines []string
	for i := 1; i <= 60; i++ {
		lines = append(lines, "- [ ] 超长任务详情段落第 "+string(rune('A'+(i%26)))+" 行：验证上下滚动绝不破版溢出到顶栏或底栏")
	}
	longDesc := strings.Join(lines, "\n")
	task := api.Task{ID: 1, Title: "超长内容防破版测试任务", Description: longDesc, Status: "pending"}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{task}})
	a.editTaskNow(task)

	tt := ui.NewTester(a.view, 1280, 720)
	tt.Frame()

	if _, ok := tt.Access("任务底部操作"); ok {
		t.Fatal("clean synced task should not render redundant bottom save bar")
	}
	titleBefore, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
	if !ok {
		t.Fatal("missing task title field")
	}
	editorNode, ok := tt.AccessByRole(ui.RoleTextField, "备注")
	if !ok {
		t.Fatal("missing rich description editor")
	}
	if editorNode.Bounds.Y+editorNode.Bounds.H > 720.5 {
		t.Fatalf("editor overflowed window bottom: editor=%+v", editorNode.Bounds)
	}

	// Scroll down inside the rich description editor so top paragraphs have negative relative Y
	// and bottom paragraphs extend past the bottom of the editor viewport.
	tt.Scroll(editorNode.Bounds.X+80, editorNode.Bounds.Y+80, 0, -240)
	tt.Frame()

	titleAfter, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
	if !ok || titleAfter.Bounds != titleBefore.Bounds {
		t.Fatalf("scrolling long description shifted title: before=%+v after=%+v", titleBefore.Bounds, titleAfter.Bounds)
	}
	editorAfter, ok := tt.AccessByRole(ui.RoleTextField, "备注")
	if !ok || editorAfter.Bounds != editorNode.Bounds {
		t.Fatalf("scrolling long description shifted editor viewport: before=%+v after=%+v", editorNode.Bounds, editorAfter.Bounds)
	}

	// Verify the bottom padding strip below editorAfter has zero bled text pixels
	// from scrolled richtext paragraphs.
	img := tt.Image()
	bottomStripY := int(editorAfter.Bounds.Y + editorAfter.Bounds.H + 4)
	if bottomStripY < 718 {
		bg := img.RGBAAt(int(editorAfter.Bounds.X+10), bottomStripY)
		for x := int(editorAfter.Bounds.X + 40); x < int(editorAfter.Bounds.X+editorAfter.Bounds.W-40); x++ {
			for y := bottomStripY; y < min(720, bottomStripY+6); y++ {
				if got := img.RGBAAt(x, y); got != bg {
					t.Fatalf("richtext paragraph bled into bottom margin at (%d,%d): got=%+v want bg=%+v", x, y, got, bg)
				}
			}
		}
	}
}
