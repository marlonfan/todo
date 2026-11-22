package app

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/syncer"
)

func TestQuitGuardFlushesBeforeDebounceForCloseAndQuit(t *testing.T) {
	for _, quit := range []bool{false, true} {
		t.Run(map[bool]string{false: "close", true: "quit"}[quit], func(t *testing.T) {
			a := autosaveFixture(t)
			a.draft.Title = "关闭前最后输入"
			a.autosave.due = time.Now().Add(450 * time.Millisecond)
			if quit {
				e := &mygo.QuitEvent{}
				a.Quitting(e)
				if e.DefaultPrevented() || !a.quitting {
					t.Fatal("durable draft blocked quit")
				}
			} else {
				e := &mygo.CloseEvent{}
				a.windowClosing(e)
				if e.DefaultPrevented() {
					t.Fatal("durable draft blocked close")
				}
			}
			cache, err := a.store.Cache("", 0)
			if err != nil || len(cache.Outbox) != 1 || cache.Outbox[0].State != "pending" {
				t.Fatal("last input not durably queued", err, cache.Outbox)
			}
			found := false
			for _, task := range syncer.View(cache).Tasks {
				if task.ID == 1 && task.Title == "关闭前最后输入" {
					found = true
				}
			}
			if !found || a.taskDraftDirty() || a.detailSaveLabel() != "已存本机 · 待同步" {
				t.Fatal("lost input or claimed remote sync", a.detailSaveLabel())
			}
			// Quit may be requested again with the same durable pending outbox.
			e := &mygo.QuitEvent{}
			a.Quitting(e)
			if e.DefaultPrevented() {
				t.Fatal("pending local outbox prevented safe quit")
			}
		})
	}
}

func TestQuitGuardUnsafeInputsCancelCloseAndQuit(t *testing.T) {
	cases := []struct {
		name    string
		prepare func(*testing.T, *App)
	}{
		{"composition", func(_ *testing.T, a *App) { a.autosave.composing = true }},
		{"compositionWithoutDraftDelta", func(_ *testing.T, a *App) { a.draft = *a.taskDraftBase; a.autosave.composing = true }},
		{"invalidTitle", func(_ *testing.T, a *App) { a.draft.Title = "" }},
		{"localFailure", func(t *testing.T, a *App) {
			path := filepath.Join(t.TempDir(), "occupied")
			if err := os.WriteFile(path, []byte("occupied"), 0600); err != nil {
				t.Fatal(err)
			}
			a.store.Dir = path
		}},
		{"newTask", func(_ *testing.T, a *App) { a.draft.Task.ID = 0 }},
		{"quickDraft", func(_ *testing.T, a *App) {
			a.draft = *a.taskDraftBase
			a.ensureQuickDraft()
			a.quick.Draft.Title = "未创建的快速输入"
		}},
		{"busy", func(_ *testing.T, a *App) { a.busy = true }},
		{"orphaned", func(_ *testing.T, a *App) { a.taskDraftOrphaned = true }},
		{"cacheFailure", func(_ *testing.T, a *App) { a.cacheError = "cannot save local cache" }},
		{"readOnly", func(_ *testing.T, a *App) { a.draft.Task.ReadOnly = true }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := autosaveFixture(t)
			a.draft.Title = "未落盘输入"
			tc.prepare(t, a)
			title, quickTitle := a.draft.Title, a.quick.Draft.Title
			closeEvent := &mygo.CloseEvent{}
			a.windowClosing(closeEvent)
			if !closeEvent.DefaultPrevented() || !a.taskDiscardConfirm || a.pendingTaskAction == nil {
				t.Fatal("close did not protect input")
			}
			quitEvent := &mygo.QuitEvent{}
			a.Quitting(quitEvent)
			if !quitEvent.DefaultPrevented() || a.quitting || !a.taskDiscardConfirm || a.pendingTaskAction == nil {
				t.Fatal("quit did not protect input")
			}
			if a.draft.Title != title || a.quick.Draft.Title != quickTitle || len(a.cache.Outbox) != 0 {
				t.Fatal("unsafe input was changed or persisted")
			}
		})
	}
}

func TestQuitGuardConfirmationRequiresExplicitDiscard(t *testing.T) {
	for _, discard := range []bool{false, true} {
		t.Run(map[bool]string{false: "continueEditing", true: "discard"}[discard], func(t *testing.T) {
			a := autosaveFixture(t)
			a.draft.Task.ID = 0
			a.draft.Title = "尚未创建"
			a.ensureQuickDraft()
			a.quick.Draft.Title = "快速草稿"
			a.autosave.composing = true
			continued := 0
			if a.guardTaskExit(func() {
				continued++
				e := &mygo.QuitEvent{}
				a.Quitting(e)
				if e.DefaultPrevented() || !a.quitting {
					t.Fatal("explicit discard failed to re-enter quit")
				}
			}) {
				t.Fatal("unsafe draft exited")
			}
			tt := ui.NewTester(a.taskDiscardConfirmation, 900, 600)
			label := "继续编辑"
			if discard {
				label = "放弃并切换"
			}
			if err := tt.Click(label); err != nil {
				t.Fatal(err)
			}
			if a.taskDiscardConfirm || a.pendingTaskAction != nil {
				t.Fatal("confirmation not resolved")
			}
			if discard {
				if continued != 1 || a.taskDraftDirty() || a.quickDraftDirty() || a.autosave.composing {
					t.Fatal("discard left unsafe draft")
				}
			} else if continued != 0 || a.draft.Title != "尚未创建" || a.quick.Draft.Title != "快速草稿" || a.quitting {
				t.Fatal("continue editing lost input or continued quit")
			}
		})
	}
}

func TestQuitGuardFlushesExistingDetailButRetainsQuickDraft(t *testing.T) {
	a := autosaveFixture(t)
	a.draft.Description = "详情最后输入"
	a.ensureQuickDraft()
	a.quick.Draft.Title = "尚未创建的 quick"
	e := &mygo.QuitEvent{}
	a.Quitting(e)
	if !e.DefaultPrevented() || a.quitting || !a.taskDiscardConfirm || a.taskDraftDirty() || !a.quickDraftDirty() {
		t.Fatal("mixed drafts did not flush detail and protect quick capture")
	}
	cache, err := a.store.Cache("", 0)
	if err != nil || len(cache.Outbox) != 1 || a.quick.Draft.Title != "尚未创建的 quick" {
		t.Fatal("mixed draft lost durable detail or quick input", err)
	}
	found := false
	for _, task := range syncer.View(cache).Tasks {
		if task.ID == 1 && task.Description == "详情最后输入" {
			found = true
		}
	}
	if !found {
		t.Fatal("detail was not durable before quit was cancelled")
	}
}

func TestQuitGuardOccurrenceScheduleNeedsConfirmation(t *testing.T) {
	a := autosaveFixture(t)
	a.clearTaskSelection()
	a.selectedOccurrence = &api.Task{ID: 1, Title: "重复任务"}
	a.occurrenceSchedule = &occurrenceScheduleDraft{}
	a.occurrenceScheduleBase = &occurrenceScheduleDraft{}
	// An edited occurrence title remains unsafe while its explicit schedule
	// form is open, even though normal occurrence text supports autosave.
	a.occurrenceEditing = true
	a.occurrenceTitle = "修改本次"
	e := &mygo.QuitEvent{}
	a.Quitting(e)
	if !e.DefaultPrevented() || !a.taskDiscardConfirm || !a.taskDraftDirty() || len(a.cache.Outbox) != 0 {
		t.Fatal("quit bypassed explicit occurrence scheduling")
	}
}

func TestWindowClosingHidesToTrayInsteadOfQuitting(t *testing.T) {
	a := autosaveFixture(t)
	a.trayAvailable = true
	a.draft.Title = "关闭到托盘前保存"

	if !a.shouldHideOnClose() {
		t.Fatal("expected shouldHideOnClose to be true when tray is available and app is not quitting")
	}

	closeEvent := &mygo.CloseEvent{}
	a.windowClosing(closeEvent)
	if !closeEvent.DefaultPrevented() {
		t.Fatal("expected window close to be prevented so the window hides to tray")
	}
	if a.taskDiscardConfirm {
		t.Fatal("hiding to tray should not prompt to discard drafts")
	}
	cache, err := a.store.Cache("", 0)
	if err != nil || len(cache.Outbox) != 1 {
		t.Fatalf("expected autosave flush when hiding to tray, err=%v outbox=%d", err, len(cache.Outbox))
	}

	// Explicit quit (e.g., from tray Quit menu or shortcut) must allow closing.
	quitEvent := &mygo.QuitEvent{}
	a.Quitting(quitEvent)
	if quitEvent.DefaultPrevented() || !a.quitting {
		t.Fatal("explicit quit was unexpectedly prevented")
	}
	if a.shouldHideOnClose() {
		t.Fatal("shouldHideOnClose must be false once app is explicitly quitting")
	}

	finalClose := &mygo.CloseEvent{}
	a.windowClosing(finalClose)
	if finalClose.DefaultPrevented() {
		t.Fatal("expected window close to proceed once app is quitting")
	}
}
