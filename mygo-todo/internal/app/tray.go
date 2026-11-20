package app

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"todo-native/internal/api"
)

// distToSegment computes the Euclidean distance from point (px, py) to segment (ax, ay)-(bx, by).
func distToSegment(px, py, ax, ay, bx, by float64) float64 {
	dx, dy := bx-ax, by-ay
	lenSq := dx*dx + dy*dy
	if lenSq == 0 {
		return math.Hypot(px-ax, py-ay)
	}
	t := ((px-ax)*dx + (py-ay)*dy) / lenSq
	if t < 0 {
		t = 0
	} else if t > 1 {
		t = 1
	}
	projX, projY := ax+t*dx, ay+t*dy
	return math.Hypot(px-projX, py-projY)
}

// trayPNG renders a 36x36 (@2x Retina 18x18pt) 4x4-supersampled anti-aliased
// Apple SF-Symbols-inspired rounded squircle + checkmark template icon.
func trayPNG() []byte {
	const size = 36
	const samples = 4
	img := image.NewNRGBA(image.Rect(0, 0, size, size))

	// Rounded squircle bounds in [0, 36]: center (18, 18), half-size 11.5, corner radius 6.2, stroke width 2.2
	const cx, cy = 18.0, 18.0
	const half = 11.5
	const radius = 6.2
	const ringHalfStroke = 1.12

	// Checkmark vertices inside the squircle
	const x1, y1 = 12.6, 18.4
	const x2, y2 = 16.4, 22.1
	const x3, y3 = 23.6, 14.3
	const checkHalfStroke = 1.22

	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			hits := 0
			for sy := 0; sy < samples; sy++ {
				py := float64(y) + (float64(sy)+0.5)/float64(samples)
				for sx := 0; sx < samples; sx++ {
					px := float64(x) + (float64(sx)+0.5)/float64(samples)

					// Signed distance to rounded rectangle
					qx := math.Abs(px-cx) - (half - radius)
					qy := math.Abs(py-cy) - (half - radius)
					outDist := math.Hypot(math.Max(qx, 0), math.Max(qy, 0))
					inDist := math.Min(math.Max(qx, qy), 0)
					sdfRect := outDist + inDist - radius

					onRing := math.Abs(sdfRect) <= ringHalfStroke

					// Signed distance to checkmark polyline with rounded caps/joins
					d1 := distToSegment(px, py, x1, y1, x2, y2)
					d2 := distToSegment(px, py, x2, y2, x3, y3)
					onCheck := math.Min(d1, d2) <= checkHalfStroke

					if onRing || onCheck {
						hits++
					}
				}
			}
			if hits > 0 {
				alpha := uint8((hits*255 + (samples*samples)/2) / (samples * samples))
				img.SetNRGBA(x, y, color.NRGBA{R: 0, G: 0, B: 0, A: alpha})
			}
		}
	}

	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
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
		return fmt.Sprintf(" %d", len(todayTasks))
	}
	if focus, ok := a.trayFocusTask(todayTasks, now); ok {
		title := truncateRunes(focus.Title, 10)
		if pt := taskPrimaryTime(focus); pt != nil && !focus.AllDay {
			return fmt.Sprintf(" %s %s", pt.In(a.location()).Format("15:04"), title)
		}
		return " " + title
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
		return fmt.Sprintf("Todo · 今日 %d 项待办（%s）", len(todayTasks), focus.Title)
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
		Gap:          4,
		Width:        328,
		Height:       420,
		Focusable:    true,
		CornerRadius: 11,
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

// weekdayLabel maps Go's Sunday-first time.Weekday (0=Sun..6=Sat) onto the
// Monday-first Chinese weekday table (0=周一..6=周日).
func weekdayLabel(wd time.Weekday) string {
	return weekdays[(int(wd)+6)%7]
}

// trayHeaderDateParts formats the menu bar popover header into primary date
// (e.g. "11月18日") and secondary weekday + lunar caption (e.g. "周三 · 十月初十").
func trayHeaderDateParts(now time.Time) (string, string) {
	primary := now.Format("1月2日")
	secondary := weekdayLabel(now.Weekday())
	if l, ok := solarToLunar(now); ok {
		secondary += " · " + l.MonthLabel() + l.DayLabel()
	}
	return primary, secondary
}

func trayHeaderIconButton(c *ui.Context, key, label string, icon *ui.SVG, disabled bool, onClick func()) {
	t := tokensOf(c)
	btn := ui.ButtonBase(c.Key(key)).Label(label).Tooltip(label).
		Size(26, 26).Radius(6).Center().Cursor(ui.CursorPointer).
		Disabled(disabled).FocusRingColor(t.Accent).OnClick(onClick)
	fg := t.TextSecondary
	if btn.Pressed() {
		btn.Background(t.BgSelected)
		fg = t.TextPrimary
	} else if btn.Hovered() {
		btn.Background(t.BgHover)
		fg = t.TextPrimary
	}
	btn.Children(func() {
		ui.Icon(c, icon).Size(14, 14).TextColor(fg).AccessHidden(true)
	})
}

func (a *App) trayFlyoutView(c *ui.Context) {
	applyAppTheme(c)
	t := tokensOf(c)
	now := time.Now().In(a.location())
	if a.trayTab == "" {
		a.trayTab = "today"
	}

	// Clean Apple-style popover container on bright main surface with hairline rim.
	root := ui.Column(c.Key("tray-flyout-root")).Label("顶部状态栏任务面板").Fill().Padding(12, 14, 8, 14).Gap(8).Radius(11).
		Background(t.BgApp).Border(1, t.BorderPopup).Clip()

	root.Children(func() {
		if a.client == nil {
			ui.Column(c).Grow(1).Center().Gap(10).Padding(20).Children(func() {
				ui.Text(c, "Todo").FontSize(15).FontWeight(fontWeightSemibold).TextColor(t.TextPrimary)
				ui.Text(c, "登录账户后即可在菜单栏查看并完成今日待办。").FontSize(12).FontWeight(fontWeightRegular).TextColor(t.TextSecondary).TextAlign(ui.Center)
				appButton(c, "打开主窗口", "primary").Height(28).OnClick(func() {
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

		// 1. Editorial Apple-style Header: Date + Weekday/Lunar on left, optically matched linear icons on right.
		ui.Row(c.Key("tray-header")).Height(26).Shrink(0).AlignItems(ui.Center).Gap(6).Children(func() {
			primaryDate, secondaryDate := trayHeaderDateParts(now)
			ui.Row(c).Grow(1).MinWidth(0).Gap(6).AlignItems(ui.Baseline).Children(func() {
				ui.Text(c, primaryDate).FontSize(13.5).FontWeight(fontWeightSemibold).FontFeatures("tnum").TextColor(t.TextPrimary).SingleLine().Shrink(0)
				ui.Text(c, secondaryDate).FontSize(11.5).FontWeight(fontWeightRegular).TextColor(t.TextSecondary).SingleLine().Grow(1).MinWidth(0)
			})

			ui.Row(c).Gap(2).AlignItems(ui.Center).Shrink(0).Children(func() {
				trayHeaderIconButton(c, "tray-refresh", "刷新菜单栏任务", lucide.RefreshCw(), a.busy || a.syncing, a.refresh)
				trayHeaderIconButton(c, "tray-open-main", "打开 Todo 主窗口", lucide.ExternalLink(), false, func() {
					a.closeTrayFlyout()
					a.Show()
				})
			})
		})

		// 2. Tactile Apple Segmented Pill Switcher: [今日 | 最近7天 | 全部]
		trackBg := t.BgSubtle
		if c.Theme().Dark {
			trackBg = t.BgSidebar
		}
		ui.Row(c.Key("tray-tabs")).Height(30).Shrink(0).Padding(2.5).Gap(2).Radius(8).Background(trackBg).AlignItems(ui.Center).Children(func() {
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
				btn := ui.ButtonBase(c.Key("tray-tab-" + tab.id)).Label("菜单栏切换" + tab.title).
					Grow(1).Basis(0).FillHeight().Radius(6).Center().Cursor(ui.CursorPointer).
					OnClick(func() { a.trayTab = tabID })
				fg := t.TextSecondary
				countCol := t.TextTertiary
				if active {
					elevateSegmentActive(c, btn)
					fg = t.TextPrimary
					countCol = t.TextSecondary
				} else if btn.Hovered() {
					btn.Background(t.BgHover)
					fg = t.TextReadable
				}
				btn.Children(func() {
					ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
						weight := fontWeightRegular
						if active {
							weight = fontWeightSemibold
						}
						ui.Text(c, tab.title).FontSize(11.5).FontWeight(weight).TextColor(fg).SingleLine()
						if tab.count > 0 {
							ui.Text(c, fmt.Sprint(tab.count)).FontSize(10.5).FontWeight(fontWeightRegular).FontFeatures("tnum").TextColor(countCol).SingleLine()
						}
					})
				})
			}
		})

		// 3. Understated Single-Line Quick Capture
		hasTitle := strings.TrimSpace(a.trayQuickTitle) != ""
		quickRow := ui.Row(c.Key("tray-quick-add")).Label("菜单栏快捷添加区").Height(34).Shrink(0).Padding(0, 9).Gap(6).Radius(7).
			AlignItems(ui.Center).Background(t.BgSubtle.Alpha(0.75)).Border(1, ui.Transparent)
		if a.trayQuickInput.Focused(c) {
			quickRow.Background(t.BgElevated).BorderColor(t.BorderDefault)
		}
		quickRow.Children(func() {
			iconCol := t.TextTertiary
			if a.trayQuickInput.Focused(c) || hasTitle {
				iconCol = t.Accent
			}
			ui.Icon(c, lucide.Plus()).Size(13.5, 13.5).TextColor(iconCol).Shrink(0).AccessHidden(true)
			ui.TextInputBase(c.Key("tray-quick-input"), &a.trayQuickTitle).Ref(&a.trayQuickInput).
				Label("菜单栏快捷添加").Placeholder("添加任务…").PlaceholderColor(t.TextTertiary).
				FontSize(12.5).FontWeight(fontWeightRegular).Grow(1).MinWidth(0).MinHeight(24).Disabled(a.busy).OnSubmit(a.submitTrayQuickTask)
			smart := a.previewSmartInput(a.trayQuickTitle)
			if smart.HasTime || smart.HasPriority {
				ui.Text(c, smartSummaryText(smart)).FontSize(10.5).FontWeight(fontWeightMedium).TextColor(t.Accent).SingleLine().Shrink(0)
			}
			if hasTitle {
				addBtn := ui.ButtonBase(c.Key("tray-quick-submit")).Label("菜单栏添加任务").Tooltip("创建任务 (Enter)").
					Size(22, 22).Radius(5).Center().Cursor(ui.CursorPointer).Background(t.Accent).
					Disabled(a.busy).OnClick(a.submitTrayQuickTask)
				addBtn.Children(func() {
					ui.Icon(c, lucide.CornerDownLeft()).Size(11.5, 11.5).TextColor(t.TextOnAccent).AccessHidden(true)
				})
			}
		})

		// 4. Airy, Borderless Task List with strictly flush left-aligned titles.
		var visibleTasks []api.Task
		switch a.trayTab {
		case "upcoming":
			visibleTasks = upcomingTasks
		case "all":
			visibleTasks = allTasks
		default:
			visibleTasks = todayTasks
		}

		ui.Scroll(c.Key("tray-task-list")).Label("菜单栏任务列表").Grow(1).Basis(0).MinHeight(0).Gap(1).Children(func() {
			if len(visibleTasks) == 0 {
				ui.Column(c).Grow(1).Padding(42, 16).Center().Gap(4).Children(func() {
					emptyTitle := "今日待办已全部完成"
					if a.trayTab != "today" {
						emptyTitle = "暂无待办任务"
					}
					ui.Text(c, emptyTitle).FontSize(12.5).FontWeight(fontWeightRegular).TextColor(t.TextSecondary)
				})
				return
			}
			for _, item := range visibleTasks {
				task := item
				row := ui.Row(c.Key("tray-row-"+a.stableTaskKey(task))).Label("菜单栏任务行 "+task.Title).
					Height(36).Shrink(0).Padding(0, 6).Gap(7).Radius(6).AlignItems(ui.Center)
				if row.Hovered() {
					row.Background(t.BgHover)
				}
				row.Children(func() {
					done := task.Status == "completed"
					disabled := task.ReadOnly || (task.Recurring() && task.InstanceID == "")
					cb := ui.CheckboxBase(c.Key("tray-done-"+a.stableTaskKey(task)), &done).
						Size(22, 22).Center().Cursor(ui.CursorPointer).FocusRingColor(t.Accent).
						Label("菜单栏完成 " + task.Title).Disabled(disabled).
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
					cb.Children(func() {
						boxBg := t.BgApp
						boxBorder := t.TextTertiary.Alpha(0.55)
						var borderW float32 = 1.35
						if done {
							boxBg, boxBorder = t.Accent, t.Accent
							borderW = 1.4
						} else if task.Priority > 0 {
							boxBg = t.Accent.Alpha(0.08)
							boxBorder = t.Accent
							borderW = 1.5
							if cb.Hovered() {
								boxBg = t.Accent.Alpha(0.16)
							}
						} else if task.Priority < 0 {
							boxBorder = t.TextTertiary.Alpha(0.45)
						} else if cb.Hovered() {
							boxBorder = t.TextSecondary
						}
						ui.Box(c).Size(15, 15).Radius(4.5).Center().Background(boxBg).Border(borderW, boxBorder).AccessHidden(true).Children(func() {
							if done {
								ui.Icon(c, lucide.Check()).Size(10, 10).TextColor(t.TextOnAccent).AccessHidden(true)
							}
						})
					})

					openBtn := ui.ButtonBase(c.Key("tray-open-"+a.stableTaskKey(task))).
						Label("菜单栏打开 "+task.Title).Tooltip(task.Title).
						Grow(1).FillHeight().MinWidth(0).Justify(ui.Start).Padding(0, 2).Cursor(ui.CursorPointer).
						OnClick(func() { a.openTaskFromTray(task) })
					openBtn.Children(func() {
						ui.Row(c).Grow(1).MinWidth(0).Gap(6).AlignItems(ui.Center).Children(func() {
							titleTxt := ui.Text(c, task.Title).FontSize(12.5).FontWeight(fontWeightRegular).TextColor(t.TextPrimary).SingleLine().Grow(1).MinWidth(0)
							if done {
								titleTxt.Strikethrough().TextColor(t.TextTertiary)
							}
							if pt := taskPrimaryTime(task); pt != nil {
								st := pt.In(a.location())
								overdue := task.Status == "pending" && st.Before(dayStart(now))
								timeLabel := st.Format("15:04")
								if task.AllDay {
									if !dayStart(st).Equal(dayStart(now)) {
										timeLabel = st.Format("01/02")
									} else {
										timeLabel = "全天"
									}
								} else if !dayStart(st).Equal(dayStart(now)) {
									timeLabel = st.Format("01/02")
								}
								timeCol := t.TextTertiary
								if overdue {
									timeCol = t.Danger
								}
								ui.Text(c, timeLabel).FontSize(11).FontWeight(fontWeightRegular).FontFeatures("tnum").TextColor(timeCol).Shrink(0)
							}
						})
					})
				})
			}
		})

		// 5. Balanced, Quiet Footer with clear action hierarchy.
		ui.Row(c.Key("tray-footer")).Height(30).Shrink(0).Padding(6, 2, 0, 2).AlignItems(ui.Center).Gap(4).
			BorderWidth(1, 0, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
			modeBtn := ui.ButtonBase(c.Key("tray-title-mode")).Label("切换顶部状态栏显示模式").
				Tooltip("点击切换状态栏文字：下一项任务 / 今日数量 / 仅图标").
				Height(22).Padding(0, 6).Radius(5).Center().Cursor(ui.CursorPointer).
				OnClick(a.cycleTrayTitleMode)
			modeCol := t.TextTertiary
			if modeBtn.Hovered() {
				modeBtn.Background(t.BgHover)
				modeCol = t.TextSecondary
			}
			modeBtn.Children(func() {
				ui.Text(c, "状态栏 · "+trayTitleModeLabel(a.trayTitleMode)).FontSize(10.5).FontWeight(fontWeightRegular).TextColor(modeCol).SingleLine()
			})

			ui.Spacer(c)

			mainBtn := ui.ButtonBase(c.Key("tray-main-win")).Label("显示主窗口").Height(22).Padding(0, 7).Radius(5).Center().Cursor(ui.CursorPointer).
				OnClick(func() {
					a.closeTrayFlyout()
					a.Show()
				})
			mainCol := t.TextSecondary
			if mainBtn.Hovered() {
				mainBtn.Background(t.BgHover)
				mainCol = t.TextPrimary
			}
			mainBtn.Children(func() {
				ui.Text(c, "打开 Todo").FontSize(11.5).FontWeight(fontWeightMedium).TextColor(mainCol).SingleLine()
			})

			ui.Box(c).Size(1, 11).Background(t.BorderDefault.Alpha(0.75)).Shrink(0).AccessHidden(true)

			quitBtn := ui.ButtonBase(c.Key("tray-quit")).Label("退出应用").Height(22).Padding(0, 6).Radius(5).Center().Cursor(ui.CursorPointer).
				OnClick(func() {
					a.closeTrayFlyout()
					mygo.App.Quit()
				})
			quitCol := t.TextTertiary
			if quitBtn.Hovered() {
				quitBtn.Background(t.Danger.Alpha(0.08))
				quitCol = t.Danger
			}
			quitBtn.Children(func() {
				ui.Text(c, "退出").FontSize(11.5).FontWeight(fontWeightRegular).TextColor(quitCol).SingleLine()
			})
		})
	})
}
