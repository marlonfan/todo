package app

import (
	"encoding/json"
	"github.com/egoist/mygo/ui"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestNativeOccurrenceScheduleEditorAndPayload(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	loc, _ := time.LoadLocation("Asia/Shanghai")
	a.session.User.Timezone = loc.String()
	start := time.Date(2026, 11, 9, 9, 0, 0, 0, loc)
	end := start.Add(time.Hour)
	a.session.Server = api.DefaultServer
	a.session.User.ID = 1
	task := api.Task{ID: 1, Title: "会议", Status: "completed", Revision: 7, InstanceID: "1_20261109", OccurrenceDate: "2026-11-09", StartTime: &start, EndTime: &end, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	series := task
	series.InstanceID, series.OccurrenceDate = "", ""
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{series}})
	a.openTask(task)
	tt := ui.NewTester(a.view, 900, 760)
	if err := tt.Click("编辑本次开始"); err != nil {
		t.Fatal(err)
	}
	if a.occurrenceSchedule == nil || !tt.HasText("原始实例日期：2026-11-09") {
		t.Fatal(tt.Texts())
	}
	a.occurrenceSchedule.Start = start.AddDate(0, 0, 2)
	a.occurrenceSchedule.End = a.occurrenceSchedule.Start.Add(-time.Hour)
	a.saveOccurrenceSchedule(false)
	if !strings.Contains(a.failure, "结束时间") || a.occurrenceSchedule == nil {
		t.Fatal("invalid schedule lost draft")
	}
	a.occurrenceSchedule.HasEnd = false
	body, err := occurrenceSchedulePayload(task, *a.occurrenceSchedule)
	if err != nil || body["occurrence_date"] != "2026-11-09" || body["instance_id"] != task.InstanceID || body["end_time"] != nil || len(body) != 5 {
		t.Fatal(body, err)
	}
	tt.Frame()
	if err := tt.Click("取消本次改期"); err != nil || !a.taskDiscardConfirm || a.occurrenceSchedule == nil {
		t.Fatalf("cancel: err=%v, draft=%+v, selected=%+v, texts=%v", err, a.occurrenceSchedule, a.selectedOccurrence, tt.Texts())
	}
	if err := tt.Click("继续编辑"); err != nil || a.occurrenceSchedule == nil {
		t.Fatal("lost cancelled schedule draft", err)
	}
	if err := tt.Click("取消本次改期"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("放弃并切换"); err != nil || a.occurrenceSchedule != nil || a.selectedOccurrence == nil {
		t.Fatal("cannot discard schedule", err)
	}
	if err := tt.Click("编辑本次开始"); err != nil {
		t.Fatal(err)
	}
	a.occurrenceSchedule.Start = start.AddDate(0, 0, 2)
	a.occurrenceSchedule.HasEnd = false
	tt.Frame()
	if len(a.cache.Outbox) != 0 || !a.taskDraftDirty() {
		t.Fatal("compound schedule was saved before explicit confirmation")
	}
	if err := tt.Click("保存本次时间"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(3 * time.Second)
	var saved storage.Cache
	for {
		state, err := a.store.Cache(api.DefaultServer, 1)
		if err == nil && len(state.Outbox) == 1 {
			saved = state
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("schedule was not persisted", err, a.failure)
		}
		time.Sleep(time.Millisecond)
	}
	op := saved.Outbox[0]
	var request struct {
		InstanceID     string     `json:"instance_id"`
		OccurrenceDate string     `json:"occurrence_date"`
		StartTime      time.Time  `json:"start_time"`
		EndTime        *time.Time `json:"end_time"`
		AllDay         bool       `json:"all_day"`
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(op.Body, &request); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(op.Body, &fields); err != nil {
		t.Fatal(err)
	}
	if op.Method != "PATCH" || op.TaskID != task.ID || op.Revision != task.Revision || len(fields) != 5 || request.InstanceID != task.InstanceID || request.OccurrenceDate != task.OccurrenceDate || !request.StartTime.Equal(start.AddDate(0, 0, 2)) || request.EndTime != nil || request.AllDay {
		t.Fatalf("wrong persisted schedule: %+v %s", op, op.Body)
	}
	if len(saved.Tasks) != 1 || !saved.Tasks[0].StartTime.Equal(start) || saved.Tasks[0].Status != "completed" || saved.Tasks[0].InstanceID != "" {
		t.Fatal("instance reschedule changed canonical series", saved.Tasks)
	}
}

func TestNativeOccurrenceScheduleFitsSmallWindow(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "原生预览", Timezone: "Asia/Shanghai"}
	loc, _ := time.LoadLocation(a.session.User.Timezone)
	start := time.Date(2026, 11, 10, 10, 0, 0, 0, loc)
	end := start.Add(time.Hour)
	task := api.Task{ID: 1, Title: "项目进度检查", Status: "pending", Revision: 7, InstanceID: "1_20261110", OccurrenceDate: "2026-11-10", StartTime: &start, EndTime: &end, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	series := task
	series.InstanceID, series.OccurrenceDate = "", ""
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{series}})
	a.openTask(task)
	a.editOccurrenceSchedule()
	tt := ui.NewTester(a.view, 900, 600)
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		for _, label := range []string{"保存本次时间", "恢复本次系列时间", "取消本次改期"} {
			n, ok := tt.AccessByRole(ui.RoleButton, label)
			// Restore is a lower-frequency action inside the independently
			// scrolling schedule form; confirmation/cancel stay in the footer.
			for attempt := 0; label == "恢复本次系列时间" && ok && n.Offscreen && attempt < 8; attempt++ {
				tt.Scroll(800, 350, 0, 200)
				n, ok = tt.AccessByRole(ui.RoleButton, label)
			}
			if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
				t.Fatal("unreachable schedule action", label, n)
			}
		}
		if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" {
			name := "native-occurrence-schedule-headless-light.png"
			if dark {
				name = "native-occurrence-schedule-headless-dark.png"
			}
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			file, err := os.Create(filepath.Join(dir, name))
			if err != nil {
				t.Fatal(err)
			}
			err = png.Encode(file, tt.Image())
			closeErr := file.Close()
			if err != nil || closeErr != nil {
				t.Fatal(err, closeErr)
			}
		}
	}
}
