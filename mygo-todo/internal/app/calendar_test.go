package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func calendarFixture() (storage.Cache, time.Time) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	day := time.Date(2026, 11, 9, 0, 0, 0, 0, loc)
	start := day.Add(9 * time.Hour)
	series := api.Task{ID: 7, Title: "每日计划", Status: "pending", Revision: 3, StartTime: &start, RecurrenceRule: json.RawMessage("{\"freq\":\"daily\"}")}
	e := api.CalendarEvent{ID: "7_20261110", Title: "改期后的单次", Start: day.AddDate(0, 0, 2).Add(9 * time.Hour).Format(time.RFC3339), End: day.AddDate(0, 0, 2).Add(10 * time.Hour).Format(time.RFC3339)}
	e.ExtendedProps.TaskID, e.ExtendedProps.InstanceID, e.ExtendedProps.IsRecurring, e.ExtendedProps.Status = 7, e.ID, true, "pending"
	begin, end := calendarRange(day, 2)
	return storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{series}, SavedAt: day, Calendar: &storage.CalendarSnapshot{Start: begin, End: end, Timezone: loc.String(), SavedAt: day, Events: []api.CalendarEvent{e}, SeriesRevisions: map[int64]int64{7: 3}}}, day
}
func TestCalendarRangesAndNavigation(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	day := time.Date(2026, 3, 8, 12, 0, 0, 0, loc)
	start, end := calendarRange(day, 0)
	if end.Sub(start) != 23*time.Hour {
		t.Fatalf("DST day=%s", end.Sub(start))
	}
	start, end = calendarRange(day, 1)
	if start.Weekday() != time.Monday || end.Sub(start) != 167*time.Hour {
		t.Fatalf("DST week: %s — %s", start, end)
	}
	day = time.Date(2026, 1, 31, 9, 30, 0, 0, loc)
	shifted := calendarShift(day, 2, 1)
	if shifted.Month() != time.February || shifted.Day() != 28 || shifted.Hour() != 9 || shifted.Minute() != 30 {
		t.Fatal(shifted)
	}
	shifted = calendarShift(day, 2, -1)
	if shifted.Year() != 2025 || shifted.Month() != time.December || shifted.Day() != 31 {
		t.Fatal(shifted)
	}
	start, end = calendarRange(time.Date(2026, 11, 1, 0, 0, 0, 0, loc), 2)
	if start.Format("2006-01-02") != "2026-10-26" || end.Format("2006-01-02") != "2026-12-07" {
		t.Fatalf("month=%s — %s", start, end)
	}
}

func TestCalendarEventSourceFilter(t *testing.T) {
	task := api.CalendarEvent{ID: "task", Title: "本地任务"}
	external := api.CalendarEvent{ID: "external", Title: "外部日程"}
	external.ExtendedProps.ReadOnly = true
	external.ExtendedProps.Source = "caldav"
	events := []api.CalendarEvent{task, external}
	if got := filterCalendarEvents(events, 0); len(got) != 2 {
		t.Fatal(got)
	}
	if got := filterCalendarEvents(events, 1); len(got) != 1 || got[0].ID != "task" {
		t.Fatal(got)
	}
	if got := filterCalendarEvents(events, 2); len(got) != 1 || got[0].ID != "external" {
		t.Fatal(got)
	}
}

func TestCalendarRestoresDayAndWeekNearWorkingHours(t *testing.T) {
	for _, mode := range []string{"日", "周"} {
		store := storage.Store{Dir: t.TempDir()}
		if err := store.SavePreferences(storage.Preferences{CalendarView: mode}); err != nil {
			t.Fatal(err)
		}
		a := New(store)
		if a.calendarMode >= 2 || a.calendarScroll.Y != 7*float32(a.calendarZoom) {
			t.Fatalf("%s view restored at midnight: mode=%d scroll=%v", mode, a.calendarMode, a.calendarScroll.Y)
		}
		a.Close()
	}
}
func TestTimelineClipsAndReusesOverlapLanes(t *testing.T) {
	_, day := calendarFixture()
	makeEvent := func(id string, from, to int) api.CalendarEvent {
		return api.CalendarEvent{ID: id, Start: day.Add(time.Duration(from) * time.Minute).Format(time.RFC3339), End: day.Add(time.Duration(to) * time.Minute).Format(time.RFC3339)}
	}
	events := []api.CalendarEvent{makeEvent("a", 540, 660), makeEvent("b", 570, 600), makeEvent("c", 600, 660), makeEvent("d", 660, 720), makeEvent("cross", -30, 30)}
	segments := timelineSegments(events, day)
	if len(segments) != 5 || segments[0].From != 0 || segments[0].To != 30 {
		t.Fatal(segments)
	}
	byID := make(map[string]calendarSegment)
	for _, s := range segments {
		byID[s.Event.ID] = s
	}
	if byID["a"].Lanes != 2 || byID["b"].Lane != byID["c"].Lane || byID["d"].Lanes != 1 {
		t.Fatal(segments)
	}
	for i, a := range segments {
		for _, b := range segments[i+1:] {
			if a.Lane == b.Lane && a.From < b.To && b.From < a.To {
				t.Fatal("overlap in same lane", a, b)
			}
		}
	}
	events = []api.CalendarEvent{makeEvent("midnight", 1380, 1440), {ID: "all-day", Start: day.Format("2006-01-02"), AllDay: true}}
	if got := eventsForDay(events, day.AddDate(0, 0, 1)); len(got) != 0 {
		t.Fatal(got)
	}
	if got := eventsForDay(events, day); len(got) != 2 || !got[0].AllDay {
		t.Fatal(got)
	}
}
func TestCalendarProjectionOfflineWritesAndRestart(t *testing.T) {
	state, day := calendarFixture()
	start, end := day.Add(8*time.Hour), day.Add(10*time.Hour)
	state.Tasks = append(state.Tasks, api.Task{ID: 2, Title: "普通任务", Status: "pending", Revision: 1, StartTime: &start, EndTime: &end})
	var err error
	state, err = syncer.Enqueue(state, "POST", "/tasks", map[string]any{"title": "离线创建", "start_time": day.Add(14 * time.Hour)}, 0)
	if err != nil {
		t.Fatal(err)
	}
	state, err = syncer.Enqueue(state, "PUT", "/tasks/2", map[string]any{"title": "离线改期", "start_time": day.AddDate(0, 0, 1).Add(8 * time.Hour), "end_time": day.AddDate(0, 0, 1).Add(10 * time.Hour)}, 1)
	if err != nil {
		t.Fatal(err)
	}
	events := projectedCalendar(state)
	if len(events) != 3 || len(eventsForDay(events, day)) != 1 || len(eventsForDay(events, day.AddDate(0, 0, 1))) != 1 {
		t.Fatal(events)
	}
	if state.Tasks[1].Title != "普通任务" || !state.Tasks[1].StartTime.Equal(start) {
		t.Fatal("canonical task changed")
	}
	state, err = syncer.Enqueue(state, "DELETE", "/tasks/2", nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	if got := projectedCalendar(state); len(got) != 2 {
		t.Fatal(got)
	}
	store := storage.Store{Dir: t.TempDir()}
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Cache(state.Server, 1)
	if err != nil {
		t.Fatal(err)
	}
	if got := projectedCalendar(restored); len(got) != 2 {
		t.Fatal("offline calendar lost", got)
	}
}
func TestCalendarOnlyInstanceStatusSurvivesAcknowledgement(t *testing.T) {
	state, _ := calendarFixture()
	body := map[string]string{"status": "completed", "instance_id": "7_20261110", "occurrence_date": "2026-11-10"}
	var err error
	state, err = syncer.Enqueue(state, "PATCH", "/tasks/7/status", body, 3)
	if err != nil {
		t.Fatal(err)
	}
	if got := projectedCalendar(state); len(got) != 1 || got[0].ExtendedProps.Status != "completed" {
		t.Fatal(got)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var got map[string]string
		_ = json.NewDecoder(r.Body).Decode(&got)
		if got["instance_id"] != "7_20261110" || got["occurrence_date"] != "2026-11-10" {
			t.Error(got)
		}
		series := state.Tasks[0]
		series.Revision = 4
		_ = json.NewEncoder(w).Encode(series)
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	state, err = syncer.Flush(context.Background(), client, storage.Store{Dir: t.TempDir()}, state)
	if err != nil {
		t.Fatal(err)
	}
	if state.Calendar.Events[0].ExtendedProps.Status != "completed" {
		t.Fatal("confirmed status lost")
	}
	if got := projectedCalendar(state); len(got) != 1 || got[0].ExtendedProps.Status != "completed" {
		t.Fatal(got)
	}
	state.Tasks[0].Revision = 5
	if got := projectedCalendar(state); len(got) != 0 {
		t.Fatal("stale series expansion survived a remote edit", got)
	}
}

func TestOfflineOccurrenceDescriptionKeepsCalendarVisible(t *testing.T) {
	state, _ := calendarFixture()
	var err error
	state, err = syncer.Enqueue(state, "PUT", "/tasks/7", map[string]string{"instance_id": "7_20261110", "occurrence_date": "2026-11-10", "description": "离线记录"}, 3)
	if err != nil {
		t.Fatal(err)
	}
	got := projectedCalendar(state)
	if len(got) != 1 || got[0].ExtendedProps.Description != "离线记录" || got[0].ExtendedProps.Status != "pending" {
		t.Fatal("scoped description hid the series or changed its status", got)
	}
}
func TestNativeCalendarModesOpenInstanceAndCreateSlot(t *testing.T) {
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	a.adoptCache(state)
	a.page = "calendar"
	a.selectedDay = day
	tt := ui.NewTester(a.view, 1280, 900)
	label := "日程 2026-11-11 改期后的单次"
	if _, ok := tt.AccessByRole(ui.RoleButton, label); !ok {
		t.Fatal("month event inaccessible", tt.Texts())
	}
	if err := tt.Click(label); err != nil {
		t.Fatal(err)
	}
	if a.selectedOccurrence == nil || a.selectedOccurrence.OccurrenceDate != "2026-11-10" || a.selectedOccurrence.StartTime.Day() != 11 {
		t.Fatal(a.selectedOccurrence)
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "编辑整个系列"); !ok {
		t.Fatal("series editing must be directly accessible in occurrence toolbar")
	}
	if err := tt.Click("编辑整个系列"); err != nil {
		t.Fatal(err)
	}
	if !a.draft.Start.Equal(*state.Tasks[0].StartTime) {
		t.Fatal("series anchor changed")
	}
	if err := tt.Click("关闭"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("周"); err != nil {
		t.Fatal(err)
	}
	if a.calendarMode != 1 {
		t.Fatal("week mode not selected")
	}
	slot := fmt.Sprintf("在 %s 14:00 添加日程", day.Format("2006-01-02"))
	if err := tt.Click(slot); err != nil {
		t.Fatal(err)
	}
	if !a.editing || !a.draft.HasStart || a.draft.Start.Hour() != 14 || a.draft.End.Sub(a.draft.Start) != time.Hour {
		t.Fatal(a.draft)
	}
	if err := tt.Click("关闭"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("日程"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("日历定位日期"); err != nil {
		t.Fatal(err)
	}
	if _, ok := tt.AccessByRole(ui.RoleTable, "跳转日历日期"); !ok {
		t.Fatal("missing calendar picker")
	}
	prefs, err := a.store.Preferences()
	if err != nil || prefs.CalendarView != "日程" {
		t.Fatal(prefs, err)
	}
}
func TestCalendarCoverageReadOnlyAndInvalidInstance(t *testing.T) {
	state, day := calendarFixture()
	start, end := calendarRange(day, 1)
	if !calendarCovered(state, start, end, "Asia/Shanghai") {
		t.Fatal("cached week not covered")
	}
	if calendarCovered(state, start, end, "America/New_York") {
		t.Fatal("timezone mismatch")
	}
	state.SavedAt = state.SavedAt.Add(time.Second)
	if calendarCovered(state, start, end, "Asia/Shanghai") {
		t.Fatal("stale snapshot")
	}
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	a.adoptCache(state)
	event := state.Calendar.Events[0]
	event.ExtendedProps.InstanceID = "8_20261110"
	if _, err := a.calendarTask(event); err == nil {
		t.Fatal("wrong instance accepted")
	}
	event.ExtendedProps.ReadOnly = true
	event.ExtendedProps.Location = "会议室 A"
	event.ExtendedProps.Organizer = "日历管理员"
	a.openCalendarEvent(event)
	if a.calendarDetail == nil || a.editing || a.selectedOccurrence != nil {
		t.Fatal("read-only event opened editor")
	}
	tt := ui.NewTester(a.view, 1000, 760)
	if _, ok := tt.AccessByRole(ui.RoleDialog, ""); !ok || !tt.HasText("地点：会议室 A") || !tt.HasText("组织者：日历管理员") {
		t.Fatal("missing native read-only details", tt.Texts())
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok {
		t.Fatal("external event offered a write action")
	}
	if err := tt.Click("关闭日程"); err != nil || a.calendarDetail != nil {
		t.Fatal("cannot close external event", err)
	}
}

func TestNativeTimelineFillsWorkspaceAfterResize(t *testing.T) {
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	a.adoptCache(state)
	a.page, a.calendarMode, a.selectedDay = "calendar", 0, day.AddDate(0, 0, 2)
	a.calendarScroll.Y = 7 * float32(a.calendarZoom)
	tt := ui.NewTester(a.view, 1280, 900)
	for _, width := range []int{900, 1280, 1536} {
		tt.SetSize(width, 900)
		slot, ok := tt.AccessByRole(ui.RoleButton, "在 2026-11-11 10:00 添加日程")
		available := float32(width)
		if width >= 1180 {
			available -= a.sidebarWidth + 1
		}
		// Full-bleed Google Calendar canvas: 56px hour gutter + day column filling to window edge.
		if !ok || slot.Bounds.W < available-60 || slot.Bounds.X+slot.Bounds.W > float32(width)+1 {
			t.Fatalf("day canvas does not fill width %d: %+v", width, slot)
		}
	}
	tt.SetDark(true)
	if err := tt.Click("周"); err != nil {
		t.Fatal(err)
	}
	first, ok := tt.AccessByRole(ui.RoleButton, "在 2026-11-09 10:00 添加日程")
	last, lastOK := tt.AccessByRole(ui.RoleButton, "在 2026-11-15 10:00 添加日程")
	if !ok || !lastOK || last.Bounds.X+last.Bounds.W < 1500 || first.Bounds.W < 149 {
		t.Fatal("week canvas does not fill wide window", first, last)
	}
}

func TestAllDaySpansPackingAndCrossWeekContinuations(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	week1 := time.Date(2026, 11, 9, 0, 0, 0, 0, loc)  // Mon Nov 9
	week2 := time.Date(2026, 11, 16, 0, 0, 0, 0, loc) // Mon Nov 16

	events := []api.CalendarEvent{
		{ID: "cross-week", Title: "跨周峰会", Start: "2026-11-13", End: "2026-11-18", AllDay: true}, // Fri–Tue
		{ID: "mid-week", Title: "周中两日", Start: "2026-11-18", End: "2026-11-20", AllDay: true},   // Wed–Thu
		{ID: "overlap", Title: "周二单日", Start: "2026-11-17", End: "2026-11-18", AllDay: true},    // Tue
		{ID: "timed", Title: "普通时段", Start: "2026-11-18T10:00:00+08:00", End: "2026-11-18T11:00:00+08:00", AllDay: false},
	}

	spans1, lanes1 := allDaySpansForRange(events, week1, 7)
	if lanes1 != 1 || len(spans1) != 1 {
		t.Fatalf("week1 spans: lanes=%d spans=%+v", lanes1, spans1)
	}
	if spans1[0].StartCol != 4 || spans1[0].Span != 3 || spans1[0].ContinuesLeft || !spans1[0].ContinuesRight {
		t.Fatalf("unexpected week1 cross-week span: %+v", spans1[0])
	}

	spans2, lanes2 := allDaySpansForRange(events, week2, 7)
	if lanes2 != 2 || len(spans2) != 3 {
		t.Fatalf("week2 spans: lanes=%d spans=%+v", lanes2, spans2)
	}
	byID := map[string]allDaySpan{}
	for _, sp := range spans2 {
		byID[sp.Event.ID] = sp
	}
	if cw := byID["cross-week"]; cw.StartCol != 0 || cw.Span != 2 || !cw.ContinuesLeft || cw.ContinuesRight || cw.Lane != 0 {
		t.Fatalf("unexpected week2 continuation: %+v", cw)
	}
	if ov := byID["overlap"]; ov.StartCol != 1 || ov.Span != 1 || ov.Lane != 1 {
		t.Fatalf("overlap did not move to lane 1: %+v", ov)
	}
	if mw := byID["mid-week"]; mw.StartCol != 2 || mw.Span != 2 || mw.Lane != 0 {
		t.Fatalf("non-overlapping span did not reuse lane 0: %+v", mw)
	}
}

func TestMultiDayAllDayContinuousSpanInMonthAndWeekViews(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	base := time.Date(2026, 11, 16, 0, 0, 0, 0, loc)
	sAll := time.Date(2026, 11, 18, 0, 0, 0, 0, loc)
	eAll := time.Date(2026, 11, 20, 0, 0, 0, 0, loc)
	sTimed := time.Date(2026, 11, 18, 10, 0, 0, 0, loc)
	eTimed := time.Date(2026, 11, 18, 11, 0, 0, 0, loc)

	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	startRange, endRange := calendarRange(base, 2)
	a.adoptCache(storage.Cache{
		Server:  api.DefaultServer,
		UserID:  1,
		SavedAt: base,
		Tasks: []api.Task{
			{ID: 301, Title: "年度技术架构峰会", Status: "pending", AllDay: true, StartTime: &sAll, EndTime: &eAll, Revision: 1},
			{ID: 302, Title: "当日技术评审", Status: "pending", StartTime: &sTimed, EndTime: &eTimed, Revision: 1},
		},
		Calendar: &storage.CalendarSnapshot{
			Start: startRange, End: endRange, Timezone: "Asia/Shanghai", SavedAt: base,
		},
	})
	a.page = "calendar"
	a.selectedDay = base
	a.calendarMode = 2

	tt := ui.NewTester(a.view, 1440, 900)
	tt.Frame()
	tt.Frame()

	// Month View: single continuous bar spanning col 18 and col 19, no duplicate chopped bar on 19
	cell18, ok18 := tt.Access("日历日期 2026-11-18")
	if !ok18 {
		t.Fatal("missing month cell 2026-11-18")
	}
	spanBtn, okSpan := tt.AccessByRole(ui.RoleButton, "日程 2026-11-18 年度技术架构峰会")
	if !okSpan {
		t.Fatalf("missing spanning all-day bar in month view: %v", tt.Texts())
	}
	if _, dup := tt.AccessByRole(ui.RoleButton, "日程 2026-11-19 年度技术架构峰会"); dup {
		t.Fatal("multi-day all-day event was chopped into a duplicate bar on day 19 in month view")
	}
	if spanBtn.Bounds.W < cell18.Bounds.W*1.8 {
		t.Fatalf("month spanning bar too narrow (not spanning 2 columns): spanW=%.1f colW=%.1f", spanBtn.Bounds.W, cell18.Bounds.W)
	}
	timedBtn, okTimed := tt.AccessByRole(ui.RoleButton, "日程 2026-11-18 当日技术评审")
	if !okTimed {
		t.Fatal("missing timed event on day 18")
	}
	if timedBtn.Bounds.Y < spanBtn.Bounds.Y+spanBtn.Bounds.H {
		t.Fatalf("timed event overlapped spanning all-day bar: span=%+v timed=%+v", spanBtn.Bounds, timedBtn.Bounds)
	}
	// Click spanning bar opens task editor
	if err := tt.Click("日程 2026-11-18 年度技术架构峰会"); err != nil {
		t.Fatal(err)
	}
	if !a.editing || a.draft.Task.ID != 301 {
		t.Fatalf("clicking month spanning bar did not open task 301: editing=%v id=%d", a.editing, a.draft.Task.ID)
	}
	a.clearTaskSelection()

	// Week View: continuous spanning ribbon in dedicated all-day strip
	a.calendarMode = 1
	tt.Frame()
	tt.Frame()
	col18, okCol := tt.Access("全天栏 2026-11-18")
	if !okCol {
		t.Fatal("missing week all-day drop column 2026-11-18")
	}
	wkSpan, okWk := tt.AccessByRole(ui.RoleButton, "日程 2026-11-18 年度技术架构峰会")
	if !okWk {
		t.Fatalf("missing spanning all-day bar in week view: %v", tt.Texts())
	}
	if _, dup := tt.AccessByRole(ui.RoleButton, "日程 2026-11-19 年度技术架构峰会"); dup {
		t.Fatal("multi-day all-day event was chopped into duplicate bar on day 19 in week view")
	}
	if wkSpan.Bounds.W < col18.Bounds.W*1.8 {
		t.Fatalf("week spanning bar too narrow (not spanning 2 columns): spanW=%.1f colW=%.1f", wkSpan.Bounds.W, col18.Bounds.W)
	}
}

func TestAgendaTypographyWidthCapMultiDayAndInlineExternalBadge(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	base := time.Date(2026, 11, 16, 0, 0, 0, 0, loc)
	s1 := time.Date(2026, 11, 16, 9, 30, 0, 0, loc)
	e1 := time.Date(2026, 11, 16, 11, 0, 0, 0, loc)
	sAll := time.Date(2026, 11, 18, 0, 0, 0, 0, loc)
	eAll := time.Date(2026, 11, 20, 0, 0, 0, 0, loc)

	richMD := "## 核心体验升级清单\n\n本次重构采用温润的纸感配色与轻量图标表达。\n\n- [x] 第一项\n- [ ] 第二项\n\n| 模块 | 状态 |\n| --- | --- |\n| 日历 | 完成 |"
	if got := agendaSummaryText(richMD); got != "本次重构采用温润的纸感配色与轻量图标表达。" {
		t.Fatalf("agendaSummaryText leaked markdown or dots: %q", got)
	}
	plainLong := strings.Repeat("长摘要 Chinese English\n", 100)
	if agendaSummaryText(plainLong) != plainMarkdownPreview(plainLong) {
		t.Fatal("agendaSummaryText diverged from plainMarkdownPreview on single plain paragraph")
	}

	extEv := api.CalendarEvent{
		ID:    "ext-agenda-1",
		Title: "外部团队设计同步会",
		Start: time.Date(2026, 11, 16, 13, 30, 0, 0, loc).Format(time.RFC3339),
		End:   time.Date(2026, 11, 16, 14, 30, 0, 0, loc).Format(time.RFC3339),
	}
	extEv.ExtendedProps.ReadOnly = true
	extEv.ExtendedProps.Source = "caldav"

	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	startRange, endRange := calendarRange(base, 2)
	a.adoptCache(storage.Cache{
		Server:  api.DefaultServer,
		UserID:  1,
		SavedAt: base,
		Tasks: []api.Task{
			{ID: 401, Title: "重构客户端 UI", Description: richMD, Status: "pending", StartTime: &s1, EndTime: &e1, Revision: 1},
			{ID: 402, Title: "年度技术架构峰会", Description: "压测准备", Status: "pending", AllDay: true, StartTime: &sAll, EndTime: &eAll, Revision: 1},
		},
		Calendar: &storage.CalendarSnapshot{
			Start: startRange, End: endRange, Timezone: "Asia/Shanghai", SavedAt: base,
			Events: []api.CalendarEvent{extEv},
		},
	})
	a.page = "calendar"
	a.selectedDay = base
	a.calendarMode = 3

	// Render Agenda at ultrawide 1600px to verify 840px reading width cap & inline badge placement
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		ui.Column(c).Fill().Children(func() { a.calendarView(c) })
	}, 1600, 900)
	tt.Frame()

	if !tt.HasText("本次重构采用温润的纸感配色与轻量图标表达。") {
		t.Fatalf("clean agenda summary missing: %v", tt.Texts())
	}
	for _, txt := range tt.Texts() {
		if strings.Contains(txt, "核心体验升级清单 ·") {
			t.Fatalf("agenda still rendered noisy dot-concatenated markdown: %q", txt)
		}
	}
	if !tt.HasText("第 1/2 天 · 11/18–11/19") || !tt.HasText("第 2/2 天 · 11/18–11/19") {
		t.Fatalf("agenda missing clear multi-day indicators: %v", tt.Texts())
	}
	extBadge, okBadge := tt.Find("外部")
	extTitle, okTitle := tt.Find("外部团队设计同步会")
	if !okBadge || !okTitle {
		t.Fatalf("missing external badge or title in agenda: %v", tt.Texts())
	}
	// External badge must sit right next to the event title (not stranded 800px away at the right window edge)
	if gap := extBadge.X - (extTitle.X + extTitle.W); gap < 0 || gap > 120 {
		t.Fatalf("external cloud badge stranded too far from title: title=%+v badge=%+v gap=%.1f", extTitle, extBadge, gap)
	}
	// Centered 840px reading stream inside 1600px viewport: right edge must stay <= (1600+840)/2 = 1220
	if extBadge.X+extBadge.W > 1225 {
		t.Fatalf("agenda content exceeded 840px reading cap on 1600px screen: badge=%+v", extBadge)
	}
}

func TestCalendarFloatingDetailDrawerDoesNotDeformGridOrToolbar(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	base := time.Date(2026, 11, 16, 0, 0, 0, 0, loc)
	s1 := time.Date(2026, 11, 16, 9, 30, 0, 0, loc)
	e1 := time.Date(2026, 11, 16, 11, 0, 0, 0, loc)

	for _, tc := range []struct {
		name string
		dark bool
		bar  ui.TitleBar
	}{
		{"macos-light", false, ui.TitleBar{Height: 38, Left: 78, Right: 0}},
		{"windows-dark", true, ui.TitleBar{Height: 40, Left: 0, Right: 138}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			a.client, _ = api.New(api.DefaultServer, "")
			a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
			startRange, endRange := calendarRange(base, 2)
			task := api.Task{ID: 501, Title: "抽屉联调验证", Status: "pending", StartTime: &s1, EndTime: &e1, Revision: 1}
			a.adoptCache(storage.Cache{
				Server:  api.DefaultServer,
				UserID:  1,
				SavedAt: base,
				Tasks:   []api.Task{task},
				Calendar: &storage.CalendarSnapshot{
					Start: startRange, End: endRange, Timezone: "Asia/Shanghai", SavedAt: base,
				},
			})
			a.page = "calendar"
			a.selectedDay = base

			for _, mode := range []int{2, 1, 0} {
				a.calendarMode = mode
				a.clearTaskSelection()
				tt := ui.NewTester(a.view, 1440, 900)
				tt.SetDark(tc.dark)
				tt.SetTitleBar(tc.bar)
				tt.Frame()
				tt.Frame()

				toolbarLabels := []string{"回到今天", "上一段", "下一段", "日历定位日期", "日程来源", "日", "周", "月", "日程", "添加日程"}
				toolbarBefore := make(map[string]ui.Rect, len(toolbarLabels))
				for _, label := range toolbarLabels {
					node, ok := tt.Access(label)
					if !ok {
						t.Fatalf("mode=%d missing toolbar control %q before drawer", mode, label)
					}
					toolbarBefore[label] = node.Bounds
				}

				colCount := 7
				if mode == 0 {
					colCount = 1
				}
				colsBefore := make(map[string]ui.Rect, colCount)
				for d := 0; d < colCount; d++ {
					dayStr := base.AddDate(0, 0, d).Format("2006-01-02")
					target := "日历日期 " + dayStr
					if mode < 2 {
						target = "全天栏 " + dayStr
					}
					col, ok := tt.Access(target)
					if !ok {
						t.Fatalf("mode=%d missing day column %q before drawer", mode, target)
					}
					colsBefore[target] = col.Bounds
				}

				// Open built-in task detail in floating overlay drawer
				a.editTaskNow(task)
				tt.Frame()
				tt.Frame()

				drawer, ok := tt.Access("详情侧边抽屉")
				if !ok {
					t.Fatalf("mode=%d floating detail drawer did not open", mode)
				}
				if drawer.Bounds.W < detailMinWidth || drawer.Bounds.X+drawer.Bounds.W < 1439 || drawer.Bounds.Y != 0 || drawer.Bounds.H < 899 {
					t.Fatalf("mode=%d floating drawer geometry unexpected: %+v", mode, drawer.Bounds)
				}

				// Calendar toolbar & every day column must stay 100% unchanged (0px shift/resize)
				for label, before := range toolbarBefore {
					after, ok := tt.Access(label)
					if !ok || after.Bounds != before {
						t.Fatalf("mode=%d floating drawer deformed toolbar %q: before=%+v after=%+v", mode, label, before, after.Bounds)
					}
				}
				for target, before := range colsBefore {
					after, ok := tt.Access(target)
					if !ok || after.Bounds != before {
						t.Fatalf("mode=%d floating drawer deformed column %q: before=%+v after=%+v", mode, target, before, after.Bounds)
					}
				}
			}
		})
	}
}

func TestCalendarEventsHaveNoHoverTooltips(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	base := time.Date(2026, 11, 16, 0, 0, 0, 0, loc)
	sAll := time.Date(2026, 11, 18, 0, 0, 0, 0, loc)
	eAll := time.Date(2026, 11, 20, 0, 0, 0, 0, loc)
	sTimed := time.Date(2026, 11, 18, 10, 0, 0, 0, loc)
	eTimed := time.Date(2026, 11, 18, 11, 0, 0, 0, loc)

	extEv := api.CalendarEvent{
		ID:    "ext-tooltip-1",
		Title: "外部只读评审",
		Start: time.Date(2026, 11, 18, 14, 0, 0, 0, loc).Format(time.RFC3339),
		End:   time.Date(2026, 11, 18, 15, 0, 0, 0, loc).Format(time.RFC3339),
	}
	extEv.ExtendedProps.ReadOnly = true
	extEv.ExtendedProps.Source = "caldav"

	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	startRange, endRange := calendarRange(base, 2)
	a.adoptCache(storage.Cache{
		Server:  api.DefaultServer,
		UserID:  1,
		SavedAt: base,
		Tasks: []api.Task{
			{ID: 601, Title: "跨天全天任务", Status: "pending", AllDay: true, StartTime: &sAll, EndTime: &eAll, Revision: 1},
			{ID: 602, Title: "时段评审任务", Status: "pending", StartTime: &sTimed, EndTime: &eTimed, Revision: 1},
		},
		Calendar: &storage.CalendarSnapshot{
			Start: startRange, End: endRange, Timezone: "Asia/Shanghai", SavedAt: base,
			Events: []api.CalendarEvent{extEv},
		},
	})
	a.page = "calendar"
	a.selectedDay = base

	assertNoTooltipOnHover := func(tt *ui.Tester, targetName string, r ui.Rect) {
		t.Helper()
		tt.Move(r.X+r.W/2, r.Y+r.H/2)
		tt.Advance(2 * time.Second)
		tt.Frame()
		for _, node := range tt.AccessAll() {
			if node.Role == ui.RoleTooltip && !node.Offscreen {
				t.Fatalf("hovering %q rendered dark tooltip overlay: %+v", targetName, node)
			}
		}
	}

	// Month view: all-day span bar, timed event, resize handle, and toolbar controls
	a.calendarMode = 2
	tt := ui.NewTester(a.view, 1440, 900)
	tt.Frame()
	tt.Frame()
	for _, label := range []string{
		"日程 2026-11-18 跨天全天任务",
		"日程 2026-11-18 时段评审任务",
		"调整结束 2026-11-19 跨天全天任务",
		"回到今天",
		"日历定位日期",
		"日程来源",
		"添加日程",
	} {
		node, ok := tt.Access(label)
		if !ok {
			t.Fatalf("month view missing %q", label)
		}
		assertNoTooltipOnHover(tt, label, node.Bounds)
	}

	// Week view: timeline card, all-day span bar, and timeline resize handle
	a.calendarMode = 1
	a.calendarScroll.Y = 8 * float32(a.calendarZoom)
	tt.Frame()
	tt.Frame()
	for _, label := range []string{
		"日程 2026-11-18 跨天全天任务",
		"日程 2026-11-18 时段评审任务",
		"调整结束 2026-11-18 时段评审任务",
	} {
		node, ok := tt.Access(label)
		if !ok {
			t.Fatalf("week view missing %q", label)
		}
		assertNoTooltipOnHover(tt, label, node.Bounds)
	}

	// Agenda view: multi-day pill and external read-only badge
	a.calendarMode = 3
	tt.Frame()
	tt.Frame()
	for _, text := range []string{"第 1/2 天 · 11/18–11/19", "外部"} {
		rect, ok := tt.Find(text)
		if !ok {
			t.Fatalf("agenda view missing %q", text)
		}
		assertNoTooltipOnHover(tt, text, rect)
	}
}

func TestCalendarFloatingDetailDrawerEscapePopoverIMEAndBackdrop(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	base := time.Date(2026, 11, 16, 0, 0, 0, 0, loc)
	s1 := time.Date(2026, 11, 16, 10, 0, 0, 0, loc)
	e1 := time.Date(2026, 11, 16, 11, 0, 0, 0, loc)

	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	startRange, endRange := calendarRange(base, 2)
	task := api.Task{ID: 701, Title: "悬浮抽屉交互验证", Status: "pending", StartTime: &s1, EndTime: &e1, Revision: 1}
	a.adoptCache(storage.Cache{
		Server:  api.DefaultServer,
		UserID:  1,
		SavedAt: base,
		Tasks:   []api.Task{task},
		Calendar: &storage.CalendarSnapshot{
			Start: startRange, End: endRange, Timezone: "Asia/Shanghai", SavedAt: base,
		},
	})
	a.page = "calendar"
	a.selectedDay = base
	a.calendarMode = 2

	tt := ui.NewTester(a.view, 1440, 900)
	tt.Frame()
	tt.Frame()

	// 1. Click calendar task -> floating drawer opens; Esc closes it immediately.
	if err := tt.Click("日程 2026-11-16 悬浮抽屉交互验证"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if _, ok := tt.Access("详情侧边抽屉"); !ok || !a.editing {
		t.Fatal("floating detail drawer did not open")
	}
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if _, ok := tt.Access("详情侧边抽屉"); ok || a.editing {
		t.Fatal("Esc did not close floating detail drawer")
	}

	// 2. Re-open, open a nested property popover -> first Esc closes ONLY the popover,
	//    second Esc closes the floating drawer.
	if err := tt.Click("日程 2026-11-16 悬浮抽屉交互验证"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if err := tt.Click("编辑优先级"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if a.taskMetaOpen != "priority" {
		t.Fatalf("expected priority popover open, got %q", a.taskMetaOpen)
	}
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if a.taskMetaOpen != "" {
		t.Fatalf("first Esc did not close priority popover: %q", a.taskMetaOpen)
	}
	if _, ok := tt.Access("详情侧边抽屉"); !ok || !a.editing {
		t.Fatal("first Esc closed floating drawer while nested popover was open")
	}
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if _, ok := tt.Access("详情侧边抽屉"); ok || a.editing {
		t.Fatal("second Esc did not close floating drawer after popover closed")
	}

	// 3. Re-open, focus title and start real IME composition -> Esc must NOT close the drawer.
	if err := tt.Click("日程 2026-11-16 悬浮抽屉交互验证"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if err := tt.Click("任务标题"); err != nil {
		t.Fatal(err)
	}
	tt.Compose("zhongwen", 8)
	tt.Frame()
	if !a.autosave.composing {
		t.Fatal("expected active IME composition on title input")
	}
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if !a.editing {
		t.Fatal("Esc closed floating drawer during active IME composition")
	}
	tt.Compose("", 0)
	tt.Frame()

	// 4. Clicking empty padding inside the floating drawer keeps it open.
	drawer, ok := tt.Access("详情侧边抽屉")
	if !ok {
		t.Fatal("missing floating drawer")
	}
	tt.ClickAt(drawer.Bounds.X+drawer.Bounds.W-6, drawer.Bounds.Y+drawer.Bounds.H-6)
	tt.Frame()
	if !a.editing {
		t.Fatal("clicking inside floating drawer unexpectedly dismissed it")
	}

	// 5. Clicking outside on the backdrop dismisses the floating drawer cleanly
	//    without opening a new calendar task underneath.
	tt.ClickAt(drawer.Bounds.X-80, 420)
	tt.Frame()
	if a.editing || a.selectedOccurrence != nil {
		t.Fatal("clicking outside backdrop did not dismiss floating drawer")
	}
	if _, ok := tt.Access("详情侧边抽屉"); ok {
		t.Fatal("floating drawer remained mounted after backdrop click")
	}
}
