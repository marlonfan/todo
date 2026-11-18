package app

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"todo-native/internal/api"
)

func trayPNG() []byte {
	img := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	for y := 5; y < 27; y++ {
		for x := 5; x < 27; x++ {
			if x < 7 || x > 24 || y < 7 || y > 24 {
				img.Set(x, y, color.Black)
			}
		}
	}
	for n := 0; n < 10; n++ {
		for w := 0; w < 3; w++ {
			img.Set(12+n, 21-n+w, color.Black)
		}
	}
	for n := 0; n < 6; n++ {
		for w := 0; w < 3; w++ {
			img.Set(7+n, 16+n+w, color.Black)
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

var trayTitleModes = []struct {
	id, label string
}{
	{"next", "下一项任务"},
	{"count", "今日数量"},
	{"icon", "仅图标"},
}

func normalizeTrayTitleMode(mode string) string {
	switch mode {
	case "count", "icon", "next":
		return mode
	case "仅显示图标", "仅图标":
		return "icon"
	case "今日数量", "仅显示今日数量":
		return "count"
	default:
		return "next"
	}
}

func trayTitleModeLabel(mode string) string {
	switch normalizeTrayTitleMode(mode) {
	case "count":
		return "今日数量"
	case "icon":
		return "仅图标"
	default:
		return "下一项任务"
	}
}

func (a *App) setTrayTitleMode(labelOrMode string) {
	mode := normalizeTrayTitleMode(labelOrMode)
	a.trayTitleMode = mode
	if a.preferencesError == "" {
		prefs := a.preferences
		prefs.TrayTitleMode = mode
		if err := a.store.SavePreferences(prefs); err != nil {
			a.failure = "无法保存菜单栏偏好：" + err.Error()
		} else {
			a.preferences = prefs
		}
	}
	a.updateTray()
}

func (a *App) cycleTrayTitleMode() {
	switch normalizeTrayTitleMode(a.trayTitleMode) {
	case "next":
		a.setTrayTitleMode("count")
	case "count":
		a.setTrayTitleMode("icon")
	default:
		a.setTrayTitleMode("next")
	}
}

func truncateRunes(s string, maxRunes int) string {
	s = strings.TrimSpace(s)
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	if maxRunes <= 1 {
		return string(runes[:maxRunes])
	}
	return string(runes[:maxRunes]) + "…"
}

// trayFocusTask picks the most relevant pending task for the macOS top menu bar:
// 1. Upcoming or currently active timed task today (start time >= now - 30m)
// 2. Earliest timed task today
// 3. First pending task in today's list (already sorted by priority & time)
func (a *App) trayFocusTask(todayTasks []api.Task, now time.Time) (api.Task, bool) {
	if len(todayTasks) == 0 {
		return api.Task{}, false
	}
	loc := a.location()
	var bestUpcoming *api.Task
	var earliestTimed *api.Task
	cutoff := now.Add(-30 * time.Minute)
	for i := range todayTasks {
		t := &todayTasks[i]
		pt := taskPrimaryTime(*t)
		if pt == nil || t.AllDay {
			continue
		}
		st := pt.In(loc)
		if earliestTimed == nil || st.Before(*taskPrimaryTime(*earliestTimed)) {
			earliestTimed = t
		}
		if !st.Before(cutoff) {
			if bestUpcoming == nil || st.Before(*taskPrimaryTime(*bestUpcoming)) {
				bestUpcoming = t
			}
		}
	}
	if bestUpcoming != nil {
		return *bestUpcoming, true
	}
	if earliestTimed != nil {
		return *earliestTimed, true
	}
	return todayTasks[0], true
}

func (a *App) trayStatusTitle(now time.Time) string {
	if a.client == nil {
		return ""
	}
	mode := normalizeTrayTitleMode(a.trayTitleMode)
	if mode == "icon" {
		return ""
	}
	projected := projectTasks(a.tasks, a.nextOccurrences, a.history.Items)
	todayTasks := a.interactionTasks(projected, "today", "", now)
	if mode == "count" {
		if len(todayTasks) == 0 {
			return ""
		}
		return fmt.Sprintf(" 今日 %d", len(todayTasks))
	}
	if focus, ok := a.trayFocusTask(todayTasks, now); ok {
		title := truncateRunes(focus.Title, 11)
		prefix := title
		if pt := taskPrimaryTime(focus); pt != nil && !focus.AllDay {
			prefix = pt.In(a.location()).Format("15:04") + " " + title
		}
		if len(todayTasks) > 1 {
			return fmt.Sprintf(" %s ·%d", prefix, len(todayTasks))
		}
		return " " + prefix
	}
	allTasks := a.interactionTasks(projected, "all", "", now)
	if len(allTasks) > 0 {
		return fmt.Sprintf(" 待办 %d", len(allTasks))
	}
	return ""
}

func (a *App) trayToolTip(now time.Time) string {
	if a.client == nil {
		return "Todo Native · 未登录"
	}
	projected := projectTasks(a.tasks, a.nextOccurrences, a.history.Items)
	todayTasks := a.interactionTasks(projected, "today", "", now)
	allTasks := a.interactionTasks(projected, "all", "", now)
	if focus, ok := a.trayFocusTask(todayTasks, now); ok {
		return fmt.Sprintf("Todo · 今日 %d 项待办（下一项：%s）", len(todayTasks), focus.Title)
	}
	return fmt.Sprintf("Todo · 今日 0 项 · 全部 %d 项待办", len(allTasks))
}

func (a *App) updateTray() {
	now := time.Now().In(a.location())
	if a.tray != nil {
		a.tray.SetTitle(a.trayStatusTitle(now))
		a.tray.SetToolTip(a.trayToolTip(now))
	}
	if a.trayFlyout != nil && !a.trayFlyout.IsDestroyed() {
		a.trayFlyout.Invalidate()
	}
}

func (a *App) toggleTrayFlyout() {
	if a.tray == nil {
		return
	}
	if a.trayFlyout != nil && !a.trayFlyout.IsDestroyed() {
		a.trayFlyout.Close()
		a.trayFlyout = nil
		return
	}
	if a.trayTab == "" {
		a.trayTab = "today"
	}
	fl := mygo.NewFlyout(mygo.FlyoutOptions{
		Tray:         a.tray,
		Placement:    mygo.PlacementBottom,
		Gap:          6,
		Width:        360,
		Height:       460,
		Focusable:    true,
		CornerRadius: 12,
		Content:      ui.View(a.trayFlyoutView),
	})
	a.trayFlyout = fl
	fl.OnClose(func(*mygo.CloseEvent) {
		if a.trayFlyout == fl {
			a.trayFlyout = nil
		}
	})
}

func (a *App) closeTrayFlyout() {
	if a.trayFlyout != nil && !a.trayFlyout.IsDestroyed() {
		fl := a.trayFlyout
		a.trayFlyout = nil
		fl.Close()
	}
}

func (a *App) submitTrayQuickTask() {
	if a.client == nil || a.busy {
		return
	}
	title := strings.TrimSpace(a.trayQuickTitle)
	if title == "" {
		return
	}
	now := time.Now().In(a.location())
	d := draftFrom(api.Task{}, atClock(now, a.session.User.DefaultTaskStartTime))
	d.Title = title
	if a.trayTab == "today" || a.trayTab == "" {
		d.HasStart = true
		d.Start = atClock(now, a.session.User.DefaultTaskStartTime)
		d.End = d.Start.Add(time.Hour)
	}
	a.applySmartTitleToDraft(&d)
	body, err := d.payload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.queueTask("POST", "/tasks", body, 0, func() {
		a.trayQuickTitle = ""
		a.updateTray()
		if a.win != nil && !a.win.IsDestroyed() {
			a.win.Invalidate()
		}
	})
}

func (a *App) openTaskFromTray(task api.Task) {
	a.closeTrayFlyout()
	a.Show()
	if !isTaskWorkspacePage(a.page) {
		if a.trayTab == "today" || a.trayTab == "upcoming" {
			a.page = a.trayTab
		} else {
			a.page = "all"
		}
	}
	a.openTask(task)
	if a.win != nil && !a.win.IsDestroyed() {
		a.win.Invalidate()
	}
}

func (a *App) trayFlyoutView(c *ui.Context) {
	applyAppTheme(c)
	t := tokensOf(c)
	now := time.Now().In(a.location())
	if a.trayTab == "" {
		a.trayTab = "today"
	}

	root := ui.Column(c.Key("tray-flyout-root")).Label("顶部状态栏任务面板").Fill().Padding(12, 14).Gap(10).Radius(12).
		Background(t.BgApp).Border(1, t.BorderDefault)

	root.Children(func() {
		if a.client == nil {
			ui.Column(c).Grow(1).Center().Gap(10).Padding(20).Children(func() {
				ui.Text(c, "Todo 菜单栏速览").FontSize(15).FontWeight(600).TextColor(t.TextPrimary)
				ui.Text(c, "请先在主窗口登录账户，即可在 macOS 顶部实时查看并完成今日待办。").FontSize(12).TextColor(t.TextSecondary).TextAlign(ui.Center)
				appButton(c, "打开主窗口", "primary").Height(30).OnClick(func() {
					a.closeTrayFlyout()
					a.Show()
				})
			})
			return
		}

		projected := projectTasks(a.tasks, a.nextOccurrences, a.history.Items)
		todayTasks := a.interactionTasks(projected, "today", "", now)
		upcomingTasks := a.interactionTasks(projected, "upcoming", "", now)
		allTasks := a.interactionTasks(projected, "all", "", now)

		// 1. Header: Date + Lunar + Quick Actions
		ui.Row(c.Key("tray-header")).AlignItems(ui.Center).Gap(8).Children(func() {
			ui.Column(c).Grow(1).MinWidth(0).Gap(2).Children(func() {
				ui.Row(c).Gap(6).AlignItems(ui.Center).Children(func() {
					ui.Text(c, "今日焦点").FontSize(14.5).FontWeight(600).TextColor(t.TextPrimary)
					badgeBg := t.BgSubtle
					badgeFg := t.TextSecondary
					if len(todayTasks) > 0 {
						badgeBg = t.Accent.Alpha(0.14)
						badgeFg = t.Accent
					}
					ui.Box(c).Padding(1, 7).Radius(9).Background(badgeBg).Children(func() {
						ui.Text(c, fmt.Sprintf("%d 项", len(todayTasks))).FontSize(11).FontWeight(600).FontFeatures("tnum").TextColor(badgeFg)
					})
				})
				dateLine := fmt.Sprintf("%s %s", now.Format("1月2日"), weekdays[int(now.Weekday())])
				if l, ok := solarToLunar(now); ok {
					dateLine += " · " + l.FullLabel()
				}
				ui.Text(c, dateLine).FontSize(11).TextColor(t.TextSecondary).SingleLine()
			})

			iconButton(c, "刷新菜单栏任务", lucide.RefreshCw()).Size(28, 28).Padding(6).Disabled(a.busy || a.syncing).OnClick(a.refresh)
			iconButton(c, "打开 Todo 主窗口", lucide.Maximize2()).Size(28, 28).Padding(6).OnClick(func() {
				a.closeTrayFlyout()
				a.Show()
			})
		})

		// 2. Quick Capture Input Bar (with smart natural-language date & priority preview)
		quickRow := ui.Row(c.Key("tray-quick-add")).Label("菜单栏快捷添加区").Height(38).Padding(0, 8).Gap(6).Radius(8).
			AlignItems(ui.Center).Background(t.BgSubtle).Border(1, t.BorderDefault)
		quickRow.Children(func() {
			ui.Icon(c, lucide.Plus()).Size(14, 14).TextColor(t.Accent).Shrink(0).AccessHidden(true)
			ui.TextInputBase(c.Key("tray-quick-input"), &a.trayQuickTitle).Ref(&a.trayQuickInput).
				Label("菜单栏快捷添加").Placeholder("添加任务… (支持 明天9点 / !!高优)").PlaceholderColor(t.TextReadable).
				FontSize(12.5).Grow(1).MinWidth(0).MinHeight(26).Disabled(a.busy).OnSubmit(a.submitTrayQuickTask)
			smart := a.previewSmartInput(a.trayQuickTitle)
			if smart.HasTime || smart.HasPriority {
				ui.Box(c).Padding(2, 6).Radius(5).Background(t.Accent.Alpha(0.12)).Shrink(0).Children(func() {
					ui.Text(c, smartSummaryText(smart)).FontSize(10.5).FontWeight(500).TextColor(t.Accent).SingleLine()
				})
			}
			hasTitle := strings.TrimSpace(a.trayQuickTitle) != ""
			addBtn := ui.ButtonBase(c.Key("tray-quick-submit")).Label("菜单栏添加任务").Tooltip("创建任务 (Enter)").Size(24, 24).Radius(6).Center().
				Cursor(ui.CursorPointer).Disabled(a.busy || !hasTitle).OnClick(a.submitTrayQuickTask)
			if hasTitle {
				addBtn.Background(t.Accent)
			} else {
				addBtn.Background(t.BgHover.Alpha(0.6))
			}
			addBtn.Children(func() {
				fg := t.TextTertiary
				if hasTitle {
					fg = t.TextOnAccent
				}
				ui.Icon(c, lucide.CornerDownLeft()).Size(12.5, 12.5).TextColor(fg).AccessHidden(true)
			})
		})

		// 3. Scope Tabs: [今日 | 最近7天 | 全部]
		ui.Row(c.Key("tray-tabs")).Height(28).Gap(4).AlignItems(ui.Center).Children(func() {
			for _, tab := range []struct {
				id, title string
				count     int
			}{
				{"today", "今日", len(todayTasks)},
				{"upcoming", "最近7天", len(upcomingTasks)},
				{"all", "全部", len(allTasks)},
			} {
				active := a.trayTab == tab.id
				tabID := tab.id
				btn := ui.ButtonBase(c.Key("tray-tab-"+tab.id)).Label("菜单栏切换"+tab.title).Height(26).Padding(0, 9).Radius(6).Center().Cursor(ui.CursorPointer).
					OnClick(func() { a.trayTab = tabID })
				fg := t.TextSecondary
				if active {
					btn.Background(t.BgSelected)
					fg = t.TextPrimary
				} else if btn.Hovered() {
					btn.Background(t.BgHover)
					fg = t.TextReadable
				}
				btn.Children(func() {
					ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
						txt := ui.Text(c, tab.title).FontSize(11.5).TextColor(fg)
						if active {
							txt.FontWeight(600)
						} else {
							txt.FontWeight(500)
						}
						ui.Text(c, fmt.Sprint(tab.count)).FontSize(10.5).FontFeatures("tnum").TextColor(t.TextTertiary)
					})
				})
			}
			ui.Spacer(c)
			modeBtn := ui.ButtonBase(c.Key("tray-title-mode")).Label("切换顶部状态栏显示模式").
				Tooltip("点击切换 macOS 顶部状态栏文字：下一项任务 / 今日数量 / 仅图标").
				Height(24).Padding(0, 7).Radius(5).Center().Cursor(ui.CursorPointer).Background(t.BgSubtle).
				OnClick(a.cycleTrayTitleMode)
			if modeBtn.Hovered() {
				modeBtn.Background(t.BgHover)
			}
			modeBtn.Children(func() {
				ui.Text(c, "顶部: "+trayTitleModeLabel(a.trayTitleMode)).FontSize(10.5).TextColor(t.TextSecondary).SingleLine()
			})
		})

		ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)

		// 4. Interactive Task List
		var visibleTasks []api.Task
		switch a.trayTab {
		case "upcoming":
			visibleTasks = upcomingTasks
		case "all":
			visibleTasks = allTasks
		default:
			visibleTasks = todayTasks
		}

		ui.Scroll(c.Key("tray-task-list")).Label("菜单栏任务列表").Grow(1).MinHeight(0).Gap(2).Children(func() {
			if len(visibleTasks) == 0 {
				ui.Column(c).Grow(1).Padding(36, 16).Center().Gap(6).Children(func() {
					emptyTitle := "今日待办已全部完成"
					emptySub := "在上方输入框可直接添加新任务。"
					if a.trayTab != "today" {
						emptyTitle = "当前列表暂无待办任务"
					}
					ui.Text(c, emptyTitle).FontSize(13).FontWeight(600).TextColor(t.TextPrimary)
					ui.Text(c, emptySub).FontSize(11.5).TextColor(t.TextSecondary)
				})
				return
			}
			for _, item := range visibleTasks {
				task := item
				row := ui.Row(c.Key("tray-row-"+a.stableTaskKey(task))).Label("菜单栏任务行 "+task.Title).
					Height(42).Padding(0, 6).Gap(6).Radius(7).AlignItems(ui.Center).
					BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle.Alpha(0.45))
				if row.Hovered() {
					row.Background(t.BgHover).BorderColor(ui.Transparent)
				}
				row.Children(func() {
					done := task.Status == "completed"
					ui.Checkbox(c.Key("tray-done-"+a.stableTaskKey(task)), &done, "").
						Size(26, 26).Justify(ui.Center).AlignItems(ui.Center).
						Label("菜单栏完成 " + task.Title).
						Disabled(task.ReadOnly || (task.Recurring() && task.InstanceID == "")).
						OnChange(func() {
							status := "pending"
							if done {
								status = "completed"
							}
							a.setTaskStatus(task, status)
							if a.win != nil && !a.win.IsDestroyed() {
								a.win.Invalidate()
							}
						})

					openBtn := ui.ButtonBase(c.Key("tray-open-"+a.stableTaskKey(task))).
						Label("菜单栏打开 "+task.Title).Tooltip("在主窗口中查看："+task.Title).
						Grow(1).FillHeight().MinWidth(0).Justify(ui.Start).Padding(0, 2).Cursor(ui.CursorPointer).
						OnClick(func() { a.openTaskFromTray(task) })
					openBtn.Children(func() {
						ui.Row(c).Grow(1).MinWidth(0).Gap(6).AlignItems(ui.Center).Children(func() {
							titleTxt := ui.Text(c, task.Title).FontSize(12.5).FontWeight(500).TextColor(t.TextPrimary).SingleLine().Grow(1).MinWidth(0)
							if done {
								titleTxt.Strikethrough().TextColor(t.TextSecondary)
							}
							if task.Priority > 0 {
								ui.Text(c, "!").FontSize(11).FontWeight(700).TextColor(t.Warning).Shrink(0)
							}
							if pt := taskPrimaryTime(task); pt != nil {
								st := pt.In(a.location())
								overdue := task.Status == "pending" && st.Before(dayStart(now))
								timeLabel := st.Format("15:04")
								if task.AllDay {
									if st.Before(dayStart(now)) || !dayStart(st).Equal(dayStart(now)) {
										timeLabel = st.Format("01/02")
									} else {
										timeLabel = "全天"
									}
								} else if !dayStart(st).Equal(dayStart(now)) {
									timeLabel = st.Format("01/02 15:04")
								}
								timeCol := t.TextSecondary
								if overdue {
									timeCol = t.Danger
								}
								ui.Text(c, timeLabel).FontSize(11).FontFeatures("tnum").TextColor(timeCol).Shrink(0)
							}
						})
					})
				})
			}
		})

		ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)

		// 5. Footer: Sync status + Open Main Window + Quit
		ui.Row(c.Key("tray-footer")).Height(28).AlignItems(ui.Center).Gap(8).Children(func() {
			dotColor := t.Success
			statusText := "已同步"
			if a.pendingChanges() > 0 {
				dotColor = t.Accent
				statusText = fmt.Sprintf("%d 项待同步", a.pendingChanges())
			} else if a.syncNeedsAttention() {
				dotColor = t.Warning
				statusText = "同步需关注"
			}
			ui.Box(c).Size(6, 6).Radius(3).Background(dotColor).Shrink(0).AccessHidden(true)
			ui.Text(c, statusText).FontSize(11).TextColor(t.TextSecondary).Grow(1).MinWidth(0).SingleLine()

			mainBtn := ui.ButtonBase(c.Key("tray-main-win")).Label("显示主窗口").Height(24).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer).
				OnClick(func() {
					a.closeTrayFlyout()
					a.Show()
				})
			if mainBtn.Hovered() {
				mainBtn.Background(t.BgHover)
			}
			mainBtn.Children(func() {
				ui.Text(c, "显示主窗口").FontSize(11).FontWeight(500).TextColor(t.TextReadable)
			})

			quitBtn := ui.ButtonBase(c.Key("tray-quit")).Label("退出应用").Height(24).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer).
				OnClick(func() {
					a.closeTrayFlyout()
					mygo.App.Quit()
				})
			if quitBtn.Hovered() {
				quitBtn.Background(t.BgHover)
			}
			quitBtn.Children(func() {
				ui.Text(c, "退出").FontSize(11).TextColor(t.TextSecondary)
			})
		})
	})
}
