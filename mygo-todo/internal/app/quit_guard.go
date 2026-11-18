package app

import "github.com/egoist/mygo"

// Called synchronously by the UI-thread close/quit listeners. Window.Update
// queues work even on that thread, so it cannot decide whether to cancel an
// event before MyGo destroys the window.
func (a *App) guardTaskExit(next func()) bool {
	saved := a.flushDetailAutosave()
	if saved && !a.taskDraftDirty() && !a.quickDraftDirty() {
		return true
	}
	a.pendingTaskAction = func() {
		// Only the explicit discard action reaches this continuation. Clear
		// composition and quick capture too before re-entering the event gate.
		a.clearTaskSelection()
		a.quick = quickAddState{}
		next()
	}
	a.taskDiscardConfirm = true
	a.Show()
	if a.win != nil {
		a.win.Invalidate()
	}
	return false
}

func (a *App) Quitting(e *mygo.QuitEvent) {
	a.quitting = false
	if !a.guardTaskExit(mygo.App.Quit) {
		e.PreventDefault()
		return
	}
	// Durable pending outbox entries may remain; they are not a sync receipt.
	a.quitting = true
}

func (a *App) windowClosing(e *mygo.CloseEvent) {
	if a.quitting {
		return // OnBeforeQuit already checked the same UI-thread state.
	}
	if a.tray != nil {
		a.flushDetailAutosave()
		e.PreventDefault()
		a.win.Hide() // Unsaved input stays in this process for the next Show.
		return
	}
	if !a.guardTaskExit(func() { a.win.Close() }) {
		e.PreventDefault()
	}
}
