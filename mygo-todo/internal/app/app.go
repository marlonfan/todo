// Package app implements the Todo client entirely with MyGo Native UI.
// Windows in this package have Content and never create a Page or WebView.
package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"reflect"
	"runtime"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/markdown"
	"github.com/egoist/mygo/ui/richtext"
	"todo-native/internal/api"
	"todo-native/internal/reminders"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

type App struct {
	aiPrompts            []api.Prompt
	aiHistory            api.AskHistoryPage
	aiLoaded             bool
	aiTab, aiOutputMode  int
	aiSearch             string
	aiConfigDraft        *api.AIConfig
	aiPromptDraft        *api.Prompt
	aiDelete             *aiDelete
	aiPanel              *aiPanel
	aiReasoningOpen      bool
	markdown             markdown.Options
	descriptionPreview   bool
	taskTitleEditing     bool
	taskTitleInput       ui.Handle
	taskDescriptionInput ui.Handle
	richDoc              *richtext.Document
	richComposing        bool
	taskActivityOpen     bool
	sidebarOverlay       bool
	sidebarWidth         float32

	autosave                          detailAutosaveState
	localWrites                       localWriteState
	interaction                       taskInteractionState
	store                             storage.Store
	win                               *mygo.Window
	tray                              *mygo.Tray
	trayFlyout                        *mygo.Window
	trayTab                           string
	trayQuickTitle                    string
	trayQuickInput                    ui.Handle
	trayTitleMode                     string
	client                            *api.Client
	session                           api.Session
	ctx                               context.Context
	cancel                            context.CancelFunc
	epoch                             uint64
	quitting                          bool
	busy                              bool
	syncing                           bool
	calendarLoading                   bool
	message, failure                  string
	server, username, password, email string
	register                          bool
	page, query, theme                string
	quick                             quickAddState
	search                            taskSearchState
	tasks                             []api.Task
	nextOccurrences                   []api.Occurrence
	history                           api.OccurrencePage
	historyFilter                     historyFilter
	selectedOccurrence                *api.Task
	occurrenceEditing                 bool
	occurrenceSchedule                *occurrenceScheduleDraft
	occurrenceScheduleBase            *occurrenceScheduleDraft
	occurrenceTitle                   string
	occurrenceDescription             string
	categories                        []api.Category
	list                              ui.ListState
	// taskListWidth is the resizable middle pane in the task workspace.
	// Keep a compact default while letting each user tune the list/detail balance.
	taskListWidth                         float32
	taskListFitWidth                      float32
	taskWorkspaceWidth                    float32
	revealTaskID                          int64
	selectedDay                           time.Time
	calendarMode                          int
	calendarFilter                        int
	calendarScroll                        ui.ScrollState
	calendarDetail                        *api.CalendarEvent
	calendarZoom                          float64
	calendarDragging                      bool
	taskMenuOpen                          bool
	calendarGrab                          calendarGrab
	caldavSources                         []api.CaldavSource
	caldavLoaded, caldavEditing           bool
	caldavDraft                           caldavDraft
	deleteCaldav                          *api.CaldavSource
	calendarSubscription                  *api.CalendarSubscription
	subscriptionFailure, caldavNotice     string
	syncedAt                              time.Time
	editing                               bool
	draft                                 Draft
	selectedTaskID                        int64
	taskDetailOpen                        bool
	pendingTaskAction                     func()
	taskDraftBase                         *Draft
	taskEditorInline                      bool
	taskAdvancedOpen                      bool
	taskMetaOpen                          string
	taskDiscardConfirm                    bool
	taskDraftOrphaned                     bool
	categoryEditing                       bool
	categoryDraft                         api.Category
	deleteTask                            *api.Task
	deleteCategory                        *api.Category
	profileTimezone                       string
	profileTimezoneDirty                  bool
	accountEditing                        bool
	accountSection                        string
	accountDraft                          accountDraft
	avatar                                *ui.Bitmap
	avatarSource, avatarFailure           string
	cache                                 storage.Cache
	cacheError                            string
	reauthPassword                        string
	reauthRequired                        bool
	stopAutoSync                          context.CancelFunc
	cacheGeneration                       uint64
	remotePulling                         bool
	remoteRetryAt                         time.Time
	discardSyncID                         *int64
	discardProfile                        bool
	discardCategoryID                     *int64
	localReminders                        bool
	preferences                           storage.Preferences
	preferencesError                      string
	reminderRunner                        *reminders.Runner
	stopReminders                         context.CancelFunc
	reminderStatus                        reminders.Status
	profileReminderEnabled                bool
	profileReminderMinutes                string
	profileMorningTime                    string
	profileReminderDirty                  bool
	profileReminderBase                   api.ProfilePreferences
	pendingReminder                       string
	openAtLogin, packaged                 bool
	trayAvailable, notificationsAvailable bool
	notifySettings                        []api.NotifySetting
	notifyChannels                        []string
	notifyLoaded, notifyEditing           bool
	notifyDraft                           notifyDraft
	notifyTestResults                     map[int64]notifyTestResult
	notifyDraftResult                     *notifyTestResult
	deleteNotify                          *api.NotifySetting
	taskCenter                            *taskCenter

	viewCache          viewCache
	pendingOps         map[string]bool
	pendingToasts      []ui.Toast
	taskListScroll     ui.ScrollState
	detailNavDir       float32
	calendarNavDir     float32
	discardedDraft     *Draft
	palette            commandPaletteState
	highlightedTaskKey string
	highlightOpenAt    time.Time
	highlightPending   *api.Task
	manualOrderRev     uint64
}

func New(store storage.Store) *App {
	a := &App{store: store, server: api.DefaultServer, page: "all", theme: "跟随系统", selectedDay: time.Now(), localReminders: true, calendarMode: 2, calendarZoom: 56, taskListWidth: taskListDefaultWidth, sidebarWidth: sidebarDefaultWidth}
	a.ctx, a.cancel = context.WithCancel(context.Background())
	if prefs, err := store.Preferences(); err == nil {
		a.preferences = prefs
		if prefs.SidebarWidth >= 200 && prefs.SidebarWidth <= 280 {
			a.sidebarWidth = fittedSidebarWidth(prefs.SidebarWidth)
		}
		if prefs.TaskListWidth >= taskListMinWidth && prefs.TaskListWidth <= 1400 {
			a.taskListWidth = prefs.TaskListWidth
		}
		for i, mode := range calendarModes {
			if prefs.CalendarView == mode {
				a.calendarMode = i
			}
		}
		if prefs.LocalReminders != nil {
			a.localReminders = *prefs.LocalReminders
		}
		a.trayTitleMode = normalizeTrayTitleMode(prefs.TrayTitleMode)
	} else if !errors.Is(err, os.ErrNotExist) {
		a.localReminders = false
		a.preferencesError = "无法读取桌面偏好，已暂停本机提醒：" + err.Error()
	}
	if server := os.Getenv("TODO_API_URL"); server != "" {
		a.server = server
	}
	if session, err := store.Session(); err == nil {
		if client, err := api.New(session.Server, session.Token); err == nil && session.Token != "" {
			a.client, a.session, a.server = client, session, session.Server
			a.profileTimezone = session.User.Timezone
			a.cache = storage.Cache{Server: session.Server, UserID: session.User.ID}
			if cache, err := store.Cache(session.Server, session.User.ID); err == nil {
				a.adoptCache(cache)
			} else if !errors.Is(err, os.ErrNotExist) {
				a.cacheError = "无法读取本地数据，已暂停写入以保留待同步修改：" + err.Error()
				a.failure = a.cacheError
			}
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		a.failure = "无法读取本地登录信息：" + err.Error()
	}
	a.selectedDay = time.Now().In(a.location())
	a.resetReminderProfile()
	a.theme = themeLabel(a.preferences.Theme)
	if a.preferences.CalendarView == "" && a.session.User.CalendarDefaultView != "" {
		a.calendarMode = accountCalendarMode(a.session.User.CalendarDefaultView)
	}
	a.focusCalendarWorkingHours()
	return a
}

func (a *App) mainWindowOptions(hidden bool) mygo.WindowOptions {
	return mygo.WindowOptions{
		Title:                "Todo Native",
		Width:                1280,
		Height:               800,
		MinWidth:             900,
		MinHeight:            600,
		StateKey:             "main",
		TitleBarStyle:        mygo.TitleBarHidden,
		TitleBarHeight:       windowTitleBarHeight,
		TrafficLightPosition: &mygo.Point{X: trafficLightInsetX, Y: trafficLightInsetY},
		AutoHideMenuBar:      true,
		BackgroundColor:      windowBackgroundColor,
		Hidden:               hidden,
		Content:              ui.View(a.view),
	}
}

func (a *App) createMainWindow(hidden bool) {
	a.win = mygo.NewWindow(a.mainWindowOptions(hidden))
	a.win.OnClose(a.windowClosing)
}

func (a *App) Start() {
	mygo.Theme.SetSource(themeSource(a.theme))
	a.setupTray()
	a.createMainWindow(mygo.App.WasOpenedAtLogin())
	a.setupMenus()
	a.openAtLogin, a.packaged = mygo.App.OpenAtLogin(), mygo.App.IsPackaged()
	a.notificationsAvailable = mygo.NotificationsSupported()
	a.startReminders()
	a.loadAvatar()
	if a.client != nil {
		a.refresh()
	}
	a.startAutoSync()
	a.openPendingReminder()
}

func (a *App) Show() {
	if a.win == nil || a.win.IsDestroyed() {
		if !a.quitting && a.tray != nil {
			a.createMainWindow(false)
		}
		if a.win == nil || a.win.IsDestroyed() {
			return
		}
	}
	a.win.Show()
	a.win.Restore()
	a.win.Focus()
}
func (a *App) Close() {
	a.commitPendingDeletes()
	a.closeTrayFlyout()
	if a.tray != nil {
		a.tray.Destroy()
		a.tray = nil
	}
	a.cancel()
	if a.stopReminders != nil {
		a.stopReminders()
	}
	if a.stopAutoSync != nil {
		a.stopAutoSync()
	}
}

func (a *App) setupMenus() {
	mygo.App.SetMenu(mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu},
		{Label: "任务", Submenu: []*mygo.MenuItem{
			{Label: "新建任务", Accelerator: "CmdOrCtrl+N", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.win.Update(func() {
					if a.client != nil {
						a.beginQuickAdd()
					}
				})
			}},
			{Label: "搜索任务", Accelerator: "CmdOrCtrl+F", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.win.Update(a.openTaskSearch)
			}},
			{Label: "命令面板", Accelerator: "CmdOrCtrl+K", Click: func(*mygo.MenuItem, *mygo.Window) { a.win.Update(a.openCommandPalette) }},
			{Label: "保存任务", Accelerator: "CmdOrCtrl+S", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.win.Update(a.saveCurrentTask)
			}},
			{Label: "刷新", Accelerator: "CmdOrCtrl+R", Click: func(*mygo.MenuItem, *mygo.Window) { a.win.Update(a.refreshCurrentPage) }},
			mygo.Separator(), {Role: mygo.RoleClose}, {Role: mygo.RoleQuit},
		}},
		{Role: mygo.RoleEditMenu}, {Role: mygo.RoleWindowMenu},
	}))
}

func (a *App) setupTray() {
	now := time.Now().In(a.location())
	icon, isTemplate := trayIconForOS(runtime.GOOS)
	contextMenu := usesTrayContextMenu(runtime.GOOS)
	opts := mygo.TrayOptions{
		ID:             "todo-native-tray",
		Icon:           icon,
		IconIsTemplate: isTemplate,
		ToolTip:        a.trayToolTip(now),
	}
	if contextMenu {
		opts.Menu = mygo.NewMenu(a.trayMenuItems())
	} else {
		// On macOS, Menu is nil so clicking the status item opens the interactive
		// Menu Bar Flyout Popover while Title shows live task info.
		opts.Title = a.trayStatusTitle(now)
	}
	tray, err := mygo.NewTray(opts)
	if err != nil {
		// Retry once with the monochrome fallback icon so Windows/Linux still get
		// close-to-tray even if the primary icon conversion fails.
		opts.Icon = trayPNG()
		opts.IconIsTemplate = false
		tray, err = mygo.NewTray(opts)
	}
	if err != nil {
		log.Printf("托盘不可用，关闭窗口将退出：%v", err)
		return
	}
	a.tray = tray
	a.trayAvailable = true
	if contextMenu {
		tray.OnClick(a.showFromTray)
	} else {
		tray.OnClick(a.toggleTrayFlyout)
		tray.OnRightClick(a.toggleTrayFlyout)
	}
}

// All model changes happen on the UI thread. Network and disk reads happen in
// workers. Session epochs discard stale responses after logout/account changes.
func (a *App) isPending(scope string) bool {
	return a.pendingOps[scope]
}

func (a *App) anyPending() bool {
	return len(a.pendingOps) > 0
}

func (a *App) runScoped(scope string, job func(context.Context) (func(), error)) {
	if a.busy {
		return
	}
	if scope != "" && a.pendingOps[scope] {
		return
	}
	if a.pendingOps == nil {
		a.pendingOps = make(map[string]bool)
	}
	if scope != "" {
		a.pendingOps[scope] = true
	}
	a.failure, a.message = "", ""
	epoch, ctx := a.epoch, a.ctx
	go func() {
		apply, err := job(ctx)
		if a.win == nil || a.win.IsDestroyed() {
			return
		}
		a.win.Update(func() {
			if epoch != a.epoch {
				return
			}
			defer a.openPendingReminder()
			if scope != "" {
				delete(a.pendingOps, scope)
			}
			if err != nil {
				a.failure = err.Error()
				a.pushErrorToast(err, func() { a.runScoped(scope, job) })
				return
			}
			if apply != nil {
				apply()
			}
			a.drainTaskReceipts()
			a.scheduleTaskSync()
		})
	}()
}

func (a *App) run(job func(context.Context) (func(), error)) {
	a.runScoped("global", job)
}

func (a *App) login() {
	client, err := api.New(a.server, "")
	if err != nil {
		a.failure = err.Error()
		return
	}
	username, password, email, register := strings.TrimSpace(a.username), a.password, strings.TrimSpace(a.email), a.register
	if username == "" || password == "" {
		a.failure = "请输入用户名和密码"
		return
	}
	a.runScoped("auth.login", func(ctx context.Context) (func(), error) {
		if register {
			if err := client.Do(ctx, "POST", "/auth/register", map[string]string{"username": username, "password": password, "email": email}, nil, 0); err != nil {
				return nil, err
			}
		}
		session, err := client.Login(ctx, username, password)
		if err != nil {
			return nil, err
		}
		cache := storage.Cache{Server: session.Server, UserID: session.User.ID}
		if saved, err := a.store.Cache(session.Server, session.User.ID); err == nil {
			cache = saved
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("无法读取本地数据：%w", err)
		}
		if err = a.store.SaveSession(session); err != nil {
			return nil, fmt.Errorf("无法保存登录信息：%w", err)
		}
		return func() {
			a.client, a.session, a.server = client, session, session.Server
			a.adoptCache(cache)
			a.password = ""
			a.profileTimezone = a.session.User.Timezone
			a.profileTimezoneDirty = false
			a.loadAvatar()
			if a.preferences.CalendarView == "" {
				a.calendarMode = accountCalendarMode(a.session.User.CalendarDefaultView)
				a.focusCalendarWorkingHours()
			}
			a.resetReminderProfile()
			a.selectedDay = time.Now().In(a.location())
			a.refresh()
			a.startAutoSync()
		}, nil
	})
}

func (a *App) logout() {
	if a.taskDraftDirty() || a.quickDraftDirty() {
		a.pendingTaskAction = func() { a.quick = quickAddState{}; a.logout() }
		a.taskDiscardConfirm = true
		return
	}
	if a.cacheError != "" {
		a.failure = a.cacheError
		return
	}
	if a.pendingChanges() > 0 {
		a.failure = "还有未同步的修改，请先在同步页面提交或处理后再退出登录"
		return
	}
	if err := a.store.Logout(); err != nil {
		a.failure = "无法清除本地会话：" + err.Error()
		return
	}
	a.commitPendingDeletes()
	a.cancel()
	if a.stopAutoSync != nil {
		a.stopAutoSync()
	}
	a.epoch++
	a.ctx, a.cancel = context.WithCancel(context.Background())
	a.client = nil
	a.session = api.Session{}
	a.reauthPassword, a.reauthRequired = "", false
	a.clearAI()
	a.closeAccountEditor()
	a.avatar, a.avatarSource, a.avatarFailure = nil, "", ""
	a.profileTimezone, a.profileTimezoneDirty = "", false
	a.pendingReminder = ""
	a.updateReminders()
	mygo.ClearNotifications()
	a.profileReminderDirty = false
	a.cache = storage.Cache{}
	a.discardSyncID = nil
	a.discardProfile = false
	a.discardCategoryID = nil
	a.cacheError = ""
	a.tasks = nil
	a.localWrites = localWriteState{}
	a.interaction = taskInteractionState{}
	a.nextOccurrences = nil
	a.history = api.OccurrencePage{}
	a.historyFilter = historyFilter{}
	a.selectedOccurrence = nil
	a.occurrenceSchedule = nil
	a.notifySettings, a.notifyChannels = nil, nil
	a.notifyLoaded, a.notifyEditing, a.deleteNotify = false, false, nil
	a.notifyDraft, a.taskCenter = notifyDraft{}, nil
	a.notifyTestResults, a.notifyDraftResult = nil, nil
	a.categories = nil
	a.calendarDetail = nil
	a.caldavSources, a.calendarSubscription, a.deleteCaldav = nil, nil, nil
	a.caldavLoaded, a.caldavEditing = false, false
	a.caldavDraft = caldavDraft{}
	a.subscriptionFailure, a.caldavNotice = "", ""
	a.password = ""
	a.clearTaskSelection()
	a.pendingTaskAction = nil
	a.taskDiscardConfirm = false
	a.busy = false
	a.pendingOps = nil
	a.pendingToasts = nil
	a.discardedDraft = nil
	a.highlightedTaskKey = ""
	a.highlightPending = nil
	a.syncing = false
	a.calendarLoading = false
	a.page = "all"
	a.sidebarOverlay = false
	a.query = ""
	a.quick = quickAddState{}
	a.search = taskSearchState{}
	a.failure = ""
	a.updateTray()
}

func (a *App) refresh() {
	if a.localWrites.running || a.localWrites.reply != nil {
		a.wakeTaskWrites(time.Second)
		return
	}
	if a.taskDiscardConfirm || a.client == nil || a.busy || a.syncing || a.calendarDragging || a.taskMenuOpen || a.discardProfile || a.discardCategoryID != nil || a.discardSyncID != nil || a.aiPanel != nil || a.aiConfigDraft != nil || a.aiPromptDraft != nil || a.cacheError != "" {
		return
	}
	client, session := a.client, a.session
	state := syncer.Clone(a.cache)
	wantCalendar := a.page == "calendar" || state.Calendar != nil
	calStart, calEnd := calendarRange(a.selectedDay.In(a.location()), a.calendarMode)
	if state.Calendar != nil && a.page != "calendar" {
		calStart, calEnd = state.Calendar.Start, state.Calendar.End
	}
	calZone := a.location().String()
	epoch, ctx, win := a.epoch, a.ctx, a.win
	prevSession := a.session
	a.syncing = true
	go func() {
		reqCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		defer cancel()
		finish := func(apply func()) {
			if win == nil || win.IsDestroyed() {
				return
			}
			win.Update(func() {
				if epoch != a.epoch {
					return
				}
				defer a.openPendingReminder()
				a.syncing = false
				if apply != nil {
					apply()
				}
				a.drainTaskReceipts()
				a.scheduleTaskSync()
			})
		}
		failed := func(err error) {
			finish(func() {
				a.session = session
				a.adoptCache(state)
				a.failure = err.Error()
				a.setSyncFailure(err)
				a.pushErrorToast(err, a.refresh)
			})
		}
		var user api.User
		authCtx, authCancel := context.WithTimeout(reqCtx, 20*time.Second)
		authErr := client.Do(authCtx, "GET", "/auth/me", nil, &user, 0)
		authCancel()
		if authErr != nil {
			failed(authErr)
			return
		}
		if user.ID != session.User.ID {
			failed(errors.New("登录账户与本地修改所属账户不一致，已停止同步"))
			return
		}
		session.User = user
		var profileErr error
		state, user, profileErr = syncer.FlushProfile(reqCtx, client, a.store, state, session)
		session.User = user
		var err error
		state, err = syncer.FlushCategories(reqCtx, client, a.store, state, false)
		if err != nil {
			failed(err)
			return
		}
		// Task intent is sent only by the UI-owned per-operation transport.
		// This refresh worker may persist category/profile/read snapshots, so
		// it must not also consume task receipts behind the editor's baseline.
		state, err = syncer.FlushCategories(reqCtx, client, a.store, state, true)
		if err != nil {
			failed(err)
			return
		}
		pulled, err := syncer.PullTasks(reqCtx, client, state, 0)
		if err != nil {
			failed(err)
			return
		}
		categories, err := client.Categories(reqCtx)
		if err != nil {
			failed(err)
			return
		}
		syncer.UpdateCategories(&pulled, categories)
		next, err := client.NextOccurrences(reqCtx)
		if err != nil {
			failed(err)
			return
		}
		history, err := client.OccurrenceHistoryThrough(reqCtx, state.History.NextCursor)
		if err != nil {
			failed(err)
			return
		}
		// Cache expanded future instances separately from the visible month.
		// Seven days of offsets plus 30 days of due notifications fit this range.
		reminderEvents, err := client.Calendar(reqCtx, time.Now().Add(-24*time.Hour), time.Now().AddDate(0, 0, 38))
		if err != nil {
			failed(err)
			return
		}
		calSnapshot := state.Calendar
		if wantCalendar {
			if calEvents, calErr := client.Calendar(reqCtx, calStart, calEnd); calErr == nil {
				revisions := make(map[int64]int64)
				for _, task := range pulled.Tasks {
					if task.Recurring() {
						revisions[task.ID] = task.Revision
					}
				}
				calSnapshot = &storage.CalendarSnapshot{
					Start: calStart, End: calEnd, Timezone: calZone,
					SavedAt: time.Now(), Events: calEvents, SeriesRevisions: revisions,
				}
			}
		}
		session.User, session.Token = user, client.Token()
		now := time.Now()
		if calSnapshot != nil && calSnapshot.SavedAt.Before(now) {
			calSnapshot.SavedAt = now
		}
		updated := storage.Cache{CategoryOutbox: state.CategoryOutbox, NextCategoryID: state.NextCategoryID, CategoryAliases: state.CategoryAliases, ProfileChanges: state.ProfileChanges, SyncCursor: pulled.SyncCursor, Server: session.Server, UserID: user.ID, Tasks: pulled.Tasks, Categories: categories, Next: next, History: history, SavedAt: now, Outbox: state.Outbox, NextLocalID: state.NextLocalID, ReminderEvents: reminderEvents, ReminderKeys: state.ReminderKeys, LocalAckRevisions: state.LocalAckRevisions, Calendar: calSnapshot}
		if err = a.store.SaveCache(updated); err != nil {
			failed(err)
			return
		}
		state = updated
		if session.Server != prevSession.Server || session.Token != prevSession.Token {
			if err = a.store.SaveSession(session); err != nil && profileErr != nil {
				failed(profileErr)
				return
			}
		} else if !reflect.DeepEqual(session.User, prevSession.User) {
			if err = a.store.SaveSessionMetadata(session); err != nil && profileErr != nil {
				failed(profileErr)
				return
			}
		}
		finish(func() {
			a.session = session
			a.reauthRequired = false
			a.loadAvatar()
			if !a.profileTimezoneDirty {
				a.profileTimezone = session.User.Timezone
			}
			a.adoptCache(updated)
			if !a.profileReminderDirty {
				a.resetReminderProfile()
			}
			a.selectedDay = a.selectedDay.In(a.location())
			a.failure = ""
			a.message = "已同步"
			if a.pendingChanges() > 0 {
				a.message = "部分修改需要处理，请查看同步页面"
			}
			if profileErr != nil {
				a.failure = profileErr.Error()
				a.setSyncFailure(profileErr)
			}
			if a.page == "calendar" && !calendarCovered(a.cache, calStart, calEnd, a.location().String()) {
				a.loadCalendar()
			}
			if a.page == "caldav" {
				a.loadCaldav()
			}
			if a.page == "notify" {
				a.loadNotify()
			}
			if a.page == "ai" {
				a.loadAI()
			}
		})
	}()
}

func (a *App) mutate(method, path string, body any, revision int64, after func()) {
	if a.client == nil {
		return
	}
	if syncer.IsCategoryMutation(method, path) {
		a.queueCategory(method, path, body, after)
		return
	}
	if syncer.IsTaskMutation(method, path) {
		a.queueTask(method, path, body, revision, after)
		return
	}
	client := a.client
	a.runScoped("mutate:"+method+":"+path, func(ctx context.Context) (func(), error) {
		err := client.Do(ctx, method, path, body, nil, revision)
		return func() {
			if after != nil {
				after()
			}
			a.refresh()
		}, err
	})
}
