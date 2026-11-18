package app

import (
	"testing"
	"todo-native/internal/api"

	"github.com/egoist/mygo/ui"
)

func TestDetailPopoverOwnsEscapeBeforeWorkspaceClose(t *testing.T) {
	a := autosaveFixture(t)
	tt := ui.NewTester(a.view, 1280, 900)
	if err := tt.Click("编辑优先级"); err != nil {
		t.Fatal(err)
	}
	if a.taskMetaOpen != "priority" {
		t.Fatal("priority popover did not open")
	}
	tt.Key(0, ui.KeyEscape)
	if !a.editing || !a.taskDetailOpen || a.selectedTaskID != 1 || a.taskMetaOpen != "" || !tt.Focused("编辑优先级") {
		t.Fatal("parent Escape closed detail or stole anchor focus", a.editing, a.taskDetailOpen, a.taskMetaOpen)
	}
	if len(a.cache.Outbox) != 0 {
		t.Fatal("Escape changed data")
	}
}

func TestDetailCategoryMultiSelectStaysOpenAndEscapeClosesCleanly(t *testing.T) {
	a := autosaveFixture(t)
	state := a.cache
	state.Categories = []api.Category{{ID: 1, Name: "工作"}, {ID: 2, Name: "家庭"}}
	a.adoptCache(state)
	tt := ui.NewTester(a.view, 1280, 900)
	if err := tt.Click("编辑分类"); err != nil {
		t.Fatal(err)
	}
	// Multi-select allows toggling both categories in a single open session
	for _, name := range []string{"工作", "家庭"} {
		opt, ok := tt.AccessByRole(ui.RoleCheckBox, name)
		if !ok {
			t.Fatalf("missing category checkbox %q", name)
		}
		tt.ClickAt(opt.Bounds.X+opt.Bounds.W/2, opt.Bounds.Y+opt.Bounds.H/2)
		tt.Frame()
		if a.taskMetaOpen != "categories" {
			t.Fatalf("multi-select category popover closed prematurely after toggling %q", name)
		}
	}
	tt.Key(0, ui.KeyEscape)
	tt.Frame()
	if a.taskMetaOpen != "" || !tt.Focused("编辑分类") {
		t.Fatal("Escape did not close category popover and restore focus", a.taskMetaOpen)
	}
	if _, exists := tt.AccessByRole(ui.RoleTextField, "搜索分类"); exists {
		t.Fatal("closed category popup remains interactive")
	}
	if !a.draft.Categories[1] || !a.draft.Categories[2] {
		t.Fatal("category multi-select lost values", a.draft.Categories)
	}
	if len(a.cache.Outbox) == 0 {
		t.Fatal("category selection was not persisted")
	}
}
