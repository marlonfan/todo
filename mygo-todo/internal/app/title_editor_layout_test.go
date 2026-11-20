package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTaskTitleEditorUsesAvailableHeadingWidth(t *testing.T) {
	for _, width := range []int{1280, 1024} {
		t.Run(fmt.Sprintf("width-%d", width), func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			a.client, _ = api.New(api.DefaultServer, "")
			a.session.User = api.User{ID: 1, Username: "标题布局验收"}
			task := api.Task{ID: 1, Title: "属性空值与草稿保护 · Designer复查 · 未保存", Status: "pending"}
			a.tasks = []api.Task{task}
			a.editTaskNow(task)
			tt := ui.NewTester(a.view, width, 900)
			tt.Frame()
			pane, ok := tt.Access("任务详情内容")
			if !ok {
				t.Fatal("missing detail content pane")
			}
			editor, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
			if !ok {
				t.Fatal("missing direct 1-click title editor")
			}
			cb, ok := tt.AccessByRole(ui.RoleCheckBox, "完成任务 "+task.Title)
			if !ok {
				t.Fatal("missing completion checkbox beside task title")
			}
			if cb.Bounds.Y < editor.Bounds.Y-4 || cb.Bounds.Y > editor.Bounds.Y+detailTitleLineHeight {
				t.Fatalf("completion checkbox should align with first line of title: cb=%+v title=%+v", cb.Bounds, editor.Bounds)
			}
			if editor.Bounds.X < cb.Bounds.X+cb.Bounds.W+4 {
				t.Fatalf("title should sit right of completion checkbox: cb=%+v title=%+v", cb.Bounds, editor.Bounds)
			}
			wantWidth := pane.Bounds.W - 40 - cb.Bounds.W - 8
			if editor.Bounds.W < wantWidth-2 || editor.Bounds.W > wantWidth+2 {
				t.Fatalf("native title width %.1f does not span available heading width %.1f", editor.Bounds.W, wantWidth)
			}
			if err := tt.Click("任务标题"); err != nil {
				t.Fatal(err)
			}
			if !tt.Focused("任务标题") || a.taskDraftDirty() {
				t.Fatal("clicking title must focus the native field in 1 click without changing data")
			}
			maximum := strings.Repeat("标题编辑自然换行保留全部", 16) + "末尾可编辑验证！"
			if len([]rune(maximum)) != 200 {
				t.Fatalf("fixture must contain 200 runes, got %d", len([]rune(maximum)))
			}
			tt.Key(ui.Cmd, ui.KeyA)
			tt.Type(maximum)
			if a.draft.Title != maximum {
				t.Fatal("native select-all and typing lost title characters")
			}
			editor, _ = tt.AccessByRole(ui.RoleTextField, "任务标题")
			if editor.Bounds.H > 180 || editor.Bounds.W < wantWidth-2 {
				t.Fatal("200-rune editor must retain width and bounded scrolling height", editor.Bounds)
			}
			tt.Scroll(editor.Bounds.X+editor.Bounds.W/2, editor.Bounds.Y+editor.Bounds.H/2, 0, 600)
			tt.Key(0, ui.KeyBackspace)
			tt.Type("验")
			maximum = strings.TrimSuffix(maximum, "！") + "验"
			if a.draft.Title != maximum {
				t.Fatal("native editing could not reach the final character")
			}
			payload, err := a.draft.payload()
			if err != nil || payload["title"] != maximum {
				t.Fatal("200-rune title must pass complete-draft validation", err)
			}
			a.draft.Title += "超"
			if _, err := a.draft.payload(); err == nil {
				t.Fatal("201-rune title must remain invalid")
			}
			a.draft.Title = maximum
			tt.Key(0, ui.KeyEscape)
			tt.Frame()
			if a.draft.Title != maximum {
				t.Fatal("Esc must preserve the complete 200-rune title")
			}
			if !tt.Focused("备注") {
				t.Fatal("Esc/Enter commit should advance focus cleanly to description")
			}
		})
	}
}
