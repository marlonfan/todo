package app

import (
	"encoding/json"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestCalendarDragCivilDaysAndDST(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	start := time.Date(2026, 3, 7, 9, 0, 0, 0, loc)
	end := start.Add(time.Hour)
	task := api.Task{ID: 1, Revision: 3, StartTime: &start, EndTime: &end}
	event := api.CalendarEvent{Start: start.Format(time.RFC3339), End: end.Format(time.RFC3339)}
	drag := calendarDrag{Event: event, FromDay: dayStart(start), Revision: 3}
	change, err := calendarDragChange(task, drag, start.AddDate(0, 0, 1), 0, false, false, 15)
	if err != nil || change.Start.Hour() != 9 || change.Start.Sub(start) != 23*time.Hour || change.End.Sub(change.Start) != time.Hour {
		t.Fatal(change, err)
	}
	change, err = calendarDragChange(task, drag, start, 10*60+43, true, false, 15)
	if err != nil || change.Start.Hour() != 10 || change.Start.Minute() != 45 {
		t.Fatal(change, err)
	}
	_, err = calendarDragChange(task, drag, start.AddDate(0, 0, 1), 2*60+30, true, false, 15)
	if err == nil {
		t.Fatal("DST gap silently normalized")
	}
	// A fall-back occurrence moved within the repeated hour keeps its old offset.
	fold, _ := time.Parse(time.RFC3339, "2026-11-01T01:15:00-05:00")
	fold = fold.In(loc)
	got, err := calendarWallTime(fold, 90, fold)
	_, offset := got.Zone()
	if err != nil || offset != -5*3600 || got.Hour() != 1 || got.Minute() != 30 {
		t.Fatal(got, err)
	}
	// All-day spans retain their calendar-day count over a 23-hour day.
	day := dayStart(start)
	allEnd := day.AddDate(0, 0, 2)
	drag.Event.Start, drag.Event.End, drag.Event.AllDay = day.Format("2006-01-02"), allEnd.Format("2006-01-02"), true
	change, err = calendarDragChange(task, drag, day.AddDate(0, 0, 1), 0, false, false, 15)
	if err != nil || civilDays(*change.End, change.Start) != 2 || change.Start.Hour() != 0 || change.End.Hour() != 0 {
		t.Fatal(change, err)
	}
}

func TestCalendarResizeScopeAndConversions(t *testing.T) {
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.session.User.Timezone = "Asia/Shanghai"
	a.adoptCache(state)
	event := state.Calendar.Events[0]
	task, err := a.calendarTask(event)
	if err != nil {
		t.Fatal(err)
	}
	drag := calendarDrag{Event: event, FromDay: day.AddDate(0, 0, 2), Revision: task.Revision, Resize: true}
	change, err := calendarDragChange(task, drag, day.AddDate(0, 0, 3), 12*60+30, true, false, 30)
	if err != nil || !change.Start.Equal(*task.StartTime) || change.End.Hour() != 12 || change.End.Minute() != 30 || change.End.Day() != 12 {
		t.Fatal(change, err)
	}
	method, path, body, err := change.mutation()
	if err != nil || method != "PATCH" || path != "/tasks/7/occurrences/schedule" || body["instance_id"] != "7_20261110" || body["occurrence_date"] != "2026-11-10" {
		t.Fatal(method, path, body, err)
	}
	if !state.Tasks[0].StartTime.Equal(day.Add(9 * time.Hour)) {
		t.Fatal("series anchor mutated")
	}
	if _, err := calendarDragChange(task, drag, day, 0, true, false, 15); err == nil {
		t.Fatal("resize before start accepted")
	}
	drag.Revision--
	if _, err := calendarDragChange(task, drag, day, 0, false, false, 15); err == nil {
		t.Fatal("stale revision accepted")
	}
	drag.Revision++
	drag.Resize = false
	change, err = calendarDragChange(task, drag, day.AddDate(0, 0, 3), 0, true, true, 15)
	if err != nil || !change.AllDay || change.Start.Hour() != 0 || civilDays(*change.End, change.Start) != 1 {
		t.Fatal(change, err)
	}
	drag.Event.AllDay = true
	drag.Event.Start = day.Format("2006-01-02")
	drag.Event.End = day.AddDate(0, 0, 2).Format("2006-01-02")
	change, err = calendarDragChange(task, drag, day, 13*60, true, false, 15)
	if err != nil || change.AllDay || change.Start.Hour() != 13 || change.End.Sub(change.Start) != time.Hour {
		t.Fatal(change, err)
	}
	task.ReadOnly = true
	if _, err := calendarDragChange(task, drag, day, 0, false, false, 15); err == nil {
		t.Fatal("readonly accepted")
	}
}

func TestCalendarDueOnlyAndContinuationGrab(t *testing.T) {
	_, day := calendarFixture()
	task := api.Task{ID: 2, DueDate: &day, Revision: 1}
	event := api.CalendarEvent{Start: day.Format("2006-01-02"), AllDay: true}
	drag := calendarDrag{Event: event, FromDay: day, Revision: 1}
	change, err := calendarDragChange(task, drag, day.AddDate(0, 0, 2), 0, false, false, 15)
	if err != nil || !change.DueOnly {
		t.Fatal(change, err)
	}
	method, _, body, err := change.mutation()
	if err != nil || method != "PUT" || body["start_time"] != nil || body["end_time"] != nil || body["due_date"] == nil {
		t.Fatal(body, err)
	}
	start, end := day.Add(22*time.Hour), day.Add(27*time.Hour)
	event.Start, event.End, event.AllDay = start.Format(time.RFC3339), end.Format(time.RFC3339), false
	task.StartTime, task.EndTime, task.DueDate = &start, &end, nil
	drag = calendarDrag{Event: event, FromDay: day.AddDate(0, 0, 1), GrabMinutes: 180, Revision: 1}
	change, err = calendarDragChange(task, drag, day.AddDate(0, 0, 2), 60, true, false, 15)
	if err != nil || change.Start.Day() != 10 || change.Start.Hour() != 22 || change.End.Sub(change.Start) != 5*time.Hour {
		t.Fatal(change, err)
	}
}

func nativeDrag(t *testing.T, tt *ui.Tester, fromX, fromY, toX, toY float32) {
	t.Helper()
	tt.Press(fromX, fromY)
	for k := 1; k <= 5; k++ {
		f := float32(k) / 5
		tt.Move(fromX+(toX-fromX)*f, fromY+(toY-fromY)*f)
	}
	tt.Release(toX, toY)
}

func TestNativeCalendarDragAndResizeCreateScopedOfflineIntent(t *testing.T) {
	for _, resize := range []bool{false, true} {
		t.Run(map[bool]string{false: "move", true: "resize"}[resize], func(t *testing.T) {
			state, day := calendarFixture()
			store := storage.Store{Dir: t.TempDir()}
			a := New(store)
			defer a.Close()
			a.client, _ = api.New(api.DefaultServer, "")
			a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
			a.adoptCache(state)
			a.page, a.calendarMode, a.selectedDay = "calendar", 1, day
			a.calendarScroll.Y = 7 * 56
			tt := ui.NewTester(a.view, 1280, 900)
			label := "日程 2026-11-11 改期后的单次"
			if resize {
				label = "调整结束 2026-11-11 改期后的单次"
			}
			src, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok {
				t.Fatal(label, tt.Texts())
			}
			dst, ok := tt.AccessByRole(ui.RoleButton, "在 2026-11-12 12:00 添加日程")
			if !ok {
				t.Fatal(tt.Texts())
			}
			fromY := src.Bounds.Y + 10
			if resize {
				fromY = src.Bounds.Y + src.Bounds.H/2
			}
			toY := dst.Bounds.Y + 28
			if !resize {
				toY += 10
			}
			nativeDrag(t, tt, src.Bounds.X+src.Bounds.W/2, fromY, dst.Bounds.X+dst.Bounds.W/2, toY)
			var saved storage.Cache
			var err error
			until := time.Now().Add(3 * time.Second)
			for time.Now().Before(until) {
				saved, err = store.Cache(state.Server, 1)
				if err == nil && len(saved.Outbox) == 1 {
					break
				}
				time.Sleep(5 * time.Millisecond)
			}
			if err != nil || len(saved.Outbox) != 1 {
				t.Fatal("drag did not save", err, a.failure, tt.Texts())
			}
			op := saved.Outbox[0]
			var body struct {
				InstanceID, OccurrenceDate string
				Start, End                 time.Time
			}
			var fields map[string]json.RawMessage
			_ = json.Unmarshal(op.Body, &fields)
			_ = json.Unmarshal(fields["instance_id"], &body.InstanceID)
			_ = json.Unmarshal(fields["occurrence_date"], &body.OccurrenceDate)
			_ = json.Unmarshal(fields["start_time"], &body.Start)
			_ = json.Unmarshal(fields["end_time"], &body.End)
			if op.Suffix != "/occurrences/schedule" || body.InstanceID != "7_20261110" || body.OccurrenceDate != "2026-11-10" {
				t.Fatal(op)
			}
			if resize {
				if !body.Start.Equal(day.AddDate(0, 0, 2).Add(9*time.Hour)) || body.End.In(a.location()).Hour() != 12 || body.End.In(a.location()).Minute() != 30 {
					t.Fatal(body)
				}
			} else if body.Start.In(a.location()).Hour() != 12 || body.Start.In(a.location()).Minute() != 30 || body.Start.In(a.location()).Day() != 12 || body.End.Sub(body.Start) != time.Hour {
				t.Fatal(body)
			}
		})
	}
}

func TestNativeCalendarEscapeAndLobePreview(t *testing.T) {
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "原生日历预览", Timezone: "Asia/Shanghai"}
	a.adoptCache(state)
	a.page, a.calendarMode, a.selectedDay = "calendar", 1, day
	a.calendarScroll.Y = 7 * 56
	tt := ui.NewTester(a.view, 1280, 900)
	for _, width := range []int{900, 1280} {
		tt.SetSize(width, 900)
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			tt.Advance(time.Second)
			if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" && width == 1280 {
				name := "native-lobe-calendar-headless-light.png"
				if dark {
					name = "native-lobe-calendar-headless-dark.png"
				}
				if err := os.MkdirAll(dir, 0700); err != nil {
					t.Fatal(err)
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
	}
	tt.SetDark(false)
	tt.Advance(time.Second)
	src, _ := tt.AccessByRole(ui.RoleButton, "日程 2026-11-11 改期后的单次")
	dst, _ := tt.AccessByRole(ui.RoleButton, "在 2026-11-12 12:00 添加日程")
	tt.Press(src.Bounds.X+20, src.Bounds.Y+10)
	tt.Move(dst.Bounds.X+30, dst.Bounds.Y+20)
	tt.Key(0, ui.KeyEscape)
	tt.Release(dst.Bounds.X+30, dst.Bounds.Y+20)
	if a.busy || a.editing || a.selectedOccurrence != nil || len(a.cache.Outbox) != 0 {
		t.Fatal("cancel wrote or clicked")
	}
}

func TestCalendarGrabClipsVisualPaddingAndKeepsContinuation(t *testing.T) {
	_, day := calendarFixture()
	event := api.CalendarEvent{Start: day.Add(9 * time.Hour).Format(time.RFC3339), End: day.Add(9*time.Hour + time.Minute).Format(time.RFC3339)}
	if got := calendarGrabMinutes(event, day, 16, 56); got != 1 {
		t.Fatal("short event padding moved its anchor", got)
	}
	event.Start, event.End = day.Add(-2*time.Hour).Format(time.RFC3339), day.Add(2*time.Hour).Format(time.RFC3339)
	if got := calendarGrabMinutes(event, day, 28, 56); got != 150 {
		t.Fatal("continuation lost its actual start", got)
	}
}

func TestNativeReadOnlyCalendarHasNoResizeOrDragWrites(t *testing.T) {
	for _, external := range []bool{false, true} {
		t.Run(map[bool]string{false: "task", true: "external"}[external], func(t *testing.T) {
			state, day := calendarFixture()
			state.Tasks[0].ReadOnly = !external
			state.Calendar.Events[0].ExtendedProps.ReadOnly = external
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			a.client, _ = api.New(api.DefaultServer, "")
			a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
			a.adoptCache(state)
			a.page, a.calendarMode, a.selectedDay = "calendar", 1, day
			a.calendarScroll.Y = 7 * 56
			tt := ui.NewTester(a.view, 1280, 900)
			if _, ok := tt.AccessByRole(ui.RoleButton, "调整结束 2026-11-11 改期后的单次"); ok {
				t.Fatal("read-only event exposes a resize handle")
			}
			src, ok := tt.AccessByRole(ui.RoleButton, "日程 2026-11-11 改期后的单次")
			if !ok {
				t.Fatal(tt.Texts())
			}
			dst, ok := tt.AccessByRole(ui.RoleButton, "在 2026-11-12 12:00 添加日程")
			if !ok {
				t.Fatal(tt.Texts())
			}
			nativeDrag(t, tt, src.Bounds.X+20, src.Bounds.Y+10, dst.Bounds.X+20, dst.Bounds.Y+28)
			if a.busy || len(a.cache.Outbox) != 0 || a.calendarDragging {
				t.Fatal("read-only event started a calendar write")
			}
		})
	}
}
