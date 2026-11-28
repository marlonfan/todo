package syncer

import (
	"encoding/json"
	"errors"
	"reflect"
	"slices"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
)

// EnqueueCoalesced combines only adjacent, unsent edits with the same guard and scope.
func EnqueueCoalesced(state storage.Cache, method, path string, body any, revision int64) (storage.Cache, error) {
	next, err := Enqueue(state, method, path, body, revision)
	if err != nil || len(next.Outbox) < 2 {
		return next, err
	}
	n := len(next.Outbox)
	old, fresh := next.Outbox[n-2], next.Outbox[n-1]
	if old.Method != "PUT" || fresh.Method != "PUT" || old.State != "pending" || fresh.State != "pending" || old.Sent || fresh.Sent || old.TaskID != fresh.TaskID || old.Suffix != fresh.Suffix || old.Revision != fresh.Revision {
		return next, nil
	}
	var a, b map[string]json.RawMessage
	if err := json.Unmarshal(old.Body, &a); err != nil {
		return state, err
	}
	if err := json.Unmarshal(fresh.Body, &b); err != nil {
		return state, err
	}
	for _, key := range []string{"instance_id", "occurrence_date"} {
		if !reflect.DeepEqual(a[key], b[key]) {
			return next, nil
		}
	}
	if a == nil || b == nil {
		return next, nil
	}
	for key, value := range b {
		a[key] = value
	}
	old.Body, err = json.Marshal(a)
	if err != nil {
		return state, err
	}
	old.Local = fresh.Local
	next.Outbox[n-2] = old
	next.Outbox = next.Outbox[:n-1]
	return next, nil
}

// ApplyTaskReceipt applies one sent operation to the latest live cache. It does
// no I/O; the caller must atomically persist the returned cache before using it.
// Request failures are stored in the outbox and return nil error, including
// transient failures. Errors signal an invalid receipt and leave intent intact.
func ApplyTaskReceipt(state storage.Cache, opID string, task api.Task, requestErr error) (storage.Cache, error) {
	state = Clone(state)
	i := slices.IndexFunc(state.Outbox, func(op storage.Mutation) bool { return op.ID == opID })
	// A duplicate receipt or an operation discarded while in flight is harmless.
	if i < 0 {
		return state, nil
	}
	op := state.Outbox[i]
	if !op.Sent {
		return state, errors.New("待同步修改尚未发送")
	}
	var apiErr *api.Error
	if errors.As(requestErr, &apiErr) && apiErr.Status == 404 && op.Method == "DELETE" {
		requestErr = nil
	}
	if requestErr != nil {
		failed := &state.Outbox[i]
		failed.Failure, failed.State = requestErr.Error(), "pending"
		if errors.As(requestErr, &apiErr) && apiErr.Status >= 400 && apiErr.Status < 500 && apiErr.Status != 408 && apiErr.Status != 429 {
			failed.State, failed.Latest = "rejected", apiErr.Latest
			if apiErr.Status == 409 {
				failed.State = "conflict"
			}
			if op.Suffix == "/occurrences/schedule" && apiErr.Status == 404 {
				failed.Failure = "服务端不支持单次改期或任务已删除；本机修改已保留，请升级服务端后点击重新尝试此修改，或放弃此修改。"
			}
		}
		return state, nil
	}
	if op.Method != "DELETE" && task.ID <= 0 {
		return state, errors.New("服务器未返回任务编号，修改已保留并将在下次重试")
	}
	var fields struct {
		InstanceID string `json:"instance_id"`
	}
	_ = json.Unmarshal(op.Body, &fields)
	currentRevision := int64(0)
	for _, current := range state.Tasks {
		if current.ID == op.TaskID || current.ID == task.ID {
			currentRevision = max(currentRevision, current.Revision)
		}
	}
	// Replayed receipts acknowledge intent, but cannot replace a newer pull or
	// overlay an old body onto its occurrence projections.
	if op.Method == "DELETE" || currentRevision <= task.Revision {
		confirmed := View(storage.Cache{Next: state.Next, History: state.History, ReminderEvents: state.ReminderEvents, Calendar: state.Calendar, Outbox: []storage.Mutation{op}})
		state.Next, state.History, state.ReminderEvents, state.Calendar = confirmed.Next, confirmed.History, confirmed.ReminderEvents, confirmed.Calendar
		if state.Calendar != nil && (fields.InstanceID != "" || !TaskScheduleChanged(op)) && state.Calendar.SeriesRevisions[op.TaskID] == op.Revision {
			state.Calendar.SeriesRevisions[op.TaskID] = task.Revision
		}
		if op.Method == "PUT" && fields.InstanceID == "" && (op.Base.Recurring() || op.Local.Recurring()) {
			if TaskScheduleChanged(op) {
				state.Next = slices.DeleteFunc(state.Next, func(o api.Occurrence) bool { return o.TaskID == op.TaskID })
				state.ReminderEvents = slices.DeleteFunc(state.ReminderEvents, func(e api.CalendarEvent) bool { return e.ExtendedProps.TaskID == op.TaskID })
				if state.Calendar != nil {
					state.Calendar.Events = slices.DeleteFunc(state.Calendar.Events, func(e api.CalendarEvent) bool { return e.ExtendedProps.TaskID == op.TaskID })
				}
			} else {
				for idx := range state.Next {
					if state.Next[idx].TaskID == op.TaskID {
						if state.Next[idx].Title == "" || state.Next[idx].Title == op.Base.Title {
							state.Next[idx].Title = task.Title
						}
						state.Next[idx].Priority = task.Priority
					}
				}
				updateEventSeriesMeta := func(events []api.CalendarEvent) {
					for idx := range events {
						if events[idx].ExtendedProps.TaskID == op.TaskID && !events[idx].ExtendedProps.ReadOnly {
							if events[idx].Title == op.Base.Title {
								events[idx].Title = task.Title
							}
							events[idx].ExtendedProps.Priority = task.Priority
						}
					}
				}
				updateEventSeriesMeta(state.ReminderEvents)
				if state.Calendar != nil {
					updateEventSeriesMeta(state.Calendar.Events)
				}
			}
		}
		state.Tasks = slices.DeleteFunc(state.Tasks, func(t api.Task) bool { return t.ID == op.TaskID || t.ID == task.ID })
		if op.Method != "DELETE" {
			state.Tasks = append(state.Tasks, task)
		}
	} else if op.TaskID != task.ID {
		state.Tasks = slices.DeleteFunc(state.Tasks, func(t api.Task) bool { return t.ID == op.TaskID })
	}
	if op.Method != "DELETE" {
		if state.LocalAckRevisions == nil {
			state.LocalAckRevisions = make(map[int64]int64)
		}
		state.LocalAckRevisions[task.ID] = max(state.LocalAckRevisions[task.ID], task.Revision)
		if key := state.ReminderKeys[op.TaskID]; key != "" && op.TaskID != task.ID {
			state.ReminderKeys[task.ID] = key
			delete(state.ReminderKeys, op.TaskID)
		}
	}
	state.Outbox = slices.Delete(state.Outbox, i, i+1)
	for j := i; j < len(state.Outbox); j++ {
		next := &state.Outbox[j]
		if next.TaskID != op.TaskID || next.Sent || op.Method == "DELETE" {
			continue
		}
		next.TaskID, next.Local.ID, next.Base.ID = task.ID, task.ID, task.ID
		// Only a write sharing the acknowledged operation's original guard is
		// dependent on it. A stale editor's guard must still reach the server.
		if next.Revision == op.Revision {
			next.Revision, next.Base.Revision, next.Local.Revision = task.Revision, task.Revision, task.Revision
		}
	}
	return state, nil
}

func TaskScheduleChanged(op storage.Mutation) bool {
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(op.Body, &fields)
	before, _ := json.Marshal(op.Base)
	after, _ := json.Marshal(op.Local)
	var a, b map[string]any
	_ = json.Unmarshal(before, &a)
	_ = json.Unmarshal(after, &b)
	for _, key := range []string{"start_time", "end_time", "due_date", "all_day", "recurrence_rule", "recurrence_end_date"} {
		if _, supplied := fields[key]; supplied && !reflect.DeepEqual(a[key], b[key]) {
			return true
		}
	}
	return false
}

// taskDelta overlays supplied fields on the accumulated canonical task. Category
// IDs are transport fields, so resolve them through the current category view.
func taskDelta(base api.Task, op storage.Mutation, categories []api.Category) api.Task {
	_ = json.Unmarshal(op.Body, &base)
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(op.Body, &fields)
	if raw, ok := fields["category_ids"]; ok {
		var ids []int64
		_ = json.Unmarshal(raw, &ids)
		base.Categories = nil
		for _, cat := range categories {
			if slices.Contains(ids, cat.ID) {
				base.Categories = append(base.Categories, cat)
			}
		}
	}
	base.UpdatedAt = op.CreatedAt
	return base
}
