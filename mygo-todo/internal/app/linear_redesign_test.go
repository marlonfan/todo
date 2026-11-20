package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestLinearDetailReadEditAndVerticalProperties(t *testing.T) {
	for _, width := range []int{1024, 1280, 1600, 1920} {
		for _, dark := range []bool{false, true} {
			t.Run(fmt.Sprintf("width-%d/dark-%v", width, dark), func(t *testing.T) {
				a := New(storage.Store{Dir: t.TempDir()})
				defer a.Close()
				a.client, _ = api.New(api.DefaultServer, "")
				a.session.User = api.User{ID: 1, Username: "验收用户"}
				a.categories = []api.Category{{ID: 4, Name: strings.Repeat("长分类名称", 6)}}
				task := api.Task{ID: 11, Title: strings.Repeat("长标题 English 123 ", 5), Status: "pending", Description: "## 阅读态 Markdown\n\n- [ ] 保留原有内容", Categories: a.categories}
				a.adoptCache(storage.Cache{Tasks: []api.Task{task}, Categories: a.categories})
				a.editTaskNow(task)
				tt := ui.NewTester(a.view, width, 900)
				tt.SetDark(dark)
				tt.Frame()

				// 1-click inline editable title and WYSIWYG description are mounted immediately
				title, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
				if !ok {
					t.Fatalf("missing 1-click title editor: %v", tt.Texts())
				}
				description, ok := tt.AccessByRole(ui.RoleTextField, "备注")
				if !ok || strings.Contains(description.Value, "## ") {
					t.Fatalf("missing WYSIWYG description editor or leaked syntax: %+v", description)
				}
				for _, label := range []string{"提醒与活动记录", "更多任务选项", "关闭"} {
					if _, ok := tt.Access(label); !ok {
						t.Fatalf("missing toolbar action %q: %v", label, tt.Texts())
					}
				}
				if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok || tt.HasText("未修改") {
					t.Fatal("clean detail must stay quiet without a save button or dirty hint")
				}
				if width >= 1180 && !tt.HasText("已同步") {
					t.Fatal("sidebar must retain the single sync status indicator on wide windows")
				}
				if footer, ok := tt.Access("任务底部操作"); ok {
					t.Fatalf("clean synced detail must not render redundant bottom status bar: %+v", footer)
				}

				// Horizontal wrapped property chips sit between Title and WYSIWYG Description
				for _, label := range []string{"编辑状态", "编辑开始", "编辑优先级", "编辑分类", "编辑重复", "编辑提醒"} {
					n, ok := tt.AccessByRole(ui.RoleButton, label)
					if !ok || n.Offscreen {
						t.Fatalf("missing upfront property chip %q", label)
					}
					if n.Bounds.W <= 0 || n.Bounds.H <= 0 || n.Bounds.X < 0 || n.Bounds.X+n.Bounds.W > float32(width)+1 {
						t.Fatalf("property chip outside horizontal viewport: %+v", n)
					}
					if n.Bounds.Y < title.Bounds.Y+title.Bounds.H-1 || description.Bounds.Y < n.Bounds.Y+n.Bounds.H-1 {
						t.Fatalf("property chip %q must sit between title and WYSIWYG editor: title=%+v chip=%+v desc=%+v", label, title.Bounds, n.Bounds, description.Bounds)
					}
				}

				if err := tt.Click("任务标题"); err != nil {
					t.Fatal(err)
				}
				if a.taskDraftDirty() {
					t.Fatal("focusing title changed task data")
				}
				if err := tt.Click("备注"); err != nil {
					t.Fatal(err)
				}
				if a.taskDraftDirty() {
					t.Fatal("focusing WYSIWYG description changed task data")
				}

				a.draft.Description += "\n\n未保存的真实修改"
				tt.Frame()
				if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok || !a.taskDraftDirty() || !tt.HasText("待保存…") {
					t.Fatal("dirty draft must show pending autosave status")
				}
				if dirtyFooter, ok := tt.Access("任务底部操作"); ok {
					t.Fatalf("dirty existing task should use transient toolbar status, not bottom bar: %+v", dirtyFooter)
				}
				if dirtyDesc, ok := tt.AccessByRole(ui.RoleTextField, "备注"); !ok || dirtyDesc.Bounds != description.Bounds {
					t.Fatalf("editing shifted description layout: before=%+v after=%+v", description.Bounds, dirtyDesc.Bounds)
				}
				if len(a.cache.Outbox) != 0 || a.tasks[0].Description != task.Description {
					t.Fatal("reading/editing wrote task before autosave flush")
				}
			})
		}
	}
}
