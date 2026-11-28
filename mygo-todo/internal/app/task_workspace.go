package app

import (
	"maps"
	"reflect"
	"strings"

	"github.com/egoist/mygo/ui"
)

func isTaskWorkspacePage(page string) bool {
	switch page {
	case "all", "inbox", "today", "upcoming", "processed", "completed", "cancelled", "skipped":
		return true
	}
	return strings.HasPrefix(page, "category:")
}

func (a *App) pruneMissingDraftCategories(d *Draft) bool {
	available := make(map[int64]bool, len(a.categories))
	for _, category := range a.categories {
		available[category.ID] = true
	}
	removed := false
	for id, checked := range d.Categories {
		if checked && !available[id] && !available[a.cache.CategoryAliases[id]] {
			delete(d.Categories, id)
			removed = true
		}
	}
	return removed
}

func (a *App) rememberTaskDraft() {
	d := a.draft
	d.Categories = maps.Clone(d.Categories)
	a.taskDraftBase = &d
}

func (a *App) taskDraftDirty() bool {
	if a.editing && a.taskDraftBase != nil && !reflect.DeepEqual(a.draft, *a.taskDraftBase) {
		return true
	}
	if t := a.selectedOccurrence; t != nil {
		if a.occurrenceEditing && (a.occurrenceTitle != t.Title || a.occurrenceDescription != t.Description) {
			return true
		}
		if a.occurrenceSchedule != nil && a.occurrenceScheduleBase != nil && *a.occurrenceSchedule != *a.occurrenceScheduleBase {
			return true
		}
	}
	return false
}

func (a *App) clearTaskSelection() {
	a.autosave = detailAutosaveState{generation: a.autosave.generation + 1}
	a.editing, a.taskEditorInline, a.taskDetailOpen = false, false, false
	a.selectedTaskID, a.taskDraftBase = 0, nil
	a.selectedOccurrence, a.occurrenceSchedule, a.occurrenceScheduleBase = nil, nil, nil
	a.occurrenceEditing = false
	a.highlightPending = nil
	a.highlightedTaskKey = ""
	a.failure = ""
	a.taskDraftOrphaned = false
}

func (a *App) resumeTaskDraft() {
	a.sidebarOverlay = false
	if (a.editing || a.selectedOccurrence != nil) && a.taskDraftDirty() {
		a.detailNavDir = 1
		a.taskDetailOpen = a.taskEditorInline
		return
	}
	if a.quickDraftDirty() {
		a.taskDetailOpen = false
		a.quick.Open = true
		a.quick.Input.Focus()
	}
}

func (a *App) restoreDiscardedDraft() {
	if a.discardedDraft == nil {
		return
	}
	d := *a.discardedDraft
	d.Categories = maps.Clone(d.Categories)
	a.discardedDraft = nil
	a.requestTaskTransition(func() {
		a.newTaskNow()
		a.draft = d
	})
}

// Every destructive editor transition goes through this gate. Returning from
// the narrow detail view only hides it, so the exact same draft can be resumed.
func (a *App) requestTaskTransition(next func()) {
	if a.busy || a.aiPanel != nil {
		return
	}
	if a.autosave.composing {
		a.autosave.failure = "输入法组合中，请完成输入后切换"
		return
	}
	if a.taskDraftDirty() && (a.selectedOccurrence != nil || (a.editing && a.draft.Task.ID != 0)) {
		a.flushDetailAutosave()
	}
	if a.taskDraftDirty() {
		// For brand-new unsaved drafts without autosave/storage errors, discard directly with an Undo toast.
		if a.editing && a.draft.Task.ID == 0 && a.autosave.failure == "" && a.cacheError == "" {
			snap := a.draft
			snap.Categories = maps.Clone(snap.Categories)
			a.discardedDraft = &snap
			a.clearTaskSelection()
			next()
			a.pushUndoToast("discard-new-draft", "已放弃未保存的任务草稿", "撤销", func() {
				a.restoreDiscardedDraft()
			}, nil)
			return
		}
		a.pendingTaskAction = next
		a.taskDiscardConfirm = true
		return
	}
	a.clearTaskSelection()
	next()
}

func (a *App) changePage(page string) {
	if page == a.page {
		return
	}
	a.requestTaskTransition(func() {
		a.sidebarOverlay = false
		a.quick.Open = false
		a.quick.Meta = ""
		a.highlightedTaskKey = ""
		a.highlightPending = nil
		a.taskListScroll = ui.ScrollState{}
		a.page = page
		a.query = ""
		a.search = taskSearchState{}
		a.list = ui.ListState{}
		switch page {
		case "calendar":
			a.loadCalendar()
		case "caldav":
			a.loadCaldav()
		case "notify":
			a.loadNotify()
		case "ai":
			a.loadAI()
		}
	})
}
