package app

import (
	"testing"
	"time"
	"todo-native/internal/api"

	"github.com/egoist/mygo/ui"
)

func TestDetailShortcutSummaryAndPanelBounds(t *testing.T) {
	for _, size := range [][2]int{{900, 600}, {1280, 800}} {
		a := autosaveFixture(t)
		a.draft.HasStart = true
		a.draft.Start = time.Date(2026, 11, 13, 14, 30, 0, 0, time.Local)
		if value, set := a.detailPropertySummary(&a.draft, "start"); value != "11/13" || !set {
			t.Fatal(value, set)
		}
		tt := ui.NewTester(a.view, size[0], size[1])
		for _, item := range []struct {
			label    string
			maxWidth float32
		}{{"编辑优先级", 220}, {"编辑重复", 360}, {"编辑开始", 360}} {
			if err := tt.Click(item.label); err != nil {
				t.Fatal(err)
			}
			panel, ok := tt.AccessByRole(ui.RolePopup, "属性选项")
			if !ok || panel.Bounds.W > item.maxWidth || panel.Bounds.X < 0 || panel.Bounds.X+panel.Bounds.W > float32(size[0]) || panel.Bounds.Y+panel.Bounds.H > float32(size[1]) {
				t.Fatal(size, item, panel)
			}
			if item.label == "编辑优先级" {
				normal, ok := tt.AccessByRole(ui.RoleRadio, "普通")
				if !ok || !normal.Checked {
					t.Fatal("priority selection semantics", normal)
				}
			}
			tt.Key(0, ui.KeyEscape)
			if !tt.Focused(item.label) {
				t.Fatal("focus not restored", item)
			}
		}
	}
}

func TestDetailToolbarFits420(t *testing.T) {
	a := autosaveFixture(t)
	a.draft.HasStart = true
	a.draft.Start = time.Date(2026, 11, 13, 14, 30, 0, 0, time.Local)
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		ui.Column(c).FillWidth().FillHeight().Children(func() { a.taskEditorContent(c, true) })
	}, 420, 700)
	for _, label := range []string{"提醒与活动记录", "更多任务选项", "关闭", "编辑状态", "编辑开始", "编辑优先级", "编辑分类", "编辑重复", "编辑提醒"} {
		entry, ok := tt.Access(label)
		if !ok || entry.Bounds.X < 0 || entry.Bounds.X+entry.Bounds.W > 420 {
			t.Fatal("detail control overflow at 420px", label, entry)
		}
	}
	if err := tt.Click("编辑重复"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("每天"); err != nil {
		t.Fatal(err)
	}
	panel, ok := tt.AccessByRole(ui.RolePopup, "属性选项")
	if !ok || panel.Bounds.X < 0 || panel.Bounds.X+panel.Bounds.W > 420 || panel.Bounds.Y+panel.Bounds.H > 700 {
		t.Fatal("expanded repeat bounds", panel)
	}
}

func TestCategoryOptionMultipleSelectionSemantics(t *testing.T) {
	a := autosaveFixture(t)
	a.categories = []api.Category{{ID: 1, Name: "工作", Emoji: "💼", Color: "#123456"}, {ID: 2, Name: "生活", Emoji: "🌱", Color: "#abcdef"}}
	a.draft.Categories = map[int64]bool{1: true, 2: true}
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		a.detailPropertyShortcuts(c, &a.draft)
	}, 1280, 800)
	if err := tt.Click("快捷设置分类"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"工作", "生活"} {
		option, ok := tt.AccessByRole(ui.RoleCheckBox, name)
		if !ok || !option.Checked {
			t.Fatal("category must be checked checkbox", option)
		}
		if _, ok := tt.AccessByRole(ui.RoleRadio, name); ok {
			t.Fatal("category exposed as radio")
		}
	}
	if err := tt.Click("工作"); err != nil {
		t.Fatal(err)
	}
	if a.draft.Categories[1] || !a.draft.Categories[2] {
		t.Fatal("toggle changed unrelated category")
	}
}
