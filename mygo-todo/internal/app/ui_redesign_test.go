package app

import (
	"encoding/json"
	"image/png"
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

func savePreviewPNG(t *testing.T, dir, name string, tt *ui.Tester) {
	t.Helper()
	if dir == "" {
		return
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	f, err := os.Create(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, tt.Image()); err != nil {
		t.Fatal(err)
	}
}

func TestUIRedesignEndToEndAndVisuals(t *testing.T) {
	dir := os.Getenv("TODO_PREVIEW_DIR")
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 11, 16, 10, 30, 0, 0, loc)
	start1 := time.Date(2026, 11, 16, 9, 30, 0, 0, loc)
	end1 := time.Date(2026, 11, 16, 11, 0, 0, 0, loc)
	start2 := time.Date(2026, 11, 17, 14, 0, 0, 0, loc)
	end2 := time.Date(2026, 11, 17, 15, 30, 0, 0, loc)
	start3 := time.Date(2026, 11, 18, 0, 0, 0, 0, loc)
	end3 := time.Date(2026, 11, 20, 0, 0, 0, 0, loc)

	catWork := api.Category{ID: 1, Name: "产品研发", Color: "#3B66F5", Emoji: "🚀"}
	catDesign := api.Category{ID: 2, Name: "设计体验", Color: "#10B981", Emoji: "🎨"}
	catLife := api.Category{ID: 3, Name: "个人生活", Color: "#F59E0B", Emoji: "🌿"}

	richMD := "## 核心体验升级清单\n\n本次重构采用温润的纸感配色与轻量图标表达，让注意力回归内容本身：\n\n- [x] Claude 暖白纸感与深炭灰语义配色，零阴影扁平界面\n- [ ] Google 风格全幅日历与月视图行高自适应防遮挡\n- [ ] 单行内联快捷添加与自由拖拽分栏宽度\n\n| 模块 | 状态 | 备注 |\n| --- | --- | --- |\n| 编辑器 | 已完成 | 表格与分隔线直接内联所见即所得 |\n| 状态栏 | 已完成 | Apple 极简风下拉速览 |\n\n---\n\n> 少即是多，克制线框与文字噪音。\n\n```go\nfunc main() {\n\tfmt.Println(\"Hello Warm Editorial UI!\")\n}\n```"

	tasks := []api.Task{
		{
			ID: 101, Title: "重构 MyGo 原生客户端 UI 与所见即所得编辑器", Description: richMD,
			Status: "pending", Priority: 1, StartTime: &start1, EndTime: &end1,
			Categories: []api.Category{catWork, catDesign}, Revision: 3,
			ReminderPolicy: "offset", ReminderMinutesBefore: intPtr(15),
		},
		{
			ID: 102, Title: "日历组件视觉与拖拽幽灵预览走查", Description: "检查周视图时间轴、今日红线与分类色彩标签。",
			Status: "pending", Priority: 0, StartTime: &start2, EndTime: &end2,
			Categories: []api.Category{catDesign}, Revision: 1,
		},
		{
			ID: 103, Title: "年度技术架构峰会（全天跨日）", Description: "准备演示环境与离线同步压测数据。",
			Status: "pending", AllDay: true, StartTime: &start3, EndTime: &end3,
			Categories: []api.Category{catWork}, Revision: 1,
		},
		{
			ID: 104, Title: "每日晨间计划回顾", Description: "确认今日最重要的三件事。",
			Status: "pending", StartTime: &start1, RecurrenceRule: json.RawMessage(`{"freq":"daily","interval":1}`),
			Categories: []api.Category{catLife}, Revision: 2,
		},
		{
			ID: 105, Title: "整理书桌与阅读笔记", Status: "pending", Categories: []api.Category{catLife}, Revision: 1,
		},
	}

	calEvents := []api.CalendarEvent{
		{
			ID: "104_20261116", Title: "每日晨间计划回顾",
			Start: start1.Add(-90 * time.Minute).Format(time.RFC3339),
			End:   start1.Add(-60 * time.Minute).Format(time.RFC3339),
		},
		{
			ID: "ext-1", Title: "外部团队设计同步会",
			Start: time.Date(2026, 11, 16, 13, 30, 0, 0, loc).Format(time.RFC3339),
			End:   time.Date(2026, 11, 16, 14, 30, 0, 0, loc).Format(time.RFC3339),
		},
	}
	calEvents[0].ExtendedProps.TaskID = 104
	calEvents[0].ExtendedProps.InstanceID = "104_20261116"
	calEvents[0].ExtendedProps.IsRecurring = true
	calEvents[0].ExtendedProps.Status = "pending"
	calEvents[1].ExtendedProps.ReadOnly = true
	calEvents[1].ExtendedProps.Source = "caldav"

	cache := storage.Cache{
		Server:     api.DefaultServer,
		UserID:     1,
		SavedAt:    now,
		Tasks:      tasks,
		Categories: []api.Category{catWork, catDesign, catLife},
		Next: []api.Occurrence{{
			TaskID: 104, InstanceID: "104_20261116", Title: "每日晨间计划回顾",
			StartTime: start1.Add(-90 * time.Minute), OriginalDate: time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC),
			Status: "pending",
		}},
		Calendar: &storage.CalendarSnapshot{
			Start:           time.Date(2026, 10, 26, 0, 0, 0, 0, loc),
			End:             time.Date(2026, 12, 14, 0, 0, 0, 0, loc),
			Timezone:        "Asia/Shanghai",
			SavedAt:         now.Add(time.Second),
			Events:          calEvents,
			SeriesRevisions: map[int64]int64{104: 2},
		},
	}

	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "token")
	a.session.User = api.User{ID: 1, Username: "marlon", Timezone: "Asia/Shanghai"}
	a.adoptCache(cache)
	a.selectedDay = now
	a.editTaskNow(a.tasks[0])

	tt := ui.NewTester(a.view, 1440, 900)

	// 1. Verify WYSIWYG Markdown is live immediately without raw "##" or "```" markers
	descNode, ok := tt.AccessByRole(ui.RoleTextField, "备注")
	if !ok {
		t.Fatal("expected live WYSIWYG rich editor on task open")
	}
	if strings.Contains(descNode.Value, "## ") || strings.Contains(descNode.Value, "- [x]") {
		t.Fatalf("WYSIWYG editor leaked raw Markdown syntax in text value: %q", descNode.Value)
	}
	if !strings.Contains(descNode.Value, "核心体验升级清单") {
		t.Fatalf("WYSIWYG editor missing heading content: %q", descNode.Value)
	}
	// Untouched description must stay 100% byte-for-byte identical (including ```go)
	if a.draft.Description != richMD {
		t.Fatalf("opening WYSIWYG mutated untouched markdown: %q", a.draft.Description)
	}

	savePreviewPNG(t, dir, "01-workspace-light.png", tt)
	tt.SetDark(true)
	tt.Frame()
	savePreviewPNG(t, dir, "02-workspace-dark.png", tt)

	// Open unified schedule popover
	tt.SetDark(false)
	tt.Frame()
	if err := tt.Click("编辑开始"); err != nil {
		t.Fatal(err)
	}
	savePreviewPNG(t, dir, "03-schedule-popover-light.png", tt)
	a.taskMetaOpen = ""
	tt.Frame()

	// Calendar Month, Week, and Agenda screenshots
	a.clearTaskSelection()
	a.page = "calendar"
	a.calendarMode = 2
	tt.Frame()
	savePreviewPNG(t, dir, "04-calendar-month-light.png", tt)
	tt.SetDark(true)
	tt.Frame()
	savePreviewPNG(t, dir, "05-calendar-month-dark.png", tt)

	a.calendarMode = 1
	a.calendarScroll.Y = 8 * float32(a.calendarZoom)
	tt.SetDark(false)
	tt.Frame()
	savePreviewPNG(t, dir, "06-calendar-week-light.png", tt)
	tt.SetDark(true)
	tt.Frame()
	savePreviewPNG(t, dir, "07-calendar-week-dark.png", tt)

	a.calendarMode = 3
	tt.SetDark(false)
	tt.Frame()
	savePreviewPNG(t, dir, "08-calendar-agenda-light.png", tt)

	// Calendar Month view with right-hand slide-over detail drawer (zero calendar squeezing)
	a.calendarMode = 2
	a.editTaskNow(a.tasks[0])
	tt.Frame()
	savePreviewPNG(t, dir, "11-calendar-drawer-light.png", tt)

	// macOS Menu Bar Flyout Task Companion preview
	trayTester := ui.NewTester(a.trayFlyoutView, 328, 420)
	trayTester.Frame()
	savePreviewPNG(t, dir, "12-tray-flyout-light.png", trayTester)
	trayTester.SetDark(true)
	trayTester.Frame()
	savePreviewPNG(t, dir, "13-tray-flyout-dark.png", trayTester)
}

func TestTrayHeaderWeekdayAndTaskTitleAlignment(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	cases := []struct {
		date    time.Time
		primary string
		wantDay string
	}{
		{time.Date(2026, 11, 15, 9, 0, 0, 0, loc), "11月15日", "周日"},
		{time.Date(2026, 11, 16, 9, 0, 0, 0, loc), "11月16日", "周一"},
		{time.Date(2026, 11, 18, 9, 0, 0, 0, loc), "11月18日", "周三"},
		{time.Date(2026, 11, 20, 9, 0, 0, 0, loc), "11月20日", "周五"},
		{time.Date(2026, 11, 21, 9, 0, 0, 0, loc), "11月21日", "周六"},
	}
	for _, tc := range cases {
		primary, secondary := trayHeaderDateParts(tc.date)
		if primary != tc.primary || !strings.HasPrefix(secondary, tc.wantDay) {
			t.Fatalf("trayHeaderDateParts(%s) = (%q, %q), want (%q, prefix %q)", tc.date.Format("2006-01-02"), primary, secondary, tc.primary, tc.wantDay)
		}
	}

	now := time.Now().In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 10, 0, 0, 0, loc)
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "marlon", Timezone: "Asia/Shanghai"}
	a.adoptCache(storage.Cache{
		Server: api.DefaultServer, UserID: 1, SavedAt: now,
		Tasks: []api.Task{
			{ID: 1, Title: "高优先级对齐测试任务", Status: "pending", Priority: 1, StartTime: &today},
			{ID: 2, Title: "普通优先级对齐测试任务", Status: "pending", Priority: 0, StartTime: &today},
		},
	})
	tt := ui.NewTester(a.trayFlyoutView, 328, 420)
	tt.Frame()
	highTitle, ok1 := tt.Find("高优先级对齐测试任务")
	normalTitle, ok2 := tt.Find("普通优先级对齐测试任务")
	if !ok1 || !ok2 {
		t.Fatalf("missing tray task titles: high=%t normal=%t texts=%v", ok1, ok2, tt.Texts())
	}
	if highTitle.X != normalTitle.X {
		t.Fatalf("tray task titles misaligned by priority indicator: high.X=%.2f normal.X=%.2f", highTitle.X, normalTitle.X)
	}
}

func TestAntiFlickerSyncAndStableRowGeometry(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session = api.Session{Server: api.DefaultServer, User: api.User{ID: 1, Timezone: "UTC"}}

	existing := []api.Task{
		{ID: 10, Title: "已有较新任务", Status: "pending", Revision: 2},
		{ID: 5, Title: "已有较旧任务", Status: "pending", Revision: 1},
	}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, SavedAt: now, Tasks: existing})

	// 1. Background sync indicator (a.syncing) must never set a.busy or disable sidebar/task rows.
	a.syncing = true
	if a.busy {
		t.Fatal("background syncing must not set blocking a.busy")
	}
	tt := ui.NewTester(a.view, 1280, 800)
	tt.Frame()
	rowBefore, ok := tt.Access("任务行 已有较新任务")
	if !ok || rowBefore.Disabled {
		t.Fatalf("task row disabled during background sync: %+v", rowBefore)
	}
	inboxBtn, ok := tt.Access("收件箱")
	if !ok || inboxBtn.Disabled {
		t.Fatalf("sidebar disabled during background sync: %+v", inboxBtn)
	}
	a.syncing = false

	// 2. Optimistic task creation (ID < 0) sorts at top AND stays at top with identical widget key after server receipt.
	state, err := syncer.Enqueue(a.cache, "POST", "/tasks", map[string]any{"title": "新创建的置顶任务"}, 0)
	if err != nil {
		t.Fatal(err)
	}
	a.adoptCache(state)
	tt.Frame()
	orderedBefore := filteredTasks(a.tasks, "all", "", now)
	if len(orderedBefore) != 3 || orderedBefore[0].ID != -1 || orderedBefore[0].Title != "新创建的置顶任务" {
		t.Fatalf("optimistic local task should sort at index 0, got %+v", orderedBefore)
	}
	keyBefore := a.stableTaskKey(orderedBefore[0])
	newRowBefore, ok := tt.Access("任务行 新创建的置顶任务")
	if !ok || newRowBefore.Bounds.H != 52 {
		t.Fatalf("pending outbox task should keep crisp 52px row height without 待同步 bounce: %+v", newRowBefore)
	}

	// Mark sent and apply server receipt assigning positive ID = 500
	state.Outbox[0].Sent = true
	acked, err := syncer.ApplyTaskReceipt(state, state.Outbox[0].ID, api.Task{
		ID: 500, Title: "新创建的置顶任务", Status: "pending", Revision: 1,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	a.adoptCache(acked)
	tt.Frame()
	orderedAfter := filteredTasks(a.tasks, "all", "", now)
	if orderedAfter[0].ID != 500 {
		t.Fatalf("acked task teleported away from index 0: %+v", orderedAfter)
	}
	keyAfter := a.stableTaskKey(orderedAfter[0])
	if keyBefore != keyAfter {
		t.Fatalf("stableTaskKey changed across optimistic->server ID transition: %q -> %q", keyBefore, keyAfter)
	}
	newRowAfter, ok := tt.Access("任务行 新创建的置顶任务")
	if !ok || newRowAfter.Bounds != newRowBefore.Bounds {
		t.Fatalf("task row bounds shifted on sync receipt: before=%+v after=%+v", newRowBefore.Bounds, newRowAfter.Bounds)
	}

	// 3. Non-schedule edit on a recurring series updates Calendar in place without wiping Calendar snapshot.
	start := time.Date(2026, 11, 16, 9, 0, 0, 0, time.UTC)
	series := api.Task{ID: 77, Title: "晨会", Status: "pending", StartTime: &start, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`), Revision: 4}
	ev := api.CalendarEvent{ID: "77_20261116", Title: "晨会", Start: start.Format(time.RFC3339), End: start.Add(time.Hour).Format(time.RFC3339)}
	ev.ExtendedProps.TaskID = 77
	ev.ExtendedProps.IsRecurring = true
	calCache := storage.Cache{
		Server: api.DefaultServer, UserID: 1, SavedAt: now,
		Tasks: []api.Task{series},
		Calendar: &storage.CalendarSnapshot{
			Start: now.AddDate(0, 0, -7), End: now.AddDate(0, 0, 7), Timezone: "UTC", SavedAt: now,
			Events:          []api.CalendarEvent{ev},
			SeriesRevisions: map[int64]int64{77: 4},
		},
	}
	calCache, err = syncer.Enqueue(calCache, "PUT", "/tasks/77", map[string]any{"title": "产品晨会", "priority": 1}, 4)
	if err != nil {
		t.Fatal(err)
	}
	calCache.Outbox[0].Sent = true
	updatedSeries := series
	updatedSeries.Title = "产品晨会"
	updatedSeries.Priority = 1
	updatedSeries.Revision = 5
	calCache, err = syncer.ApplyTaskReceipt(calCache, calCache.Outbox[0].ID, updatedSeries, nil)
	if err != nil {
		t.Fatal(err)
	}
	if calCache.Calendar == nil || calCache.Calendar.SeriesRevisions[77] != 5 || calCache.Calendar.Events[0].Title != "产品晨会" {
		t.Fatalf("non-schedule series edit invalidated or failed to update calendar in place: %+v", calCache.Calendar)
	}

	// 4. Echoed own-write revision in pollRemote must be recognized as clean sync, not foreign conflict/device edit.
	if !sameTaskRevisions([]api.Task{{ID: 77, Revision: 4}}, []api.Task{{ID: 77, Revision: 5}}, calCache.LocalAckRevisions) {
		t.Fatal("sameTaskRevisions failed to recognize our own LocalAckRevisions")
	}
	if sameTaskRevisions([]api.Task{{ID: 77, Revision: 5}}, []api.Task{{ID: 77, Revision: 6}}, calCache.LocalAckRevisions) {
		t.Fatal("sameTaskRevisions ignored genuine newer revision from another device")
	}
}

func TestWYSIWYGToolbarAndInlineCategoryCreation(t *testing.T) {
	a := autosaveFixture(t)
	a.cache.Server = api.DefaultServer
	a.cache.UserID = 1
	tt := ui.NewTester(a.view, 1280, 900)
	tt.Frame()

	// 1. WYSIWYG toolbar buttons format document and serialize cleanly
	if err := tt.Click("备注"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type("所见即所得工具栏验证")
	tt.Frame()
	if err := tt.Click("一级标题"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if a.draft.Description != "# 所见即所得工具栏验证" {
		t.Fatalf("H1 toolbar button did not produce Markdown heading: %q", a.draft.Description)
	}

	// 2. Inline 1-click category creation & auto-attachment inside category popover
	if err := tt.Click("编辑分类"); err != nil {
		t.Fatal(err)
	}
	tt.Type("灵感速记")
	tt.Frame()
	if err := tt.Click("创建并关联分类 灵感速记"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	foundNewCat := false
	for _, cat := range a.categories {
		if cat.Name == "灵感速记" && a.draft.Categories[cat.ID] {
			foundNewCat = true
		}
	}
	if !foundNewCat {
		t.Fatalf("inline category creation did not create and attach category: cats=%+v selected=%+v", a.categories, a.draft.Categories)
	}
}

func TestCalendarModesZoomAndGhostPreview(t *testing.T) {
	loc := time.UTC
	day := time.Date(2026, 11, 16, 9, 0, 0, 0, loc)
	end := day.Add(90 * time.Minute)
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session = api.Session{Server: api.DefaultServer, User: api.User{ID: 1, Timezone: "UTC"}}
	a.page = "calendar"
	a.selectedDay = day
	task := api.Task{ID: 21, Title: "架构评审", Status: "pending", StartTime: &day, EndTime: &end, Priority: 1}
	ev := api.CalendarEvent{ID: "task-21", Title: "架构评审", Start: day.Format(time.RFC3339), End: end.Format(time.RFC3339)}
	ev.ExtendedProps.TaskID = 21
	ev.ExtendedProps.Status = "pending"
	startRange, endRange := calendarRange(day, 2)
	a.adoptCache(storage.Cache{
		Server: api.DefaultServer, UserID: 1, SavedAt: day,
		Tasks: []api.Task{task},
		Calendar: &storage.CalendarSnapshot{
			Start: startRange, End: endRange, Timezone: "UTC", SavedAt: day,
			Events: []api.CalendarEvent{ev},
		},
	})

	tt := ui.NewTester(a.view, 1280, 860)
	// Verify all 4 calendar modes render cleanly within bounds
	for _, modeLabel := range []string{"日", "周", "月", "日程"} {
		if err := tt.Click(modeLabel); err != nil {
			t.Fatalf("switching calendar mode %s: %v", modeLabel, err)
		}
		tt.Frame()
	}

	// Switch to Week mode, test zoom buttons and ghost drag preview
	if err := tt.Click("周"); err != nil {
		t.Fatal(err)
	}
	tt.Advance(500 * time.Millisecond)
	beforeZoom := a.calendarZoom
	if err := tt.Click("放大时间轴"); err != nil {
		t.Fatal(err)
	}
	tt.Advance(500 * time.Millisecond)
	if a.calendarZoom <= beforeZoom {
		t.Fatalf("zoom-in did not increase calendarZoom: before=%v after=%v", beforeZoom, a.calendarZoom)
	}

	// Drag timeline card down by 2 hours using real pointer events and verify ghost preview + drop rescheduling
	a.calendarScroll.Y = 7 * float32(a.calendarZoom)
	tt.Frame()
	card, ok := tt.AccessByRole(ui.RoleButton, "日程 2026-11-16 架构评审")
	if !ok {
		t.Fatal("missing week timeline card")
	}
	cx, cy := card.Bounds.X+card.Bounds.W/2, card.Bounds.Y+12
	tt.Press(cx, cy)
	tt.Move(cx, cy+2*float32(a.calendarZoom))
	tt.Frame()
	if !tt.HasText("11:00 – 12:30") {
		t.Fatalf("active timeline drag did not render ghost drop preview range: %v", tt.Texts())
	}
	tt.Release(cx, cy+2*float32(a.calendarZoom))
	tt.Frame()
	if len(a.cache.Outbox) == 0 {
		t.Fatal("dropping timeline event did not queue reschedule mutation")
	}

	// Verify Month View crowded day never overflows or gets overlapped by the row below at compact heights
	manyEvents := make([]api.CalendarEvent, 0, 8)
	for i := 0; i < 8; i++ {
		st := day.Add(time.Duration(i) * time.Hour)
		en := st.Add(45 * time.Minute)
		ce := api.CalendarEvent{
			ID:    "crowd-" + string(rune('a'+i)),
			Title: "密集测试日程 " + string(rune('A'+i)),
			Start: st.Format(time.RFC3339),
			End:   en.Format(time.RFC3339),
		}
		ce.ExtendedProps.ReadOnly = true
		manyEvents = append(manyEvents, ce)
	}
	a.cache.Calendar.Events = manyEvents
	a.calendarMode = 2
	for _, h := range []int{620, 720, 880} {
		tt.SetSize(1280, h)
		tt.Frame()
		tt.Frame() // second pass settles exact measured rowH
		topCell, ok1 := tt.Access("日历日期 2026-11-16")
		belowCell, ok2 := tt.Access("日历日期 2026-11-23")
		if !ok1 || !ok2 {
			t.Fatalf("missing month cells at height %d", h)
		}
		if topCell.Bounds.Y+topCell.Bounds.H > belowCell.Bounds.Y+1 {
			t.Fatalf("month cell overlapped next week row at height %d: top=%+v below=%+v", h, topCell.Bounds, belowCell.Bounds)
		}
		moreBtn, ok := tt.Access("更多日程 2026-11-16")
		if !ok || moreBtn.Bounds.Y+moreBtn.Bounds.H > belowCell.Bounds.Y+0.5 {
			t.Fatalf("month '+N 项' overflowed into next week row at height %d: more=%+v below=%+v", h, moreBtn.Bounds, belowCell.Bounds)
		}
	}
}

func intPtr(v int) *int { return &v }
