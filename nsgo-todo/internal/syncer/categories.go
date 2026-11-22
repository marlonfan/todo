package syncer

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
)

func categoryValues(category api.Category) error {
	if strings.TrimSpace(category.Name) == "" || utf8.RuneCountInString(category.Name) > 50 || utf8.RuneCountInString(category.Emoji) > 16 {
		return errors.New("分类名称或表情无效，请重新编辑")
	}
	if len(category.Color) != 7 || category.Color[0] != '#' {
		return errors.New("分类颜色应为 #RRGGBB")
	}
	if _, err := hex.DecodeString(category.Color[1:]); err != nil {
		return errors.New("分类颜色应为 #RRGGBB")
	}
	return nil
}

func IsCategoryMutation(method, path string) bool {
	if method == "POST" && path == "/categories" {
		return true
	}
	if method != "PUT" && method != "DELETE" {
		return false
	}
	var id int64
	_, err := fmt.Sscanf(path, "/categories/%d", &id)
	return err == nil && id != 0 && path == fmt.Sprintf("/categories/%d", id)
}

func QueueCategory(state storage.Cache, method string, category api.Category) (storage.Cache, error) {
	if state.UserID <= 0 {
		return state, errors.New("请先登录账户")
	}
	if method != "POST" && method != "PUT" && method != "DELETE" {
		return state, errors.New("不支持的分类操作")
	}
	if method != "DELETE" {
		if err := categoryValues(category); err != nil {
			return state, err
		}
	}
	effective := View(state)
	if alias := state.CategoryAliases[category.ID]; alias > 0 {
		category.ID = alias
	}
	var base api.Category
	if method != "POST" {
		index := slices.IndexFunc(effective.Categories, func(c api.Category) bool { return c.ID == category.ID })
		if index < 0 {
			return state, errors.New("分类已移除，请刷新后重新选择")
		}
		base = effective.Categories[index]
	}
	if method != "DELETE" {
		for _, c := range effective.Categories {
			if c.ID != category.ID && c.Name == category.Name {
				return state, errors.New("已有同名分类，请换一个名称")
			}
		}
	}
	state = Clone(state)
	if method == "POST" {
		if state.NextCategoryID >= 0 {
			state.NextCategoryID = -1
		}
		category.ID = state.NextCategoryID
		state.NextCategoryID--
	}
	if method == "DELETE" && category.ID < 0 {
		uncertain := false
		for _, op := range state.CategoryOutbox {
			if op.CategoryID == category.ID && op.Sent && op.State != "rejected" {
				uncertain = true
			}
		}
		if !uncertain {
			return DiscardCategory(state, category.ID), nil
		}
	}
	id, err := api.NewOperationID()
	if err != nil {
		return state, err
	}
	allReplaceable := true
	var first *storage.CategoryMutation
	for i := range state.CategoryOutbox {
		op := &state.CategoryOutbox[i]
		if op.CategoryID != category.ID {
			continue
		}
		if first == nil {
			first = op
		}
		if op.Sent && op.State != "rejected" {
			allReplaceable = false
		}
	}
	if first != nil && allReplaceable {
		base = first.Base
		if method != "DELETE" && first.Method == "POST" {
			method = "POST"
		}
		state.CategoryOutbox = slices.DeleteFunc(state.CategoryOutbox, func(op storage.CategoryMutation) bool { return op.CategoryID == category.ID })
	}
	// Unsent drafts and definitive rejections may be replaced. Uncertain requests
	// retain their exact operation ID and values, followed by a separate edit.
	for i := len(state.CategoryOutbox) - 1; i >= 0; i-- {
		op := &state.CategoryOutbox[i]
		if op.CategoryID != category.ID {
			continue
		}
		if method != "DELETE" && (!op.Sent || op.State == "rejected") && op.Method != "DELETE" {
			op.ID, op.Local, op.State, op.Sent, op.Failure = id, category, "pending", false, ""
			return state, nil
		}
		break
	}
	state.CategoryOutbox = append(state.CategoryOutbox, storage.CategoryMutation{ID: id, Method: method, CategoryID: category.ID, Local: category, Base: base, State: "pending", CreatedAt: time.Now()})
	return state, nil
}

func categoryOverlay(state storage.Cache) []api.Category {
	categories := append([]api.Category(nil), state.Categories...)
	for _, op := range state.CategoryOutbox {
		categories = slices.DeleteFunc(categories, func(c api.Category) bool { return c.ID == op.CategoryID })
		if op.Method != "DELETE" {
			categories = append(categories, op.Local)
		}
	}
	return categories
}

func categoryIDs(body json.RawMessage) []int64 {
	var fields struct {
		IDs []int64 `json:"category_ids"`
	}
	_ = json.Unmarshal(body, &fields)
	return fields.IDs
}

func rewriteCategories(body json.RawMessage, oldID, newID int64) json.RawMessage {
	var fields map[string]json.RawMessage
	if json.Unmarshal(body, &fields) != nil {
		return body
	}
	if _, ok := fields["category_ids"]; !ok {
		return body
	}
	ids := []int64{}
	for _, id := range categoryIDs(body) {
		if id == oldID {
			id = newID
		}
		if id != 0 && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	fields["category_ids"], _ = json.Marshal(ids)
	result, _ := json.Marshal(fields)
	return result
}

func remapCategory(state *storage.Cache, oldID int64, category api.Category) {
	if oldID == category.ID {
		return
	}
	if state.CategoryAliases == nil {
		state.CategoryAliases = map[int64]int64{}
	}
	state.CategoryAliases[oldID] = category.ID
	for i := range state.CategoryOutbox {
		op := &state.CategoryOutbox[i]
		if op.CategoryID == oldID && !op.Sent {
			op.CategoryID, op.Local.ID, op.Base.ID = category.ID, category.ID, category.ID
		}
	}
	for i := range state.Outbox {
		op := &state.Outbox[i]
		if op.Sent {
			continue
		}
		op.Body = rewriteCategories(op.Body, oldID, category.ID)
		for _, task := range []*api.Task{&op.Local, &op.Base} {
			for j := range task.Categories {
				if task.Categories[j].ID == oldID {
					task.Categories[j].ID = category.ID
				}
			}
		}
	}
}

func DiscardCategory(state storage.Cache, categoryID int64) storage.Cache {
	state = Clone(state)
	state.CategoryOutbox = slices.DeleteFunc(state.CategoryOutbox, func(op storage.CategoryMutation) bool { return op.CategoryID == categoryID })
	if categoryID < 0 {
		// A local category with unknown delivery has no confirmed server identity.
		// Keep tasks, but explicitly detach this abandoned temporary association.
		for i := range state.Outbox {
			op := &state.Outbox[i]
			if op.Sent {
				continue
			}
			op.Body = rewriteCategories(op.Body, categoryID, 0)
			op.Local.Categories = slices.DeleteFunc(op.Local.Categories, func(c api.Category) bool { return c.ID == categoryID })
		}
	}
	return state
}

// Upserts are flushed before tasks; deletions wait until all task requests that
// still refer to that category have been acknowledged or explicitly discarded.
func FlushCategories(ctx context.Context, client *api.Client, store storage.Store, state storage.Cache, deletes bool) (storage.Cache, error) {
	state = Clone(state)
	blocked := map[int64]bool{}
	for i := 0; i < len(state.CategoryOutbox); {
		op := state.CategoryOutbox[i]
		if blocked[op.CategoryID] || op.State != "pending" {
			blocked[op.CategoryID] = true
			i++
			continue
		}
		if (op.Method == "DELETE") != deletes {
			i++
			continue
		}
		if op.Method != "POST" && op.CategoryID < 0 {
			i++
			continue
		}
		if deletes {
			waiting := slices.ContainsFunc(state.Outbox, func(task storage.Mutation) bool { return slices.Contains(categoryIDs(task.Body), op.CategoryID) })
			if waiting {
				i++
				continue
			}
		}
		if op.Method != "DELETE" {
			if err := categoryValues(op.Local); err != nil {
				return state, err
			}
		}
		before := Clone(state)
		state.CategoryOutbox[i].Sent = true
		if err := store.SaveCache(state); err != nil {
			return before, err
		}
		payload := map[string]any{"method": op.Method, "category_id": op.CategoryID}
		if op.Method == "POST" {
			payload["category_id"] = int64(0)
		}
		if op.Method != "DELETE" {
			payload["category"] = map[string]string{"name": op.Local.Name, "emoji": op.Local.Emoji, "color": op.Local.Color}
		}
		var response struct {
			Category *api.Category `json:"category"`
		}
		requestCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		err := client.DoOperation(requestCtx, "POST", "/categories/sync", payload, &response, 0, op.ID)
		cancel()
		var apiErr *api.Error
		if err != nil {
			// The pre-send journal is already durable. Even if recording the
			// failure now fails, retain Sent so an uncertain operation can never
			// be replaced with a different payload under a new operation ID.
			before = Clone(state)
			state.CategoryOutbox[i].Failure = err.Error()
			if errors.As(err, &apiErr) && apiErr.Status == 400 && strings.Contains(apiErr.Message, "already exists") {
				state.CategoryOutbox[i].Failure = "服务器已有同名分类，请到分类管理修改名称后重试。"
			}
			if errors.As(err, &apiErr) && apiErr.Status == 409 {
				state.CategoryOutbox[i].Failure = "此分类操作与服务器回执不一致，本机修改已保留；请放弃此修改后重新编辑。"
			}
			if errors.As(err, &apiErr) && apiErr.Status == 404 {
				state.CategoryOutbox[i].Failure = "服务端不支持分类离线同步，或分类已被其他设备移除；请升级服务端后重试或放弃此修改。"
			}
			permanent := errors.As(err, &apiErr) && apiErr.Status >= 400 && apiErr.Status < 500 && apiErr.Status != 401 && apiErr.Status != 408 && apiErr.Status != 429
			if permanent {
				state.CategoryOutbox[i].State = "rejected"
			}
			if saveErr := store.SaveCache(state); saveErr != nil {
				return before, saveErr
			}
			if !permanent {
				return state, err
			}
			blocked[op.CategoryID] = true
			i++
			continue
		}
		if op.Method != "DELETE" && (response.Category == nil || response.Category.ID <= 0 || (op.Method != "POST" && response.Category.ID != op.CategoryID)) {
			return state, errors.New("服务端未返回正确的分类编号，本机修改已保留")
		}
		before = Clone(state)
		state.CategoryOutbox = slices.Delete(state.CategoryOutbox, i, i+1)
		state.Categories = slices.DeleteFunc(state.Categories, func(c api.Category) bool {
			return c.ID == op.CategoryID || (response.Category != nil && c.ID == response.Category.ID)
		})
		if op.Method != "DELETE" {
			state.Categories = append(state.Categories, *response.Category)
			remapCategory(&state, op.CategoryID, *response.Category)
		}
		UpdateCategories(&state, state.Categories)
		if err := store.SaveCache(state); err != nil {
			return before, err
		}
	}
	return state, nil
}
