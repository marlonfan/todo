package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func (a *App) adoptCache(state storage.Cache) {
	// Identity follows creation acknowledgements even while the user is typing;
	// editable fields and the original conflict baseline must remain intact.
	selectedID, cleanEditor := a.selectedTaskID, a.editing && !a.taskDraftDirty() && !a.autosave.focused && !a.autosave.composing
	reminderKey := a.cache.ReminderKeys[selectedID]
	a.cacheGeneration++
	a.cache = state
	a.adoptCategoryAliases()
	a.applyProfilePreferences()
	if !a.profileTimezoneDirty {
		a.profileTimezone = a.session.User.Timezone
	}
	if !a.profileReminderDirty {
		a.resetReminderProfile()
	}
	a.selectedDay = a.selectedDay.In(a.location())
	view := syncer.View(state)
	a.tasks, a.categories, a.nextOccurrences, a.history, a.syncedAt = view.Tasks, view.Categories, view.Next, view.History, view.SavedAt
	if a.editing && selectedID != 0 {
		if selectedID < 0 && reminderKey != "" {
			for id, key := range state.ReminderKeys {
				if id > 0 && key == reminderKey {
					selectedID = id
					break
				}
			}
		}
		found := false
		for _, task := range a.tasks {
			if task.ID != selectedID {
				continue
			}
			found = true
			a.taskDraftOrphaned = false
			if cleanEditor {
				a.draft = draftFrom(task, time.Now().In(a.location()).Truncate(time.Minute))
				a.selectedTaskID = selectedID
				a.rememberTaskDraft()
			} else if a.selectedTaskID != selectedID {
				// A pull may already include unseen remote changes after the local
				// receipt. Only acknowledged local writes authorize this revision.
				// Old caches lack receipts; creation starts at 1, which safely
				// conflicts if the server has since advanced.
				revision := state.LocalAckRevisions[selectedID]
				if revision < 1 {
					revision = 1
				}
				a.selectedTaskID = selectedID
				a.draft.Task.ID, a.draft.Task.Revision = selectedID, revision
				if a.taskDraftBase != nil {
					a.taskDraftBase.Task.ID, a.taskDraftBase.Task.Revision = selectedID, revision
				}
			}
			break
		}
		if !found {
			if cleanEditor {
				a.clearTaskSelection()
			} else {
				a.taskDraftOrphaned = true
				a.failure = "原任务已被删除，未保存的修改已保留；请另存为新任务。"
			}
		}
	}
	a.updateReminders()
	a.updateTray()
}

func (a *App) enqueueTaskIntent(method, path string, body any, revision int64) (storage.Cache, error) {
	state, err := syncer.Enqueue(a.cache, method, path, body, revision)
	if err == nil && a.editing && method == "PUT" && path == fmt.Sprintf("/tasks/%d", a.draft.Task.ID) && revision == a.draft.Task.Revision {
		// Remote reads can update the canonical row while this editor stays open.
		// Conflict comparison must still show what the user originally opened.
		state.Outbox[len(state.Outbox)-1].Base = a.draft.Task
	}
	return state, err
}

func (a *App) queueTask(method, path string, body any, revision int64, after func()) {
	if _, err := a.persistTaskIntent(method, path, body, revision); err != nil {
		a.failure = err.Error()
		return
	}
	if after != nil {
		after()
	}
	a.scheduleTaskSync()
}

func (a *App) startAutoSync() {
	if a.win == nil {
		return
	}
	if a.stopAutoSync != nil {
		a.stopAutoSync()
	}
	ctx, cancel := context.WithCancel(context.Background())
	a.stopAutoSync = cancel
	a.remotePulling, a.remoteRetryAt = false, time.Time{}
	win := a.win
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		nextRefresh := time.Now().Add(30 * time.Second)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if win.IsDestroyed() {
					return
				}
				// RunOnMain inspects state on the UI thread without forcing a frame
				// rebuild when idle or while long-polling has no new cursor.
				mygo.RunOnMain(func() {
					if ctx.Err() != nil || win.IsDestroyed() {
						return
					}
					a.pollRemote(ctx)
					offline := strings.HasPrefix(a.message, "连接中断")
					if !offline && time.Now().Before(nextRefresh) {
						return
					}
					nextRefresh = time.Now().Add(30 * time.Second)
					needsFullSync := a.cache.SyncCursor == "" || a.cache.ProfileChanges != nil || len(a.cache.CategoryOutbox) > 0 || offline
					if !needsFullSync {
						return
					}
					comparing := false
					for _, op := range a.cache.Outbox {
						if op.State != "pending" {
							comparing = true
							break
						}
					}
					if ctx.Err() == nil && a.client != nil && !a.busy && !a.syncing && !a.quickDraftDirty() && a.aiPanel == nil && a.aiConfigDraft == nil && a.aiPromptDraft == nil && a.aiDelete == nil && !a.accountEditing && !a.categoryEditing && !a.caldavEditing && !a.notifyEditing && a.deleteNotify == nil && a.deleteCaldav == nil && a.deleteTask == nil && a.deleteCategory == nil && !a.discardProfile && a.discardCategoryID == nil && a.discardSyncID == nil && (a.page != "sync" || (!comparing && a.reauthPassword == "")) {
						a.refresh()
					}
				})
			}
		}
	}()
}

func (a *App) changeOutbox(change func(storage.Cache) (storage.Cache, error)) {
	if a.busy {
		return
	}
	state, err := change(a.cache)
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.runScoped("sync.outbox", func(context.Context) (func(), error) {
		if err := a.store.SaveCache(state); err != nil {
			return nil, err
		}
		return func() {
			a.adoptCache(state)
			a.discardSyncID = nil
			a.discardCategoryID = nil
			a.discardProfile = false
			a.refresh()
		}, nil
	})
}

func (a *App) reauthenticate() {
	if a.busy || a.client == nil {
		return
	}
	if a.reauthPassword == "" {
		a.failure = "请输入当前账户密码"
		return
	}
	session, password, state := a.session, a.reauthPassword, syncer.Clone(a.cache)
	a.runScoped("sync.reauth", func(ctx context.Context) (func(), error) {
		client, err := api.New(session.Server, "")
		if err != nil {
			return nil, err
		}
		updated, err := client.Login(ctx, session.User.Username, password)
		if err != nil {
			return nil, err
		}
		if updated.User.ID != session.User.ID {
			return nil, errors.New("账户不一致，未修改本地待同步内容")
		}
		if err := a.store.SaveSession(updated); err != nil {
			return nil, err
		}
		if state.ProfileChanges != nil {
			state.ProfileChanges.Rejected, state.ProfileChanges.Failure = false, ""
		}
		for i := range state.CategoryOutbox {
			state.CategoryOutbox[i].State, state.CategoryOutbox[i].Failure = "pending", ""
		}
		for i := range state.Outbox {
			if state.Outbox[i].State == "rejected" {
				state.Outbox[i].State, state.Outbox[i].Failure = "pending", ""
			}
		}
		if err := a.store.SaveCache(state); err != nil {
			return nil, err
		}
		return func() {
			a.client, a.session, a.reauthPassword = client, updated, ""
			a.reauthRequired = false
			a.adoptCache(state)
			a.refresh()
		}, nil
	})
}

func mutationName(op storage.Mutation) string {
	if op.Suffix == "/occurrences/schedule" {
		return "调整本次时间"
	}
	var scope struct {
		InstanceID  string  `json:"instance_id"`
		Description *string `json:"description"`
	}
	_ = json.Unmarshal(op.Body, &scope)
	if scope.InstanceID != "" && scope.Description != nil {
		return "编辑本次描述"
	}
	if op.Method == "POST" {
		return "新建任务"
	}
	if op.Method == "DELETE" {
		return "删除任务"
	}
	if op.Suffix == "/status" {
		return "更改任务或本次实例状态"
	}
	return "编辑任务"
}

func (a *App) setSyncFailure(err error) {
	var apiErr *api.Error
	a.reauthRequired = errors.As(err, &apiErr) && apiErr.Status == 401
	if a.reauthRequired {
		a.message = "登录已失效；本地修改已保留，请在同步页面重新验证"
	} else {
		a.message = "连接中断；本地修改已保留，将自动重试"
	}
}
