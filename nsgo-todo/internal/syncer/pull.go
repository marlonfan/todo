package syncer

import (
	"context"
	"errors"
	"slices"
	"time"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
)

// PullTasks never writes to disk. Its caller commits the cursor and data together,
// after checking that no local write superseded the captured snapshot.
func PullTasks(ctx context.Context, client *api.Client, state storage.Cache, wait time.Duration) (storage.Cache, error) {
	result := Clone(state)
	bootstrap := result.SyncCursor == ""
	for round := 0; round < 1000; round++ {
		page, err := client.TaskChanges(ctx, result.SyncCursor, wait)
		if errors.Is(err, api.ErrSyncUnsupported) && round == 0 {
			result.Tasks, err = client.Tasks(ctx)
			if err != nil {
				return state, err
			}
			result.SyncCursor = ""
			return result, nil
		}
		if err != nil {
			return state, err
		}
		if bootstrap {
			result.Tasks = nil
			bootstrap = false
		}
		for _, task := range page.Tasks {
			i := slices.IndexFunc(result.Tasks, func(t api.Task) bool { return t.ID == task.ID })
			if i < 0 {
				result.Tasks = append(result.Tasks, task)
			} else if task.Revision >= result.Tasks[i].Revision {
				result.Tasks[i] = task
			}
		}
		for _, deleted := range page.Deleted {
			result.Tasks = slices.DeleteFunc(result.Tasks, func(t api.Task) bool { return t.ID == deleted.TaskID })
		}
		result.SyncCursor = page.NextCursor
		if !page.HasMore {
			return result, nil
		}
		wait = 0 // Only the first page may long-poll.
	}
	return state, errors.New("任务变更分页过多，请稍后重试；本机数据已保留")
}

// Category metadata changes do not necessarily create task change records.
func UpdateCategories(state *storage.Cache, categories []api.Category) {
	state.Categories = categories
	byID := make(map[int64]api.Category, len(categories))
	for _, category := range categories {
		byID[category.ID] = category
	}
	for i := range state.Tasks {
		var attached []api.Category
		for _, category := range state.Tasks[i].Categories {
			if updated, ok := byID[category.ID]; ok {
				attached = append(attached, updated)
			}
		}
		state.Tasks[i].Categories = attached
	}
}
