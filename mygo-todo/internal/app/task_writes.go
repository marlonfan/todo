package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

var errLocalWriteBusy = errors.New("正在提交其他本机修改，输入已保留，请稍候")

type taskWriteReply struct {
	op      storage.Mutation
	task    api.Task
	next    []api.Occurrence
	hasNext bool
	err     error
}
type localWriteState struct {
	running bool
	reply   *taskWriteReply
	retry   map[int64]time.Time
}

// UI-thread owner: both intent and receipts are written against the latest
// cache. Network workers never write a captured cache over newer local edits.
func (a *App) persistTaskIntent(method, path string, body any, revision int64) (storage.Mutation, error) {
	if a.busy {
		return storage.Mutation{}, errLocalWriteBusy
	}
	if a.cacheError != "" {
		return storage.Mutation{}, errors.New(a.cacheError)
	}
	if a.client == nil {
		return storage.Mutation{}, errors.New("请先登录后保存")
	}
	state, err := syncer.EnqueueCoalesced(a.cache, method, path, body, revision)
	if err != nil {
		return storage.Mutation{}, err
	}
	if a.editing && method == "PUT" && path == fmt.Sprintf("/tasks/%d", a.draft.Task.ID) && revision == a.draft.Task.Revision {
		state.Outbox[len(state.Outbox)-1].Base = a.draft.Task
	}
	if err = a.store.SaveCache(state); err != nil {
		return storage.Mutation{}, fmt.Errorf("无法保存本机修改，输入已保留：%w", err)
	}
	op := state.Outbox[len(state.Outbox)-1]
	a.adoptCache(state)
	if method == "POST" {
		a.revealTaskID = op.TaskID
	}
	a.message = "已存本机 · 待同步"
	return op, nil
}

func (a *App) scheduleTaskSync() {
	if a.busy || a.localWrites.running || a.localWrites.reply != nil || a.client == nil || a.win == nil || a.win.IsDestroyed() || a.reauthRequired || a.cacheError != "" {
		return
	}
	blocked := map[int64]bool{}
	index := -1
	now := time.Now()
	for i, op := range a.cache.Outbox {
		if op.State != "pending" {
			blocked[op.TaskID] = true
			continue
		}
		if blocked[op.TaskID] {
			continue
		}
		if now.Before(a.localWrites.retry[op.TaskID]) {
			blocked[op.TaskID] = true
			continue
		}
		if op.TaskID < 0 && op.Method != "POST" {
			blocked[op.TaskID] = true
			continue
		}
		var fields struct {
			CategoryIDs []int64 `json:"category_ids"`
		}
		_ = json.Unmarshal(op.Body, &fields)
		unresolved := false
		for _, id := range fields.CategoryIDs {
			if id < 0 {
				unresolved = true
			}
		}
		if unresolved {
			blocked[op.TaskID] = true
			continue
		}
		index = i
		break
	}
	if index < 0 {
		return
	}
	state := syncer.Clone(a.cache)
	state.Outbox[index].Sent = true
	if err := a.store.SaveCache(state); err != nil {
		a.failure = "无法记录发送状态，本机修改仍保留：" + err.Error()
		return
	}
	op := state.Outbox[index]
	a.adoptCache(state)
	a.localWrites.running = true
	client, epoch, ctx, win := a.client, a.epoch, a.ctx, a.win
	go func() {
		path := fmt.Sprintf("/tasks/%d%s", op.TaskID, op.Suffix)
		if op.Method == "POST" {
			path = "/tasks"
		}
		requestCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		var task api.Task
		err := client.DoOperation(requestCtx, op.Method, path, op.Body, &task, op.Revision, op.ID)
		var next []api.Occurrence
		hasNext := false
		if err == nil && (task.Recurring() || op.Base.Recurring() || op.Local.Recurring()) {
			if fetched, nextErr := client.NextOccurrences(requestCtx); nextErr == nil {
				next, hasNext = fetched, true
			}
		}
		if ctx.Err() != nil || win.IsDestroyed() {
			return
		}
		win.Update(func() {
			if epoch != a.epoch {
				return
			}
			a.localWrites.running = false
			a.localWrites.reply = &taskWriteReply{op: op, task: task, next: next, hasNext: hasNext, err: err}
			a.drainTaskReceipts()
		})
	}()
}

func (a *App) drainTaskReceipts() {
	if a.busy || a.localWrites.reply == nil {
		return
	}
	reply := a.localWrites.reply
	state, err := syncer.ApplyTaskReceipt(a.cache, reply.op.ID, reply.task, reply.err)
	if err != nil {
		a.failure = err.Error()
		a.localWrites.reply = nil
		a.wakeTaskWrites(3 * time.Second)
		return
	}
	if reply.err == nil && reply.hasNext {
		state.Next = reply.next
	}
	if err = a.store.SaveCache(state); err != nil {
		a.failure = "服务端回执尚未存入本机，原操作编号已保留，可安全重试：" + err.Error()
		a.wakeTaskWrites(3 * time.Second)
		return
	}
	a.localWrites.reply = nil
	if reply.err == nil {
		a.authorizeDetailReceipt(reply.op, reply.task)
	}
	a.adoptCache(state)
	a.taskInteractionReceipt(reply.op, reply.err)
	var apiErr *api.Error
	if errors.As(reply.err, &apiErr) && apiErr.Status == 404 && reply.op.Method != "DELETE" && a.editing && a.draft.Task.ID == reply.op.TaskID {
		a.taskDraftOrphaned = true
		a.autosave.failure = "原任务已被删除，本机输入保留；可另存为新任务"
	}
	if reply.err != nil {
		if a.localWrites.retry == nil {
			a.localWrites.retry = map[int64]time.Time{}
		}
		a.localWrites.retry[reply.op.TaskID] = time.Now().Add(3 * time.Second)
		a.setSyncFailure(reply.err)
		a.wakeTaskWrites(3 * time.Second)
	} else {
		delete(a.localWrites.retry, reply.op.TaskID)
		a.failure = ""
		a.message = "已同步"
	}
	a.scheduleTaskSync()
	if !a.localWrites.running {
		if reply.err == nil && len(a.cache.Outbox) == 0 && len(a.cache.CategoryOutbox) > 0 {
			a.refresh() // deferred category deletes can run after task links commit
		} else {
			a.pollRemote(a.ctx)
		}
	}
}

func (a *App) wakeTaskWrites(delay time.Duration) {
	win, epoch, ctx := a.win, a.epoch, a.ctx
	if win == nil {
		return
	}
	time.AfterFunc(delay, func() {
		if ctx.Err() != nil || win.IsDestroyed() {
			return
		}
		win.Update(func() {
			if a.epoch == epoch {
				a.drainTaskReceipts()
				a.scheduleTaskSync()
			}
		})
	})
}
