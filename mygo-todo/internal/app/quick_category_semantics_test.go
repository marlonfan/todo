package app

import (
	"github.com/egoist/mygo/ui"
	"testing"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestQuickCaptureCategoriesHaveIndependentCheckboxSemantics(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "all"
	a.categories = []api.Category{{ID: 1, Name: "工作"}, {ID: 2, Name: "生活"}}
	a.beginQuickAdd()
	a.quick.Draft.Categories = map[int64]bool{1: true, 2: true}
	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("编辑快捷分类"); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"工作", "生活"} {
		option, ok := tt.AccessByRole(ui.RoleCheckBox, name)
		if !ok || !option.Checked {
			t.Fatal("multi category must be checked checkbox", name, option)
		}
		if _, ok := tt.AccessByRole(ui.RoleRadio, name); ok {
			t.Fatal("multi category exposed as radio", name)
		}
	}
	work, _ := tt.AccessByRole(ui.RoleCheckBox, "工作")
	tt.Press(work.Bounds.X+20, work.Bounds.Y+18)
	tt.Release(work.Bounds.X+20, work.Bounds.Y+18)
	tt.Frame()
	first, firstOK := tt.AccessByRole(ui.RoleCheckBox, "工作")
	second, secondOK := tt.AccessByRole(ui.RoleCheckBox, "生活")
	if !firstOK || !secondOK || first.Checked || !second.Checked || len(a.cache.Outbox) != 0 {
		t.Fatal("unchecking one category closed multi-select or changed another or submitted new task", first.Checked, second.Checked, a.quick.Draft.Categories, len(a.cache.Outbox))
	}
}
