package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/domain"
	"nsgo-todo/internal/storage"
	"nsgo-todo/internal/syncer"
	"nsgo-todo/internal/voice"
)

// Options lets tests or embedders override initial server URL.
type Options struct {
	DefaultServer string
}

// AppState owns all reactive signals, offline cache, and async sync workers.
type AppState struct {
	cx      *core.Scope
	persist persistence
	toaster *ui.Toaster

	ctx    context.Context
	cancel context.CancelFunc
	epoch  uint64
	client *api.Client

	// Auth & Session
	booting       *core.Signal[bool]
	authenticated *core.Signal[bool]
	session       *core.Signal[api.Session]
	serverInput   *core.Signal[string]
	authBusy      *core.Signal[bool]
	authError     *core.Signal[string]

	// Theme
	themeMode *core.Signal[ThemeMode]

	// Navigation & Task List Filters
	activeTab          *core.Signal[int]
	drawerOpen         *core.Signal[bool]
	hideTabBar         *core.Signal[bool]
	recentTaskID       *core.Signal[int64]
	filter             *core.Signal[domain.Filter]
	selectedCategoryID *core.Signal[int64]
	searchOpen         *core.Signal[bool]
	searchQuery        *core.Signal[string]

	// Data & Derived Projections
	cache          *core.Signal[storage.Cache]
	viewCache      *core.Memo[storage.Cache]
	projectedTasks *core.Memo[[]api.Task]
	filteredTasks  *core.Memo[[]api.Task]
	counts         *core.Memo[domain.FilterCounts]

	// Sync Status
	refreshing  *core.Signal[bool]
	syncing     *core.Signal[bool]
	syncError   *core.Signal[string]
	syncNotice  *core.Signal[string]
	lastSyncAt  *core.Signal[time.Time]
	offline     *core.Signal[bool]
	reauthError *core.Signal[bool]

	// Voice ASR & LLM AI Config
	doubaoConfig      *core.Signal[voice.DoubaoConfig]
	aiConfig          *core.Signal[api.AIConfig]
	aiConfigured      *core.Signal[bool]
	aiConfigBusy      *core.Signal[bool]
	voiceSettingsOpen *core.Signal[bool]
}

func newAppState(cx *core.Scope, opts Options) *AppState {
	ctx, cancel := context.WithCancel(context.Background())
	cx.Cleanup(func() { cancel() })

	persist := newPersistence(cx)
	defaultServer := strings.TrimSpace(opts.DefaultServer)
	if defaultServer == "" {
		defaultServer = strings.TrimSpace(os.Getenv("TODO_API_URL"))
	}
	if defaultServer == "" {
		defaultServer = persist.LoadLastServer()
	}

	prefs := persist.LoadPreferences()
	mode := ThemeSystem
	switch ThemeMode(prefs.Theme) {
	case ThemeLight, ThemeDark, ThemeSystem:
		mode = ThemeMode(prefs.Theme)
	}
	applyThemeMode(cx, mode)

	st := &AppState{
		cx:                 cx,
		persist:            persist,
		toaster:            ui.NewToaster(cx),
		ctx:                ctx,
		cancel:             cancel,
		booting:            core.NewSignal(cx, true),
		authenticated:      core.NewSignal(cx, false),
		session:            core.NewSignalFunc(cx, api.Session{}, nil),
		serverInput:        core.NewSignal(cx, defaultServer),
		authBusy:           core.NewSignal(cx, false),
		authError:          core.NewSignal(cx, ""),
		themeMode:          core.NewSignal(cx, mode),
		activeTab:          core.NewSignal(cx, 0),
		drawerOpen:         core.NewSignal(cx, false),
		hideTabBar:         core.NewSignal(cx, false),
		recentTaskID:       core.NewSignal(cx, int64(0)),
		filter:             core.NewSignal(cx, domain.FilterToday),
		selectedCategoryID: core.NewSignal(cx, int64(0)),
		searchOpen:         core.NewSignal(cx, false),
		searchQuery:        core.NewSignal(cx, ""),
		cache:              core.NewSignalFunc(cx, storage.Cache{}, nil),
		refreshing:         core.NewSignal(cx, false),
		syncing:            core.NewSignal(cx, false),
		syncError:          core.NewSignal(cx, ""),
		syncNotice:         core.NewSignal(cx, ""),
		doubaoConfig:       core.NewSignalFunc(cx, voice.DefaultDoubaoConfig(), nil),
		aiConfig:           core.NewSignalFunc(cx, api.AIConfig{Protocol: api.AIProtocolOpenAI, BaseURL: api.DefaultAIBaseURL(api.AIProtocolOpenAI)}, nil),
		aiConfigured:       core.NewSignal(cx, false),
		aiConfigBusy:       core.NewSignal(cx, false),
		voiceSettingsOpen:  core.NewSignal(cx, false),
		lastSyncAt:         core.NewSignal(cx, time.Time{}),
		offline:            core.NewSignal(cx, false),
		reauthError:        core.NewSignal(cx, false),
	}

	st.viewCache = core.NewMemoFunc(cx, func() storage.Cache {
		return syncer.View(st.cache.Get())
	}, nil)

	st.projectedTasks = core.NewMemoFunc(cx, func() []api.Task {
		vc := st.viewCache.Get()
		return domain.ProjectTasks(vc.Tasks, vc.Next, vc.History.Items)
	}, nil)

	st.counts = core.NewMemoFunc(cx, func() domain.FilterCounts {
		loc := st.location()
		return domain.Counts(st.projectedTasks.Get(), st.now(), loc)
	}, nil)

	st.filteredTasks = core.NewMemoFunc(cx, func() []api.Task {
		loc := st.location()
		return domain.FilterAndSort(
			st.projectedTasks.Get(),
			st.filter.Get(),
			st.selectedCategoryID.Get(),
			st.searchQuery.Get(),
			st.now(),
			loc,
		)
	}, nil)

	st.restoreSessionAsync()
	return st
}

func (s *AppState) now() time.Time {
	return s.cx.WallTime()
}

func (s *AppState) location() *time.Location {
	return domain.Location(s.session.Get().User.Timezone)
}

func (s *AppState) locationUntracked() *time.Location {
	return domain.Location(s.session.GetUntracked().User.Timezone)
}

func (s *AppState) PendingCount() int {
	c := s.cache.Get()
	n := len(c.Outbox) + len(c.CategoryOutbox)
	if c.ProfileChanges != nil {
		n++
	}
	return n
}

func (s *AppState) ConflictCount() int {
	c := s.cache.Get()
	n := 0
	for _, op := range c.Outbox {
		if op.State == "conflict" || op.State == "rejected" {
			n++
		}
	}
	for _, op := range c.CategoryOutbox {
		if op.State == "rejected" {
			n++
		}
	}
	return n
}

func (s *AppState) ToastSuccess(title string) {
	s.toaster.Show(ui.ToastContent{Type: ui.ToastSuccess, Title: title, Duration: 2500 * time.Millisecond})
}

func (s *AppState) ToastError(title string) {
	s.toaster.Show(ui.ToastContent{Type: ui.ToastError, Title: title, Duration: 4 * time.Second})
}

func (s *AppState) ToastInfo(title string) {
	s.toaster.Show(ui.ToastContent{Type: ui.ToastInfo, Title: title, Duration: 2500 * time.Millisecond})
}

func (s *AppState) SetThemeMode(mode ThemeMode) {
	s.themeMode.Set(mode)
	applyThemeMode(s.cx, mode)
	s.cx.PlayHaptic(core.HapticSelection)
	prefs := storage.Preferences{Theme: string(mode)}
	go func() {
		_ = s.persist.SavePreferences(prefs)
	}()
}

// restoreSessionAsync loads saved session (including Keystore token) off the engine goroutine.
func (s *AppState) restoreSessionAsync() {
	epoch := s.epoch
	go func() {
		doubaoCfg := s.persist.LoadDoubaoConfig()
		s.cx.Post(func() {
			s.doubaoConfig.Set(doubaoCfg)
		})
		sess, err := s.persist.LoadSession()
		if err != nil || sess.Token == "" || sess.Server == "" {
			s.cx.Post(func() {
				if s.epoch != epoch {
					return
				}
				s.booting.Set(false)
			})
			return
		}
		client, err := api.New(sess.Server, sess.Token)
		if err != nil {
			s.cx.Post(func() {
				if s.epoch != epoch {
					return
				}
				s.booting.Set(false)
			})
			return
		}
		cache, cacheErr := s.persist.LoadCache(sess.Server, sess.User.ID)
		if cacheErr != nil {
			cache = storage.Cache{Server: sess.Server, UserID: sess.User.ID}
		}
		s.cx.Post(func() {
			if s.epoch != epoch {
				return
			}
			s.client = client
			s.cx.Batch(func() {
				s.session.Set(sess)
				s.serverInput.Set(sess.Server)
				s.cache.Set(cache)
				if !cache.SavedAt.IsZero() {
					s.lastSyncAt.Set(cache.SavedAt)
				}
				s.authenticated.Set(true)
				s.booting.Set(false)
			})
			s.Refresh(false)
			s.RefreshAIConfig(false)
		})
	}()
}

// LoginOrRegister authenticates against the configured Todo server.
func (s *AppState) LoginOrRegister(server, username, email, password string, register bool) {
	if s.authBusy.GetUntracked() {
		return
	}
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(email)
	if username == "" || password == "" {
		s.authError.Set("请输入用户名和密码")
		return
	}
	client, err := api.New(server, "")
	if err != nil {
		s.authError.Set(err.Error())
		return
	}

	s.cx.Batch(func() {
		s.authBusy.Set(true)
		s.authError.Set("")
	})
	epoch := s.epoch
	ctx := s.ctx

	go func() {
		var sess api.Session
		var err error
		if register {
			sess, err = client.Register(ctx, username, email, password)
		} else {
			sess, err = client.Login(ctx, username, password)
		}
		if err != nil {
			s.cx.Post(func() {
				if s.epoch != epoch {
					return
				}
				s.authBusy.Set(false)
				s.authError.Set(err.Error())
			})
			return
		}
		cache, cacheErr := s.persist.LoadCache(sess.Server, sess.User.ID)
		if cacheErr != nil {
			cache = storage.Cache{Server: sess.Server, UserID: sess.User.ID}
		}
		_ = s.persist.SaveSession(sess)

		s.cx.Post(func() {
			if s.epoch != epoch {
				return
			}
			s.client = client
			s.cx.Batch(func() {
				s.authBusy.Set(false)
				s.authError.Set("")
				s.session.Set(sess)
				s.serverInput.Set(sess.Server)
				s.cache.Set(cache)
				s.authenticated.Set(true)
				s.activeTab.Set(0)
				s.filter.Set(domain.FilterToday)
				s.selectedCategoryID.Set(0)
			})
			s.cx.PlayHaptic(core.HapticSuccess)
			s.Refresh(false)
			s.RefreshAIConfig(false)
		})
	}()
}

// Logout signs out after verifying there are no unsynced local mutations.
func (s *AppState) Logout() error {
	if s.PendingCount() > 0 {
		msg := "还有未同步的修改，请先在同步页面提交或处理后再退出登录"
		s.ToastError(msg)
		return errors.New(msg)
	}
	s.cancel()
	s.epoch++
	s.ctx, s.cancel = context.WithCancel(context.Background())
	s.client = nil
	s.cx.Batch(func() {
		s.authenticated.Set(false)
		s.session.Set(api.Session{})
		s.cache.Set(storage.Cache{})
		s.syncError.Set("")
		s.syncNotice.Set("")
		s.offline.Set(false)
		s.reauthError.Set(false)
		s.refreshing.Set(false)
		s.syncing.Set(false)
		s.searchOpen.Set(false)
		s.searchQuery.Set("")
		s.selectedCategoryID.Set(0)
		s.filter.Set(domain.FilterToday)
		s.activeTab.Set(0)
	})
	go func() {
		_ = s.persist.Logout()
	}()
	return nil
}

// Refresh flushes pending offline outboxes, pulls incremental task changes,
// categories, next occurrences, and user profile in a background goroutine.
func (s *AppState) Refresh(pullToRefresh bool) {
	if s.client == nil || s.syncing.GetUntracked() {
		if pullToRefresh {
			s.refreshing.Set(false)
		}
		return
	}
	client := s.client
	sess := s.session.GetUntracked()
	baseCache := syncer.Clone(s.cache.GetUntracked())
	epoch := s.epoch
	ctx := s.ctx
	syncStore := s.persist.SyncStore()

	s.cx.Batch(func() {
		s.syncing.Set(true)
		if pullToRefresh {
			s.refreshing.Set(true)
		}
		s.syncError.Set("")
	})

	go func() {
		reqCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
		defer cancel()

		state := baseCache
		var flushErr error

		// 1. Flush category creates/updates first (tasks may reference new local category IDs).
		if len(state.CategoryOutbox) > 0 {
			var err error
			state, err = syncer.FlushCategories(reqCtx, client, syncStore, state, false)
			if err != nil {
				flushErr = err
			}
		}
		// 2. Flush pending task mutations.
		if len(state.Outbox) > 0 {
			var err error
			state, err = syncer.Flush(reqCtx, client, syncStore, state)
			if err != nil && flushErr == nil {
				flushErr = err
			}
		}
		// 3. Flush category deletes after task updates.
		if len(state.CategoryOutbox) > 0 {
			var err error
			state, err = syncer.FlushCategories(reqCtx, client, syncStore, state, true)
			if err != nil && flushErr == nil {
				flushErr = err
			}
		}

		// 3. Pull user profile, categories, tasks (incremental v1 cursor or fallback), and next occurrences.
		user, userErr := client.Me(reqCtx)
		if userErr != nil {
			s.finishSyncFailure(epoch, state, userErr)
			return
		}
		categories, catErr := client.Categories(reqCtx)
		if catErr != nil {
			s.finishSyncFailure(epoch, state, catErr)
			return
		}
		pulled, pullErr := syncer.PullTasks(reqCtx, client, state, 0)
		if pullErr != nil {
			s.finishSyncFailure(epoch, state, pullErr)
			return
		}
		syncer.UpdateCategories(&pulled, categories)

		next, nextErr := client.NextOccurrences(reqCtx)
		if nextErr != nil {
			s.finishSyncFailure(epoch, state, nextErr)
			return
		}
		if hist, histErr := client.OccurrenceHistory(reqCtx, 0); histErr == nil {
			pulled.History = hist
		}

		now := time.Now()
		pulled.Server = sess.Server
		pulled.UserID = user.ID
		pulled.Next = next
		pulled.SavedAt = now

		updatedSess := sess
		updatedSess.User = user
		if tok := client.Token(); tok != "" {
			updatedSess.Token = tok
		}

		_ = s.persist.SaveCache(pulled)
		_ = s.persist.SaveSession(updatedSess)

		s.cx.Post(func() {
			if s.epoch != epoch {
				return
			}
			s.cx.Batch(func() {
				s.syncing.Set(false)
				s.refreshing.Set(false)
				s.offline.Set(false)
				s.reauthError.Set(false)
				s.session.Set(updatedSess)
				s.cache.Set(pulled)
				s.lastSyncAt.Set(now)
				if flushErr != nil {
					s.syncError.Set(flushErr.Error())
				} else {
					s.syncError.Set("")
				}
				if s.PendingCount() > 0 {
					s.syncNotice.Set("部分本地修改需要处理")
				} else {
					s.syncNotice.Set("已同步")
				}
			})
			if pullToRefresh {
				s.cx.PlayHaptic(core.HapticLight)
			}
		})
	}()
}

func (s *AppState) finishSyncFailure(epoch uint64, partial storage.Cache, err error) {
	_ = s.persist.SaveCache(partial)
	var connErr *api.ConnectionError
	var apiErr *api.Error
	isOffline := errors.As(err, &connErr)
	isReauth := errors.As(err, &apiErr) && apiErr.Status == 401

	s.cx.Post(func() {
		if s.epoch != epoch {
			return
		}
		s.cx.Batch(func() {
			s.syncing.Set(false)
			s.refreshing.Set(false)
			s.cache.Set(partial)
			s.offline.Set(isOffline)
			s.reauthError.Set(isReauth)
			s.syncError.Set(err.Error())
		})
	})
}

// queueTaskMutation atomically persists local intent, updates UI immediately,
// and triggers an asynchronous sync flush.
func (s *AppState) queueTaskMutation(method, path string, body any, revision int64) (int64, error) {
	current := s.cache.GetUntracked()
	next, err := syncer.Enqueue(current, method, path, body, revision)
	if err != nil {
		s.ToastError(err.Error())
		return 0, err
	}
	var taskID int64
	if len(next.Outbox) > 0 {
		taskID = next.Outbox[len(next.Outbox)-1].TaskID
	}
	s.cache.Set(next)
	snapshot := syncer.Clone(next)
	go func() {
		_ = s.persist.SaveCache(snapshot)
	}()
	s.flushOutboxAsync()
	return taskID, nil
}

func (s *AppState) flushOutboxAsync() {
	if s.client == nil || s.syncing.GetUntracked() {
		return
	}
	client := s.client
	epoch := s.epoch
	ctx := s.ctx
	syncStore := s.persist.SyncStore()
	state := syncer.Clone(s.cache.GetUntracked())

	s.syncing.Set(true)
	go func() {
		reqCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()

		hadTaskOps := len(state.Outbox) > 0
		var flushErr error
		if len(state.CategoryOutbox) > 0 {
			var err error
			state, err = syncer.FlushCategories(reqCtx, client, syncStore, state, false)
			if err != nil {
				flushErr = err
			}
		}
		if len(state.Outbox) > 0 {
			var err error
			state, err = syncer.Flush(reqCtx, client, syncStore, state)
			if err != nil && flushErr == nil {
				flushErr = err
			}
		}
		if len(state.CategoryOutbox) > 0 {
			var err error
			state, err = syncer.FlushCategories(reqCtx, client, syncStore, state, true)
			if err != nil && flushErr == nil {
				flushErr = err
			}
		}
		if hadTaskOps && flushErr == nil {
			if next, err := client.NextOccurrences(reqCtx); err == nil {
				state.Next = next
			}
			if hist, err := client.OccurrenceHistory(reqCtx, 0); err == nil {
				state.History = hist
			}
		}
		_ = s.persist.SaveCache(state)

		var connErr *api.ConnectionError
		var apiErr *api.Error
		isOffline := flushErr != nil && errors.As(flushErr, &connErr)
		isReauth := flushErr != nil && errors.As(flushErr, &apiErr) && apiErr.Status == 401

		s.cx.Post(func() {
			if s.epoch != epoch {
				return
			}
			s.cx.Batch(func() {
				s.syncing.Set(false)
				s.cache.Set(state)
				s.offline.Set(isOffline)
				s.reauthError.Set(isReauth)
				if flushErr != nil {
					s.syncError.Set(flushErr.Error())
				} else {
					s.syncError.Set("")
					s.lastSyncAt.Set(time.Now())
					s.syncNotice.Set("已同步")
				}
			})
		})
	}()
}

// CreateTask creates a new task (optimistically persisted offline first).
func (s *AppState) CreateTask(title, description string, priority int, dueDate, startDate *time.Time, allDay bool, categoryIDs []int64) (int64, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		err := errors.New("任务标题不能为空")
		s.ToastError(err.Error())
		return 0, err
	}
	payload := map[string]any{
		"title":        title,
		"description":  description,
		"status":       "pending",
		"priority":     priority,
		"all_day":      allDay,
		"category_ids": nonNilInt64s(categoryIDs),
	}
	if dueDate != nil {
		payload["due_date"] = dueDate.UTC().Format(time.RFC3339)
	}
	if startDate != nil {
		payload["start_time"] = startDate.UTC().Format(time.RFC3339)
	}
	id, err := s.queueTaskMutation("POST", "/tasks", payload, 0)
	if err == nil {
		s.cx.PlayHaptic(core.HapticSuccess)
		s.recentTaskID.Set(id)
		s.cx.AfterFunc(1400*time.Millisecond, func() {
			if s.recentTaskID.GetUntracked() == id {
				s.recentTaskID.Set(0)
			}
		})
		s.ToastSuccess("已添加任务")
	}
	return id, err
}

// CreateTaskFromParsed creates a rich task (including optional end_time and
// recurrence_rule / recurrence_end_date) from an LLM-parsed voice preview.
func (s *AppState) CreateTaskFromParsed(parsed voice.ParsedTask, showToast bool) (int64, error) {
	title := strings.TrimSpace(parsed.Title)
	if title == "" {
		err := errors.New("任务标题不能为空")
		s.ToastError(err.Error())
		return 0, err
	}
	payload := map[string]any{
		"title":        title,
		"description":  strings.TrimSpace(parsed.Description),
		"status":       "pending",
		"priority":     parsed.Priority,
		"all_day":      parsed.AllDay,
		"category_ids": nonNilInt64s(parsed.CategoryIDs),
	}
	if parsed.DueDate != nil {
		payload["due_date"] = parsed.DueDate.UTC().Format(time.RFC3339)
	}
	if parsed.StartTime != nil {
		payload["start_time"] = parsed.StartTime.UTC().Format(time.RFC3339)
	}
	if parsed.EndTime != nil {
		payload["end_time"] = parsed.EndTime.UTC().Format(time.RFC3339)
	}
	if rule := parsed.RecurrenceRule.Normalized(); rule != nil {
		payload["recurrence_rule"] = rule
		if parsed.RecurrenceEndDate != nil {
			payload["recurrence_end_date"] = parsed.RecurrenceEndDate.UTC().Format(time.RFC3339)
		}
	}
	id, err := s.queueTaskMutation("POST", "/tasks", payload, 0)
	if err == nil {
		s.cx.PlayHaptic(core.HapticSuccess)
		s.recentTaskID.Set(id)
		s.cx.AfterFunc(1400*time.Millisecond, func() {
			if s.recentTaskID.GetUntracked() == id {
				s.recentTaskID.Set(0)
			}
		})
		if showToast {
			s.ToastSuccess("已创建语音任务")
		}
	}
	return id, err
}

// SaveDoubaoConfig validates and saves Doubao IME ASR credentials into the platform keystore.
func (s *AppState) SaveDoubaoConfig(cfg voice.DoubaoConfig) error {
	if err := cfg.Validate(); err != nil {
		s.ToastError(err.Error())
		return err
	}
	norm := cfg.Normalized()
	s.doubaoConfig.Set(norm)
	go func() {
		if err := s.persist.SaveDoubaoConfig(norm); err != nil {
			s.cx.Post(func() { s.ToastError("保存豆包语音配置失败: " + err.Error()) })
			return
		}
		s.cx.Post(func() {
			s.cx.PlayHaptic(core.HapticSuccess)
			s.ToastSuccess("豆包语音配置已加密保存")
		})
	}()
	return nil
}

// RefreshAIConfig pulls the user's LLM configuration from /api/ai/config.
func (s *AppState) RefreshAIConfig(showFeedback bool) {
	if s.client == nil || s.aiConfigBusy.GetUntracked() {
		return
	}
	client := s.client
	epoch := s.epoch
	ctx := s.ctx
	s.aiConfigBusy.Set(true)
	go func() {
		reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		cfg, ok, err := client.GetAIConfig(reqCtx)
		s.cx.Post(func() {
			if s.epoch != epoch {
				return
			}
			s.aiConfigBusy.Set(false)
			if err != nil {
				if showFeedback {
					s.ToastError("同步服务器 AI 配置失败: " + err.Error())
				}
				return
			}
			if ok {
				s.aiConfig.Set(cfg)
				s.aiConfigured.Set(true)
				if showFeedback {
					s.ToastSuccess("已同步服务器 AI 配置（" + cfg.ModelID + "）")
				}
			} else {
				s.aiConfigured.Set(false)
				if showFeedback {
					s.ToastInfo("服务器尚未配置大模型，请填写后保存")
				}
			}
		})
	}()
}

// SaveAIConfig saves the user's LLM settings to /api/ai/config on the Todo server.
func (s *AppState) SaveAIConfig(cfg api.AIConfig) {
	norm := cfg.Normalized()
	if !norm.Ready() {
		s.ToastError("请完整填写 API Base URL、API Key 和 Model ID")
		return
	}
	if s.client == nil {
		s.ToastError("请先登录 Todo 服务器")
		return
	}
	client := s.client
	epoch := s.epoch
	ctx := s.ctx
	s.aiConfigBusy.Set(true)
	go func() {
		reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		saved, err := client.SaveAIConfig(reqCtx, norm)
		s.cx.Post(func() {
			if s.epoch != epoch {
				return
			}
			s.aiConfigBusy.Set(false)
			if err != nil {
				s.ToastError("保存 AI 配置失败: " + err.Error())
				return
			}
			s.aiConfig.Set(saved)
			s.aiConfigured.Set(saved.Ready())
			s.cx.PlayHaptic(core.HapticSuccess)
			s.ToastSuccess("大模型配置已同步保存")
		})
	}()
}

// UpdateTask updates an existing task's fields offline-first.
func (s *AppState) UpdateTask(task api.Task, title, description, status string, priority int, dueDate, startDate *time.Time, allDay bool, categoryIDs []int64) error {
	return s.updateTaskInternal(task, title, description, status, priority, dueDate, startDate, allDay, categoryIDs, true)
}

// UpdateTaskQuiet updates an existing task without showing a toast (used for instant auto-save in detail view).
func (s *AppState) UpdateTaskQuiet(task api.Task, title, description, status string, priority int, dueDate, startDate *time.Time, allDay bool, categoryIDs []int64) error {
	return s.updateTaskInternal(task, title, description, status, priority, dueDate, startDate, allDay, categoryIDs, false)
}

func (s *AppState) updateTaskInternal(task api.Task, title, description, status string, priority int, dueDate, startDate *time.Time, allDay bool, categoryIDs []int64, showToast bool) error {
	title = strings.TrimSpace(title)
	if title == "" {
		err := errors.New("任务标题不能为空")
		s.ToastError(err.Error())
		return err
	}
	if status == "" {
		status = "pending"
	}
	payload := map[string]any{
		"title":        title,
		"description":  description,
		"status":       status,
		"priority":     priority,
		"all_day":      allDay,
		"category_ids": nonNilInt64s(categoryIDs),
		"due_date":     nil,
		"start_time":   nil,
	}
	if dueDate != nil {
		payload["due_date"] = dueDate.UTC().Format(time.RFC3339)
	}
	if startDate != nil {
		payload["start_time"] = startDate.UTC().Format(time.RFC3339)
	}
	if len(task.RecurrenceRule) > 0 {
		payload["recurrence_rule"] = task.RecurrenceRule
	}
	if task.RecurrenceEndDate != nil {
		payload["recurrence_end_date"] = task.RecurrenceEndDate.UTC().Format(time.RFC3339)
	}
	if task.ReminderPolicy != "" {
		payload["reminder_policy"] = task.ReminderPolicy
	}
	if task.ReminderMinutesBefore != nil {
		payload["reminder_minutes_before"] = *task.ReminderMinutesBefore
	}
	_, err := s.queueTaskMutation("PUT", fmt.Sprintf("/tasks/%d", task.ID), payload, task.Revision)
	if err == nil && showToast {
		s.cx.PlayHaptic(core.HapticSuccess)
		s.ToastSuccess("已保存任务")
	}
	return err
}

// RescheduleTaskTomorrow moves an active task's due date to tomorrow (preserving time if not all-day).
func (s *AppState) RescheduleTaskTomorrow(task api.Task) {
	if task.ReadOnly {
		s.ToastInfo("外部日历任务为只读")
		return
	}
	loc := s.locationUntracked()
	now := s.now().In(loc)
	y, m, d := now.Date()
	hour, min := 0, 0
	allDay := true
	if ref := domain.EffectiveDate(task); ref != nil && !task.AllDay {
		localRef := ref.In(loc)
		if localRef.Hour() != 0 || localRef.Minute() != 0 {
			hour, min = localRef.Hour(), localRef.Minute()
			allDay = false
		}
	}
	tomorrow := time.Date(y, m, d, hour, min, 0, 0, loc).AddDate(0, 0, 1)
	var catIDs []int64
	for _, c := range task.Categories {
		catIDs = append(catIDs, c.ID)
	}
	if err := s.updateTaskInternal(task, task.Title, task.Description, task.Status, task.Priority, &tomorrow, task.StartTime, allDay, catIDs, false); err == nil {
		s.cx.PlayHaptic(core.HapticLight)
		s.ToastInfo("已推迟至明天")
	}
}

// ToggleTaskStatus toggles a task between completed and pending (supports recurring next occurrence too).
func (s *AppState) ToggleTaskStatus(task api.Task) {
	if task.ReadOnly {
		s.ToastInfo("外部日历任务为只读")
		return
	}
	nextStatus := "completed"
	if task.Status == "completed" {
		nextStatus = "pending"
	}
	payload := map[string]any{"status": nextStatus}
	if task.Recurring() && task.InstanceID != "" {
		payload["instance_id"] = task.InstanceID
		if task.OccurrenceDate != "" {
			payload["occurrence_date"] = task.OccurrenceDate
		}
	}
	if _, err := s.queueTaskMutation("PATCH", fmt.Sprintf("/tasks/%d/status", task.ID), payload, task.Revision); err == nil {
		if nextStatus == "completed" {
			s.cx.PlayHaptic(core.HapticSuccess)
		} else {
			s.cx.PlayHaptic(core.HapticSelection)
		}
	}
}

// DeleteTask deletes a task offline-first.
func (s *AppState) DeleteTask(task api.Task) error {
	if task.ReadOnly {
		err := errors.New("外部日历任务不可删除")
		s.ToastError(err.Error())
		return err
	}
	_, err := s.queueTaskMutation("DELETE", fmt.Sprintf("/tasks/%d", task.ID), nil, task.Revision)
	if err == nil {
		s.cx.PlayHaptic(core.HapticMedium)
		s.ToastSuccess("已删除任务")
	}
	return err
}

// SaveCategory creates or updates a category offline-first.
func (s *AppState) SaveCategory(cat api.Category) error {
	method := "PUT"
	if cat.ID == 0 {
		method = "POST"
	}
	cat.Name = strings.TrimSpace(cat.Name)
	if cat.Color == "" {
		cat.Color = categoryColorPresets[0]
	}
	next, err := syncer.QueueCategory(s.cache.GetUntracked(), method, cat)
	if err != nil {
		s.ToastError(err.Error())
		return err
	}
	s.cache.Set(next)
	snapshot := syncer.Clone(next)
	go func() {
		_ = s.persist.SaveCache(snapshot)
	}()
	s.cx.PlayHaptic(core.HapticSuccess)
	if method == "POST" {
		s.ToastSuccess("已创建分类")
	} else {
		s.ToastSuccess("已更新分类")
	}
	s.flushOutboxAsync()
	return nil
}

// DeleteCategory deletes a category offline-first.
func (s *AppState) DeleteCategory(cat api.Category) error {
	next, err := syncer.QueueCategory(s.cache.GetUntracked(), "DELETE", cat)
	if err != nil {
		s.ToastError(err.Error())
		return err
	}
	if s.selectedCategoryID.GetUntracked() == cat.ID {
		s.selectedCategoryID.Set(0)
	}
	s.cache.Set(next)
	snapshot := syncer.Clone(next)
	go func() {
		_ = s.persist.SaveCache(snapshot)
	}()
	s.cx.PlayHaptic(core.HapticMedium)
	s.ToastSuccess("已删除分类")
	s.flushOutboxAsync()
	return nil
}

// ResolveConflictOverwrite re-queues a conflicted task mutation with the latest server revision.
func (s *AppState) ResolveConflictOverwrite(opID string) {
	next, err := syncer.Resolve(s.cache.GetUntracked(), opID)
	if err != nil {
		s.ToastError(err.Error())
		return
	}
	s.cache.Set(next)
	snapshot := syncer.Clone(next)
	go func() {
		_ = s.persist.SaveCache(snapshot)
	}()
	s.ToastInfo("已重新排队，正在覆盖服务器版本")
	s.flushOutboxAsync()
}

// DiscardTaskMutations drops all pending mutations for a given taskID.
func (s *AppState) DiscardTaskMutations(taskID int64) {
	next := syncer.Discard(s.cache.GetUntracked(), taskID)
	s.cache.Set(next)
	snapshot := syncer.Clone(next)
	go func() {
		_ = s.persist.SaveCache(snapshot)
	}()
	s.ToastInfo("已放弃该任务的本地待同步修改")
}

// DiscardCategoryMutation drops pending category mutations for a given categoryID.
func (s *AppState) DiscardCategoryMutation(categoryID int64) {
	next := syncer.DiscardCategory(s.cache.GetUntracked(), categoryID)
	s.cache.Set(next)
	snapshot := syncer.Clone(next)
	go func() {
		_ = s.persist.SaveCache(snapshot)
	}()
	s.ToastInfo("已放弃该分类的本地修改")
}

// FindTask looks up the latest effective task by ID.
func (s *AppState) FindTask(id int64) (api.Task, bool) {
	for _, t := range s.projectedTasks.Get() {
		if t.ID == id {
			return t, true
		}
	}
	return api.Task{}, false
}

// TaskHasPending reports whether taskID has unacknowledged local mutations.
func (s *AppState) TaskHasPending(taskID int64) bool {
	for _, op := range s.cache.Get().Outbox {
		if op.TaskID == taskID {
			return true
		}
	}
	return false
}

func nonNilInt64s(in []int64) []int64 {
	if in == nil {
		return []int64{}
	}
	return in
}
