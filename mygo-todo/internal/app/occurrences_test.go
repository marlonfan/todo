package app

import (
	"encoding/json"
	"slices"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTodayAndUpcomingIncludeOverdueAndBoundSevenLocalDays(t *testing.T) {
	// DST ends within this seven-calendar-day window: 7*24h is incorrect.
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 29, 15, 0, 0, 0, loc)
	day := time.Date(2026, 10, 29, 0, 0, 0, 0, loc)
	var tasks []api.Task
	for _, v := range []struct {
		id   int64
		date time.Time
	}{
		{1, day.AddDate(0, 0, -3)}, {2, day}, {3, day.AddDate(0, 0, 1)},
		{4, day.AddDate(0, 0, 7).Add(-time.Nanosecond)}, {5, day.AddDate(0, 0, 7)},
	} {
		tasks = append(tasks, api.Task{ID: v.id, Status: "pending", DueDate: &v.date})
	}
	tasks = append(tasks, api.Task{ID: 6, Status: "pending"}, api.Task{ID: 7, Status: "completed", StartTime: &day})
	for _, tc := range []struct {
		page string
		want []int64
	}{
		{"today", []int64{1, 2}}, {"upcoming", []int64{1, 2, 3, 4}},
	} {
		var ids []int64
		for _, task := range filteredTasks(tasks, tc.page, "", now) {
			ids = append(ids, task.ID)
		}
		slices.Sort(ids)
		if !slices.Equal(ids, tc.want) {
			t.Errorf("%s: got %v, want %v", tc.page, ids, tc.want)
		}
	}
}

func TestRecurringProjectionDoesNotReuseSeriesAnchorOrAddressDate(t *testing.T) {
	loc, _ := time.LoadLocation("America/Los_Angeles")
	anchor := time.Date(2026, 1, 1, 9, 0, 0, 0, loc)
	now := time.Date(2026, 11, 9, 12, 0, 0, 0, loc)
	nextStart := time.Date(2026, 11, 10, 9, 0, 0, 0, loc)
	originalDate := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	series := api.Task{ID: 1, Title: "每日阅读", Description: "系列描述", Status: "pending", Revision: 8, StartTime: &anchor, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	next := api.Occurrence{TaskID: 1, InstanceID: "1_20261110", OriginalDate: originalDate, StartTime: nextStart, Status: "pending"}
	history := next
	history.InstanceID, history.Status = "1_20261109", "completed"
	history.StartTime, history.OriginalDate = nextStart.AddDate(0, 0, -1), originalDate.AddDate(0, 0, -1)
	rows := projectTasks([]api.Task{series}, []api.Occurrence{next}, []api.Occurrence{history, history})
	if len(rows) != 2 || rows[0].OccurrenceDate != "2026-11-10" || rows[0].Revision != 8 {
		t.Fatalf("rows: %+v", rows)
	}
	if got := filteredTasks(rows, "today", "", now); len(got) != 0 {
		t.Fatalf("series anchor leaked into today: %+v", got)
	}
	if got := filteredTasks(rows, "completed", "", now); len(got) != 1 || got[0].InstanceID != history.InstanceID {
		t.Fatalf("history: %+v", got)
	}
	if !series.StartTime.Equal(anchor) || series.InstanceID != "" {
		t.Fatal("projection mutated the series")
	}
	if got := projectTasks([]api.Task{series}, nil, nil); len(got) != 0 {
		t.Fatal("exhausted recurrence should be hidden")
	}
	for _, status := range []string{"completed", "skipped", "pending"} {
		payload, err := taskStatusPayload(rows[0], status)
		if err != nil || payload["instance_id"] != next.InstanceID || payload["occurrence_date"] != "2026-11-10" || payload["status"] != status {
			t.Fatalf("payload: %v %v", payload, err)
		}
	}
	if _, err := taskStatusPayload(series, "completed"); err == nil {
		t.Fatal("unscoped recurrence completion accepted")
	}
}

func TestNativeOccurrenceDetailEditsOriginalSeries(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User.Timezone = "Pacific/Auckland"
	anchor := time.Date(2026, 1, 1, 9, 0, 0, 0, a.location())
	series := api.Task{ID: 4, Title: "每日计划", Status: "pending", Revision: 8, StartTime: &anchor, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, Tasks: []api.Task{series}, Next: []api.Occurrence{{TaskID: 4, InstanceID: "4_20261109", Status: "pending", StartTime: anchor.AddDate(0, 10, 8), OriginalDate: time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)}}})
	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("每日计划"); err != nil {
		t.Fatal(err)
	}
	if done, ok := tt.AccessByRole(ui.RoleCheckBox, "完成本次 每日计划"); !ok || done.Disabled || a.editing {
		t.Fatalf("occurrence detail: %v", tt.Texts())
	}
	for _, node := range tt.AccessAll() {
		if node.Role == ui.RoleDialog && !node.Offscreen {
			t.Fatal("instance detail opened a modal", node.Name)
		}
	}
	if err := tt.Click("编辑整个系列"); err != nil {
		t.Fatal(err)
	}
	if !a.editing || a.selectedOccurrence != nil || !a.draft.Start.Equal(anchor) || a.draft.Task.InstanceID != "" || a.draft.Task.Revision != series.Revision || a.draft.Start.Location().String() != a.location().String() {
		t.Fatalf("wrong series draft: %+v", a.draft)
	}
}

func TestOccurrenceCacheRestoresNextAndHistoryOffline(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	session := api.Session{Server: api.DefaultServer, Token: "cached-token", User: api.User{ID: 1, Timezone: "Asia/Shanghai"}}
	start := time.Now()
	if err := s.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveCache(storage.Cache{Server: session.Server, UserID: 1,
		Tasks:   []api.Task{{ID: 1, Status: "pending", RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}},
		Next:    []api.Occurrence{{TaskID: 1, InstanceID: "next", StartTime: start, OriginalDate: start, Status: "pending"}},
		History: api.OccurrencePage{Items: []api.Occurrence{{TaskID: 1, InstanceID: "past", StartTime: start, OriginalDate: start, Status: "completed"}}, NextCursor: 200, HasMore: true},
	}); err != nil {
		t.Fatal(err)
	}
	a := New(s)
	defer a.Close()
	if len(a.nextOccurrences) != 1 || !a.history.HasMore || a.history.NextCursor != 200 || len(projectTasks(a.tasks, a.nextOccurrences, a.history.Items)) != 2 {
		t.Fatal("offline instance cache lost")
	}
}
