package app

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTaskRowTrailingHandleAndPointerPreview(t *testing.T) {
	for _, dark := range []bool{false, true} {
		for _, page := range []string{"all", "completed", "category:2", "search"} {
			for _, readOnly := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/dark=%t/readonly=%t", page, dark, readOnly), func(t *testing.T) {
					a := New(storage.Store{Dir: t.TempDir()})
					defer a.Close()
					a.page = page
					task := api.Task{ID: 1, InstanceID: "instance", Title: "任务布局", Status: "pending", Priority: 1, ReadOnly: readOnly}
					var background ui.Color
					tt := ui.NewTester(func(c *ui.Context) {
						applyAppTheme(c)
						background = tokensOf(c).BgList
						ui.Column(c).Width(420).Children(func() { a.taskListItem(c, task, time.Now()) })
					}, 600, 260)
					tt.SetDark(dark)
					tt.Frame()
					row, _ := tt.Access("任务行 " + task.Title)
					check, _ := tt.Access("完成 " + task.Title)
					title, _ := tt.Access(task.Title)
					if check.Bounds.X-row.Bounds.X != 8 || title.Bounds.X-row.Bounds.X != 46 || check.Bounds.W != 32 || check.Bounds.H != 32 || title.Bounds.X-(check.Bounds.X+check.Bounds.W) != 6 {
						t.Fatal("padding/checkbox/title boundaries", row.Bounds, check.Bounds, title.Bounds)
					}
					titleText, foundTitle := tt.Find(task.Title)
					if !foundTitle || titleText.X != title.Bounds.X {
						t.Fatal("title text origin", titleText, title.Bounds)
					}
					summaryText := "高优先级"
					for _, text := range tt.Texts() {
						if strings.HasPrefix(text, "高优先级") {
							summaryText = text
							break
						}
					}
					summary, ok := tt.Find(summaryText)
					if !ok || summary.X != title.Bounds.X {
						t.Fatal("summary/title origins", summary, title.Bounds)
					}
					handle, hasHandle := tt.Access("拖动归类 " + task.Title)
					if readOnly {
						if hasHandle {
							t.Fatal("readonly has drag source")
						}
						return
					}
					more, hasMore := tt.Access("更多操作 " + task.Title)
					if !hasHandle || !hasMore || handle.Bounds.W != 32 || handle.Bounds.H != 32 || more.Bounds.W < 32 || more.Bounds.H < 32 || handle.Bounds.X < title.Bounds.X+title.Bounds.W || handle.Bounds.X+handle.Bounds.W+6 != more.Bounds.X || more.Bounds.X+more.Bounds.W != row.Bounds.X+row.Bounds.W-8 {
						t.Fatal("trailing title/handle/menu boundaries", title.Bounds, handle.Bounds, more.Bounds)
					}
					tt.Move(handle.Bounds.X+16, handle.Bounds.Y+16)
					tt.Frame()
					hoverTitle, _ := tt.Access(task.Title)
					hoverCheck, _ := tt.Access("完成 " + task.Title)
					if hoverTitle.Bounds != title.Bounds || hoverCheck.Bounds != check.Bounds {
						t.Fatal("hover moved leading targets", hoverTitle.Bounds, hoverCheck.Bounds)
					}
					tt.Press(handle.Bounds.X+16, handle.Bounds.Y+16)
					tt.Move(220, 130)
					tt.Frame()
					preview, ok := tt.Access("拖动预览 " + task.Title)
					if !ok || preview.Bounds.W != 248 || preview.Bounds.H != 40 {
						t.Fatal("missing real preview", preview)
					}
					first := preview.Bounds
					tt.Move(260, 160)
					tt.Frame()
					preview, _ = tt.Access("拖动预览 " + task.Title)
					if preview.Bounds.X-first.X != 40 || preview.Bounds.Y-first.Y != 30 {
						t.Fatal("preview does not follow pointer", first, preview.Bounds)
					}
					pixel := tt.Image().RGBAAt(int(preview.Bounds.X+4), int(preview.Bounds.Y+20))
					if pixel.R != background.R || pixel.G != background.G || pixel.B != background.B || pixel.A != 255 {
						t.Fatal("preview plate is not opaque", pixel, background)
					}
					tt.Move(599, 259)
					tt.Frame()
					preview, _ = tt.Access("拖动预览 " + task.Title)
					if preview.Bounds.X < 0 || preview.Bounds.Y < 0 || preview.Bounds.X+preview.Bounds.W > 600 || preview.Bounds.Y+preview.Bounds.H > 260 {
						t.Fatal("preview clips at window edge", preview.Bounds)
					}
					tt.Key(0, ui.KeyEscape)
					tt.Frame()
					if _, ok := tt.Access("拖动预览 " + task.Title); ok {
						t.Fatal("escape leaves preview")
					}
					if len(a.cache.Outbox) != 0 {
						t.Fatal("canceled drag wrote mutation")
					}
				})
			}
		}
	}
}
