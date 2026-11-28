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
	{"processed", "已处理"}, {"completed", "已完成"}, {"cancelled", "已取消"}, {"skipped", "已跳过"},
	{"calendar", "日历"}, {"caldav", "CalDAV"}, {"notify", "通知渠道"}, {"categories", "管理分类"}, {"sync", "同步"}, {"settings", "设置"}, {"ai", "AI 与提示词"},
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
	a.flushPendingToasts(c)
	a.calendarDragging = false
	a.taskMenuOpen = false
	if a.client == nil {
		a.loginView(c)
		a.toastViewport(c)
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
		rootCol := ui.Column(c).Fill().MinWidth(0).MinHeight(0).Background(tokensOf(c).BgApp).
			OnShortcut(ui.Cmd, ui.KeyK, a.openCommandPalette)
		rootCol.Children(func() {
			// Persistent top banner is reserved strictly for critical blocking issues
			// (local storage error or expired session). Transient failures use toasts.
			if (a.cacheError != "" || a.reauthRequired) && !a.editing && a.selectedOccurrence == nil {
				t := tokensOf(c)
				bannerMsg := a.cacheError
				if bannerMsg == "" && a.reauthRequired {
					bannerMsg = "登录状态已过期，本地修改已保留；请前往同步页面重新验证。"
				}
				bannerChrome := toolbarChromeMetrics(c.TitleBar(), 16, width < sidebarBreakpoint, true)
				ui.Row(c).Padding(8, bannerChrome.PadRight, 8, bannerChrome.PadLeft).Gap(8).AlignItems(ui.Center).Background(t.Danger.Alpha(0.08)).BorderWidth(0, 0, 1, 0).BorderColor(t.Danger.Alpha(0.20)).DragWindow().Children(func() {
					ui.Text(c, bannerMsg).FontSize(12).TextColor(t.Danger).Grow(1).MinWidth(0).MaxLines(3)
					if a.reauthRequired {
						appButton(c, "去验证", "ghost").Height(24).Padding(0, 8).TextColor(t.Accent).OnClick(func() { a.changePage("sync") })
					}
					headerIconButton(c, "关闭提示", lucide.X()).Size(24, 24).Padding(4).OnClick(func() {
						a.cacheError = ""
						a.failure = ""
					})
				})
			}
			renderActivePage := func() {
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
			pageContent := func() {
				pageKey := a.page
				if isTaskWorkspacePage(a.page) {
					// Task workspace keeps a single persistent split view while smoothly
					// cross-fading/lifting the task list inside taskListPane.
					pageKey = "task-workspace"
				}
				ui.Box(c.Key("page-stage")).Grow(1).Fill().MinHeight(0).MinWidth(0).Clip().Children(func() {
					ui.Column(c.Key("page-view:" + pageKey)).Absolute().Fill().MinHeight(0).MinWidth(0).
						Transition(motionPageSwitch()).
						Children(renderActivePage)
				})
			}
			if !isTaskWorkspacePage(a.page) {
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
	a.commandPaletteView(c)
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
	a.toastViewport(c)
}

func (a *App) loginView(c *ui.Context) {
	t := tokensOf(c)
	loggingIn := a.isPending("auth.login") || a.busy
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
				if loggingIn {
					label = "正在连接…"
				}
				primaryButton(c, label).Height(38).Disabled(loggingIn).OnClick(a.login)
				link := "创建账户"
				if a.register {
					link = "返回登录"
				}
				appButton(c, link, "ghost").Disabled(loggingIn).OnClick(func() { a.register = !a.register; a.failure = "" })
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
	if inDrawer {
		topH = 8
	}
	ui.Column(c).Fill().MinWidth(0).MinHeight(0).Background(t.BgSidebar).Children(func() {
		if topH > 0 {
			topStrip := ui.Box(c.Key("sidebar-titlebar")).FillWidth().Height(topH).Shrink(0)
			if topDraggable {
				topStrip.DragWindow()
			}
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
				item := a.sidebarEntry(c, "processed", "已处理", "", taskPageIcon("processed"))
				item.Children(func() { countBadge(c, a.pageCount("processed")) })
			})
			// "清单" section with "+" add category action and context menu for "管理分类"
			ui.Column(c.Key("sidebar-categories-section")).Gap(2).Margin(12, 0, 0, 0).Shrink(0).Children(func() {
				catHead := ui.Row(c.Key("sidebar-categories-header")).Padding(4, 4, 4, 8).AlignItems(ui.Center)
				catHead.Children(func() {
					ui.Text(c, "清单").FontSize(12).FontWeight(600).TextColor(t.TextSecondary).Grow(1).SingleLine()
					addCat := ui.ButtonBase(c.Key("sidebar-add-category")).Label("新建分类").Tooltip("新建分类").
						Size(22, 22).Radius(5).Center().Cursor(ui.CursorPointer).
						Transition(motionColorsFast()).
						OnClick(func() { a.editCategory(api.Category{}) })
					fg := t.TextTertiary
					if addCat.Hovered() {
						addCat.Background(t.BgHover)
						fg = t.TextPrimary
					}
					addCat.Children(func() {
						ui.Icon(c, lucide.Plus()).Size(13, 13).TextColor(fg).AccessHidden(true)
					})
				})
				switch overlay.ContextMenu(c, catHead, overlay.DropdownMenuProps{
					Items: []overlay.MenuItem{
						{Key: "new", Label: "新建分类", Icon: lucide.FolderPlus()},
						{Key: "manage", Label: "管理分类…", Icon: lucide.Folders()},
					},
				}) {
				case "new":
					a.editCategory(api.Category{})
				case "manage":
					a.changePage("categories")
				}

				for _, cat := range a.categories {
					catCopy := cat
					id := "category:" + strconv.FormatInt(cat.ID, 10)
					item := a.sidebarCategoryEntry(c, id, cat.Name, strings.TrimSpace(cat.Emoji), strings.TrimSpace(cat.Color), lucide.Folder())
					item.Children(func() { countBadge(c, a.pageCount(id)) })
					a.taskCategoryTarget(c, item, cat)
					item.Label(strings.TrimSpace(cat.Emoji + " " + cat.Name))
					switch overlay.ContextMenu(c, item, overlay.DropdownMenuProps{
						Items: []overlay.MenuItem{
							{Key: "edit", Label: "编辑分类", Icon: lucide.Pencil()},
							{Key: "manage", Label: "管理全部分类…", Icon: lucide.Folders()},
							{Divider: true},
							{Key: "delete", Label: "删除分类", Icon: lucide.Trash2(), Danger: true},
						},
					}) {
					case "edit":
						a.editCategory(catCopy)
					case "manage":
						a.changePage("categories")
					case "delete":
						a.deleteCategory = &catCopy
						a.failure = ""
					}
				}
			})
			ui.SidebarSection(c, "工作空间", nil, func() {
				a.sidebarEntry(c, "calendar", "日历", "", taskPageIcon("calendar"))
			})
		}).Background(ui.Transparent).Grow(1).Shrink(1).MinHeight(0).Disabled(a.aiPanel != nil).Changed() {
			nextPage := a.page
			a.page = previousPage
			a.changePage(nextPage)
		}
		a.taskCategoryUndoView(c)

		// Bottom dock: low-frequency Account entry beside Settings, plus quiet sync status.
		ui.Column(c.Key("sidebar-bottom-dock")).Padding(8, 0, 12, 0).Gap(4).BorderWidth(1, 0, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
			ui.Row(c.Key("sidebar-account-settings")).Padding(0, 8).Gap(4).AlignItems(ui.Center).Children(func() {
				profileState := ui.Box(c.Key("profile-state")).Grow(1).MinWidth(0)
				profileOpen := ui.Local(profileState, "open", func() bool { return false })
				profileState.Children(func() {
					choice := appDropdown(c, profileOpen, []overlay.MenuItem{
						{Key: "account", Label: "账户设置", Icon: lucide.User()},
						{Key: "categories", Label: "管理分类", Icon: lucide.Folders()},
						{Divider: true},
						{Key: "logout", Label: "退出账户", Icon: lucide.LogOut(), Danger: true},
					}, func(trigger ui.Element) {
						trigger.Label("账户菜单").Height(48).FillWidth().MinWidth(0).Padding(4, 8).Radius(7).Gap(10).Justify(ui.Start).AlignItems(ui.Center).
							Transition(motionColorsFast())
						if trigger.Hovered() || *profileOpen {
							trigger.Background(t.BgHover)
						}
						trigger.Children(func() {
							display.Avatar(c, a.session.User.Username, display.AvatarProps{Size: 40, Shape: display.AvatarCircle, Image: avatarImage(a.avatar), Fallback: display.AvatarText}).Shrink(0).Label("账户头像")
							ui.Text(c, a.session.User.Username).FontSize(13.5).FontWeight(fontWeightSemibold).TextColor(t.TextPrimary).SingleLine().Grow(1).MinWidth(0)
							ui.Icon(c, lucide.ChevronsUpDown()).Size(13, 13).TextColor(t.TextTertiary).Shrink(0).AccessHidden(true)
						})
					})
					switch choice {
					case "account":
						a.changePage("settings")
					case "categories":
						a.changePage("categories")
					case "logout":
						a.logout()
					}
				})

				settingsActive := a.page == "settings"
				settingsBtn := ui.ButtonBase(c.Key("sidebar-settings-btn")).Label("设置").Tooltip("设置").
					Size(34, 34).Radius(7).Center().Shrink(0).Cursor(ui.CursorPointer).
					Disabled(a.aiPanel != nil).Transition(motionColorsFast()).
					OnClick(func() { a.changePage("settings") })
				sIconCol := t.TextSecondary
				if settingsActive {
					settingsBtn.Background(t.BgSelected)
					sIconCol = t.Accent
				} else if settingsBtn.Hovered() {
					settingsBtn.Background(t.BgHover)
					sIconCol = t.TextPrimary
				}
				settingsBtn.Children(func() {
					ui.Icon(c, taskPageIcon("settings")).Size(15.5, 15.5).TextColor(sIconCol).AccessHidden(true)
				})
			})
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
	case "processed":
		return lucide.CheckCheck()
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
	return a.cachedPageCount(page, time.Now().In(a.location()))
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

func headerIconButton(c *ui.Context, label string, icon *ui.SVG) ui.Element {
	t := tokensOf(c)
	button := styleAppButton(c, ui.ButtonBase(c).Label(label), "", "ghost").Size(30, 30).Padding(7)
	iconColor := t.TextSecondary
	if button.Hovered() || button.Pressed() {
		iconColor = t.TextPrimary
	}
	button.Children(func() {
		if icon != nil {
			ui.Icon(c, icon).Size(15, 15).TextColor(iconColor).AccessHidden(true)
		}
	})
	return button
}

func (a *App) header(c *ui.Context) {
	t := tokensOf(c)
	chrome := a.windowToolbarMetrics(c, 16)
	ui.Row(c.Key("view-toolbar")).Height(chrome.ToolbarHeight).Shrink(0).Padding(0, chrome.PadRight, 0, chrome.PadLeft).Gap(6).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).AlignItems(ui.Center).DragWindow().Children(func() {
		width, _ := c.Size()
		if width < sidebarBreakpoint {
			headerIconButton(c, "展开导航", lucide.PanelLeft()).OnClick(func() { a.sidebarOverlay = true })
			headerIconButton(c, "刷新", lucide.RefreshCw()).Disabled(a.syncing).OnClick(a.refreshCurrentPage)
		}
		ui.Text(c, a.title()).FontSize(15).FontWeight(600).TextColor(t.TextPrimary).SingleLine().MinWidth(0).Grow(1)
		if isTaskWorkspacePage(a.page) {
			filtered := strings.TrimSpace(a.query) != "" || (isHistoryPage(a.page) && a.historyFilter.isActive())
			if filtered {
				count := len(a.searchResults())
				total := a.pageCount(a.page)
				badgeText := fmt.Sprint(count)
				badgeLabel := fmt.Sprintf("%d 个任务", count)
				badgeDesc := ""
				if total > 0 && count < total {
					badgeText = fmt.Sprintf("%d / %d", count, total)
					badgeDesc = fmt.Sprintf("已筛选 %d / 共 %d 项", count, total)
				}
				badge := ui.Text(c, badgeText).Label(badgeLabel).FontSize(fontAux).FontWeight(fontWeightMedium).FontFeatures("tnum").
					TextColor(t.TextSecondary).Background(t.BgSubtle).Padding(2, 7).Radius(10)
				if badgeDesc != "" {
					badge.Description(badgeDesc)
				}
			}
			if !isHistoryPage(a.page) && a.hasManualOrder(a.page) {
				headerIconButton(c, "恢复默认排序", lucide.RotateCcw()).OnClick(func() { a.resetManualOrder(a.page) })
			}
			if !isHistoryPage(a.page) {
				searchLabel := "搜索任务"
				if a.search.Return {
					searchLabel = "返回搜索"
				}
				headerIconButton(c, searchLabel, lucide.Search()).OnClick(a.openTaskSearch)
			}
			headerIconButton(c, "命令面板", lucide.Command()).OnClick(a.openCommandPalette)
			headerIconButton(c, "＋ 新建任务", lucide.Plus()).OnClick(a.newTask)
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
		} else if a.syncing || a.localWrites.running || a.anyPending() || a.busy {
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
		ui.Box(c).Size(6, 6).Radius(3).Background(dotColor).Shrink(0).AccessHidden(true).Transition(motionColorsFast())
		ui.Box(c.Key("sync-status-wrap")).Grow(1).MinWidth(0).Clip().Children(func() {
			ui.Text(c.Key(status), status).FontSize(11).TextColor(color).SingleLine().Tooltip(status).Transition(motionTextSwap())
		})
		if pending > 0 {
			ui.ButtonBase(c).Label(fmt.Sprintf("%d 项待同步", pending)).Tooltip("查看待同步修改").Padding(2, 6).Radius(8).Background(t.BgSubtle).OnClick(func() { a.changePage("sync") }).Children(func() {
				ui.Text(c, fmt.Sprint(pending)).FontSize(11).FontFeatures("tnum").TextColor(color)
			})
		}
		iconButton(c, "刷新", lucide.RefreshCw()).Tooltip("刷新 "+shortcutHint("R")).Size(24, 24).Padding(4).Disabled(a.syncing).OnClick(a.refreshCurrentPage)
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
		case "processed":
			if task.Status != "completed" && task.Status != "cancelled" && task.Status != "skipped" {
				continue
			}
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

func (a *App) detailPanelKey() string {
	if a.editing {
		if a.draft.Task.ID == 0 {
			return "detail-new"
		}
		return fmt.Sprintf("detail-task-%d", a.draft.Task.ID)
	}
	if a.selectedOccurrence != nil {
		return "detail-occ-" + taskRowKey(*a.selectedOccurrence)
	}
	return "detail-empty"
}

func (a *App) emptyDetailOverview(c *ui.Context) {
	t := tokensOf(c)
	now := time.Now().In(a.location())
	todayStart := dayStart(now)
	todayCount := a.pageCount("today")
	processedCount := a.pageCount("processed")
	overdueCount := 0
	for _, task := range a.cachedProjectedTasks(now) {
		if task.Status == "pending" {
			if d := taskPrimaryTime(task); d != nil && d.Before(todayStart) {
				overdueCount++
			}
		}
	}

	ui.Box(c.Key("empty-detail-titlebar")).FillWidth().Height(emptyDetailTitleBarHeight(c.TitleBar())).Shrink(0).DragWindow()
	ui.Scroll(c.Key("empty-detail-scroll")).Grow(1).MinHeight(0).Padding(24).ScrollbarInsets(16, 2, 20, 0).Children(func() {
		ui.Column(c).FillWidth().MaxWidth(480).AlignSelf(ui.Center).Gap(20).Children(func() {
			// Today Overview Card
			ui.Column(c.Key("empty-today-overview")).Padding(20).Gap(14).Radius(12).
				Background(t.BgList).Border(1, t.BorderSubtle).Children(func() {
				wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[now.Weekday()]
				dateLine := now.Format("1月2日 ") + wk
				if lunar, ok := solarToLunar(now); ok {
					dateLine += " · " + lunar.FullLabel()
				}
				ui.Row(c).AlignItems(ui.Center).Gap(8).Children(func() {
					ui.Column(c).Grow(1).Gap(2).Children(func() {
						ui.Text(c, "今日概览").FontSize(16).FontWeight(600).TextColor(t.TextPrimary)
						ui.Text(c, dateLine).FontSize(12).TextColor(t.TextSecondary)
					})
					primaryButton(c, "新建任务").Tooltip("新建任务 "+shortcutHint("N")).OnClick(a.newTask)
				})

				ui.Row(c).Gap(10).Children(func() {
					statCard := func(label string, count int, col ui.Color, targetPage string) {
						card := ui.ButtonBase(c.Key("stat-"+label)).Label(label).Grow(1).Basis(0).Padding(10, 12).Radius(8).
							Background(t.BgApp).Border(1, t.BorderSubtle).Justify(ui.Start).Cursor(ui.CursorPointer).
							Transition(motionColorsFast()).
							OnClick(func() { a.changePage(targetPage) })
						if card.Hovered() {
							card.Background(t.BgHover).BorderColor(t.BorderDefault)
						}
						card.Children(func() {
							ui.Column(c).Gap(2).Children(func() {
								ui.Text(c, fmt.Sprint(count)).FontSize(20).FontWeight(600).FontFeatures("tnum").TextColor(col)
								ui.Text(c, label).FontSize(11.5).TextColor(t.TextSecondary)
							})
						})
					}
					statCard("今日待办", todayCount, t.Accent, "today")
					overdueCol := t.TextPrimary
					if overdueCount > 0 {
						overdueCol = t.Danger
					}
					statCard("已逾期", overdueCount, overdueCol, "today")
					statCard("已处理", processedCount, t.Success, "processed")
				})
			})

			// Keyboard Shortcuts Quick Reference
			ui.Column(c.Key("empty-shortcuts-card")).Padding(18, 20).Gap(10).Radius(12).
				Background(t.BgApp).Border(1, t.BorderSubtle).Children(func() {
				ui.Text(c, "快捷键速查").FontSize(13).FontWeight(600).TextColor(t.TextSecondary)
				shortcuts := []struct{ label, keys string }{
					{"命令面板", shortcutHint("K")},
					{"新建任务", shortcutHint("N")},
					{"搜索任务", shortcutHint("F")},
					{"刷新同步", shortcutHint("R")},
					{"列表浏览", "↑ / ↓"},
					{"打开详情", "Enter"},
					{"调整排序", "Alt + ↑ / ↓"},
					{"保存修改", shortcutHint("S")},
				}
				ui.Grid(c).Columns(2).Gap(8).FillWidth().Children(func() {
					for _, sc := range shortcuts {
						ui.Row(c.Key("sc-"+sc.label)).AlignItems(ui.Center).Gap(8).Padding(3, 0).Children(func() {
							ui.Text(c, sc.label).FontSize(12).TextColor(t.TextSecondary).Grow(1)
							ui.Text(c, sc.keys).FontSize(11).FontWeight(500).TextColor(t.TextPrimary).
								Padding(2, 6).Radius(4).Background(t.BgSubtle)
						})
					}
				})
			})
		})
	})
}

func (a *App) taskDetailPanel(c *ui.Context, compact bool) {
	ui.Box(c.Key("detail-stage")).Fill().MinHeight(0).MinWidth(0).Background(tokensOf(c).BgApp).Clip().Children(func() {
		ui.Column(c.Key(a.detailPanelKey())).Absolute().Fill().MinHeight(0).MinWidth(0).
			Background(tokensOf(c).BgApp).
			Transition(motionDetailSwitch()).
			Children(func() {
				if a.editing {
					a.taskEditorContent(c, compact)
				} else if a.selectedOccurrence != nil {
					a.occurrenceContent(c, compact)
				} else {
					a.emptyDetailOverview(c)
				}
			})
	})
}

func (a *App) taskListPane(c *ui.Context) {
	now := time.Now().In(a.location())
	if a.highlightPending != nil {
		if !c.Now().Before(a.highlightOpenAt) {
			pending := *a.highlightPending
			a.highlightPending = nil
			a.openTask(pending)
		} else {
			c.After(a.highlightOpenAt.Sub(c.Now()))
		}
	}

	a.header(c)
	if !a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) && a.taskDraftDirty() {
		appButton(c, "继续编辑未保存任务", "ghost").Margin(4, 12).TextColor(tokensOf(c).Accent).OnClick(a.resumeTaskDraft)
	}
	if isHistoryPage(a.page) {
		a.historyToolbar(c, now)
	} else {
		a.quickAddBar(c)
	}

	if a.syncing && a.syncedAt.IsZero() && len(a.tasks) == 0 && len(a.history.Items) == 0 {
		a.taskListSkeleton(c)
		return
	}

	tasks := a.cachedTaskList(a.page, a.query, now)
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
	var listContainer ui.Element
	var scrollTaskIntoView func(idx int)

	if isHistoryPage(a.page) {
		displayRows, taskToRow := a.cachedGroupedHistoryRows(tasks, a.historyFilter.Basis, now)
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
		t := tokensOf(c)
		if rowCount <= 250 {
			listContainer = ui.Scroll(c.Key("task-list-scroll")).TrackScroll(&a.taskListScroll).Label("任务列表").Grow(1).MinHeight(0).ScrollbarInsets(14, 2, 16, 0)
			listContainer.Children(func() {
				ui.Column(c.Key("task-list-rows")).Padding(4, 8).Gap(3).FillWidth().Children(func() {
					for i := 0; i < rowCount; i++ {
						if hasMoreRow && i == len(displayRows) {
							a.historyMoreButton(c)
							continue
						}
						item := displayRows[i]
						if item.isHeader {
							topPad := float32(8)
							if i == 0 {
								topPad = 2
							}
							ui.Row(c.Key(item.headerKey)).FillWidth().Padding(topPad, 10, 2, 10).AlignItems(ui.Center).Children(func() {
								ui.Text(c, item.title).FontSize(11.5).FontWeight(fontWeightSemibold).TextColor(t.TextSecondary).Grow(1)
								ui.Text(c, fmt.Sprint(item.count)).FontSize(fontAux).FontFeatures("tnum").TextColor(t.TextTertiary)
							})
							continue
						}
						wrap := ui.Box(c.Key(a.stableTaskKey(item.task))).FillWidth().Transition(motionRowLifecycle())
						if a.highlightedTaskKey == taskRowKey(item.task) {
							wrap.ScrollIntoView()
						}
						wrap.Children(func() {
							rowControlOwnsKeys = a.taskListItem(c, item.task, now) || rowControlOwnsKeys
						})
					}
				})
			})
			scrollTaskIntoView = func(idx int) {}
		} else {
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
			listContainer = ui.List(c, &a.list, rowCount, func(i int) {
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
		}
	} else {
		if len(tasks) <= 250 {
			revealID := a.revealTaskID
			a.revealTaskID = 0
			listContainer = ui.Scroll(c.Key("task-list-scroll")).TrackScroll(&a.taskListScroll).Label("任务列表").Grow(1).MinHeight(0).ScrollbarInsets(14, 2, 16, 0)
			listContainer.Children(func() {
				ui.Column(c.Key("task-list-rows")).Padding(4, 8).Gap(3).FillWidth().Children(func() {
					for i := range tasks {
						task := tasks[i]
						wrap := ui.Box(c.Key(a.stableTaskKey(task))).FillWidth().Transition(motionRowLifecycle())
						if (revealID != 0 && task.ID == revealID) || a.highlightedTaskKey == taskRowKey(task) {
							wrap.ScrollIntoView()
						}
						wrap.Children(func() {
							rowControlOwnsKeys = a.taskListItem(c, task, now) || rowControlOwnsKeys
						})
					}
				})
			})
			scrollTaskIntoView = func(idx int) {}
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
			listContainer = ui.List(c, &a.list, len(tasks), func(i int) {
				rowControlOwnsKeys = a.taskListItem(c, tasks[i], now) || rowControlOwnsKeys
			}).Label("任务列表").Padding(4, 8).Gap(3).Grow(1).MinHeight(0)
			scrollTaskIntoView = func(idx int) { a.list.ScrollIntoView(idx) }
		}
	}

	currentIndex := func() int {
		if a.highlightedTaskKey != "" {
			for i, task := range tasks {
				if taskRowKey(task) == a.highlightedTaskKey {
					return i
				}
			}
		}
		for i, task := range tasks {
			if a.taskRowSelected(task) {
				return i
			}
		}
		return -1
	}

	move := func(direction int) {
		index := currentIndex()
		index = min(max(0, index+direction), len(tasks)-1)
		nextTask := tasks[index]
		a.highlightedTaskKey = taskRowKey(nextTask)
		a.highlightPending = &nextTask
		a.highlightOpenAt = c.Now().Add(80 * time.Millisecond)
		c.After(80 * time.Millisecond)
		scrollTaskIntoView(index)
	}

	if !rowControlOwnsKeys {
		listContainer.
			OnShortcut(0, ui.KeyDown, func() { move(1) }).
			OnShortcut(0, ui.KeyUp, func() { move(-1) }).
			OnShortcut(ui.Alt, ui.KeyDown, func() {
				idx := max(0, currentIndex())
				if idx < len(tasks) {
					a.reorderTaskByDelta(a.page, tasks, a.stableTaskKey(tasks[idx]), 1)
				}
			}).
			OnShortcut(ui.Alt, ui.KeyUp, func() {
				idx := max(0, currentIndex())
				if idx < len(tasks) {
					a.reorderTaskByDelta(a.page, tasks, a.stableTaskKey(tasks[idx]), -1)
				}
			}).
			OnShortcut(0, ui.KeyEnter, func() {
				a.highlightPending = nil
				idx := currentIndex()
				if idx >= 0 && idx < len(tasks) {
					a.openTask(tasks[idx])
					return
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
	if isHistoryPage(a.page) && a.history.HasMore {
		t := tokensOf(c)
		loading := a.isPending("history.more") || a.busy
		label := "加载更多重复任务历史"
		if a.isPending("history.more") {
			label = "正在加载…"
		}
		ui.Row(c).FillWidth().Padding(8, 12, 12, 12).Justify(ui.Center).Children(func() {
			more := ui.ButtonBase(c.Key("history-more")).Label("加载更多重复任务历史").
				Height(28).Padding(0, 12).Radius(7).Center().Cursor(ui.CursorPointer).
				Background(ui.Transparent).Border(1, t.BorderSubtle).Disabled(loading).
				Transition(motionColorsFast()).OnClick(a.loadMoreHistory)
			fg := t.TextSecondary
			if more.Hovered() {
				more.Background(t.BgHover).BorderColor(t.BorderDefault)
				fg = t.TextPrimary
			}
			more.Children(func() {
				ui.Text(c, label).FontSize(11.5).FontWeight(fontWeightRegular).TextColor(fg)
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
