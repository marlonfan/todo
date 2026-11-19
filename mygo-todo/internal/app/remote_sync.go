package app

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

// A read-only network worker never sets busy and never writes the cache. Both
// foreground mutations and its eventual commit are serialized on the UI thread.
func (a *App) pollRemote(ctx context.Context) {
	if a.win == nil || a.client == nil || a.remotePulling || a.reauthRequired || !a.canApplyRemote() || a.cache.SyncCursor == "" || time.Now().Before(a.remoteRetryAt) {
		return
	}
	state, client, generation, epoch, win := syncer.Clone(a.cache), a.client, a.cacheGeneration, a.epoch, a.win
	wait := 20 * time.Second
	if strings.HasPrefix(a.message, "连接中断") {
		// Probe immediately when recovering from an offline / interrupted state
		// instead of waiting 20s in a server long-poll hold.
		wait = 0
	}
	a.remotePulling = true
	go func() {
		readCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
		defer cancel()
		updated, err := readRemoteChangesWithWait(readCtx, client, state, wait)
		if ctx.Err() != nil || win.IsDestroyed() {
			return
		}
		mygo.RunOnMain(func() {
			if ctx.Err() != nil || epoch != a.epoch || win.IsDestroyed() {
				return
			}
			a.remotePulling = false
			if err != nil {
				a.remoteRetryAt = time.Now().Add(3 * time.Second)
				if generation == a.cacheGeneration && !a.busy {
					prevMsg, prevReauth := a.message, a.reauthRequired
					a.setSyncFailure(err)
					if a.message != prevMsg || a.reauthRequired != prevReauth {
						win.Invalidate()
					}
				}
				return
			}
			if updated.SyncCursor == state.SyncCursor {
				if strings.HasPrefix(a.message, "连接中断") || a.reauthRequired {
					a.reauthRequired = false
					a.failure = ""
					if a.pendingChanges() > 0 {
						a.message = "部分修改需要处理，请查看同步页面"
					} else {
						a.message = "已同步"
					}
					win.Invalidate()
					if !a.syncing {
						a.refresh()
					}
					return
				}
				// No remote changes arrived during long-poll: immediately re-arm
				// without invalidating or rebuilding the UI tree.
				a.pollRemote(ctx)
				return
			}
			committed, commitErr := a.commitRemoteChanges(updated, generation)
			if commitErr != nil {
				a.remoteRetryAt = time.Now().Add(3 * time.Second)
				a.failure = commitErr.Error()
				win.Invalidate()
				return
			}
			if committed {
				win.Invalidate()
			}
			a.pollRemote(ctx)
		})
	}()
}

func (a *App) canApplyRemote() bool {
	if a.localWrites.running || a.localWrites.reply != nil {
		return false
	}
	if a.taskDiscardConfirm || a.busy || a.syncing || a.cacheError != "" || a.calendarDragging || a.taskMenuOpen || a.discardSyncID != nil || a.discardCategoryID != nil || a.discardProfile {
		return false
	}
	if a.page == "sync" {
		if a.reauthPassword != "" {
			return false
		}
		for _, op := range a.cache.Outbox {
			if op.State != "pending" {
				return false
			}
		}
	}
	return true
}

func (a *App) commitRemoteChanges(updated storage.Cache, generation uint64) (bool, error) {
	// A local save, ID remapping, calendar read or foreground refresh supersedes
	// this response. Leave its cursor uncommitted and read the changes again.
	if generation != a.cacheGeneration || !a.canApplyRemote() || updated.Server != a.cache.Server || updated.UserID != a.cache.UserID {
		return false, nil
	}
	if err := a.store.SaveCache(updated); err != nil {
		return false, fmt.Errorf("无法保存增量同步结果，本机修改已保留：%w", err)
	}
	externalDiff := !sameTaskRevisions(a.cache.Tasks, updated.Tasks, a.cache.LocalAckRevisions) ||
		!reflect.DeepEqual(a.cache.Categories, updated.Categories)
	a.adoptCache(updated)
	a.reauthRequired = false
	if strings.HasPrefix(a.message, "连接中断") {
		a.failure = ""
	}
	if a.failure == "" {
		if externalDiff {
			a.message = "已接收其他设备的修改"
		} else {
			a.message = "已同步"
		}
	}
	return true, nil
}

func sameTaskRevisions(prev, next []api.Task, ack map[int64]int64) bool {
	if len(prev) != len(next) {
		return false
	}
	byID := make(map[int64]int64, len(prev))
	for _, t := range prev {
		byID[t.ID] = t.Revision
	}
	for _, t := range next {
		oldRev, ok := byID[t.ID]
		if !ok {
			return false
		}
		if t.Revision != oldRev && t.Revision > ack[t.ID] {
			return false
		}
	}
	return true
}

func readRemoteChanges(ctx context.Context, client *api.Client, state storage.Cache) (storage.Cache, error) {
	return readRemoteChangesWithWait(ctx, client, state, 20*time.Second)
}

func readRemoteChangesWithWait(ctx context.Context, client *api.Client, state storage.Cache, wait time.Duration) (storage.Cache, error) {
	updated, err := syncer.PullTasks(ctx, client, state, wait)
	if err != nil {
		return state, err
	}
	if updated.SyncCursor == state.SyncCursor {
		return state, nil
	}
	// Instance projections have their own endpoints. Keep them and the task
	// cursor in one commit so recurring reminders and history never lag behind.
	updated.Categories, err = client.Categories(ctx)
	if err != nil {
		return state, err
	}
	syncer.UpdateCategories(&updated, updated.Categories)
	updated.Next, err = client.NextOccurrences(ctx)
	if err != nil {
		return state, err
	}
	updated.History, err = client.OccurrenceHistoryThrough(ctx, state.History.NextCursor)
	if err != nil {
		return state, err
	}
	updated.ReminderEvents, err = client.Calendar(ctx, time.Now().Add(-24*time.Hour), time.Now().AddDate(0, 0, 38))
	if err != nil {
		return state, err
	}
	if snapshot := updated.Calendar; snapshot != nil {
		snapshot.Events, err = client.Calendar(ctx, snapshot.Start, snapshot.End)
		if err != nil {
			return state, err
		}
		snapshot.SeriesRevisions = make(map[int64]int64)
		for _, task := range updated.Tasks {
			if task.Recurring() {
				snapshot.SeriesRevisions[task.ID] = task.Revision
			}
		}
		snapshot.SavedAt = time.Now()
	}
	updated.SavedAt = time.Now()
	return updated, nil
}
