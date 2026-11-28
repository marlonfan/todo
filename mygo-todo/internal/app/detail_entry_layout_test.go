package app

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func detailEntryApp(t *testing.T, page string) *App {
	t.Helper()
	a := New(storage.Store{Dir: t.TempDir()})
	t.Cleanup(a.Close)
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "详情入口验收", Timezone: "UTC"}
	a.page = page
	return a
}

func assertWindowDetail(t *testing.T, tt *ui.Tester, width int, occurrence bool) ui.AccessInfo {
	t.Helper()
	label, content := "任务标题", "任务详情内容"
	if occurrence {
		label, content = "本次标题", "本次任务详情内容"
	}
	reader, ok := tt.AccessByRole(ui.RoleTextField, label)
	if !ok {
		t.Fatal("missing in-window title", label)
	}
	pane, ok := tt.Access(content)
	if !ok {
		t.Fatal("missing independently scrolling detail", content)
	}
	for _, node := range tt.AccessAll() {
		if node.Role == ui.RoleDialog && !node.Offscreen {
			t.Fatalf("task entry opened a dialog: %s", node.Name)
		}
	}
	if width >= 1180 {
		if pane.Bounds.W < detailMinWidth || pane.Bounds.W > detailMaxWidth {
			t.Fatalf("detail must stay within 420–520, got %v", pane.Bounds)
		}
		if reader.Bounds.X < float32(width)-detailMaxWidth {
			t.Fatal("detail did not open on the right", reader.Bounds)
		}
	} else if _, ok := tt.AccessByRole(ui.RoleButton, "‹ 返回任务列表"); !ok {
		t.Fatal("narrow detail lost its return action")
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok {
		t.Fatal("existing task exposes a persistent save button")
	}
	return reader
}

func TestDetailListHistoryCategoryAndSearchEntries(t *testing.T) {
	for _, page := range []string{"all", "completed", "cancelled", "skipped", "category:7"} {
		for _, width := range []int{1400, 1024} {
			t.Run(fmt.Sprintf("%s/%d", page, width), func(t *testing.T) {
				a := detailEntryApp(t, page)
				status := "pending"
				if isHistoryPage(page) {
					status = page
				}
				a.categories = []api.Category{{ID: 7, Name: "项目"}}
				a.tasks = []api.Task{
					{ID: 2, Title: "第一个任务", Status: status, Categories: a.categories},
					{ID: 1, Title: "第二个任务", Status: status, Categories: a.categories},
				}
				tt := ui.NewTester(a.view, width, 900)
				tt.Frame()
				if err := tt.Click(a.tasks[0].Title); err != nil {
					t.Fatal(err)
				}
				tt.Advance(800 * time.Millisecond)
				first := assertWindowDetail(t, tt, width, false)
				listBounds, hadList := tt.Access("任务列表")
				if width < 1180 {
					if err := tt.Click("‹ 返回任务列表"); err != nil {
						t.Fatal(err)
					}
					tt.Advance(800 * time.Millisecond)
				}
				if err := tt.Click(a.tasks[1].Title); err != nil {
					t.Fatal(err)
				}
				tt.Advance(800 * time.Millisecond)
				second := assertWindowDetail(t, tt, width, false)
				nearDetail(t, "selection keeps title x", second.Bounds.X, first.Bounds.X)
				nearDetail(t, "selection keeps title y", second.Bounds.Y, first.Bounds.Y)
				if width >= 1180 {
					after, ok := tt.Access("任务列表")
					if !hadList || !ok || after.Bounds != listBounds.Bounds {
						t.Fatal("task switch changed list bounds")
					}
				} else {
					if err := tt.Click("‹ 返回任务列表"); err != nil {
						t.Fatal(err)
					}
				}
				a.openTaskSearch()
				tt.Frame()
				if err := tt.Click("搜索结果 " + a.tasks[0].Title); err != nil {
					t.Fatal(err)
				}
				assertWindowDetail(t, tt, width, false)
			})
		}
	}
}

func TestDetailCalendarTaskAndOccurrenceEntry(t *testing.T) {
	for _, recurring := range []bool{false, true} {
		for _, width := range []int{1400, 1024} {
			t.Run(fmt.Sprintf("recurring=%t/%d", recurring, width), func(t *testing.T) {
				a := detailEntryApp(t, "calendar")
				day := time.Date(2026, 11, 10, 9, 0, 0, 0, time.UTC)
				a.selectedDay, a.calendarMode = day, 3
				task := api.Task{ID: 1, Title: "日历任务", Status: "pending", StartTime: &day}
				event := api.CalendarEvent{ID: "event-1", Title: task.Title, Start: day.Format(time.RFC3339), End: day.Add(time.Hour).Format(time.RFC3339)}
				event.ExtendedProps.TaskID, event.ExtendedProps.Status = 1, "pending"
				if recurring {
					task.RecurrenceRule = json.RawMessage(`{"freq":"daily"}`)
					event.ExtendedProps.IsRecurring, event.ExtendedProps.InstanceID = true, "1_20261110"
				}
				a.tasks, a.cache.Tasks = []api.Task{task}, []api.Task{task}
				start, end := calendarRange(day, a.calendarMode)
				a.cache.Calendar = &storage.CalendarSnapshot{Start: start, End: end, Timezone: "UTC", Events: []api.CalendarEvent{event}, SeriesRevisions: map[int64]int64{1: task.Revision}}
				tt := ui.NewTester(a.view, width, 900)
				tt.Frame()
				if err := tt.Click("日程 2026-11-10 " + task.Title); err != nil {
					t.Fatal(err)
				}
				tt.Advance(800 * time.Millisecond)
				assertWindowDetail(t, tt, width, recurring)
				if a.page != "calendar" || !a.taskEditorInline {
					t.Fatal("calendar entry lost workspace context")
				}
				if width < 1180 {
					if err := tt.Click("‹ 返回任务列表"); err != nil {
						t.Fatal(err)
					}
					tt.Advance(800 * time.Millisecond)
					tt.Frame()
					if a.taskDetailOpen {
						t.Fatal("calendar back action reopened detail")
					}
					if _, ok := tt.Access("日程 2026-11-10 " + task.Title); !ok {
						t.Fatal("calendar context missing after back")
					}
				}
			})
		}
	}
}
