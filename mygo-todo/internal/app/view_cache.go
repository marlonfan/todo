package app

import (
	"slices"
	"strconv"
	"strings"
	"time"

	"todo-native/internal/api"
)

type listCacheKey struct {
	fp            uint64
	page          string
	query         string
	historyFilter historyFilter
	delayGen      uint64
}

type historyRowsCacheKey struct {
	listFP uint64
	basis  string
	dayKey string
}

// viewCache memoizes expensive per-frame projections (projectTasks, page counts,
// filtered/sorted task slices, outbox lookup maps, and calendar projections).
type viewCache struct {
	fp             uint64
	dayKey         string
	projected      []api.Task
	blockedTaskIDs map[int64]bool
	pageCounts     map[string]int

	listKey    listCacheKey
	delayUntil time.Time
	cachedList []api.Task

	historyKey     historyRowsCacheKey
	historyRows    []historyDisplayItem
	historyToRow   []int
	calFP          uint64
	calendarEvents []api.CalendarEvent
}

func fnvMix64(h, v uint64) uint64 {
	const prime = 1099511628211
	h ^= v
	return h * prime
}

func fnvMixStr64(h uint64, s string) uint64 {
	const prime = 1099511628211
	h = fnvMix64(h, uint64(len(s)))
	for i := 0; i < len(s); i++ {
		h ^= uint64(s[i])
		h *= prime
	}
	return h
}

// dataFingerprint computes a zero-allocation hash of all task/outbox/interaction
// state so even tests that mutate App slices directly invalidate the cache.
func (a *App) dataFingerprint(now time.Time) (uint64, string) {
	h := uint64(14695981039346656037)
	dayKey := now.Format("2006-01-02")
	h = fnvMixStr64(h, dayKey)
	h = fnvMixStr64(h, a.location().String())
	h = fnvMix64(h, a.cacheGeneration)
	h = fnvMix64(h, a.interaction.generation)
	h = fnvMix64(h, uint64(len(a.interaction.pendingDeletes)))
	for id := range a.interaction.pendingDeletes {
		h = fnvMix64(h, uint64(id))
	}
	h = fnvMix64(h, uint64(len(a.interaction.categoryFailures)))
	h = fnvMix64(h, a.manualOrderRev)

	h = fnvMix64(h, uint64(len(a.tasks)))
	for i := range a.tasks {
		t := &a.tasks[i]
		h = fnvMix64(h, uint64(t.ID))
		h = fnvMix64(h, uint64(t.Revision))
		h = fnvMixStr64(h, t.Status)
		h = fnvMix64(h, uint64(int64(t.Priority)+10))
		h = fnvMixStr64(h, t.Title)
		h = fnvMix64(h, uint64(len(t.Description)))
		h = fnvMix64(h, uint64(len(t.Categories)))
		for _, c := range t.Categories {
			h = fnvMix64(h, uint64(c.ID))
		}
		if t.StartTime != nil {
			h = fnvMix64(h, uint64(t.StartTime.Unix()))
		}
		if t.DueDate != nil {
			h = fnvMix64(h, uint64(t.DueDate.Unix()))
		}
	}

	h = fnvMix64(h, uint64(len(a.nextOccurrences)))
	for i := range a.nextOccurrences {
		o := &a.nextOccurrences[i]
		h = fnvMix64(h, uint64(o.TaskID))
		h = fnvMixStr64(h, o.InstanceID)
		h = fnvMixStr64(h, o.Status)
		h = fnvMixStr64(h, o.Title)
		h = fnvMix64(h, uint64(o.StartTime.Unix()))
	}

	h = fnvMix64(h, uint64(len(a.history.Items)))
	for i := range a.history.Items {
		o := &a.history.Items[i]
		h = fnvMix64(h, uint64(o.TaskID))
		h = fnvMixStr64(h, o.InstanceID)
		h = fnvMixStr64(h, o.Status)
	}

	h = fnvMix64(h, uint64(len(a.categories)))
	for i := range a.categories {
		h = fnvMix64(h, uint64(a.categories[i].ID))
		h = fnvMixStr64(h, a.categories[i].Name)
	}

	h = fnvMix64(h, uint64(len(a.cache.Outbox)))
	for i := range a.cache.Outbox {
		op := &a.cache.Outbox[i]
		h = fnvMix64(h, uint64(op.TaskID))
		h = fnvMixStr64(h, op.State)
		h = fnvMixStr64(h, op.ID)
	}
	return h, dayKey
}

func (a *App) ensureViewCache(now time.Time) {
	fp, dayKey := a.dataFingerprint(now)
	if a.viewCache.fp == fp && a.viewCache.dayKey == dayKey && a.viewCache.pageCounts != nil {
		return
	}
	a.viewCache.fp = fp
	a.viewCache.dayKey = dayKey

	projected := projectTasks(a.tasks, a.nextOccurrences, a.history.Items)
	if len(a.interaction.pendingDeletes) > 0 {
		kept := projected[:0]
		for _, task := range projected {
			if _, deleted := a.interaction.pendingDeletes[task.ID]; !deleted {
				kept = append(kept, task)
			}
		}
		projected = kept
	}
	a.viewCache.projected = projected

	blocked := make(map[int64]bool, len(a.cache.Outbox))
	for i := range a.cache.Outbox {
		op := &a.cache.Outbox[i]
		if op.State != "pending" {
			blocked[op.TaskID] = true
		}
	}
	a.viewCache.blockedTaskIDs = blocked

	counts := make(map[string]int, 12+len(a.categories))
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := start.AddDate(0, 0, 1)
	upcomingEnd := start.AddDate(0, 0, 7)

	for i := range projected {
		task := &projected[i]
		switch task.Status {
		case "completed", "cancelled", "skipped":
			counts[task.Status]++
			counts["processed"]++
			continue
		case "pending":
		default:
			continue
		}
		counts["all"]++
		date := task.StartTime
		if date == nil {
			date = task.DueDate
		}
		if date == nil && len(task.Categories) == 0 {
			counts["inbox"]++
		}
		if date != nil {
			if date.Before(todayEnd) {
				counts["today"]++
			}
			if date.Before(upcomingEnd) {
				counts["upcoming"]++
			}
		}
		for _, cat := range task.Categories {
			counts["category:"+strconv.FormatInt(cat.ID, 10)]++
		}
	}
	a.viewCache.pageCounts = counts
}

func (a *App) isTaskSyncBlocked(taskID int64) bool {
	if a.viewCache.blockedTaskIDs == nil {
		for _, op := range a.cache.Outbox {
			if op.TaskID == taskID && op.State != "pending" {
				return true
			}
		}
		return false
	}
	return a.viewCache.blockedTaskIDs[taskID]
}

func (a *App) cachedPageCount(page string, now time.Time) int {
	a.ensureViewCache(now)
	return a.viewCache.pageCounts[page]
}

func (a *App) cachedProjectedTasks(now time.Time) []api.Task {
	a.ensureViewCache(now)
	return a.viewCache.projected
}

func (a *App) statusHoldBucket(now time.Time) (uint64, time.Time) {
	var expiredCount uint64
	var nextExpiry time.Time
	for _, entry := range a.interaction.statuses {
		if entry.failed {
			continue
		}
		if now.Before(entry.until) {
			if nextExpiry.IsZero() || entry.until.Before(nextExpiry) {
				nextExpiry = entry.until
			}
		} else {
			expiredCount++
		}
	}
	return expiredCount, nextExpiry
}

func (a *App) cachedTaskList(page, query string, now time.Time) []api.Task {
	a.ensureViewCache(now)
	expiredBucket, nextExpiry := a.statusHoldBucket(now)
	key := listCacheKey{
		fp:       a.viewCache.fp,
		page:     page,
		query:    query,
		delayGen: expiredBucket,
	}
	if isHistoryPage(page) {
		key.historyFilter = a.historyFilter
	}
	delayValid := a.viewCache.delayUntil.IsZero() || now.Before(a.viewCache.delayUntil)
	if a.viewCache.listKey == key && delayValid && a.viewCache.cachedList != nil {
		return a.viewCache.cachedList
	}

	tasks := a.interactionTasks(a.viewCache.projected, page, query, now)
	if isHistoryPage(page) {
		tasks = filterHistory(tasks, a.historyFilter, now)
	} else if order := a.preferences.ManualTaskOrder[page]; len(order) > 0 && strings.TrimSpace(query) == "" {
		tasks = applyManualTaskOrder(tasks, order, a.stableTaskKey)
	}

	a.viewCache.listKey = key
	a.viewCache.delayUntil = nextExpiry
	a.viewCache.cachedList = tasks
	return tasks
}

func (a *App) cachedGroupedHistoryRows(tasks []api.Task, basis string, now time.Time) ([]historyDisplayItem, []int) {
	if basis == "" {
		basis = "处理时间"
	}
	h := uint64(len(tasks))
	for i := range tasks {
		h = fnvMix64(h, uint64(tasks[i].ID))
		h = fnvMixStr64(h, tasks[i].InstanceID)
		h = fnvMixStr64(h, tasks[i].Status)
	}
	key := historyRowsCacheKey{
		listFP: h,
		basis:  basis,
		dayKey: now.Format("2006-01-02"),
	}
	if a.viewCache.historyKey == key && a.viewCache.historyRows != nil {
		return a.viewCache.historyRows, a.viewCache.historyToRow
	}
	rows, taskToRow := buildGroupedHistoryRows(tasks, basis, now)
	a.viewCache.historyKey = key
	a.viewCache.historyRows = rows
	a.viewCache.historyToRow = taskToRow
	return rows, taskToRow
}

func (a *App) cachedCalendarEvents(now time.Time) []api.CalendarEvent {
	fp, _ := a.dataFingerprint(now)
	if a.cache.Calendar != nil {
		fp = fnvMix64(fp, uint64(a.cache.Calendar.SavedAt.UnixNano()))
		fp = fnvMix64(fp, uint64(len(a.cache.Calendar.Events)))
	}
	fp = fnvMix64(fp, uint64(a.calendarFilter+10))
	if a.viewCache.calFP == fp && a.viewCache.calendarEvents != nil {
		return a.viewCache.calendarEvents
	}
	state := a.cache
	if state.Calendar != nil && state.Calendar.Timezone != a.location().String() {
		state.Calendar = nil
	}
	events := filterCalendarEvents(projectedCalendar(state), a.calendarFilter)
	if len(a.interaction.pendingDeletes) > 0 {
		events = slices.DeleteFunc(slices.Clone(events), func(ev api.CalendarEvent) bool {
			_, deleted := a.interaction.pendingDeletes[ev.ExtendedProps.TaskID]
			return deleted
		})
	}
	a.viewCache.calFP = fp
	a.viewCache.calendarEvents = events
	return events
}
