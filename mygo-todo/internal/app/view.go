package app

import (
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"todo-native/internal/api"
)

var pages = []struct{ id, title string }{
	{"all", "全部任务"}, {"inbox", "收件箱"}, {"today", "今天"}, {"upcoming", "即将到来"},
	{"completed", "已完成"}, {"cancelled", "已取消"}, {"skipped", "已跳过"}, {"calendar", "日历"}, {"caldav", "CalDAV"}, {"notify", "通知渠道"}, {"categories", "管理分类"}, {"sync", "同步"}, {"settings", "设置"}, {"ai", "AI 与提示词"},
}

func avatarImage(bitmap *ui.Bitmap) ui.ImageSource {
	if bitmap == nil {
		return nil
	}
	return bitmap
}

func (a *App) view(c *ui.Context) {
	defer a.observeDetailAutosave(c)
	applyAppTheme(c)
	a.calendarDragging = false
	a.taskMenuOpen = false
	if a.client == nil {
		a.loginView(c)
		return
	}
	width, height := c.Size()
	// Calendar and search may select tasks outside a list workspace. Promote
	// their existing selection to the same in-window detail route once, so
	// narrow-window back navigation can subsequently hide it without reopening.
	if (a.editing || a.selectedOccurrence != nil) && !a.taskEditorInline {
		a.taskEditorInline, a.taskDetailOpen = true, true
	}
	content := func() {
		ui.Column(c).Fill().MinWidth(0).MinHeight(0).Background(tokensOf(c).BgApp).Children(func() {
			if a.failure != "" && !a.editing && a.selectedOccurrence == nil {
				t := tokensOf(c)
				bannerChrome := toolbarChromeMetrics(c.TitleBar(), 16, width < sidebarBreakpoint, true)
				ui.Row(c).Padding(8, bannerChrome.PadRight, 8, bannerChrome.PadLeft).Gap(8).AlignItems(ui.Center).Background(t.Danger.Alpha(0.08)).BorderWidth(0, 0, 1, 0).BorderColor(t.Danger.Alpha(0.20)).DragWindow().Children(func() {
					ui.Text(c, a.failure).FontSize(12).TextColor(t.Danger).Grow(1).MinWidth(0).MaxLines(3)
					iconButton(c, "关闭提示", lucide.X()).Size(24, 24).Padding(4).OnClick(func() { a.failure = "" })
				})
			}
			pageContent := func() {
				if !isTaskWorkspacePage(a.page) && a.page != "calendar" {
					a.header(c)
				}
				switch a.page {
				case "calendar":
					a.calendarView(c)
				case "caldav":
					a.caldavView(c)
				case "notify":
					a.notifyView(c)
				case "ai":
					a.aiView(c)
				case "categories":
					a.categoriesView(c)
				case "settings":
					a.settingsView(c)
				case "sync":
					a.syncView(c)
				default:
					a.taskList(c)
				}
			}
			if !isTaskWorkspacePage(a.page) && (a.editing || a.selectedOccurrence != nil) {
				a.detailDrawerWorkspace(c, pageContent)
			} else {
				pageContent()
			}
			// Never mount/unmount the narrow footer during routine sync: only
			// show it when offline, reauth-needed or blocked, avoiding layout bounce.
			if width < 1180 && a.syncNeedsAttention() {
				a.footer(c)
			}
		})
	}
	if width >= sidebarBreakpoint {
		a.sidebarWidth = fittedSidebarWidth(a.sidebarWidth)
		if ui.Split(c.Key("workspace-navigation"), &a.sidebarWidth, func() { a.sidebarContent(c, false) }, content).SplitReset(sidebarDefaultWidth).Fill().Changed() {
			a.sidebarWidth = fittedSidebarWidth(a.sidebarWidth)
			a.rememberWorkspaceLayout()
		}
	} else {
		content()
	}
	appDialog(c.Key("navigation-drawer"), &a.sidebarOverlay, func() { a.sidebarContent(c, true) }).Label("导航").Width(252).Height(min(680, height-64)).MaxWidthPercent(90).Padding(0)
	a.taskSearchPanel(c)
	a.occurrenceView(c)
	a.editorView(c)
	a.categoryEditorView(c)
	a.confirmations(c)
	a.syncConfirmation(c)
	a.profileDiscardConfirmation(c)
	a.categoryDiscardConfirmation(c)
	a.calendarEventDialog(c)
	a.caldavEditor(c)
	a.notifyEditor(c)
	a.taskCenterView(c)
	a.taskDiscardConfirmation(c)
	a.accountEditor(c)
	a.aiEditors(c)
	a.aiPanelView(c)
}

func (a *App) loginView(c *ui.Context) {
	t := tokensOf(c)
	ui.Column(c).Fill().Background(t.BgSidebar).Children(func() {
		ui.Box(c.Key("login-titlebar")).FillWidth().Height(loginTitleBarHeight(c.TitleBar())).Shrink(0).DragWindow()
		ui.Column(c).Grow(1).FillWidth().Center().Padding(0, 32, 32, 32).Children(func() {
			elevateModal(c, ui.Column(c).Width(420).MaxWidthPercent(100).Padding(32).Gap(16).Radius(16).Background(t.BgElevated)).Children(func() {
				ui.Column(c).Gap(4).Children(func() {
					ui.Text(c, "Todo").FontSize(30).FontWeight(700).TextColor(t.TextPrimary)
					ui.Text(c, "把注意力留给重要的事。").FontSize(14).TextColor(t.TextSecondary)
				})
				ui.Box(c).Height(1).FillWidth().Margin(2, 0).Background(t.BorderSubtle)
				ui.Field(c, "Todo 服务地址", func() { appInput(c.Key("server"), &a.server, "Todo 服务地址").Placeholder(api.DefaultServer) }).Description("连接服务端同步任务、日历与提醒。")
				ui.Field(c, "用户名", func() { appInput(c.Key("username"), &a.username, "用户名").AutoFocus() })
				if a.register {
					ui.Field(c, "邮箱", func() { appInput(c.Key("email"), &a.email, "邮箱") })
				}
				ui.Field(c, "密码", func() { appInput(c.Key("password"), &a.password, "密码").Password().OnSubmit(a.login) })
				if a.failure != "" {
					ui.Text(c, a.failure).FontSize(12).TextColor(t.Danger)
				}
				label := "登录"
				if a.register {
					label = "注册并登录"
				}
				if a.busy {
					label = "正在连接…"
				}
				primaryButton(c, label).Height(38).Disabled(a.busy).OnClick(a.login)
				link := "创建账户"
				if a.register {
					link = "返回登录"
				}
				appButton(c, link, "ghost").Disabled(a.busy).OnClick(func() { a.register = !a.register; a.failure = "" })
				ui.Text(c, "任务、日历与提醒，随时保持同步。").FontSize(12).TextColor(t.TextReadable).TextAlign(ui.Center)
			})
		})
	})
}

func (a *App) sidebar(c *ui.Context) {
	a.sidebarContent(c, false)
}

func (a *App) sidebarContent(c *ui.Context, inDrawer bool) {
	t := tokensOf(c)
	topH, topDraggable := sidebarTitleBarMetrics(c.TitleBar(), inDrawer)
	accountTopMargin := float32(0)
	if inDrawer {
		accountTopMargin = 6
	}
	ui.Column(c).Fill().MinWidth(0).MinHeight(0).Background(t.BgSidebar).Children(func() {
		if topH > 0 {
			topStrip := ui.Box(c.Key("sidebar-titlebar")).FillWidth().Height(topH).Shrink(0)
			if topDraggable {
				topStrip.DragWindow()
			}
		}
		// Keep the account in the app, seamlessly below the title-bar drag strip.
		profileState := ui.Box(c.Key("profile-state")).Size(0, 0)
		profileOpen := ui.Local(profileState, "open", func() bool { return false })
		choice := appDropdown(c, profileOpen, []overlay.MenuItem{{Key: "account", Label: "账户设置", Icon: lucide.User()}, {Divider: true}, {Key: "logout", Label: "退出账户", Icon: lucide.LogOut(), Danger: true, Disabled: a.busy}}, func(trigger ui.Element) {
			trigger.Label("账户菜单").Height(54).Margin(accountTopMargin, 8, 0, 8).Padding(6, 10).Radius(8).Gap(10).Justify(ui.Start)
			if trigger.Hovered() || *profileOpen {
				trigger.Background(t.BgHover)
			}
			trigger.Children(func() {
				display.Avatar(c, a.session.User.Username, display.AvatarProps{Size: 28, Shape: display.AvatarCircle, Image: avatarImage(a.avatar), Fallback: display.AvatarText}).Label("账户头像")
				ui.Column(c).MinWidth(0).Grow(1).Gap(1).Children(func() {
					ui.Text(c, "Todo").FontSize(13).FontWeight(600).TextColor(t.TextPrimary)
					ui.Text(c, a.session.User.Username).FontSize(11).TextColor(t.TextReadable).SingleLine().Tooltip(a.session.User.Username)
				})
				ui.Icon(c, lucide.ChevronsUpDown()).Size(14, 14).TextColor(t.TextTertiary)
			})
		})
		if choice == "account" {
			a.changePage("settings")
		}
		if choice == "logout" {
			a.logout()
		}
		previousPage := a.page
		if ui.Sidebar(c, &a.page, func() {
			ui.SidebarSection(c, "任务", nil, func() {
				for _, p := range pages[:4] {
					item := a.sidebarEntry(c, p.id, p.title, "", taskPageIcon(p.id))
					item.Children(func() { countBadge(c, a.pageCount(p.id)) })
				}
			})
			ui.SidebarSection(c, "历史", nil, func() {
				for _, p := range pages[4:7] {
					item := a.sidebarEntry(c, p.id, p.title, "", taskPageIcon(p.id))
					item.Children(func() { countBadge(c, a.pageCount(p.id)) })
				}
			})
			ui.SidebarSection(c, "清单", nil, func() {
				for _, cat := range a.categories {
					id := "category:" + strconv.FormatInt(cat.ID, 10)
					item := a.sidebarCategoryEntry(c, id, cat.Name, strings.TrimSpace(cat.Emoji), strings.TrimSpace(cat.Color), lucide.Folder())
					item.Children(func() { countBadge(c, a.pageCount(id)) })
					a.taskCategoryTarget(c, item, cat)
					item.Label(strings.TrimSpace(cat.Emoji + " " + cat.Name))
				}
			})
			ui.SidebarSection(c, "工作空间", nil, func() {
				a.sidebarEntry(c, "calendar", "日历", "", taskPageIcon("calendar"))
				a.sidebarEntry(c, "categories", "管理分类", "", taskPageIcon("categories"))
			})
		}).Background(ui.Transparent).Grow(1).Shrink(1).MinHeight(0).Disabled(a.busy || a.aiPanel != nil).Changed() {
			nextPage := a.page
			a.page = previousPage
			a.changePage(nextPage)
		}
		a.taskCategoryUndoView(c)
		ui.Column(c.Key("sidebar-bottom-dock")).Padding(8, 0, 14, 0).Gap(6).BorderWidth(1, 0, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
			if ui.Sidebar(c.Key("sidebar-settings"), &a.page, func() {
				a.sidebarEntry(c, "settings", "设置", "", taskPageIcon("settings"))
			}).Padding(0, 10).Height(34).Background(ui.Transparent).Disabled(a.busy || a.aiPanel != nil).Changed() {
				nextPage := a.page
				a.page = previousPage
				a.changePage(nextPage)
			}
			a.footer(c)
		})
	})
}

func taskPageIcon(id string) *ui.SVG {
	switch id {
	case "all":
		return lucide.ListTodo()
	case "inbox":
		return lucide.Inbox()
	case "today":
		return lucide.CalendarCheck()
	case "upcoming":
		return lucide.CalendarDays()
	case "completed":
		return lucide.CircleCheck()
	case "cancelled":
		return lucide.CircleX()
	case "skipped":
		return lucide.Ban()
	case "calendar":
		return lucide.Calendar()
	case "caldav":
		return lucide.Cloud()
	case "notify":
		return lucide.Bell()
	case "categories":
		return lucide.Folders()
	case "sync":
		return lucide.CloudSync()
	case "settings":
		return lucide.Settings()
	case "ai":
		return lucide.Sparkles()
	}
	return lucide.Folder()
}

func (a *App) pageCount(page string) int {
	return len(filteredTasks(projectTasks(a.tasks, a.nextOccurrences, a.history.Items), page, "", time.Now().In(a.location())))
}

func (a *App) title() string {
	for _, p := range pages {
		if p.id == a.page {
			return p.title
		}
	}
	for _, cat := range a.categories {
		if a.page == "category:"+strconv.FormatInt(cat.ID, 10) {
			return cat.Name
		}
	}
	return "任务"
}

func (a *App) header(c *ui.Context) {
	t := tokensOf(c)
	chrome := a.windowToolbarMetrics(c, 16)
	ui.Row(c.Key("view-toolbar")).Height(chrome.ToolbarHeight).Shrink(0).Padding(0, chrome.PadRight, 0, chrome.PadLeft).Gap(8).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).AlignItems(ui.Center).DragWindow().Children(func() {
		width, _ := c.Size()
		if width < sidebarBreakpoint {
			iconButton(c, "展开导航", lucide.PanelLeft()).OnClick(func() { a.sidebarOverlay = true })
			iconButton(c, "刷新", lucide.RefreshCw()).Disabled(a.busy || a.syncing).OnClick(a.refreshCurrentPage)
		}
		ui.Text(c, a.title()).FontSize(15).FontWeight(600).TextColor(t.TextPrimary).SingleLine().MinWidth(0).Grow(1).Tooltip(a.title())
		if isTaskWorkspacePage(a.page) {
			count := len(a.searchResults())
			if isHistoryPage(a.page) {
				total := a.pageCount(a.page)
				badgeText := fmt.Sprint(count)
				badgeLabel := fmt.Sprintf("%d 个任务", count)
				if total > 0 && count < total {
					badgeText = fmt.Sprintf("%d / %d", count, total)
					badgeLabel = fmt.Sprintf("已筛选 %d / 共 %d 项", count, total)
				}
				ui.Text(c, badgeText).Label(badgeLabel).FontSize(fontAux).FontWeight(fontWeightMedium).FontFeatures("tnum").
					TextColor(t.TextSecondary).Background(t.BgSubtle).Padding(2, 7).Radius(10)
				iconButton(c, "＋ 新建任务", lucide.Plus()).Disabled(a.busy).OnClick(a.newTask)
			} else {
				ui.Text(c, fmt.Sprint(count)).Label(fmt.Sprintf("%d 个任务", count)).FontSize(fontAux).FontWeight(fontWeightMedium).FontFeatures("tnum").
					TextColor(t.TextSecondary).Background(t.BgSubtle).Padding(2, 7).Radius(10)
				searchLabel := "搜索任务"
				if a.search.Return {
					searchLabel = "返回搜索"
				}
				iconButton(c, searchLabel, lucide.Search()).OnClick(a.openTaskSearch)
				iconButton(c, "＋ 新建任务", lucide.Plus()).Disabled(a.busy).OnClick(a.newTask)
			}
		}
	})
}

func (a *App) refreshCurrentPage() {
	if a.page == "caldav" {
		a.loadCaldav()
	} else if a.page == "notify" {
		a.loadNotify()
	} else if a.page == "ai" {
		a.loadAI()
	} else {
		a.refresh()
	}
}

func (a *App) hasBlockedSync() bool {
	if a.cache.ProfileChanges != nil && a.cache.ProfileChanges.Rejected {
		return true
	}
	for _, op := range a.cache.CategoryOutbox {
		if op.State != "pending" {
			return true
		}
	}
	for _, op := range a.cache.Outbox {
		if op.State != "pending" {
			return true
		}
	}
	return false
}

func (a *App) syncNeedsAttention() bool {
	return a.cacheError != "" || a.reauthRequired || a.hasBlockedSync() || strings.HasPrefix(a.message, "连接中断")
}

func (a *App) footer(c *ui.Context) {
	t := tokensOf(c)
	ui.Row(c.Key("sync-status")).Height(30).Padding(0, 14).Gap(6).AlignItems(ui.Center).Children(func() {
		status := a.message
		color := t.TextReadable
		dotColor := t.Success
		pending := a.pendingChanges()
		if a.cacheError != "" {
			status = "本地存储不可用"
			color, dotColor = t.Danger, t.Danger
		} else if a.busy {
			status = "正在同步…"
			dotColor = t.Accent
		} else if a.reauthRequired {
			status = "登录已失效"
			color, dotColor = t.Warning, t.Warning
		} else if strings.HasPrefix(a.message, "连接中断") {
			status = "离线 · 自动重试中"
			color, dotColor = t.Warning, t.Warning
		} else if a.hasBlockedSync() {
			status = "存在同步冲突"
			color, dotColor = t.Warning, t.Warning
		} else if pending > 0 && !a.localWrites.running && len(a.localWrites.retry) > 0 {
			status = "等待同步"
			color, dotColor = t.Warning, t.Warning
		} else if pending > 0 {
			status = "等待同步"
			dotColor = t.Accent
		} else if status == "" || strings.HasPrefix(status, "已") {
			status = "已同步"
		}
		ui.Box(c).Size(6, 6).Radius(3).Background(dotColor).Shrink(0).AccessHidden(true)
		ui.Text(c, status).FontSize(11).TextColor(color).SingleLine().Grow(1).MinWidth(0).Tooltip(status)
		if pending > 0 {
			ui.ButtonBase(c).Label(fmt.Sprintf("%d 项待同步", pending)).Tooltip("查看待同步修改").Padding(2, 6).Radius(8).Background(t.BgSubtle).OnClick(func() { a.changePage("sync") }).Children(func() {
				ui.Text(c, fmt.Sprint(pending)).FontSize(11).FontFeatures("tnum").TextColor(color)
			})
		}
		iconButton(c, "刷新", lucide.RefreshCw()).Size(24, 24).Padding(4).Disabled(a.busy || a.syncing).OnClick(a.refreshCurrentPage)
	})
}

func taskRecencyRank(id int64) uint64 {
	if id < 0 {
		// Negative local IDs are allocated -1, -2, -3... for newly created tasks.
		// Ranking them above positive server IDs keeps optimistic creations in the
		// exact same top slot before and after server acknowledgement.
		return uint64(math.MaxInt64) + uint64(-id)
	}
	return uint64(id)
}

func filteredTasks(tasks []api.Task, page, query string, now time.Time) []api.Task {
	query = strings.ToLower(strings.TrimSpace(query))
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	result := make([]api.Task, 0, len(tasks))
	for _, task := range tasks {
		if query != "" && !strings.Contains(strings.ToLower(task.Title+" "+task.Description), query) {
			continue
		}
		switch page {
		case "completed", "cancelled", "skipped":
			if task.Status != page {
				continue
			}
		default:
			if task.Status != "pending" {
				continue
			}
		}
		date := task.StartTime
		if date == nil {
			date = task.DueDate
		}
		if page == "inbox" && (date != nil || len(task.Categories) > 0) {
			continue
		}
		if page == "today" && (date == nil || !date.Before(start.AddDate(0, 0, 1))) {
			continue
		}
		if page == "upcoming" && (date == nil || !date.Before(start.AddDate(0, 0, 7))) {
			continue
		}
		if strings.HasPrefix(page, "category:") {
			id, _ := strconv.ParseInt(strings.TrimPrefix(page, "category:"), 10, 64)
			if !slices.ContainsFunc(task.Categories, func(cat api.Category) bool { return cat.ID == id }) {
				continue
			}
		}
		result = append(result, task)
	}
	slices.SortStableFunc(result, func(a, b api.Task) int {
		if a.Priority != b.Priority {
			return b.Priority - a.Priority
		}
		if a.StartTime != nil && b.StartTime != nil {
			if cmp := a.StartTime.Compare(*b.StartTime); cmp != 0 {
				return cmp
			}
		} else if a.StartTime != nil {
			return -1
		} else if b.StartTime != nil {
			return 1
		}
		ra, rb := taskRecencyRank(a.ID), taskRecencyRank(b.ID)
		if ra > rb {
			return -1
		}
		if ra < rb {
			return 1
		}
		return 0
	})
	return result
}

func (a *App) stableTaskKey(task api.Task) string {
	if key := a.cache.ReminderKeys[task.ID]; key != "" {
		return key + ":" + task.InstanceID
	}
	return taskRowKey(task)
}

func (a *App) taskList(c *ui.Context) {
	a.detailWorkspace(c, func() { a.taskListPane(c) })
}

func (a *App) taskDetailPanel(c *ui.Context, compact bool) {
	ui.Column(c).Fill().MinHeight(0).MinWidth(0).Background(tokensOf(c).BgApp).Children(func() {
		if a.editing {
			a.taskEditorContent(c, compact)
		} else if a.selectedOccurrence != nil {
			a.occurrenceContent(c, compact)
		} else {
			ui.Box(c.Key("empty-detail-titlebar")).FillWidth().Height(emptyDetailTitleBarHeight(c.TitleBar())).Shrink(0).DragWindow()
			ui.Column(c).Grow(1).Center().Padding(24).Gap(8).Children(func() {
				appEmptyState(c, "选择一个任务", "在左侧列表中点击任务，查看或直接编辑内容。", "", nil)
			})
		}
	})
}

func (a *App) taskListPane(c *ui.Context) {
	now := time.Now().In(a.location())
	a.header(c)
	if !a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) && a.taskDraftDirty() {
		appButton(c, "继续编辑未保存任务", "ghost").Margin(4, 12).TextColor(tokensOf(c).Accent).OnClick(a.resumeTaskDraft)
	}
	if isHistoryPage(a.page) {
		a.historyToolbar(c, now)
	} else {
		a.quickAddBar(c)
	}
	tasks := a.interactionTasks(projectTasks(a.tasks, a.nextOccurrences, a.history.Items), a.page, a.query, now)
	if isHistoryPage(a.page) {
		tasks = filterHistory(tasks, a.historyFilter, now)
	}
	if len(tasks) == 0 {
		ui.Column(c).Grow(1).Center().Gap(12).Children(func() {
			description, actionLabel := "添加一个任务，给今天留一点清晰。", "新建任务"
			var create func() = a.newTask
			if isHistoryPage(a.page) {
				description = "已加载记录中没有匹配项，可调整筛选。"
				actionLabel = ""
				create = nil
			}
			appEmptyState(c, "暂时没有任务", description, actionLabel, create)
			a.historyMoreButton(c)
		})
		return
	}

	rowControlOwnsKeys := false
	var list ui.Element
	var scrollTaskIntoView func(idx int)

	if isHistoryPage(a.page) {
		displayRows, taskToRow := buildGroupedHistoryRows(tasks, a.historyFilter.Basis, now)
		if a.revealTaskID != 0 {
			for i, task := range tasks {
				if task.ID == a.revealTaskID {
					a.list.ScrollIntoView(taskToRow[i])
					break
				}
			}
			a.revealTaskID = 0
		}
		hasMoreRow := a.history.HasMore
		rowCount := len(displayRows)
		if hasMoreRow {
			rowCount++
		}
		a.list.Key = func(i int) any {
			if hasMoreRow && i == len(displayRows) {
				return "history-more"
			}
			item := displayRows[i]
			if item.isHeader {
				return item.headerKey
			}
			return a.stableTaskKey(item.task)
		}
		t := tokensOf(c)
		list = ui.List(c, &a.list, rowCount, func(i int) {
			if hasMoreRow && i == len(displayRows) {
				a.historyMoreButton(c)
				return
			}
			item := displayRows[i]
			if item.isHeader {
				topPad := float32(8)
				if i == 0 {
					topPad = 2
				}
				ui.Row(c).FillWidth().Padding(topPad, 10, 2, 10).AlignItems(ui.Center).Children(func() {
					ui.Text(c, item.title).FontSize(11.5).FontWeight(fontWeightSemibold).TextColor(t.TextSecondary).Grow(1)
					ui.Text(c, fmt.Sprint(item.count)).FontSize(fontAux).FontFeatures("tnum").TextColor(t.TextTertiary)
				})
				return
			}
			rowControlOwnsKeys = a.taskListItem(c, item.task, now) || rowControlOwnsKeys
		}).Label("任务列表").Padding(4, 8).Gap(3).Grow(1).MinHeight(0)
		scrollTaskIntoView = func(idx int) {
			if idx >= 0 && idx < len(taskToRow) {
				a.list.ScrollIntoView(taskToRow[idx])
			}
		}
	} else {
		if a.revealTaskID != 0 {
			for i, task := range tasks {
				if task.ID == a.revealTaskID {
					a.list.ScrollIntoView(i)
					break
				}
			}
			a.revealTaskID = 0
		}
		a.list.Key = func(i int) any { return a.stableTaskKey(tasks[i]) }
		list = ui.List(c, &a.list, len(tasks), func(i int) {
			rowControlOwnsKeys = a.taskListItem(c, tasks[i], now) || rowControlOwnsKeys
		}).Label("任务列表").Padding(4, 8).Gap(3).Grow(1).MinHeight(0)
		scrollTaskIntoView = func(idx int) { a.list.ScrollIntoView(idx) }
	}

	move := func(direction int) {
		index := -1
		for i, task := range tasks {
			if a.taskRowSelected(task) {
				index = i
				break
			}
		}
		index = min(max(0, index+direction), len(tasks)-1)
		a.openTask(tasks[index])
		scrollTaskIntoView(index)
	}
	if !rowControlOwnsKeys {
		list.OnShortcut(0, ui.KeyDown, func() { move(1) }).OnShortcut(0, ui.KeyUp, func() { move(-1) })
		list.OnShortcut(0, ui.KeyEnter, func() {
			for _, task := range tasks {
				if a.taskRowSelected(task) {
					a.openTask(task)
					return
				}
			}
			a.openTask(tasks[0])
		})
	}
}

func taskPrimaryTime(task api.Task) *time.Time {
	if task.StartTime != nil {
		return task.StartTime
	}
	return task.DueDate
}

func (a *App) historyMoreButton(c *ui.Context) {
	if (a.page == "completed" || a.page == "cancelled" || a.page == "skipped") && a.history.HasMore {
		t := tokensOf(c)
		ui.Row(c).FillWidth().Padding(8, 12, 12, 12).Justify(ui.Center).Children(func() {
			more := ui.ButtonBase(c.Key("history-more")).Label("加载更多重复任务历史").
				Height(28).Padding(0, 12).Radius(7).Center().Cursor(ui.CursorPointer).
				Background(ui.Transparent).Border(1, t.BorderSubtle).Disabled(a.busy).OnClick(a.loadMoreHistory)
			fg := t.TextSecondary
			if more.Hovered() {
				more.Background(t.BgHover).BorderColor(t.BorderDefault)
				fg = t.TextPrimary
			}
			more.Children(func() {
				ui.Text(c, "加载更多重复任务历史").FontSize(11.5).FontWeight(fontWeightRegular).TextColor(fg)
			})
		})
	}
}

func (a *App) taskDiscardConfirmation(c *ui.Context) {
	open := a.taskDiscardConfirm && a.pendingTaskAction != nil
	appDialog(c, &open, func() {
		ui.Text(c, "保留未保存的任务草稿？").FontSize(fontTitle).Bold()
		ui.Text(c, "当前更改尚未保存。继续编辑可保留草稿，放弃后才会离开。").TextColor(c.Theme().TextMuted)
		ui.Row(c).Justify(ui.End).Gap(8).Wrap().Children(func() {
			appActionButton(c, "继续编辑", action.ButtonProps{}).OnClick(func() { a.taskDiscardConfirm = false; a.pendingTaskAction = nil; a.resumeTaskDraft() })
			appActionButton(c, "放弃并切换", action.ButtonProps{Variant: action.Primary}).OnClick(func() {
				next := a.pendingTaskAction
				a.pendingTaskAction = nil
				a.taskDiscardConfirm = false
				a.clearTaskSelection()
				if next != nil {
					next()
				}
			})
		})
	}).Width(430)
	if !open {
		a.taskDiscardConfirm = false
		a.pendingTaskAction = nil
	}
}

func (a *App) taskRowSelected(task api.Task) bool {
	if a.quick.Open {
		return false
	}
	if a.selectedOccurrence != nil {
		return taskRowKey(*a.selectedOccurrence) == taskRowKey(task)
	}
	return a.editing && a.draft.Task.ID != 0 && a.draft.Task.ID == task.ID
}

func taskMetaIn(task api.Task, loc *time.Location) string {
	parts := []string{}
	if date := taskPrimaryTime(task); date != nil {
		format := "01月02日 15:04"
		if task.AllDay {
			format = "01月02日 全天"
		}
		parts = append(parts, date.In(loc).Format(format))
	}
	for _, cat := range task.Categories {
		parts = append(parts, strings.TrimSpace(cat.Emoji+" "+cat.Name))
	}
	if task.ReadOnly {
		parts = append(parts, "只读日历")
	}
	return strings.Join(parts, "  ·  ")
}
