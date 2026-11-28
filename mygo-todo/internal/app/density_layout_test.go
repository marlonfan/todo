package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestDenseRowsHaveExactHeightAndReachableTargets(t *testing.T) {
	now := time.Now()
	yesterday := dayStart(now).AddDate(0, 0, -1)
	for _, dark := range []bool{false, true} {
		for _, auxiliary := range []bool{false, true} {
			t.Run(fmt.Sprintf("dark=%t/meta=%t", dark, auxiliary), func(t *testing.T) {
				a := New(storage.Store{Dir: t.TempDir()})
				defer a.Close()
				task := api.Task{ID: 1, Title: "标题优先的紧凑任务", Status: "pending"}
				want := float32(52)
				if auxiliary {
					task.StartTime = &yesterday
					want = 52
				}
				tt := ui.NewTester(func(c *ui.Context) {
					applyAppTheme(c)
					ui.Column(c).Width(420).Children(func() { a.taskListItem(c, task, now) })
				}, 420, 180)
				tt.SetDark(dark)
				tt.Frame()
				row, ok := tt.Access("任务行 " + task.Title)
				if !ok || row.Bounds.H != want {
					t.Fatalf("row height got %v, want %.0f", row, want)
				}
				for _, label := range []string{"完成 " + task.Title, "更多操作 " + task.Title, task.Title} {
					node, ok := tt.Access(label)
					if !ok || node.Bounds.W < 32 || node.Bounds.H < 32 {
						t.Fatalf("small/missing hit target %s: %v", label, node)
					}
					if node.Bounds.Y < row.Bounds.Y || node.Bounds.Y+node.Bounds.H > row.Bounds.Y+row.Bounds.H {
						t.Fatalf("target spills outside row: %v", node)
					}
				}
			})
		}
	}
}

func TestDenseQuickAddAndStableDetailFooter(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	quick := ui.NewTester(func(c *ui.Context) { applyAppTheme(c); a.quickAddBar(c) }, 420, 260)
	panel, ok := quick.Access("快捷添加区")
	if !ok || panel.Bounds.H != 42 {
		t.Fatal("collapsed quick capture must be a single 42-unit row", panel)
	}
	a.quick.Input.Focus()
	quick.Frame()
	if !a.quick.Open {
		t.Fatal("keyboard focus must expand inline quick icons")
	}
	openPanel, _ := quick.Access("快捷添加区")
	if openPanel.Bounds.H != 42 {
		t.Fatal("focused quick capture must stay single-line without expanding into a big box", openPanel)
	}
	quick.Type("原生快捷草稿")
	quick.Key(0, ui.KeyEscape)
	if a.quick.Open || a.quick.Draft.Title != "原生快捷草稿" {
		t.Fatal("Esc must collapse while preserving quick draft")
	}
	quick.Frame()
	panel, _ = quick.Access("快捷添加区")
	if panel.Bounds.H != 42 {
		t.Fatal("retained draft must not add a second collapsed line", panel)
	}
	a.client, _ = api.New(api.DefaultServer, "")
	task := api.Task{ID: 1, Title: "内容优先", Description: "描述优先于属性", Status: "pending"}
	a.adoptCache(storage.Cache{Tasks: []api.Task{task}})
	a.editTaskNow(task)
	tt := ui.NewTester(a.view, 1280, 900)
	titleField, _ := tt.AccessByRole(ui.RoleTextField, "任务标题")
	start, _ := tt.AccessByRole(ui.RoleButton, "编辑开始")
	descField, _ := tt.AccessByRole(ui.RoleTextField, "备注")
	if titleField.Bounds.Y >= start.Bounds.Y || start.Bounds.Y >= descField.Bounds.Y {
		t.Fatal("expected title -> compact property chips -> WYSIWYG description order", titleField, start, descField)
	}
	if tt.HasText("本次实例") || tt.HasText("整个系列提醒与活动记录") {
		t.Fatal("ordinary task exposes fake instance/series content")
	}
	_, hasFooter := tt.Access("任务底部操作")
	_, hasSave := tt.AccessByRole(ui.RoleButton, "保存任务")
	if hasFooter || hasSave || !tt.HasText("已同步") {
		t.Fatal("clean task must reclaim detail footer and rely on single sidebar sync status", hasFooter, hasSave)
	}
	if err := tt.Click("任务标题"); err != nil {
		t.Fatal(err)
	}
	a.draft.Title += "更改"
	tt.Frame()
	_, changedFooter := tt.Access("任务底部操作")
	_, hasSave = tt.AccessByRole(ui.RoleButton, "保存任务")
	changedDesc, _ := tt.AccessByRole(ui.RoleTextField, "备注")
	if changedFooter || hasSave || changedDesc.Bounds != descField.Bounds || !tt.HasText("待保存…") || !a.taskDraftDirty() {
		t.Fatal("dirty task must show transient toolbar status without shifting editor layout", changedFooter, changedDesc.Bounds, descField.Bounds)
	}
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	tt.Frame()
	_, savedFooter := tt.Access("任务底部操作")
	savedDesc, _ := tt.AccessByRole(ui.RoleTextField, "备注")
	if savedFooter || savedDesc.Bounds != descField.Bounds || !tt.HasText("已存本机 · 待同步") || a.taskDraftDirty() || len(a.cache.Outbox) != 1 {
		t.Fatal("autosave must keep calm layout without bottom bar and expose durable local state", savedFooter, savedDesc.Bounds)
	}
}

func TestDenseOverdueColorsOnlyDateFragment(t *testing.T) {
	now := time.Now()
	past := dayStart(now).AddDate(0, 0, -2)
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	task := api.Task{ID: 1, Title: "逾期任务", Status: "pending", Priority: 1, StartTime: &past}
	var danger ui.Color
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		danger = tokensOf(c).Danger
		ui.Column(c).Width(420).Children(func() { a.taskListItem(c, task, now) })
	}, 420, 100)
	date, ok := tt.Find(past.In(a.location()).Format("01月02日 15:04"))
	if !ok {
		t.Fatal("overdue date is not a separate fragment", tt.Texts())
	}
	image, count := tt.Image(), 0
	for y := 0; y < image.Rect.Max.Y; y++ {
		for x := 0; x < image.Rect.Max.X; x++ {
			p := image.RGBAAt(x, y)
			if p.R == danger.R && p.G == danger.G && p.B == danger.B && p.A == 255 {
				if float32(x) < date.X || float32(x) >= date.X+date.W || float32(y) < date.Y || float32(y) >= date.Y+date.H {
					t.Fatal("non-date summary text became danger colored", x, y, date)
				}
				count++
			}
		}
	}
	if count == 0 {
		t.Fatal("overdue date did not render in danger color")
	}
}

func TestDenseSecondaryActionsRevealForHoverAndKeyboard(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	task := api.Task{ID: 1, Title: "选中不强显次操作", Status: "pending"}
	a.editing, a.selectedTaskID = true, task.ID
	var ink ui.Color
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		ink = tokensOf(c).TextSecondary
		ui.Column(c).Width(420).Children(func() { a.taskListItem(c, task, time.Now()) })
	}, 420, 100)
	tt.Move(-10, -10)
	tt.Advance(time.Second)
	more, _ := tt.Access("更多操作 " + task.Title)
	pixels := func() int {
		image, count := tt.Image(), 0
		for y := int(more.Bounds.Y); y < int(more.Bounds.Y+more.Bounds.H); y++ {
			for x := int(more.Bounds.X); x < int(more.Bounds.X+more.Bounds.W); x++ {
				p := image.RGBAAt(x, y)
				if p.R == ink.R && p.G == ink.G && p.B == ink.B && p.A == 255 {
					count++
				}
			}
		}
		return count
	}
	if pixels() != 0 {
		t.Fatal("selection alone reveals secondary action")
	}
	tt.Move(120, 20)
	tt.Advance(time.Second)
	if pixels() == 0 {
		t.Fatal("hover does not reveal secondary action")
	}
	tt.Move(-10, -10)
	tt.Key(0, ui.KeyTab) // completion checkbox
	tt.Key(0, ui.KeyTab) // title
	tt.Key(0, ui.KeyTab) // native more menu trigger
	if !tt.Focused("更多操作 "+task.Title) || pixels() == 0 {
		t.Fatal("Tab cannot reveal/focus secondary action")
	}
	tt.Key(0, ui.KeyEnter)
	if !tt.HasText("查看与编辑") {
		t.Fatal("focused menu cannot open with Enter")
	}
	tt.Key(0, ui.KeyEscape)
	if !tt.Focused("更多操作 "+task.Title) || len(a.cache.Outbox) != 0 {
		t.Fatal("Esc must restore focus without mutations")
	}
}

func TestSidebarWidthMigrationKeepsSupportedPreference(t *testing.T) {
	for _, tc := range []struct{ old, want float32 }{{0, 248}, {228, 248}, {220, 240}, {244, 244}, {248, 248}, {260, 260}, {280, 260}} {
		if got := fittedSidebarWidth(tc.old); got != tc.want {
			t.Fatalf("old %.0f got %.0f want %.0f", tc.old, got, tc.want)
		}
	}
}
