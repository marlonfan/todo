package app

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"unicode/utf8"

	"github.com/egoist/mygo/ui"
)

type detailAutosaveState struct {
	identity           string
	signature          string
	generation         uint64
	composing, focused bool
	focusInput         uint8
	failure            string
	due                time.Time
}

func (a *App) detailIdentity() string {
	if t := a.selectedOccurrence; t != nil {
		return taskRowKey(*t)
	}
	if a.editing {
		return fmt.Sprintf("%d:", a.draft.Task.ID)
	}
	return ""
}

func stablePayload(p map[string]any) map[string]any {
	if ids, ok := p["category_ids"].([]int64); ok {
		ids = slices.Clone(ids)
		slices.Sort(ids)
		p["category_ids"] = ids
	}
	return p
}
func payloadDelta(base, current map[string]any) map[string]any {
	out := map[string]any{}
	stablePayload(base)
	stablePayload(current)
	for key, value := range current {
		old, _ := json.Marshal(base[key])
		now, _ := json.Marshal(value)
		if string(old) != string(now) {
			out[key] = value
		}
	}
	return out
}

// Runs after this frame's native inputs have been built. Do not retain Element
// values across frames: composition and native focus are observed in place.
func (a *App) observeDetailAutosave(c *ui.Context) {
	a.drainTaskReceipts()
	identity := a.detailIdentity()
	focused, composing := false, false
	focusInput := uint8(0)
	for index, handle := range []ui.Handle{a.taskTitleInput, a.taskDescriptionInput} {
		input := c.Resolve(handle)
		if input.Valid() {
			focused = focused || input.Focused()
			if input.Focused() {
				focusInput = uint8(index + 1)
			}
			composing = composing || input.Composing()
		}
	}
	if a.richComposing {
		desc := c.Resolve(a.taskDescriptionInput)
		if desc.Valid() && desc.Focused() {
			composing = true
		} else {
			a.richComposing = false
		}
	}
	wasFocused := a.autosave.focused
	previousInput := a.autosave.focusInput
	a.autosave.focusInput = focusInput
	a.autosave.focused, a.autosave.composing = focused, composing
	if identity != a.autosave.identity {
		a.autosave.identity = identity
		a.autosave.signature = ""
		a.autosave.failure = ""
		a.autosave.generation++
	}
	if !a.taskDraftDirty() {
		a.autosave.failure = ""
		return
	}
	if identity == "" || a.client == nil || a.occurrenceSchedule != nil {
		return
	}
	if composing {
		a.autosave.generation++
		a.autosave.signature = ""
		return
	}
	if a.editing && a.draft.Task.ID == 0 {
		return
	} // creation remains an explicit valid full draft
	var signature string
	if a.selectedOccurrence != nil {
		b, _ := json.Marshal([]any{a.occurrenceTitle, a.occurrenceDescription, a.occurrenceSchedule})
		signature = string(b)
	} else {
		b, _ := json.Marshal(a.draft)
		signature = string(b)
	}
	if wasFocused && (!focused || previousInput != focusInput) {
		a.flushDetailAutosave()
		return
	}
	if signature == a.autosave.signature {
		return
	}
	a.autosave.signature = signature
	a.autosave.generation++
	if !focused {
		a.flushDetailAutosave()
		return
	}
	a.autosave.due = time.Now().Add(450 * time.Millisecond)
	generation, epoch, win, ctx := a.autosave.generation, a.epoch, a.win, a.ctx
	if win == nil {
		return
	}
	time.AfterFunc(450*time.Millisecond, func() {
		if ctx.Err() != nil || win.IsDestroyed() {
			return
		}
		win.Update(func() {
			if a.epoch == epoch && a.autosave.generation == generation && a.detailIdentity() == identity && !a.autosave.composing {
				a.flushDetailAutosave()
			}
		})
	})
}

// A successful return means input is durably stored locally, not necessarily
// accepted by the server. Validation/composition failures preserve the editor.
func (a *App) flushDetailAutosave() bool {
	if a.autosave.composing || a.richComposing {
		a.autosave.failure = "输入法组合中，完成输入后自动保存"
		return false
	}
	if !a.taskDraftDirty() {
		return true
	}
	if a.busy {
		a.autosave.signature = ""
		a.autosave.failure = errLocalWriteBusy.Error()
		return false
	}
	if a.taskDraftOrphaned {
		a.autosave.failure = "原任务已被删除，草稿保留；可另存为新任务"
		return false
	}
	if a.selectedOccurrence != nil {
		return a.persistOccurrenceDraft()
	}
	if !a.editing || a.draft.Task.ID == 0 || a.draft.Task.ReadOnly || a.taskDraftBase == nil {
		return false
	}
	body, err := a.draft.payload()
	if err != nil {
		a.autosave.failure = err.Error()
		return false
	}
	base, err := a.taskDraftBase.payload()
	if err != nil {
		a.autosave.failure = err.Error()
		return false
	}
	delta := payloadDelta(base, body)
	if len(delta) == 0 {
		a.rememberTaskDraft()
		return true
	}
	if a.pruneMissingDraftCategories(&a.draft) {
		a.autosave.failure = "分类已被移除，输入保留，请重新确认分类"
		return false
	}
	_, err = a.persistTaskIntent("PUT", fmt.Sprintf("/tasks/%d", a.draft.Task.ID), delta, a.draft.Task.Revision)
	if err != nil {
		a.autosave.failure = err.Error()
		return false
	}
	a.rememberTaskDraft()
	a.autosave.failure = ""
	a.autosave.signature = ""
	a.autosave.generation++
	a.scheduleTaskSync()
	return true
}

func (a *App) persistOccurrenceDraft() bool {
	task := *a.selectedOccurrence
	if task.ReadOnly {
		return false
	}
	if a.occurrenceSchedule != nil {
		// The schedule form is a compound edit with explicit validation/commit.
		a.autosave.failure = "调整本次时间后请确认改期；其他输入已保留"
		return false
	}
	if !a.occurrenceEditing {
		return true
	}
	if utf8.RuneCountInString(strings.TrimSpace(a.occurrenceTitle)) > 200 {
		a.autosave.failure = "任务标题应为 1–200 个字符"
		return false
	}
	payload, scopeErr := taskStatusPayload(task, task.Status)
	if scopeErr != nil {
		a.autosave.failure, a.failure = scopeErr.Error(), scopeErr.Error()
		return false
	}
	delete(payload, "status")
	if a.occurrenceTitle != task.Title {
		payload["title"] = a.occurrenceTitle
	}
	if a.occurrenceDescription != task.Description {
		payload["description"] = a.occurrenceDescription
	}
	if len(payload) == 2 {
		return true
	}
	if _, err := a.persistTaskIntent("PUT", fmt.Sprintf("/tasks/%d", task.ID), payload, task.Revision); err != nil {
		a.autosave.failure = err.Error()
		return false
	}
	task.Title, task.Description = a.occurrenceTitle, a.occurrenceDescription
	a.selectedOccurrence = &task
	a.autosave.failure = ""
	a.autosave.generation++
	a.scheduleTaskSync()
	return true
}

func (a *App) detailSaveLabel() string {
	if a.editing && a.draft.Task.ID == 0 {
		return "新任务 · 待创建"
	}
	if a.occurrenceSchedule != nil && a.taskDraftDirty() {
		return "本次时间待确认"
	}
	if a.autosave.failure != "" {
		return a.autosave.failure
	}
	if a.taskDraftDirty() {
		return "待保存…"
	}
	id := a.selectedTaskID
	instance := ""
	if a.selectedOccurrence != nil {
		id = a.selectedOccurrence.ID
		instance = a.selectedOccurrence.InstanceID
	}
	for _, op := range a.cache.Outbox {
		if op.TaskID != id {
			continue
		}
		var fields struct {
			InstanceID string `json:"instance_id"`
		}
		_ = json.Unmarshal(op.Body, &fields)
		if fields.InstanceID != instance {
			continue
		}
		if op.State != "pending" {
			return "同步失败 · 输入已保留"
		}
		if a.localWrites.running && op.Sent {
			return "已存本机 · 正在同步"
		}
		return "已存本机 · 待同步"
	}
	return "已同步"
}

func (a *App) retryDetailAutosave() {
	a.drainTaskReceipts()
	if a.taskDraftDirty() {
		a.flushDetailAutosave()
		return
	}
	for _, op := range a.cache.Outbox {
		if op.TaskID == a.selectedTaskID && op.State != "pending" {
			a.failure = "修改存在冲突或被拒绝，请在同步页面查看差异后处理"
			return
		}
	}
	a.localWrites.retry = nil
	a.scheduleTaskSync()
}

// An acknowledgement can advance only a baseline guarded by that exact
// request revision. Another locally initiated status/category operation may
// have used newer canonical data that this text editor has never displayed.
func (a *App) authorizeDetailReceipt(op storage.Mutation, task api.Task) {
	if task.ID <= 0 || task.Revision <= op.Revision {
		return
	}
	if a.editing && a.draft.Task.ID == op.TaskID && a.draft.Task.Revision == op.Revision {
		a.draft.Task.Revision = task.Revision
		if a.taskDraftBase != nil && a.taskDraftBase.Task.Revision == op.Revision {
			a.taskDraftBase.Task.Revision = task.Revision
		}
	}
	if before := a.selectedOccurrence; before != nil && before.ID == op.TaskID && before.Revision == op.Revision {
		copy := *before
		copy.Revision = task.Revision
		a.selectedOccurrence = &copy
	}
}
