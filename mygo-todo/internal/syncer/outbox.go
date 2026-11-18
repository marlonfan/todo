// Package syncer persists task intent before sending it. The cache and outbox
// share one atomic file, including acknowledgements and local-to-server IDs.
package syncer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func Clone(state storage.Cache) storage.Cache {
	// All fields are JSON data. No pointers/slice backing arrays cross the UI
	// and worker boundary, even when a partial acknowledgement is persisted.
	b, _ := json.Marshal(state)
	var copy storage.Cache
	_ = json.Unmarshal(b, &copy)
	return copy
}

func IsTaskMutation(method, path string) bool {
	if method == "POST" && path == "/tasks" {
		return true
	}
	parts := strings.Split(strings.TrimPrefix(path, "/tasks/"), "/")
	if !strings.HasPrefix(path, "/tasks/") || len(parts) > 3 {
		return false
	}
	if len(parts) == 3 {
		return method == "PATCH" && parts[1] == "occurrences" && parts[2] == "schedule"
	}
	if id, err := strconv.ParseInt(parts[0], 10, 64); err != nil || id == 0 {
		return false
	}
	return (len(parts) == 1 && (method == "PUT" || method == "DELETE")) || (len(parts) == 2 && parts[1] == "status" && method == "PATCH")
}

func Enqueue(state storage.Cache, method, path string, body any, revision int64) (storage.Cache, error) {
	if !IsTaskMutation(method, path) {
		return state, errors.New("此操作暂不支持离线保存")
	}
	state = Clone(state)
	id, err := api.NewOperationID()
	if err != nil {
		return state, err
	}
	data, err := json.Marshal(body)
	if err != nil {
		return state, err
	}
	for oldID, newID := range state.CategoryAliases {
		data = rewriteCategories(data, oldID, newID)
	}
	view := View(state)
	for _, selected := range categoryIDs(data) {
		if !slices.ContainsFunc(view.Categories, func(c api.Category) bool { return c.ID == selected }) {
			return state, errors.New("所选分类已移除，请重新选择后保存")
		}
	}
	op := storage.Mutation{ID: id, Method: method, Body: data, Revision: revision, CreatedAt: time.Now(), State: "pending"}
	if method == "POST" {
		if state.NextLocalID >= 0 {
			state.NextLocalID = -1
		}
		op.TaskID = state.NextLocalID
		state.NextLocalID--
		if state.ReminderKeys == nil {
			state.ReminderKeys = make(map[int64]string)
		}
		state.ReminderKeys[op.TaskID] = "local:" + op.ID
		op.Local = api.Task{ID: op.TaskID, Status: "pending"}
	} else {
		parts := strings.Split(strings.TrimPrefix(path, "/tasks/"), "/")
		op.TaskID, _ = strconv.ParseInt(parts[0], 10, 64)
		if len(parts) > 1 {
			op.Suffix = "/" + strings.Join(parts[1:], "/")
		}
		i := slices.IndexFunc(view.Tasks, func(t api.Task) bool { return t.ID == op.TaskID })
		if i < 0 {
			return state, errors.New("本地没有此任务，请先刷新")
		}
		op.Base, op.Local = view.Tasks[i], view.Tasks[i]
		if op.Local.ReadOnly {
			return state, errors.New("外部日历任务为只读")
		}
	}
	if method != "DELETE" {
		// Unmarshal updates only supplied fields, including explicit JSON nulls.
		if err := json.Unmarshal(data, &op.Local); err != nil {
			return state, err
		}
		var fields struct {
			CategoryIDs *[]int64 `json:"category_ids"`
			InstanceID  string   `json:"instance_id"`
		}
		if err := json.Unmarshal(data, &fields); err != nil {
			return state, err
		}
		if fields.InstanceID != "" {
			op.Local = op.Base
		} else {
			if method == "POST" {
				op.Local.CreatedAt = op.CreatedAt
			}
			op.Local.UpdatedAt = op.CreatedAt
			applyStatusTime(op.Base.Status, op.Local.Status, op.CreatedAt, &op.Local.CompletedAt, &op.Local.DeletedAt)
		}
		if fields.CategoryIDs != nil {
			op.Local.Categories = nil
			for _, cat := range view.Categories {
				if slices.Contains(*fields.CategoryIDs, cat.ID) {
					op.Local.Categories = append(op.Local.Categories, cat)
				}
			}
		}
	}
	state.Outbox = append(state.Outbox, op)
	return state, nil
}

// View overlays intent on the last acknowledged server snapshot. Remote reads
// never erase pending local edits. Occurrence fields are overlaid separately.
func View(state storage.Cache) storage.Cache {
	view := Clone(state)
	for _, op := range state.Outbox {
		if op.State == "rejected" || op.State == "conflict" {
			// Keep editable intent and its error, but a rejected status must not
			// keep a task (or one occurrence) optimistically checked.
			var body map[string]json.RawMessage
			if json.Unmarshal(op.Body, &body) == nil && body != nil {
				delete(body, "status")
				op.Body, _ = json.Marshal(body)
			}
		}
		var fields struct {
			Title       *string    `json:"title"`
			InstanceID  string     `json:"instance_id"`
			Status      *string    `json:"status"`
			Description *string    `json:"description"`
			StartTime   *time.Time `json:"start_time"`
			EndTime     *time.Time `json:"end_time"`
			AllDay      bool       `json:"all_day"`
		}
		_ = json.Unmarshal(op.Body, &fields)
		if fields.InstanceID != "" {
			schedule := op.Suffix == "/occurrences/schedule" && fields.StartTime != nil
			for i := range view.ReminderEvents {
				props := &view.ReminderEvents[i].ExtendedProps
				if props.TaskID == op.TaskID && props.InstanceID == fields.InstanceID {
					if schedule {
						applyEventSchedule(&view.ReminderEvents[i], *fields.StartTime, fields.EndTime, fields.AllDay)
					}
					if fields.Status != nil {
						props.Status = *fields.Status
					}
					if fields.Title != nil {
						view.ReminderEvents[i].Title = *fields.Title
					}
					if fields.Description != nil {
						props.Description = *fields.Description
					}
				}
			}
			if view.Calendar != nil {
				for i := range view.Calendar.Events {
					props := &view.Calendar.Events[i].ExtendedProps
					if props.TaskID == op.TaskID && props.InstanceID == fields.InstanceID {
						if schedule {
							applyEventSchedule(&view.Calendar.Events[i], *fields.StartTime, fields.EndTime, fields.AllDay)
						}
						if fields.Status != nil {
							props.Status = *fields.Status
						}
						if fields.Title != nil {
							view.Calendar.Events[i].Title = *fields.Title
						}
						if fields.Description != nil {
							props.Description = *fields.Description
						}
					}
				}
			}
			var occurrence *api.Occurrence
			for _, pool := range [][]api.Occurrence{view.Next, view.History.Items} {
				for _, item := range pool {
					if item.TaskID == op.TaskID && item.InstanceID == fields.InstanceID {
						copy := item
						occurrence = &copy
						break
					}
				}
			}
			view.Next = slices.DeleteFunc(view.Next, func(o api.Occurrence) bool { return o.TaskID == op.TaskID && o.InstanceID == fields.InstanceID })
			view.History.Items = slices.DeleteFunc(view.History.Items, func(o api.Occurrence) bool { return o.TaskID == op.TaskID && o.InstanceID == fields.InstanceID })
			if occurrence != nil {
				if schedule {
					occurrence.StartTime, occurrence.EndTime, occurrence.AllDay = *fields.StartTime, fields.EndTime, fields.AllDay
				}
				if fields.Status != nil {
					applyStatusTime(occurrence.Status, *fields.Status, op.CreatedAt, &occurrence.CompletedAt, &occurrence.DeletedAt)
					occurrence.Status = *fields.Status
				}
				if fields.Title != nil {
					occurrence.Title = *fields.Title
				}
				if fields.Description != nil {
					occurrence.Description = *fields.Description
				}
				if occurrence.Status == "pending" {
					view.Next = append(view.Next, *occurrence)
				} else {
					view.History.Items = append(view.History.Items, *occurrence)
				}
			}
			continue
		}
		local := op.Local
		if op.Method == "PUT" || op.Method == "PATCH" {
			base := op.Base
			if i := slices.IndexFunc(view.Tasks, func(t api.Task) bool { return t.ID == op.TaskID }); i >= 0 {
				base = view.Tasks[i]
			}
			local = taskDelta(base, op, categoryOverlay(state))
			if fields.Status != nil {
				applyStatusTime(base.Status, local.Status, op.CreatedAt, &local.CompletedAt, &local.DeletedAt)
			}
		}
		view.Tasks = slices.DeleteFunc(view.Tasks, func(t api.Task) bool { return t.ID == op.TaskID })
		if op.Method != "DELETE" {
			view.Tasks = append(view.Tasks, local)
		}
	}
	if state.Categories != nil || len(state.CategoryOutbox) > 0 || len(state.CategoryAliases) > 0 {
		UpdateCategories(&view, categoryOverlay(state))
	}
	return view
}

// Flush preserves request IDs and exact payloads after uncertain delivery.
// Independent tasks continue past a conflict; subsequent writes to that same
// task wait for resolution. Each acknowledgement is committed atomically.
func Flush(ctx context.Context, client *api.Client, store storage.Store, state storage.Cache) (storage.Cache, error) {
	state = Clone(state)
	blocked := make(map[int64]bool)
	for i := 0; i < len(state.Outbox); {
		op := state.Outbox[i]
		if blocked[op.TaskID] || op.State != "pending" {
			blocked[op.TaskID] = true
			i++
			continue
		}
		if op.TaskID < 0 && op.Method != "POST" {
			blocked[op.TaskID] = true
			i++
			continue
		}
		if slices.ContainsFunc(categoryIDs(op.Body), func(id int64) bool { return id < 0 }) {
			blocked[op.TaskID] = true
			i++
			continue
		}
		before := Clone(state)
		state.Outbox[i].Sent = true
		if err := store.SaveCache(state); err != nil {
			return before, err
		}
		op = state.Outbox[i]
		path := fmt.Sprintf("/tasks/%d%s", op.TaskID, op.Suffix)
		if op.Method == "POST" {
			path = "/tasks"
		}
		var task api.Task
		requestCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
		err := client.DoOperation(requestCtx, op.Method, path, op.Body, &task, op.Revision, op.ID)
		cancel()
		before = Clone(state)
		applied, applyErr := ApplyTaskReceipt(state, op.ID, task, err)
		if applyErr != nil {
			return before, applyErr
		}
		state = applied
		if saveErr := store.SaveCache(state); saveErr != nil {
			return before, saveErr
		}
		if len(state.Outbox) > i && state.Outbox[i].ID == op.ID {
			if state.Outbox[i].State == "pending" {
				return state, err
			}
			blocked[op.TaskID] = true
			i++
		}
	}
	return state, nil
}

// Discard abandons all pending intent for one task, including dependent writes.
// It cannot undo an operation that the server may already have accepted.
func Discard(state storage.Cache, taskID int64) storage.Cache {
	state = Clone(state)
	state.Outbox = slices.DeleteFunc(state.Outbox, func(op storage.Mutation) bool { return op.TaskID == taskID })
	return state
}

func Resolve(state storage.Cache, opID string) (storage.Cache, error) {
	state = Clone(state)
	for i := range state.Outbox {
		op := &state.Outbox[i]
		if op.ID != opID {
			continue
		}
		if op.State != "conflict" || op.Latest == nil {
			return state, errors.New("请先取得服务器的冲突版本")
		}
		id, err := api.NewOperationID()
		if err != nil {
			return state, err
		}
		op.ID, op.Revision, op.Base, op.State, op.Sent, op.Failure = id, op.Latest.Revision, *op.Latest, "pending", false, ""
		op.Latest = nil
		return state, nil
	}
	return state, errors.New("待同步修改已不存在")
}
