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
)

func TestNativeCalDAVOccurrenceActivityReadablePreview(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "原生日历预览", Timezone: "Asia/Shanghai"}
	value := json.RawMessage(`{"title":"外部标题","status":"pending","description":"外部日历改本次","start_time":"2026-11-20T01:00:00Z","end_time":"2026-11-20T03:00:00Z","all_day":false,"schedule_override":true}`)
	text := a.activityValue("caldav_occurrence:2026-11-21", value)
	for _, want := range []string{"标题 外部标题", "状态 待办", "开始 2026-11-20 09:00:00", "结束 2026-11-20 11:00:00", "全天 否", "描述 外部日历改本次"} {
		if !strings.Contains(text, want) {
			t.Fatal(text, want)
		}
	}
	if a.activityValue("caldav_occurrence:2026-11-21", json.RawMessage(`null`)) != "未设置" {
		t.Fatal("reset should not format a null schedule")
	}
	task := api.Task{ID: 1, Title: "项目周会", Status: "pending", RecurrenceRule: json.RawMessage(`{"freq":"weekly"}`)}
	a.taskCenter = &taskCenter{Task: task, Tab: 1, Loaded: true, Activities: []api.TaskActivity{{ID: 1, TaskID: 1, SubmitSource: "caldav", OccurredAt: time.Date(2026, 11, 10, 1, 0, 0, 0, time.UTC), Changes: map[string]api.ActivityChange{"caldav_occurrence:2026-11-21": {From: json.RawMessage(`null`), To: value}}}}}
	tt := ui.NewTester(a.view, 900, 600)
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		tt.Advance(time.Second)
		if !tt.HasText("仅 2026-11-21 本次日程（CalDAV）") || !tt.HasText("新值："+text) {
			t.Fatal(tt.Texts())
		}
		node, ok := tt.AccessByRole(ui.RoleButton, "关闭提醒与记录")
		if !ok || node.Offscreen || node.Bounds.Y+node.Bounds.H > 600 {
			t.Fatal(node)
		}
		if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" {
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			name := "native-caldav-activity-headless-light.png"
			if dark {
				name = "native-caldav-activity-headless-dark.png"
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
