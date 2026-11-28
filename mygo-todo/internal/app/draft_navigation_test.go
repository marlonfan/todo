package app

import (
	"github.com/egoist/mygo/ui"
	"testing"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestCompactNewTaskDraftCanResumeAndQuickShortcutIsVisible(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.newTaskNow()
	a.draft.Title = "窄窗中不能丢失的新任务"
	tt := ui.NewTester(a.view, 1024, 800)
	if err := tt.Click("‹ 返回任务列表"); err != nil {
		t.Fatal(err)
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "继续编辑未保存任务"); !ok {
		t.Fatal("new draft has no resume path")
	}
	a.newTask()
	tt.Frame()
	if a.discardedDraft == nil || a.draft.Title != "" {
		t.Fatal("switching from brand-new draft should discard directly with undo toast")
	}
	if err := tt.Click("撤销"); err != nil {
		t.Fatal(err)
	}
	if !a.taskDetailOpen || a.draft.Title != "窄窗中不能丢失的新任务" {
		t.Fatal("undo did not restore the discarded new draft")
	}
	a.beginQuickAdd()
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleTextField, "快捷添加标题"); !ok || a.taskDetailOpen {
		t.Fatal("quick shortcut focused a hidden input")
	}
	if a.draft.Title != "窄窗中不能丢失的新任务" || !a.taskDraftDirty() {
		t.Fatal("quick shortcut discarded the detail draft")
	}
}

func TestLogoutRequiresDecisionForBothUnsavedTaskInputs(t *testing.T) {
	for _, quick := range []bool{false, true} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		if quick {
			a.ensureQuickDraft()
			a.quick.Draft.Title = "快捷添加草稿"
		} else {
			a.newTaskNow()
			a.draft.Title = "详情草稿"
		}
		a.logout()
		if a.client == nil || !a.taskDiscardConfirm || a.pendingTaskAction == nil {
			t.Fatal("logout cleared unsaved input without a decision", quick)
		}
		tt := ui.NewTester(a.view, 1024, 800)
		if err := tt.Click("继续编辑"); err != nil {
			t.Fatal(err)
		}
		if a.client == nil || a.taskDiscardConfirm {
			t.Fatal("cancelled logout changed session")
		}
		if quick {
			if a.quick.Draft.Title != "快捷添加草稿" || !a.quick.Open {
				t.Fatal("quick draft was not restored")
			}
		} else if a.draft.Title != "详情草稿" || !a.taskDetailOpen {
			t.Fatal("detail draft was not restored")
		}
		a.Close()
	}
}

func TestNarrowFitKeepsPreferredListWidth(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.taskListWidth = 760
	tt := ui.NewTester(a.view, 1280, 800)
	if a.taskListWidth != 760 || a.taskListFitWidth >= 760 {
		t.Fatal("narrow fitting overwrote the preferred width", a.taskListWidth, a.taskListFitWidth)
	}
	assertFit := func() {
		t.Helper()
		detailWidth := a.taskWorkspaceWidth - a.taskListFitWidth - 1
		if a.taskListWidth != 760 || detailWidth < detailMinWidth || detailWidth > detailMaxWidth || a.taskListFitWidth < taskListMinWidth {
			t.Fatal("fitting must preserve preference and flexible detail bounds", a.taskListWidth, a.taskListFitWidth, detailWidth)
		}
	}
	assertFit()
	tt.SetSize(1920, 900)
	assertFit()
	if a.taskListFitWidth != 760 {
		t.Fatal("wide workspace must restore the preferred list width", a.taskListFitWidth)
	}
	// Also verify user can shrink list down to 240px so detail gets maximum room
	a.taskListWidth = 240
	a.taskWorkspaceWidth = 0
	tt.SetSize(1440, 900)
	if a.taskListFitWidth != 240 || (a.taskWorkspaceWidth-a.taskListFitWidth-1) < 900 {
		t.Fatalf("compact list width 240px was blocked: list=%.0f workspace=%.0f", a.taskListFitWidth, a.taskWorkspaceWidth)
	}
}
