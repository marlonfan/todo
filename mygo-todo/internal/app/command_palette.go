package app

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

type commandPaletteState struct {
	Open  bool
	Query string
	Index int
	Input ui.Handle
}

type paletteCommand struct {
	Key      string
	Group    string
	Title    string
	Subtitle string
	Shortcut string
	Icon     *ui.SVG
	Run      func()
}

func (a *App) openCommandPalette() {
	if a.client == nil || a.aiPanel != nil {
		return
	}
	a.palette.Open = true
	a.palette.Query = ""
	a.palette.Index = 0
	a.palette.Input.Focus()
}

func (a *App) commandPaletteItems(now time.Time) []paletteCommand {
	var cmds []paletteCommand

	// 1. Current task contextual actions
	if a.editing && a.draft.Task.ID != 0 && !a.draft.Task.ReadOnly {
		task := a.draft.Task
		statusLabel := "标记当前任务完成"
		nextStatus := "completed"
		if task.Status == "completed" {
			statusLabel = "恢复当前任务待办"
			nextStatus = "pending"
		}
		cmds = append(cmds,
			paletteCommand{
				Key: "cur-status", Group: "当前任务", Title: statusLabel, Subtitle: task.Title,
				Icon: lucide.CircleCheck(), Run: func() { a.setTaskStatus(task, nextStatus) },
			},
			paletteCommand{
				Key: "cur-prio-high", Group: "当前任务", Title: "设为高优先级", Subtitle: task.Title,
				Icon: lucide.Flag(), Run: func() { a.draft.Priority = "高"; a.flushDetailAutosave() },
			},
			paletteCommand{
				Key: "cur-prio-normal", Group: "当前任务", Title: "设为普通优先级", Subtitle: task.Title,
				Icon: lucide.Flag(), Run: func() { a.draft.Priority = "普通"; a.flushDetailAutosave() },
			},
			paletteCommand{
				Key: "cur-today", Group: "当前任务", Title: "安排到今天", Subtitle: task.Title,
				Icon: lucide.CalendarCheck(), Run: func() {
					a.draft.HasStart = true
					a.draft.Start = atClock(now, a.session.User.DefaultTaskStartTime)
					syncDraftEndAfterStart(&a.draft)
					a.flushDetailAutosave()
				},
			},
			paletteCommand{
				Key: "cur-tomorrow", Group: "当前任务", Title: "安排到明天", Subtitle: task.Title,
				Icon: lucide.CalendarDays(), Run: func() {
					a.draft.HasStart = true
					a.draft.Start = atClock(now.AddDate(0, 0, 1), a.session.User.DefaultTaskStartTime)
					syncDraftEndAfterStart(&a.draft)
					a.flushDetailAutosave()
				},
			},
			paletteCommand{
				Key: "cur-delete", Group: "当前任务", Title: "删除当前任务", Subtitle: task.Title,
				Icon: lucide.Trash2(), Run: func() { a.deleteTaskWithUndo(task) },
			},
		)
	}

	// 2. Quick Actions
	cmds = append(cmds,
		paletteCommand{
			Key: "act-new", Group: "快捷操作", Title: "新建任务", Shortcut: shortcutHint("N"),
			Icon: lucide.Plus(), Run: a.beginQuickAdd,
		},
		paletteCommand{
			Key: "act-search", Group: "快捷操作", Title: "搜索任务", Shortcut: shortcutHint("F"),
			Icon: lucide.Search(), Run: a.openTaskSearch,
		},
		paletteCommand{
			Key: "act-refresh", Group: "快捷操作", Title: "立即同步刷新", Shortcut: shortcutHint("R"),
			Icon: lucide.RefreshCw(), Run: a.refreshCurrentPage,
		},
		paletteCommand{
			Key: "act-new-cat", Group: "快捷操作", Title: "新建分类",
			Icon: lucide.FolderPlus(), Run: func() { a.editCategory(api.Category{}) },
		},
		paletteCommand{
			Key: "act-manage-cat", Group: "快捷操作", Title: "管理分类",
			Icon: lucide.Folders(), Run: func() { a.changePage("categories") },
		},
	)
	if a.hasManualOrder(a.page) {
		page := a.page
		cmds = append(cmds, paletteCommand{
			Key: "act-reset-order", Group: "快捷操作", Title: "恢复默认排序", Subtitle: a.title(),
			Icon: lucide.RotateCcw(), Run: func() { a.resetManualOrder(page) },
		})
	}
	if a.page == "calendar" {
		for idx, modeName := range calendarModes {
			modeIdx := idx
			cmds = append(cmds, paletteCommand{
				Key: fmt.Sprintf("cal-mode-%d", idx), Group: "日历视图", Title: "切换为" + modeName + "视图",
				Icon: lucide.Calendar(), Run: func() { a.setCalendarMode(modeIdx) },
			})
		}
	}
	for _, themeName := range []string{"跟随系统", "浅色", "深色"} {
		tn := themeName
		cmds = append(cmds, paletteCommand{
			Key: "theme-" + tn, Group: "外观主题", Title: "切换外观：" + tn,
			Icon: lucide.SunMoon(), Run: func() { a.setTheme(tn) },
		})
	}

	// 3. Navigation Pages & Categories
	navPages := []struct{ id, title string }{
		{"all", "全部任务"}, {"inbox", "收件箱"}, {"today", "今天"}, {"upcoming", "即将到来"},
		{"processed", "已处理"}, {"calendar", "日历"}, {"sync", "同步"}, {"caldav", "CalDAV"},
		{"notify", "通知渠道"}, {"ai", "AI 与提示词"}, {"settings", "设置"},
	}
	for _, np := range navPages {
		pid := np.id
		cmds = append(cmds, paletteCommand{
			Key: "nav-" + pid, Group: "前往页面", Title: np.title,
			Icon: taskPageIcon(pid), Run: func() { a.changePage(pid) },
		})
	}
	for _, cat := range a.categories {
		cid := "category:" + strconv.FormatInt(cat.ID, 10)
		label := strings.TrimSpace(cat.Emoji + " " + cat.Name)
		cmds = append(cmds, paletteCommand{
			Key: "nav-" + cid, Group: "前往清单", Title: label,
			Icon: lucide.Folder(), Run: func() { a.changePage(cid) },
		})
	}

	// Filter commands by query
	q := strings.ToLower(strings.TrimSpace(a.palette.Query))
	var filtered []paletteCommand
	for _, cmd := range cmds {
		if q == "" ||
			strings.Contains(strings.ToLower(cmd.Title), q) ||
			strings.Contains(strings.ToLower(cmd.Subtitle), q) ||
			strings.Contains(strings.ToLower(cmd.Group), q) {
			filtered = append(filtered, cmd)
		}
	}

	// 4. Matching tasks when query is non-empty
	if q != "" {
		projected := a.cachedProjectedTasks(now)
		matched := 0
		for _, task := range projected {
			if strings.Contains(strings.ToLower(task.Title+" "+task.Description), q) {
				tCopy := task
				sub := "待办"
				if tCopy.Status == "completed" {
					sub = "已完成"
				} else if tCopy.Status == "cancelled" {
					sub = "已取消"
				} else if tCopy.Status == "skipped" {
					sub = "已跳过"
				}
				filtered = append(filtered, paletteCommand{
					Key:      "task-" + a.stableTaskKey(tCopy),
					Group:    "打开任务",
					Title:    tCopy.Title,
					Subtitle: sub,
					Icon:     lucide.FileText(),
					Run:      func() { a.openTask(tCopy) },
				})
				matched++
				if matched >= 8 {
					break
				}
			}
		}
	}
	return filtered
}

func (a *App) commandPaletteView(c *ui.Context) {
	t := tokensOf(c)
	appDialog(c.Key("command-palette-dialog"), &a.palette.Open, func() {
		now := time.Now().In(a.location())
		items := a.commandPaletteItems(now)
		if a.palette.Index >= len(items) {
			a.palette.Index = max(0, len(items)-1)
		}
		runSelected := func() {
			if len(items) == 0 || a.palette.Index < 0 || a.palette.Index >= len(items) {
				return
			}
			chosen := items[a.palette.Index]
			a.palette.Open = false
			if chosen.Run != nil {
				chosen.Run()
			}
		}

		ui.Column(c.Key("command-palette-root")).Gap(10).
			OnShortcut(0, ui.KeyDown, func() {
				if len(items) > 0 {
					a.palette.Index = (a.palette.Index + 1) % len(items)
				}
			}).
			OnShortcut(0, ui.KeyUp, func() {
				if len(items) > 0 {
					a.palette.Index = (a.palette.Index + len(items) - 1) % len(items)
				}
			}).
			OnShortcut(0, ui.KeyEscape, func() { a.palette.Open = false }).
			Children(func() {
				ui.Row(c).Gap(10).Padding(2, 0).AlignItems(ui.Center).Children(func() {
					ui.Icon(c, lucide.Command()).Size(17, 17).TextColor(t.Accent).AccessHidden(true)
					ui.TextInputBase(c.Key("palette-query"), &a.palette.Query).Ref(&a.palette.Input).
						Label("命令面板").Placeholder("输入命令、页面、任务属性或搜索任务…").
						PlaceholderColor(t.TextReadable).FontSize(15).Grow(1).MinWidth(0).
						AutoFocus().OnChange(func() { a.palette.Index = 0 }).OnSubmit(runSelected)
					if a.palette.Query != "" {
						iconButton(c, "清除命令搜索", lucide.CircleX()).Size(26, 26).Padding(5).OnClick(func() {
							a.palette.Query = ""
							a.palette.Index = 0
							a.palette.Input.Focus()
						})
					}
					appActionButton(c, "关闭", action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { a.palette.Open = false })
				})
				ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)

				_, winH := c.Size()
				listH := min(float32(360), max(120, winH-260))
				ui.Scroll(c.Key("palette-results")).Label("命令列表").Height(listH).MinHeight(0).Gap(2).Children(func() {
					if len(items) == 0 {
						ui.Column(c).Padding(20, 0).Gap(4).AlignItems(ui.Center).FillWidth().Children(func() {
							ui.Text(c, "没有匹配的命令").FontSize(14).FontWeight(600).TextColor(t.TextPrimary)
							ui.Text(c, "试试输入“新建”“日历”“高优先级”或任务名称。").FontSize(12).TextColor(t.TextSecondary)
						})
					}
					lastGroup := ""
					for i, item := range items {
						if item.Group != lastGroup {
							lastGroup = item.Group
							ui.Text(c, item.Group).FontSize(11).FontWeight(600).TextColor(t.TextTertiary).Padding(6, 8, 2, 8)
						}
						selected := i == a.palette.Index
						idx := i
						row := ui.ButtonBase(c.Key(item.Key)).Label(item.Title).Height(36).FillWidth().MinWidth(0).
							Padding(0, 10).Radius(7).Justify(ui.Start).Cursor(ui.CursorPointer).
							Transition(motionColorsFast()).
							OnClick(func() {
								a.palette.Index = idx
								runSelected()
							})
						if selected {
							row.Background(t.BgSelected).ScrollIntoView()
						} else if row.Hovered() {
							row.Background(t.BgHover)
						}
						row.Children(func() {
							ui.Row(c).FillWidth().MinWidth(0).Gap(10).AlignItems(ui.Center).Children(func() {
								iconCol := t.TextSecondary
								if selected {
									iconCol = t.Accent
								}
								if item.Icon != nil {
									ui.Icon(c, item.Icon).Size(15, 15).TextColor(iconCol).Shrink(0).AccessHidden(true)
								}
								ui.Text(c, item.Title).FontSize(13).FontWeight(500).TextColor(t.TextPrimary).SingleLine().MinWidth(0)
								if item.Subtitle != "" {
									ui.Text(c, item.Subtitle).FontSize(11.5).TextColor(t.TextTertiary).SingleLine().Grow(1).MinWidth(0)
								} else {
									ui.Spacer(c)
								}
								if item.Shortcut != "" {
									ui.Text(c, item.Shortcut).FontSize(11).FontWeight(500).TextColor(t.TextSecondary).
										Padding(2, 6).Radius(4).Background(t.BgSubtle).Shrink(0)
								}
							})
						})
					}
				})
				ui.Text(c, "↑ ↓ 选择 · Enter 执行 · Esc 关闭").FontSize(11).TextColor(t.TextTertiary)
			})
	}).Width(560).Padding(18)
}
