package app

import (
	"encoding/json"
	"strings"
	"testing"
	"todo-native/internal/api"
	"todo-native/internal/storage"

	"github.com/egoist/mygo/ui"
)

func TestLinearLargeTextAndReducedMotionKeepControlsReachable(t *testing.T) {
	for _, width := range []int{1024, 1280, 1920} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		task := api.Task{ID: 3, Title: strings.Repeat("长标题 English ", 8), Description: "## 正文\n\n放大文字仍可阅读。", Status: "pending"}
		a.adoptCache(storage.Cache{Tasks: []api.Task{task}})
		a.editTaskNow(task)
		tt := ui.NewTester(a.view, width, 900)
		tt.SetPreferences(ui.Preferences{TextScale: 1.5, ReduceMotion: true})
		tt.Frame()
		closeBtn, ok := tt.AccessByRole(ui.RoleButton, "关闭")
		if !ok || closeBtn.Bounds.X < 0 || closeBtn.Bounds.X+closeBtn.Bounds.W > float32(width)+1 || closeBtn.Bounds.Y < 0 || closeBtn.Bounds.Y+closeBtn.Bounds.H > 900 {
			t.Fatal("large text close button clipped", width, closeBtn)
		}
		titleField, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
		if !ok || titleField.Bounds.X < 0 || titleField.Bounds.X+titleField.Bounds.W > float32(width)+1 || titleField.Bounds.Y < 0 || titleField.Bounds.Y+titleField.Bounds.H > 900 {
			t.Fatal("large text title editor clipped", width, titleField)
		}
		for _, label := range []string{"编辑优先级", "编辑分类", "编辑重复", "编辑提醒", "提醒与活动记录"} {
			node, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok {
				t.Fatalf("common control %q must be available upfront without expanding accordions", label)
			}
			if node.Bounds.X < 0 || node.Bounds.X+node.Bounds.W > float32(width)+1 || node.Bounds.Y < 0 || node.Bounds.Y+node.Bounds.H > 900 {
				t.Fatal("large text property chip clipped", width, label, node)
			}
		}
		if err := tt.Click("编辑优先级"); err != nil {
			t.Fatal(err)
		}
		if err := tt.Click("高"); err != nil {
			t.Fatal(err)
		}
		if a.draft.Priority != "高" || a.taskDraftDirty() || len(a.cache.Outbox) != 1 {
			t.Fatal("reduced-motion property editing did not autosave")
		}
		var delta map[string]any
		if err := json.Unmarshal(a.cache.Outbox[0].Body, &delta); err != nil {
			t.Fatal(err)
		}
		if a.cache.Outbox[0].TaskID != task.ID || len(delta) != 1 || delta["priority"] != float64(1) {
			t.Fatal("priority autosave changed unrelated fields", delta)
		}
		if _, open := tt.AccessByRole(ui.RolePopup, "属性选项"); open || !tt.Focused("编辑优先级") {
			t.Fatal("selected priority must close and restore trigger focus")
		}
		if err := tt.Click("编辑分类"); err != nil {
			t.Fatal(err)
		}
		if _, ok := tt.AccessByRole(ui.RolePopup, "属性选项"); !ok {
			t.Fatal("large text category editor is unreachable")
		}
		if err := tt.Click("收起关联分类（可多选）"); err != nil {
			t.Fatal(err)
		}
		a.Close()
	}
}
