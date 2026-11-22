package api

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrSyncUnsupported = errors.New("服务端暂不支持序号增量同步")

type TaskChanges struct {
	Tasks      []Task         `json:"tasks"`
	Deleted    []TaskDeletion `json:"deleted"`
	NextCursor string         `json:"next_cursor"`
	HasMore    bool           `json:"has_more"`
}
type TaskDeletion struct {
	TaskID int64 `json:"task_id"`
}

func syncSequence(cursor string) (int64, error) {
	if !strings.HasPrefix(cursor, "v1:") {
		return 0, errors.New("无效的任务同步位置")
	}
	n, err := strconv.ParseInt(strings.TrimPrefix(cursor, "v1:"), 10, 64)
	if err != nil || n < 0 {
		return 0, errors.New("无效的任务同步位置")
	}
	return n, nil
}

func (c *Client) TaskChanges(ctx context.Context, cursor string, wait time.Duration) (TaskChanges, error) {
	if cursor == "" {
		cursor = "v1:0"
	}
	before, err := syncSequence(cursor)
	if err != nil {
		return TaskChanges{}, err
	}
	q := url.Values{"cursor": {cursor}, "limit": {"500"}}
	if wait > 0 {
		q.Set("wait", strconv.Itoa(int(min(wait, 25*time.Second)/time.Second)))
	}
	var page TaskChanges
	err = c.Do(ctx, "GET", "/tasks/sync?"+q.Encode(), nil, &page, 0)
	var response *Error
	if errors.As(err, &response) && (response.Status == 404 || response.Status == 405 || response.Status == 501) {
		return TaskChanges{}, ErrSyncUnsupported
	}
	if err != nil {
		return TaskChanges{}, err
	}
	if page.NextCursor == "" {
		return TaskChanges{}, ErrSyncUnsupported
	}
	after, err := syncSequence(page.NextCursor)
	if err != nil || after < before || ((page.HasMore || len(page.Tasks)+len(page.Deleted) > 0) && after == before) {
		return TaskChanges{}, errors.New("服务器未返回有效的任务同步位置，已保留本机数据")
	}
	for _, task := range page.Tasks {
		if task.ID <= 0 {
			return TaskChanges{}, errors.New("服务器返回了无效的任务编号")
		}
	}
	for _, deleted := range page.Deleted {
		if deleted.TaskID <= 0 {
			return TaskChanges{}, errors.New("服务器返回了无效的任务删除编号")
		}
	}
	return page, nil
}
