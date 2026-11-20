package app

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
)

func TestAgendaLongDescriptionCannotCoverFollowingEvent(t *testing.T) {
	for _, dark := range []bool{false, true} {
		t.Run(fmt.Sprint(dark), func(t *testing.T) {
			day := time.Date(2026, 11, 11, 0, 0, 0, 0, time.Local)
			a := &App{selectedDay: day, calendarMode: 3}
			long := strings.Repeat("长摘要 Chinese English\n", 100)
			events := []api.CalendarEvent{{ID: "1", Title: "长描述任务", Start: day.Add(9 * time.Hour).Format(time.RFC3339)}, {ID: "2", Title: "相邻后续任务", Start: day.Add(10 * time.Hour).Format(time.RFC3339)}}
			events[0].ExtendedProps.Description = long
			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				ui.Column(c).Fill().Children(func() { a.calendarAgendaView(c, events) })
			}, 600, 600)
			tt.SetDark(dark)
			summary, summaryOK := tt.Find(plainMarkdownPreview(long))
			next, ok := tt.AccessByRole(ui.RoleButton, "日程 2026-11-11 相邻后续任务")
			if !ok || !summaryOK || summary.H <= 0 || summary.H > 65 || next.Bounds.Y < summary.Y+summary.H {
				t.Fatal("summary overlaps next event", summary, next)
			}
			if events[0].ExtendedProps.Description != long {
				t.Fatal("presentation truncated source description")
			}
		})
	}
}

func TestPropertySaveHintMatchesExistingAndNewContext(t *testing.T) {
	for _, id := range []int64{0, 1, -1} {
		a := &App{taskMetaOpen: "priority"}
		d := Draft{Task: api.Task{ID: id}, Priority: "普通"}
		tt := ui.NewTester(func(c *ui.Context) { applyAppTheme(c); a.taskMetadataEditor(c, &d) }, 400, 400)
		for _, text := range tt.Texts() {
			if strings.Contains(text, "保存任务后生效") || strings.Contains(text, "选择后自动存入本机") {
				t.Fatalf("obsolete save boilerplate should be removed from property popover (id=%d): %q", id, text)
			}
		}
	}
}
