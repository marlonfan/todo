package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
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
