package app

import (
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestLinearListKeysStayWithinListFocus(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.tasks = []api.Task{{ID: 1, Title: "第一项", Status: "pending"}, {ID: 2, Title: "第二项", Status: "pending"}, {ID: 3, Title: "第三项", Status: "pending"}}
	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("第三项"); err != nil {
		t.Fatal(err)
	}
	tt.Key(0, ui.KeyDown)
	if a.highlightedTaskKey == "" || a.draft.Task.ID == 2 {
		// Immediate highlight moves synchronously while detail load debounces 80ms
	}
	tt.Advance(100 * time.Millisecond)
	if a.draft.Task.ID != 2 {
		t.Fatal("list Down did not choose the next task", a.draft.Task.ID)
	}
	if err := tt.Click("任务标题"); err != nil {
		t.Fatal(err)
	}
	tt.Key(0, ui.KeyDown)
	if a.draft.Task.ID != 2 {
		t.Fatal("list stole a key from the native title editor")
	}
	if err := tt.Click("快捷添加标题"); err != nil {
		t.Fatal(err)
	}
	tt.Key(0, ui.KeyDown)
	if a.draft.Task.ID != 2 {
		t.Fatal("list stole a key from quick capture")
	}
}

func TestDenseWorkspaceMenuOwnsEnterAndArrows(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.tasks = []api.Task{{ID: 1, Title: "完整工作区菜单", Status: "pending"}, {ID: 2, Title: "另一任务", Status: "pending"}}
	tt := ui.NewTester(a.view, 1280, 900)
	if err := tt.Click("完整工作区菜单"); err != nil {
		t.Fatal(err)
	}
	baseline, title := a.draft.Task.ID, a.draft.Title
	tt.Key(0, ui.KeyTab)
	if !tt.Focused("更多操作 完整工作区菜单") {
		t.Fatal("Tab missed row menu")
	}
	tt.Key(0, ui.KeyEnter)
	if !tt.HasText("查看与编辑") || !a.taskMenuOpen {
		t.Fatal("list ancestor stole menu Enter", tt.Texts())
	}
	tt.Key(0, ui.KeyDown)
	if a.draft.Task.ID != baseline || a.draft.Title != title {
		t.Fatal("list ancestor stole menu Down")
	}
	tt.Key(0, ui.KeyEscape)
	if !tt.Focused("更多操作 完整工作区菜单") || a.taskMenuOpen || len(a.cache.Outbox) != 0 {
		t.Fatal("menu Esc changed data or lost focus")
	}
}

func TestWorkspaceWidthsPersistWithoutChangingTaskDraft(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	a := New(store)
	defer a.Close()
	a.editTaskNow(api.Task{ID: 9, Title: "草稿", Status: "pending"})
	a.draft.Title = "保留这个草稿"
	a.sidebarWidth, a.taskListWidth = 244, 396
	a.rememberWorkspaceLayout()
	restarted := New(store)
	defer restarted.Close()
	if restarted.sidebarWidth != 244 || restarted.taskListWidth != 396 {
		t.Fatal("workspace layout not restored", restarted.sidebarWidth, restarted.taskListWidth)
	}
	if !a.taskDraftDirty() || a.draft.Title != "保留这个草稿" || len(a.cache.Outbox) != 0 {
		t.Fatal("layout persistence changed or saved the task draft")
	}
}
