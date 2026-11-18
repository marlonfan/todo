package app

import (
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

// All interaction state is owned by the UI thread. Persistence must finish before
// recording feedback; background sync reports rejected intents through
// taskIntentFailed after adopting its cache. Offline pending is not a rejection.
type taskInteractionState struct {
	generation         uint64
	statuses           map[string]taskStatusInteraction
	statusOps          map[string]taskStatusInteraction
	undo               *taskCategoryUndo
	categoryOps        map[string]taskCategoryUndo
	categoryGeneration map[int64]uint64
	categoryFailures   map[int64]categoryDelta
	reduceMotion       bool
	failedOps          map[string]bool
}

type taskStatusInteraction struct {
	before     api.Task
	status     string
	generation uint64
	operation  string
	previous   string
	until      time.Time
	failed     bool
}

type taskCategoryDrag struct {
	TaskID         int64
	SourceCategory int64
	InstanceID     string
}

type categoryDelta struct{ Removed, Added []int64 }
type taskCategoryUndo struct {
	TaskID     int64
	Series     bool
	Delta      categoryDelta
	Operation  string
	Generation uint64
}

func (s *taskInteractionState) recordStatus(before api.Task, status, operation string, now time.Time) taskStatusInteraction {
	if s.statuses == nil {
		s.statuses = make(map[string]taskStatusInteraction)
	}
	s.generation++
	delay := 180 * time.Millisecond
	if s.reduceMotion || status == "pending" {
		delay = 0
	}
	entry := taskStatusInteraction{before: before, status: status, generation: s.generation, operation: operation, until: now.Add(delay)}
	if prior, ok := s.statuses[taskRowKey(before)]; ok {
		entry.previous = prior.operation
	}
	if s.statusOps == nil {
		s.statusOps = make(map[string]taskStatusInteraction)
	}
	s.statusOps[operation] = entry
	s.statuses[taskRowKey(before)] = entry
	return entry
}

// Filter with the previous status during checked feedback, then render the
// actual status. Only the affected row is retained; keys and ListState survive.
func (a *App) interactionTasks(tasks []api.Task, page, query string, now time.Time) []api.Task {
	a.reconcileTaskInteractionFailures()
	filtering := slices.Clone(tasks)
	// A fast receipt/pull may replace the next-occurrence projection before
	// checked feedback ends. Retain that exact row by identity for the rest
	// of its feedback interval even when it is absent from the new pool.
	for key, entry := range a.interaction.statuses {
		present := slices.ContainsFunc(filtering, func(task api.Task) bool { return taskRowKey(task) == key })
		if !entry.failed && now.Before(entry.until) && !present {
			filtering = append(filtering, entry.before)
		} else if !now.Before(entry.until) && !present && !slices.ContainsFunc(a.cache.Outbox, func(op storage.Mutation) bool { return op.ID == entry.operation }) {
			delete(a.interaction.statuses, key)
		}
	}
	display := make(map[string]string)
	for i := range filtering {
		key := taskRowKey(filtering[i])
		if entry, ok := a.interaction.statuses[key]; ok {
			canonicalStatus := filtering[i].Status
			display[key] = entry.status
			if now.Before(entry.until) && !entry.failed {
				filtering[i].Status = entry.before.Status
			} else {
				filtering[i].Status = entry.status
			}
			// Successful acknowledged projections can take over after feedback. Failed
			// projections remain overridden while the conflicting op stays in the outbox.
			pending := slices.ContainsFunc(a.cache.Outbox, func(op storage.Mutation) bool { return op.ID == entry.operation })
			if !pending && !now.Before(entry.until) && canonicalStatus == entry.status {
				delete(a.interaction.statuses, key)
			}
		}
		if delta, ok := a.interaction.categoryFailures[filtering[i].ID]; ok {
			filtering[i].Categories = a.categoriesForIDs(applyCategoryDelta(a.taskCategoryIDs(filtering[i]), delta))
		}
	}
	result := filteredTasks(filtering, page, query, now)
	for i := range result {
		if status, ok := display[taskRowKey(result[i])]; ok {
			result[i].Status = status
		}
	}
	return result
}

func (a *App) interactionFrame(c *ui.Context) {
	a.interaction.reduceMotion = c.Preferences().ReduceMotion
	now := time.Now()
	for _, entry := range a.interaction.statuses {
		if now.Before(entry.until) && !entry.failed {
			if a.interaction.reduceMotion {
				entry.until = now
				a.interaction.statuses[taskRowKey(entry.before)] = entry
			} else {
				c.After(entry.until.Sub(now))
			}
		}
	}
}

// Called for terminal server/validation/conflict failures, never for a retained
// offline pending intent. Operation identity prevents a late failure from
// reverting a newer click on this instance, or another instance in the series.
func (a *App) taskInteractionReceipt(op storage.Mutation, requestErr error) {
	// Called on the UI thread after the parent's atomic receipt save and adopt.
	if requestErr == nil {
		delete(a.interaction.categoryOps, op.ID)
		return
	}
	var apiErr *api.Error
	terminal := op.State == "rejected" || op.State == "conflict"
	if errors.As(requestErr, &apiErr) && apiErr.Status >= 400 && apiErr.Status < 500 && apiErr.Status != 408 && apiErr.Status != 429 {
		terminal = true
	}
	if terminal {
		a.taskIntentFailed(op, requestErr)
		return
	}
	// Transport failures retain durable intent. This is deliberately not a
	// success receipt, and must not roll back the user's locally saved state.
	a.message = "任务已存本机，等待重试同步"
}

func (a *App) reconcileTaskInteractionFailures() {
	for _, op := range a.cache.Outbox {
		if op.State == "rejected" || op.State == "conflict" {
			a.taskIntentFailed(op, errors.New(op.Failure))
		}
	}
}

func (a *App) taskIntentFailed(op storage.Mutation, err error) {
	if err == nil || a.interaction.failedOps[op.ID] {
		return
	}
	_, tracked := a.interaction.statusOps[op.ID]
	if _, ok := a.interaction.categoryOps[op.ID]; ok {
		tracked = true
	}
	if !tracked {
		return
	}
	if a.interaction.failedOps == nil {
		a.interaction.failedOps = make(map[string]bool)
	}
	a.interaction.failedOps[op.ID] = true
	for key, entry := range a.interaction.statuses {
		if entry.operation != op.ID && !entry.failed {
			continue
		}
		fallback := entry.before.Status
		previous := entry.previous
		for previous != "" && a.interaction.failedOps[previous] {
			prior, ok := a.interaction.statusOps[previous]
			if !ok {
				break
			}
			fallback, previous = prior.before.Status, prior.previous
		}
		entry.status, entry.until, entry.failed = fallback, time.Time{}, true
		a.interaction.statuses[key] = entry
		a.updateSelectedStatus(entry.before, entry.status)
	}
	if undo, ok := a.interaction.categoryOps[op.ID]; ok {
		if a.interaction.categoryGeneration[undo.TaskID] == undo.Generation {
			if a.interaction.categoryFailures == nil {
				a.interaction.categoryFailures = make(map[int64]categoryDelta)
			}
			a.interaction.categoryFailures[undo.TaskID] = a.resolvedDelta(inverseCategoryDelta(undo.Delta))
			if task, ok := a.interactionTask(undo.TaskID); ok {
				ids := a.taskCategoryIDs(task)
				if a.editing && a.draft.Task.ID == task.ID {
					a.draft.Task.Categories = task.Categories
					a.updateDraftInteractionCategories(ids)
				}
				if a.selectedOccurrence != nil && a.selectedOccurrence.ID == task.ID {
					a.selectedOccurrence.Categories = task.Categories
				}
			}
		}
		if a.interaction.undo != nil && a.interaction.undo.Operation == op.ID {
			a.interaction.undo = nil
		}
		delete(a.interaction.categoryOps, op.ID)
	}
	a.failure = "任务修改未同步：" + err.Error()
}

func (a *App) updateSelectedStatus(task api.Task, status string) {
	if a.selectedOccurrence != nil && taskRowKey(*a.selectedOccurrence) == taskRowKey(task) {
		a.selectedOccurrence.Status = status
	}
	if task.InstanceID == "" && a.editing && a.draft.Task.ID == task.ID {
		a.draft.Task.Status = status
		a.draft.Status = draftFrom(api.Task{Status: status}, time.Now()).Status
		if a.taskDraftBase != nil {
			a.taskDraftBase.Task.Status = status
			a.taskDraftBase.Status = a.draft.Status
		}
	}
}

func resolveInteractionCategory(id int64, aliases map[int64]int64) int64 {
	seen := make(map[int64]bool)
	for !seen[id] {
		seen[id] = true
		next, ok := aliases[id]
		if !ok || next == id {
			break
		}
		id = next
	}
	return id
}

func (a *App) taskCategoryIDs(task api.Task) []int64 {
	ids := make([]int64, 0, len(task.Categories))
	for _, cat := range task.Categories {
		id := resolveInteractionCategory(cat.ID, a.cache.CategoryAliases)
		if !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return ids
}

func categoryDropDelta(ids []int64, source, target int64) categoryDelta {
	delta := categoryDelta{}
	if target == 0 || source == target {
		return delta
	}
	if source != 0 && slices.Contains(ids, source) {
		delta.Removed = []int64{source}
	}
	if !slices.Contains(ids, target) {
		delta.Added = []int64{target}
	}
	return delta
}

func inverseCategoryDelta(delta categoryDelta) categoryDelta {
	return categoryDelta{Removed: delta.Added, Added: delta.Removed}
}
func applyCategoryDelta(ids []int64, delta categoryDelta) []int64 {
	result := make([]int64, 0, len(ids)+len(delta.Added))
	for _, id := range ids {
		if !slices.Contains(delta.Removed, id) && !slices.Contains(result, id) {
			result = append(result, id)
		}
	}
	for _, id := range delta.Added {
		if !slices.Contains(result, id) {
			result = append(result, id)
		}
	}
	return result
}
func (a *App) resolvedDelta(delta categoryDelta) categoryDelta {
	result := categoryDelta{}
	for _, id := range delta.Removed {
		result.Removed = append(result.Removed, resolveInteractionCategory(id, a.cache.CategoryAliases))
	}
	for _, id := range delta.Added {
		result.Added = append(result.Added, resolveInteractionCategory(id, a.cache.CategoryAliases))
	}
	return result
}
func (a *App) categoriesForIDs(ids []int64) []api.Category {
	result := make([]api.Category, 0, len(ids))
	for _, cat := range a.categories {
		if slices.Contains(ids, cat.ID) {
			result = append(result, cat)
		}
	}
	return result
}
func (a *App) interactionTask(id int64) (api.Task, bool) {
	for _, task := range a.tasks {
		if task.ID == id {
			if delta, ok := a.interaction.categoryFailures[id]; ok {
				task.Categories = a.categoriesForIDs(applyCategoryDelta(a.taskCategoryIDs(task), delta))
			}
			return task, true
		}
	}
	return api.Task{}, false
}

func (a *App) applyTaskCategoryDrop(drag taskCategoryDrag, target int64) {
	target = resolveInteractionCategory(target, a.cache.CategoryAliases)
	if !slices.ContainsFunc(a.categories, func(cat api.Category) bool { return cat.ID == target }) {
		return
	}
	source := resolveInteractionCategory(drag.SourceCategory, a.cache.CategoryAliases)
	task, ok := a.interactionTask(drag.TaskID)
	if !ok || task.ReadOnly {
		return
	}
	initial := categoryDropDelta(a.taskCategoryIDs(task), source, target)
	if len(initial.Removed)+len(initial.Added) == 0 {
		return
	}
	if !a.flushDetailAutosave() {
		return
	}
	task, ok = a.interactionTask(drag.TaskID)
	if !ok || task.ReadOnly {
		return
	}
	delta := categoryDropDelta(a.taskCategoryIDs(task), source, target)
	if len(delta.Removed)+len(delta.Added) == 0 {
		return
	}
	op, err := a.persistCategoryDelta(task, delta)
	if err != nil {
		a.failure = "无法保存分类：" + err.Error()
		return
	}
	undo := taskCategoryUndo{TaskID: task.ID, Series: task.Recurring(), Delta: delta, Operation: op.ID, Generation: a.interaction.generation}
	a.interaction.undo = &undo
	a.message = "分类已存本机，等待同步"
	if task.Recurring() {
		a.message = "系列分类已存本机，等待同步（作用于整个系列）"
	}
	a.scheduleTaskSync()
}

func (a *App) persistCategoryDelta(task api.Task, delta categoryDelta) (storage.Mutation, error) {
	before := a.taskCategoryIDs(task)
	ids := applyCategoryDelta(before, a.resolvedDelta(delta))
	// The API applies only supplied fields. Never send a task snapshot: doing so
	// would overwrite title, schedule, recurrence or later remote edits on undo.
	op, err := a.persistTaskIntent("PUT", fmt.Sprintf("/tasks/%d", task.ID), map[string]any{"category_ids": ids}, task.Revision)
	if err != nil {
		return storage.Mutation{}, err
	}
	// Adjacent unsent PUTs can share an operation ID. A rejection must undo
	// that operation's net category delta, while the UI undo keeps only the
	// latest gesture's delta.
	base := a.taskCategoryIDs(op.Base)
	delta = categoryDelta{}
	for _, id := range base {
		if !slices.Contains(ids, id) {
			delta.Removed = append(delta.Removed, id)
		}
	}
	for _, id := range ids {
		if !slices.Contains(base, id) {
			delta.Added = append(delta.Added, id)
		}
	}
	a.interaction.generation++
	if a.interaction.categoryOps == nil {
		a.interaction.categoryOps = make(map[string]taskCategoryUndo)
	}
	if a.interaction.categoryGeneration == nil {
		a.interaction.categoryGeneration = make(map[int64]uint64)
	}
	a.interaction.categoryGeneration[task.ID] = a.interaction.generation
	a.interaction.categoryOps[op.ID] = taskCategoryUndo{TaskID: task.ID, Delta: delta, Operation: op.ID, Generation: a.interaction.generation}
	delete(a.interaction.categoryFailures, task.ID)
	categories := a.categoriesForIDs(ids)
	if a.editing && a.draft.Task.ID == task.ID {
		a.draft.Task.Categories = categories
		a.updateDraftInteractionCategories(ids)
	}
	if a.selectedOccurrence != nil && a.selectedOccurrence.ID == task.ID {
		a.selectedOccurrence.Categories = categories
	}
	return op, nil
}

func (a *App) undoTaskCategoryDrop() {
	if a.interaction.undo == nil || !a.flushDetailAutosave() {
		return
	}
	undo := *a.interaction.undo
	task, ok := a.interactionTask(undo.TaskID)
	if !ok || task.ReadOnly {
		a.failure = "任务已移除或只读，无法撤销分类"
		return
	}
	inverse := a.resolvedDelta(inverseCategoryDelta(undo.Delta))
	before := a.taskCategoryIDs(task)
	after := applyCategoryDelta(before, inverse)
	if sameCategorySet(before, after) {
		a.interaction.undo = nil
		return
	}
	if _, err := a.persistCategoryDelta(task, inverse); err != nil {
		a.failure = "无法撤销分类：" + err.Error()
		return
	}
	a.interaction.undo = nil
	a.message = "分类撤销已存本机，等待同步"
	a.scheduleTaskSync()
}

func (a *App) updateDraftInteractionCategories(ids []int64) {
	a.draft.Categories = make(map[int64]bool)
	for _, id := range ids {
		a.draft.Categories[id] = true
	}
	if a.taskDraftBase != nil {
		a.taskDraftBase.Task.Categories = slices.Clone(a.draft.Task.Categories)
		a.taskDraftBase.Categories = make(map[int64]bool)
		for _, id := range ids {
			a.taskDraftBase.Categories[id] = true
		}
	}
}

func sameCategorySet(a, b []int64) bool {
	if len(a) != len(b) {
		return false
	}
	for _, id := range a {
		if !slices.Contains(b, id) {
			return false
		}
	}
	return true
}

func (a *App) taskCategoryHandle(c *ui.Context, task api.Task, visible bool, open ...func()) {
	if task.ReadOnly {
		return
	}
	// The trailing hover control sits in the title's reserved end margin,
	// separated from the 32-DIP more-menu target by 6 DIPs.
	handle := ui.Box(c.Key("task-category-drag")).Absolute().Right(46).Top(6).Size(32, 32).Center().Label("拖动归类 " + task.Title).Tooltip("拖到分类：" + task.Title).Cursor(ui.CursorGrab)
	if len(open) > 0 && open[0] != nil {
		handle.OnClick(open[0])
	}
	source := int64(0)
	if strings.HasPrefix(a.page, "category:") {
		source, _ = strconv.ParseInt(strings.TrimPrefix(a.page, "category:"), 10, 64)
	}
	handle.Drag(taskCategoryDrag{TaskID: task.ID, SourceCategory: source, InstanceID: task.InstanceID})
	if task.Recurring() {
		handle.Tooltip("拖动修改整个系列的分类：" + task.Title)
	}
	handle.Children(func() {
		if visible && !handle.Dragging() {
			ui.Icon(c, lucide.GripVertical()).Size(14, 14).TextColor(tokensOf(c).TextSecondary)
		}
	})
	if handle.Dragging() {
		// MyGo paintDrag copies the source at 0.75 opacity. Keep that source
		// empty while dragging and paint an opaque, unclipped overlay instead.
		x, y, _ := handle.PointerPosition()
		bounds := handle.Bounds()
		width, height := c.Size()
		previewWidth := min(float32(248), max(0, width-16))
		left := min(max(float32(8), bounds.X+x+12), max(float32(8), width-previewWidth-8))
		top := min(max(float32(8), bounds.Y+y+12), max(float32(8), height-48))
		ui.Overlay(c, func() {
			t := tokensOf(c)
			ui.Row(c.Key("task-category-preview")).Label("拖动预览 "+task.Title).
				Absolute().Left(left).Top(top).
				Width(previewWidth).Height(40).Padding(0, 10).Gap(8).AlignItems(ui.Center).
				Background(t.BgList).Border(1, t.TextSecondary).Radius(6).PassThrough().
				Children(func() {
					ui.Icon(c, lucide.GripVertical()).Size(16, 16).TextColor(t.TextSecondary)
					ui.Text(c, task.Title).FontSize(fontTask).TextColor(t.TextReadable).SingleLine().Grow(1).MinWidth(0)
				})
		})
	}
}

func (a *App) taskCategoryTarget(c *ui.Context, item ui.Element, category api.Category) {
	if _, over := ui.DragOver[taskCategoryDrag](item); over {
		item.Background(tokensOf(c).BgSelected)
	}
	if drag, dropped := ui.Drop[taskCategoryDrag](item); dropped {
		a.applyTaskCategoryDrop(drag, category.ID)
	}
}

func (a *App) taskCategoryUndoView(c *ui.Context) {
	if a.interaction.undo == nil {
		return
	}
	ui.Row(c.Key("task-category-undo")).Padding(4, 12).Gap(8).AlignItems(ui.Center).Children(func() {
		label := "分类已存本机"
		if a.interaction.undo.Series {
			label = "整个系列分类已存本机"
		}
		ui.Text(c, label).FontSize(11).Grow(1).MinWidth(0)
		ui.ButtonBase(c.Key("undo-task-category")).Label("撤销任务归类").MinHeight(32).Padding(0, 8).OnClick(a.undoTaskCategoryDrop).Children(func() { ui.Text(c, "撤销").FontSize(12) })
	})
}
