package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
)

func TestPropertyPickerKeyboardDismissAndFocus(t *testing.T) {
	open := false
	value := "普通"
	tt := ui.NewTester(func(c *ui.Context) {
		ui.Column(c).Children(func() {
			trigger := taskPropertyRow(c, "trigger", "优先级", value, nil, false, func() { open = true })
			propertyPopover(c.Key("popup"), trigger, &open, func() { propertyOptions(c, &value, []string{"低", "普通", "高"}) })
		})
	}, 360, 300)
	if err := tt.Click("编辑优先级"); err != nil {
		t.Fatal(err)
	}
	if !tt.Focused("普通") {
		t.Fatal("opening must focus the current choice")
	}
	tt.Key(0, ui.KeyDown)
	if !tt.Focused("高") {
		t.Fatal("Down must move focus without choosing")
	}
	if value != "普通" {
		t.Fatal("navigation mutated the draft")
	}
	tt.Key(0, ui.KeyUp)
	if !tt.Focused("普通") {
		t.Fatal("Up did not move back")
	}
	tt.Key(0, ui.KeyDown)
	tt.Key(0, ui.KeyEnter)
	if open || value != "高" || !tt.Focused("编辑优先级") {
		t.Fatalf("Enter: open=%v value=%s restored=%v", open, value, tt.Focused("编辑优先级"))
	}
	if err := tt.Click("编辑优先级"); err != nil {
		t.Fatal(err)
	}
	tt.Key(0, ui.KeyEscape)
	if open || !tt.Focused("编辑优先级") {
		t.Fatal("Escape must close and restore focus")
	}
	if err := tt.Click("编辑优先级"); err != nil {
		t.Fatal(err)
	}
	tt.ClickAt(350, 290)
	if open || !tt.Focused("编辑优先级") {
		t.Fatal("outside click must close and restore focus")
	}
}

func TestPropertyPickerCategorySearchAndToggle(t *testing.T) {
	a := &App{categories: []api.Category{{ID: 1, Name: "工作 Work"}, {ID: 2, Name: "家庭"}, {ID: 3, Name: "学习"}}}
	d := Draft{Categories: map[int64]bool{1: true, 99: true}}
	open := false
	tt := ui.NewTester(func(c *ui.Context) {
		ui.Column(c).Children(func() {
			trigger := taskPropertyRow(c, "trigger", "分类", "工作", nil, false, func() { open = true })
			propertyPopover(c.Key("popup"), trigger, &open, func() { a.taskCategoryProperty(c, &d) })
		})
	}, 400, 420)
	if err := tt.Click("编辑分类"); err != nil {
		t.Fatal(err)
	}
	if !tt.Focused("搜索分类") {
		t.Fatal("search must receive initial focus")
	}
	selected, ok := tt.Access("工作 Work")
	if !ok || selected.Description != "已选中" {
		t.Fatal("current category is not marked", selected)
	}
	tt.Type("家")
	if _, ok := tt.Access("工作 Work"); ok {
		t.Fatal("search did not filter")
	}
	if _, ok := tt.Access("家庭"); !ok {
		t.Fatal("Chinese search lost matching category")
	}
	tt.Key(0, ui.KeyDown)
	if !tt.Focused("家庭") {
		t.Fatal("Down from search must enter results")
	}
	tt.Key(0, ui.KeyEnter)
	if !open || !d.Categories[2] || !d.Categories[1] || !d.Categories[99] {
		t.Fatal("multi-select toggle must stay open and preserve other IDs", open, d.Categories)
	}
	tt.Key(0, ui.KeyEscape)
	if open {
		t.Fatal("Escape must close multi-select category popover")
	}
	if err := tt.Click("编辑分类"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("工作 Work"); err != nil {
		t.Fatal(err)
	}
	if !open || d.Categories[1] || !d.Categories[2] || !d.Categories[99] {
		t.Fatal("deselect changed another ID or closed multi-select prematurely", open, d.Categories)
	}
	if got := matchingPropertyCategories(a.categories, " WORK "); len(got) != 1 || got[0].ID != 1 {
		t.Fatal("case insensitive trimmed search", got)
	}
}

func TestPropertyPickerWindowIsolation(t *testing.T) {
	makePicker := func() (*ui.Tester, *bool, *string) {
		open, value := false, "普通"
		tt := ui.NewTester(func(c *ui.Context) {
			ui.Column(c).Children(func() {
				trigger := taskPropertyRow(c, "trigger", "优先级", value, nil, false, func() { open = true })
				propertyPopover(c.Key("popup"), trigger, &open, func() {
					propertyOptions(c, &value, []string{"低", "普通", "高"})
				})
			})
		}, 400, 320)
		return tt, &open, &value
	}
	first, firstOpen, firstValue := makePicker()
	second, secondOpen, secondValue := makePicker()
	for _, tt := range []*ui.Tester{first, second} {
		if err := tt.Click("编辑优先级"); err != nil {
			t.Fatal(err)
		}
	}
	if err := first.Click("高"); err != nil {
		t.Fatal(err)
	}
	if *firstOpen || *firstValue != "高" || !*secondOpen || *secondValue != "普通" {
		t.Fatal("choosing in one window changed the other window")
	}
	if !first.Focused("编辑优先级") || !second.Focused("普通") {
		t.Fatal("focus restoration crossed window boundaries")
	}
	second.Key(0, ui.KeyEscape)
	if *secondOpen || !second.Focused("编辑优先级") || *firstValue != "高" {
		t.Fatal("Escape crossed window boundaries")
	}
}

func TestPropertyPickerBoundsAndLayout(t *testing.T) {
	for _, dark := range []bool{false, true} {
		for _, size := range [][2]int{{280, 240}, {360, 420}, {600, 300}} {
			t.Run(fmt.Sprintf("%v/dark=%v", size, dark), func(t *testing.T) {
				open := false
				tt := ui.NewTester(func(c *ui.Context) {
					ui.Column(c).FillWidth().FillHeight().Justify(ui.End).Children(func() {
						trigger := taskPropertyRow(c, "trigger", "分类", "分类", nil, false, func() { open = true })
						ui.Text(c, "after")
						propertyPopover(c.Key("popup"), trigger, &open, func() {
							for i := 0; i < 50; i++ {
								propertyOption(c.Key(i), fmt.Sprintf("分类 %d", i), false, func() {})
							}
						})
					})
				}, size[0], size[1])
				tt.SetDark(dark)
				before, _ := tt.Find("after")
				if err := tt.Click("编辑分类"); err != nil {
					t.Fatal(err)
				}
				tt.Advance(200 * time.Millisecond)
				p, ok := tt.AccessByRole(ui.RolePopup, "属性选项")
				if !ok || p.Bounds.X < 0 || p.Bounds.Y < 0 || p.Bounds.X+p.Bounds.W > float32(size[0]) || p.Bounds.Y+p.Bounds.H > float32(size[1]) {
					t.Fatal("popup outside bounds", p)
				}
				if after, _ := tt.Find("after"); after != before {
					t.Fatal("popup changed main layout")
				}
				if trigger, _ := tt.Access("编辑分类"); trigger.Bounds.H != 36 {
					t.Fatal("property row height", trigger.Bounds)
				}
				row, ok := tt.Access("分类 0")
				if !ok || row.Bounds.H != 34 {
					t.Fatal("option height", row)
				}
				anchor, _ := tt.Access("编辑分类")
				if gap := anchor.Bounds.Y - p.Bounds.Y - p.Bounds.H; gap < 6 || gap > 8 {
					t.Fatal("flipped panel anchor gap", gap)
				}
				tt.Key(0, ui.KeyEnd)
				last, ok := tt.Access("分类 49")
				if !ok || !last.Focused || last.Offscreen || last.Bounds.H != 34 {
					t.Fatal("keyboard must scroll the last option into view", last)
				}
			})
		}
	}
}
