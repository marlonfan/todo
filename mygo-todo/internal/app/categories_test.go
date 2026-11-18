package app

import (
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestCategoryPayloadMatchesServerLimitsAndDefaults(t *testing.T) {
	p, err := categoryPayload(api.Category{Name: "  工作  "})
	if err != nil || p["name"] != "工作" || p["color"] != "#3788d8" || p["emoji"] != "📁" {
		t.Fatal(p, err)
	}
	for _, cat := range []api.Category{
		{Name: "  "}, {Name: strings.Repeat("类", 51)}, {Name: "工作", Emoji: strings.Repeat("📁", 17)},
		{Name: "工作", Color: "blue"}, {Name: "工作", Color: "#123"}, {Name: "工作", Color: "#00000000"}, {Name: "工作", Color: "#gggggg"},
	} {
		if _, err := categoryPayload(cat); err == nil {
			t.Fatal("invalid category was accepted", cat)
		}
	}
	if _, err := categoryPayload(api.Category{Name: strings.Repeat("类", 50), Emoji: strings.Repeat("📁", 16), Color: " #A0b1C2 "}); err != nil {
		t.Fatal(err)
	}
}

func TestNativeCategoryPaletteValidationAndCancel(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "categories"
	a.categories = []api.Category{{ID: 4, Name: "工作", Emoji: "💼", Color: "#nothex"}}
	tt := ui.NewTester(a.view, 900, 760)
	// Invalid colors from a legacy source must render without panicking.
	if err := tt.Click("编辑分类 工作"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("保存分类"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("分类颜色应为 #RRGGBB，例如 #3788d8") || !a.categoryEditing {
		t.Fatal(tt.Texts())
	}
	tt.Scroll(450, 380, 0, 230)
	if err := tt.Click("分类绿色"); err != nil {
		t.Fatal(err)
	}
	if a.categoryDraft.Color != "#16a34a" || a.failure != "" {
		t.Fatal("palette did not update the draft or clear the old error", a.categoryDraft, a.failure)
	}
	if a.categories[0].Color != "#nothex" {
		t.Fatal("unsaved preview changed the original category")
	}
	if err := tt.Click("取消分类编辑"); err != nil {
		t.Fatal(err)
	}
	if a.categoryEditing || a.categoryDraft.Name != "" {
		t.Fatal("cancel retained the draft")
	}
	if err := tt.Click("更多分类操作 工作"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("删除分类"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("分类中的任务会保留。") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("保留"); err != nil {
		t.Fatal(err)
	}
	if a.deleteCategory != nil || len(a.categories) != 1 {
		t.Fatal("cancel deleted a category")
	}
}

func TestNativeCategoryLongErrorKeepsActionsAtMinimumWindow(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.editCategory(api.Category{ID: 3, Name: strings.Repeat("类", 50), Color: "#3788d8"})
	a.failure = strings.Repeat("服务暂时不可用。", 100)
	tt := ui.NewTester(a.view, 900, 600)
	check := func(labels ...string) {
		t.Helper()
		for _, label := range labels {
			n, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
				t.Fatal("category action outside minimum window", label, n)
			}
		}
	}
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		tt.Advance(time.Second)
		check("保存分类", "取消分类编辑")
	}
	if err := tt.Click("取消分类编辑"); err != nil {
		t.Fatal(err)
	}
	a.deleteCategory = &api.Category{ID: 3, Name: strings.Repeat("类", 50)}
	a.failure = strings.Repeat("服务暂时不可用。", 100)
	tt.Frame()
	check("保留", "确认删除")
}
