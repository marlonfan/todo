package app

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestDetailHeaderPropertyHasOneOwnerAndPersists(t *testing.T) {
	a := autosaveFixture(t)
	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("编辑优先级"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("高"); err != nil {
		t.Fatal(err)
	}
	if a.taskMetaOpen != "" || !tt.Focused("编辑优先级") {
		t.Fatal("property chip lost overlay ownership/focus", a.taskMetaOpen)
	}
	if len(a.cache.Outbox) != 1 || a.draft.Priority != "高" {
		t.Fatal("property chip did not persist priority")
	}
	if err := tt.Click("编辑重复"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("每天"); err != nil {
		t.Fatal(err)
	}
	if a.taskMetaOpen != "repeat" {
		t.Fatal("selecting repeat frequency closed repeat popover prematurely", a.taskMetaOpen)
	}
	if !a.draft.HasStart {
		t.Fatal("selecting repeat frequency on dateless task should auto-enable start date")
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "重复次数"); !ok {
		t.Fatal("repeat rule fields should appear immediately without extra click")
	}
	tt.Key(0, ui.KeyEscape)
	if !a.taskDetailOpen || !tt.Focused("编辑重复") {
		t.Fatal("Escape closed detail instead of repeat popover")
	}
}
