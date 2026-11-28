package app

import (
	"slices"

	"todo-native/internal/api"
)

func applyManualTaskOrder(tasks []api.Task, order []string, keyFn func(api.Task) string) []api.Task {
	if len(order) == 0 || len(tasks) <= 1 {
		return tasks
	}
	rank := make(map[string]int, len(order))
	for i, k := range order {
		if _, exists := rank[k]; !exists {
			rank[k] = i
		}
	}
	// Newly created / unordered tasks appear above manually ordered tasks in their default order.
	var unranked []api.Task
	var ranked []api.Task
	for _, t := range tasks {
		if _, ok := rank[keyFn(t)]; ok {
			ranked = append(ranked, t)
		} else {
			unranked = append(unranked, t)
		}
	}
	if len(ranked) <= 1 {
		return tasks
	}
	slices.SortStableFunc(ranked, func(a, b api.Task) int {
		return rank[keyFn(a)] - rank[keyFn(b)]
	})
	return append(unranked, ranked...)
}

func (a *App) hasManualOrder(page string) bool {
	return len(a.preferences.ManualTaskOrder[page]) > 0
}

func (a *App) resetManualOrder(page string) {
	if !a.hasManualOrder(page) {
		return
	}
	prefs := a.preferences
	nextMap := make(map[string][]string, len(prefs.ManualTaskOrder))
	for k, v := range prefs.ManualTaskOrder {
		if k != page {
			nextMap[k] = v
		}
	}
	if len(nextMap) == 0 {
		nextMap = nil
	}
	prefs.ManualTaskOrder = nextMap
	if a.preferencesError == "" {
		if err := a.store.SavePreferences(prefs); err != nil {
			a.pushErrorToast(err, nil)
			return
		}
	}
	a.preferences = prefs
	a.manualOrderRev++
	a.pushInfoToast("已恢复默认排序")
}

func (a *App) saveManualOrder(page string, keys []string) {
	prefs := a.preferences
	nextMap := make(map[string][]string, len(prefs.ManualTaskOrder)+1)
	for k, v := range prefs.ManualTaskOrder {
		nextMap[k] = v
	}
	nextMap[page] = keys
	prefs.ManualTaskOrder = nextMap
	if a.preferencesError == "" {
		if err := a.store.SavePreferences(prefs); err != nil {
			a.pushErrorToast(err, nil)
			return
		}
	}
	a.preferences = prefs
	a.manualOrderRev++
}

func (a *App) reorderTaskInPage(page string, currentTasks []api.Task, dragKey, targetKey string, after bool) {
	if isHistoryPage(page) || dragKey == "" || targetKey == "" || dragKey == targetKey {
		return
	}
	keys := make([]string, 0, len(currentTasks))
	fromIdx, targetIdx := -1, -1
	for _, t := range currentTasks {
		k := a.stableTaskKey(t)
		if k == dragKey {
			fromIdx = len(keys)
		}
		if k == targetKey {
			targetIdx = len(keys)
		}
		keys = append(keys, k)
	}
	if fromIdx < 0 || targetIdx < 0 {
		return
	}
	moved := keys[fromIdx]
	keys = slices.Delete(keys, fromIdx, fromIdx+1)
	if fromIdx < targetIdx {
		targetIdx--
	}
	insertIdx := targetIdx
	if after {
		insertIdx++
	}
	insertIdx = max(0, min(insertIdx, len(keys)))
	keys = slices.Insert(keys, insertIdx, moved)
	a.saveManualOrder(page, keys)
}

func (a *App) reorderTaskByDelta(page string, currentTasks []api.Task, taskKey string, delta int) {
	if isHistoryPage(page) || len(currentTasks) < 2 || taskKey == "" {
		return
	}
	keys := make([]string, 0, len(currentTasks))
	idx := -1
	for _, t := range currentTasks {
		k := a.stableTaskKey(t)
		if k == taskKey || taskRowKey(t) == taskKey {
			idx = len(keys)
		}
		keys = append(keys, k)
	}
	if idx < 0 {
		return
	}
	nextIdx := max(0, min(len(keys)-1, idx+delta))
	if nextIdx == idx {
		return
	}
	keys[idx], keys[nextIdx] = keys[nextIdx], keys[idx]
	a.saveManualOrder(page, keys)
}
