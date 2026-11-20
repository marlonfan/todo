package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

func harmonizeCalendarAccent(c *ui.Context, col ui.Color) ui.Color {
	if c.Theme().Dark {
		return col.Mix(ui.Hex("#EAE5DB"), 0.14)
	}
	return col.Mix(ui.Hex("#6C665E"), 0.16)
}

func calendarGridLine(c *ui.Context) ui.Color {
	t := tokensOf(c)
	if c.Theme().Dark {
		return t.BorderSubtle.Alpha(0.90)
	}
	return t.BorderSubtle.Alpha(0.85)
}

func (a *App) calendarEventAccent(c *ui.Context, event api.CalendarEvent) ui.Color {
	t := tokensOf(c)
	if event.ExtendedProps.ReadOnly || event.ExtendedProps.Source == "caldav" {
		if c.Theme().Dark {
			return ui.Hex("#A394E8")
		}
		return ui.Hex("#7668B8")
	}
	for _, task := range a.tasks {
		if task.ID == event.ExtendedProps.TaskID {
			for _, cat := range task.Categories {
				if strings.HasPrefix(cat.Color, "#") && len(cat.Color) == 7 {
					return harmonizeCalendarAccent(c, ui.Hex(cat.Color))
				}
			}
			break
		}
	}
	if event.ExtendedProps.Priority > 0 {
		return harmonizeCalendarAccent(c, t.Warning)
	}
	return t.Accent
}

func (a *App) calendarEffectiveWidth(c *ui.Context, rootBounds ui.Rect) float32 {
	if rootBounds.W > 0 {
		return rootBounds.W
	}
	windowWidth, _ := c.Size()
	width := windowWidth
	if windowWidth >= 1180 {
		width -= a.sidebarWidth + 1
	}
	if (a.editing || a.selectedOccurrence != nil) && (width >= 1050 || windowWidth >= 1180) {
		drawerW := min(float32(440), max(float32(detailMinWidth), width*0.36))
		width -= drawerW
	}
	return max(float32(320), width)
}

func (a *App) calendarView(c *ui.Context) {
	t := tokensOf(c)
	state := a.cache
	if state.Calendar != nil && state.Calendar.Timezone != a.location().String() {
		state.Calendar = nil
	}
	events := filterCalendarEvents(projectedCalendar(state), a.calendarFilter)
	windowWidth, _ := c.Size()

	root := ui.Column(c.Key("calendar-content")).Grow(1).MinHeight(0).MinWidth(0).Background(t.BgApp)
	effectiveWidth := a.calendarEffectiveWidth(c, root.Bounds())
	compactToolbar := effectiveWidth < 760

	root.Children(func() {
		toolbarPadX := float32(16)
		toolbarGap := float32(8)
		if compactToolbar {
			toolbarPadX = 12
			toolbarGap = 5
		}

		// Toolbar: [今天] < > 2026年 11月 v       (- +) [筛选] [日|周|月|日程] | (+)
		ui.Row(c.Key("calendar-toolbar")).Height(toolbarHeight).Padding(0, toolbarPadX).Gap(toolbarGap).BorderWidth(0, 0, 1, 0).BorderColor(calendarGridLine(c)).AlignItems(ui.Center).Children(func() {
			if windowWidth < 1180 {
				iconButton(c, "展开导航", lucide.PanelLeft()).OnClick(func() { a.sidebarOverlay = true })
			}

			// Outlined pill "Today" button
			todayBtn := ui.ButtonBase(c.Key("cal-today")).Label("回到今天").Tooltip("回到今天").
				Height(28).Padding(0, 12).Radius(14).Center().Shrink(0).Border(1, t.BorderDefault).Background(ui.Transparent).Cursor(ui.CursorPointer).
				OnClick(func() {
					a.selectedDay = time.Now().In(a.location())
					a.focusCalendarWorkingHours()
					a.loadCalendar()
				})
			if todayBtn.Hovered() {
				todayBtn.Background(t.BgHover)
			}
			todayBtn.Children(func() {
				ui.Text(c, "今天").FontSize(12).FontWeight(500).TextColor(t.TextPrimary).SingleLine()
			})

			// Grouped Prev / Next circular navigation arrows
			ui.Row(c.Key("cal-nav-arrows")).Gap(2).Shrink(0).AlignItems(ui.Center).Children(func() {
				prev := ui.ButtonBase(c.Key("cal-prev")).Label("上一段").Tooltip("上一段").Size(28, 28).Radius(14).Center().Cursor(ui.CursorPointer).
					OnClick(func() { a.selectedDay = calendarShift(a.selectedDay, a.calendarMode, -1); a.loadCalendar() })
				if prev.Hovered() {
					prev.Background(t.BgHover)
				}
				prev.Children(func() { ui.Icon(c, lucide.ChevronLeft()).Size(15, 15).TextColor(t.TextSecondary).AccessHidden(true) })

				next := ui.ButtonBase(c.Key("cal-next")).Label("下一段").Tooltip("下一段").Size(28, 28).Radius(14).Center().Cursor(ui.CursorPointer).
					OnClick(func() { a.selectedDay = calendarShift(a.selectedDay, a.calendarMode, 1); a.loadCalendar() })
				if next.Hovered() {
					next.Background(t.BgHover)
				}
				next.Children(func() { ui.Icon(c, lucide.ChevronRight()).Size(15, 15).TextColor(t.TextSecondary).AccessHidden(true) })
			})

			start, end := calendarRange(a.selectedDay, a.calendarMode)
			title := a.selectedDay.Format("2006年 1月 2日")
			if a.calendarMode == 1 {
				endDisp := end.AddDate(0, 0, -1)
				if start.Month() == endDisp.Month() {
					title = start.Format("2006年 1月")
				} else {
					title = start.Format("2006年 1月") + " – " + endDisp.Format("1月")
				}
			} else if a.calendarMode == 2 {
				title = a.selectedDay.Format("2006年 1月")
			}

			jumpHolder := ui.Box(c.Key("cal-jump-holder")).Shrink(1).MinWidth(0)
			jumpOpen := ui.Local(jumpHolder, "open", func() bool { return false })
			var titleAnchor ui.Element
			jumpHolder.Children(func() {
				titleAnchor = ui.ButtonBase(c.Key("cal-period-title")).Label("日历定位日期").Tooltip("点击快速跳转日期").
					Height(30).Padding(0, 8).Radius(8).MinWidth(0).Cursor(ui.CursorPointer).OnClick(func() { *jumpOpen = !*jumpOpen })
				if titleAnchor.Hovered() || *jumpOpen {
					titleAnchor.Background(t.BgHover)
				}
				titleSize := float32(16)
				if compactToolbar {
					titleSize = 14.5
				}
				titleAnchor.Children(func() {
					ui.Row(c).Gap(4).MinWidth(0).AlignItems(ui.Center).Children(func() {
						ui.Text(c, title).FontSize(titleSize).FontWeight(600).TextColor(t.TextPrimary).SingleLine().MinWidth(0)
						ui.Icon(c, lucide.ChevronDown()).Size(13, 13).TextColor(t.TextSecondary).Shrink(0).AccessHidden(true)
					})
				})
				if *jumpOpen {
					ui.PopoverBase(c.Key("cal-jump-popover"), titleAnchor, jumpOpen, func(panel ui.Element) {
						panel.AttachTo(titleAnchor, ui.AnchorBottomStart, ui.AnchorTopStart)
						elevatePopup(c, panel.Padding(12).Width(268).Radius(popoverRadius).Background(t.BgElevated).Label("选择跳转日期"))
						panel.Children(func() {
							if appCalendar(c, &a.selectedDay, "跳转日历日期") {
								a.selectedDay = a.selectedDay.In(a.location())
								*jumpOpen = false
								a.loadCalendar()
							}
						})
					})
				}
			})

			ui.Spacer(c)

			// Zoom control pill (Day/Week only when room permits)
			if a.calendarMode < 2 && effectiveWidth >= 760 {
				zoomStep := func(delta float64) {
					oldZoom := max(40.0, a.calendarZoom)
					topHour := float64(a.calendarScroll.Y) / oldZoom
					a.calendarZoom = min(96, max(40, a.calendarZoom+delta))
					a.calendarScroll.Y = float32(topHour * a.calendarZoom)
				}
				ui.Row(c.Key("cal-zoom-group")).Height(28).Padding(2).Gap(1).Radius(14).Background(t.BgSubtle).Shrink(0).AlignItems(ui.Center).Children(func() {
					zOut := ui.ButtonBase(c.Key("zoom-out")).Label("缩小时间轴").Tooltip("缩小时间轴").Size(24, 24).Radius(12).Center().Cursor(ui.CursorPointer).
						Disabled(a.calendarZoom <= 40).OnClick(func() { zoomStep(-8) })
					if zOut.Hovered() && a.calendarZoom > 40 {
						zOut.Background(t.BgApp)
					}
					zOutCol := t.TextSecondary
					if a.calendarZoom <= 40 {
						zOutCol = t.TextTertiary
					}
					zOut.Children(func() { ui.Icon(c, lucide.Minus()).Size(13, 13).TextColor(zOutCol).AccessHidden(true) })

					zIn := ui.ButtonBase(c.Key("zoom-in")).Label("放大时间轴").Tooltip("放大时间轴").Size(24, 24).Radius(12).Center().Cursor(ui.CursorPointer).
						Disabled(a.calendarZoom >= 96).OnClick(func() { zoomStep(8) })
					if zIn.Hovered() && a.calendarZoom < 96 {
						zIn.Background(t.BgApp)
					}
					zInCol := t.TextSecondary
					if a.calendarZoom >= 96 {
						zInCol = t.TextTertiary
					}
					zIn.Children(func() { ui.Icon(c, lucide.Plus()).Size(13, 13).TextColor(zInCol).AccessHidden(true) })
				})
			}

			// Source filter circular button
			filterHolder := ui.Box(c.Key("cal-filter-holder")).Shrink(0)
			filterOpen := ui.Local(filterHolder, "open", func() bool { return false })
			filterHolder.Children(func() {
				items := []overlay.MenuItem{
					{Key: "0", Label: "显示全部日程"},
					{Key: "1", Label: "仅显示 Todo 任务"},
					{Key: "2", Label: "仅显示外部日历"},
				}
				choice := appDropdown(c, filterOpen, items, func(trigger ui.Element) {
					trigger.Label("日程来源").Tooltip("筛选日程来源").Size(28, 28).Radius(14).Center().Cursor(ui.CursorPointer)
					if a.calendarFilter != 0 {
						trigger.Background(t.Accent.Alpha(0.12))
					} else if trigger.Hovered() || *filterOpen {
						trigger.Background(t.BgHover)
					}
					col := t.TextSecondary
					if a.calendarFilter != 0 {
						col = t.Accent
					}
					trigger.Children(func() {
						ui.Icon(c, lucide.SlidersHorizontal()).Size(14, 14).TextColor(col).AccessHidden(true)
					})
				})
				switch choice {
				case "0":
					a.calendarFilter = 0
				case "1":
					a.calendarFilter = 1
				case "2":
					a.calendarFilter = 2
				}
			})

			if appSegmented(c, &a.calendarMode, calendarModes, action.SegmentedProps{Size: theme.Small}).Shrink(0).Label("日历视图").Changed() {
				a.setCalendarMode(a.calendarMode)
			}

			if !compactToolbar {
				ui.Box(c).Width(1).Height(16).Margin(0, 2).Background(t.BorderSubtle).Shrink(0).AccessHidden(true)
			}

			// Soft circular "+" primary create action
			addBtn := ui.ButtonBase(c.Key("cal-create")).Label("添加日程").Tooltip("新建日程").Size(28, 28).Radius(14).Center().Shrink(0).
				Background(t.Accent).Cursor(ui.CursorPointer).Disabled(a.busy).OnClick(a.newTask)
			if addBtn.Hovered() {
				addBtn.Background(t.AccentHover)
			}
			addBtn.Children(func() {
				ui.Icon(c, lucide.Plus()).Size(14, 14).TextColor(t.TextOnAccent).AccessHidden(true)
			})
		})

		start, end := calendarRange(a.selectedDay, a.calendarMode)
		if !calendarCovered(a.cache, start, end, a.location().String()) && !a.calendarLoading && !a.syncing {
			ui.Row(c).Padding(4, 16).Gap(8).AlignItems(ui.Center).Background(t.BgSubtle).BorderWidth(0, 0, 1, 0).BorderColor(calendarGridLine(c)).Children(func() {
				ui.Icon(c, lucide.Info()).Size(13, 13).TextColor(t.TextSecondary)
				ui.Text(c, "当前范围仅显示本机已缓存日程，联网刷新可同步完整周期与外部日历").FontSize(11).TextColor(t.TextSecondary).Grow(1)
				iconButton(c, "刷新日历范围", lucide.RefreshCw()).Size(24, 24).Padding(4).OnClick(a.loadCalendar)
			})
		}

		// Edge-to-edge full-bleed canvas for Month & Week/Day
		ui.Column(c.Key("calendar-surface")).Background(t.BgApp).Grow(1).MinHeight(0).MinWidth(0).Clip().Children(func() {
			switch a.calendarMode {
			case 0, 1:
				a.calendarTimelineView(c, events, effectiveWidth)
			case 2:
				a.calendarMonthView(c, events)
			default:
				a.calendarAgendaView(c, events)
			}
		})
	})
}

func eventTimePrefix(event api.CalendarEvent, day time.Time) string {
	if event.AllDay {
		return ""
	}
	if start, err := eventDate(event.Start, day.Location()); err == nil {
		if start.Before(dayStart(day)) {
			return "延续"
		}
		return start.Format("15:04")
	}
	return ""
}

func eventLabel(event api.CalendarEvent, day time.Time) string {
	prefix := "全天"
	if !event.AllDay {
		if p := eventTimePrefix(event, day); p != "" {
			prefix = p
		}
	}
	marker := ""
	if event.ExtendedProps.Status == "completed" {
		marker = "✓ "
	}
	if event.ExtendedProps.ReadOnly {
		marker = "只读 · "
	}
	return marker + prefix + "  " + event.Title
}

func allDaySpanTooltip(event api.CalendarEvent, loc *time.Location) string {
	if _, totalDays, sDay, eDay, ok := multiDayEventInfo(event, time.Now().In(loc)); ok {
		return fmt.Sprintf("%s\n%s – %s · 全天（共 %d 天）", event.Title, sDay.Format("1月2日"), eDay.Format("1月2日"), totalDays)
	}
	return event.Title + "\n全天"
}

// calendarAllDaySpanBar renders a single continuous horizontal ribbon for an
// all-day event (single-day or multi-day) across [StartCol, StartCol+Span) in
// Month View or Week/Day View, preserving click, drag, and right-edge resize.
func (a *App) calendarAllDaySpanBar(c *ui.Context, span allDaySpan, cols int, height, topY float32) {
	t := tokensOf(c)
	accent := a.calendarEventAccent(c, span.Event)
	done := span.Event.ExtendedProps.Status == "completed"
	selected := a.calendarEventSelected(span.Event)

	mixAmt := float32(0.13)
	if c.Theme().Dark {
		mixAmt = 0.23
	}
	if done {
		mixAmt *= 0.55
	}
	if selected {
		mixAmt = min(0.36, mixAmt+0.07)
	}

	fg := t.TextPrimary
	if done {
		fg = t.TextSecondary
	}

	leftPct := float32(span.StartCol) * 100 / float32(cols)
	widthPct := float32(span.Span) * 100 / float32(cols)

	padL, padR := float32(4), float32(4)
	rL, rR := float32(5), float32(5)
	if span.ContinuesLeft {
		padL, rL = 0, 0
	}
	if span.ContinuesRight {
		padR, rR = 0, 0
	}

	barKey := fmt.Sprintf("span-%s-%s", eventKey(span.Event), span.AnchorDay.Format("20060102"))
	wrap := ui.Box(c.Key(barKey)).Absolute().Top(topY).Height(height).
		LeftPercent(leftPct).WidthPercent(widthPct).Padding(0, padR, 0, padL)

	wrap.Children(func() {
		textPadL := float32(9)
		if span.ContinuesLeft {
			textPadL = 6
		}
		textPadR := float32(7)
		if !span.ContinuesRight && !span.Event.ExtendedProps.ReadOnly {
			textPadR = 14
		}

		e := ui.ButtonBase(c.Key("event")).
			Label("日程 "+span.AnchorDay.Format("2006-01-02")+" "+span.Event.Title).
			Fill().MinWidth(0).Padding(0, textPadR, 0, textPadL).Radius(rL, rR, rR, rL).
			Justify(ui.Start).AlignItems(ui.Center).Clip().
			Background(t.BgApp.Mix(accent, mixAmt)).
			Cursor(ui.CursorPointer).FocusRingColor(t.Accent).
			Tooltip(allDaySpanTooltip(span.Event, span.AnchorDay.Location())).
			Disabled(a.busy).
			OnClick(func() { a.openCalendarEvent(span.Event) })

		if selected {
			e.Border(1, accent.Alpha(0.50))
		} else if e.Hovered() {
			e.Background(t.BgApp.Mix(accent, min(0.38, mixAmt+0.07)))
		}

		e.Children(func() {
			if !span.ContinuesLeft {
				barCol := accent.Alpha(0.85)
				if done {
					barCol = accent.Alpha(0.45)
				}
				ui.Box(c).Absolute().Left(2).Top(2.5).Bottom(2.5).Width(3).Radius(1.5).Background(barCol).PassThrough().AccessHidden(true)
			} else {
				ui.Text(c, "‹").FontSize(11).FontWeight(600).TextColor(accent.Alpha(0.78)).Margin(0, 3, 0, 0).Shrink(0).AccessHidden(true)
			}
			txt := ui.Text(c, span.Event.Title).FontSize(11.5).FontWeight(500).TextColor(fg).SingleLine().Grow(1).MinWidth(0).AccessHidden(true)
			if done {
				txt.Strikethrough().DecorationColor(fg.Alpha(0.6))
			}
		})

		a.calendarSpanDragSource(e, span)
		if !span.ContinuesRight {
			a.calendarResizeHandle(c, span.Event, span.EndDay, 0, wrap.Hovered() || e.Hovered())
		}
	})
}

// Compact event item for Month timed entries and "+N 项" popovers:
// - All-day events (in popovers) render as soft pastel pills with subtle left stripe.
// - Timed events render as clean harmonized dot + time + title rows.
func (a *App) calendarEventButton(c *ui.Context, event api.CalendarEvent, day time.Time) ui.Element {
	t := tokensOf(c)
	accent := a.calendarEventAccent(c, event)
	done := event.ExtendedProps.Status == "completed"
	selected := a.calendarEventSelected(event)

	fg := t.TextPrimary
	if done {
		fg = t.TextSecondary
	}

	e := ui.ButtonBase(c).Label("日程 "+day.Format("2006-01-02")+" "+event.Title).
		MinWidth(0).Padding(0, 6).Radius(4).Justify(ui.Start).AlignItems(ui.Center).Clip().
		Cursor(ui.CursorPointer).FocusRingColor(t.Accent).
		Tooltip(event.Title + "\n" + event.Start).Disabled(a.busy).
		OnClick(func() { a.openCalendarEvent(event) })

	if event.AllDay {
		e.Padding(0, 6, 0, 9)
		mixAmt := float32(0.13)
		if c.Theme().Dark {
			mixAmt = 0.23
		}
		if done {
			mixAmt *= 0.55
		}
		e.Background(t.BgApp.Mix(accent, mixAmt))
		if selected {
			e.Border(1, accent.Alpha(0.50))
		} else if e.Hovered() {
			e.Background(t.BgApp.Mix(accent, min(0.38, mixAmt+0.07)))
		}
	} else {
		e.Background(ui.Transparent)
		if selected {
			e.Background(t.BgApp.Mix(accent, 0.12))
		} else if e.Hovered() {
			e.Background(t.BgHover)
		}
	}

	e.Children(func() {
		if !event.AllDay {
			dotCol := accent
			if done {
				dotCol = accent.Alpha(0.45)
			}
			ui.Box(c).Size(6, 6).Radius(3).Margin(0, 5, 0, 0).Background(dotCol).Shrink(0).AccessHidden(true)
		} else {
			barCol := accent.Alpha(0.85)
			if done {
				barCol = accent.Alpha(0.45)
			}
			ui.Box(c).Absolute().Left(2).Top(2.5).Bottom(2.5).Width(3).Radius(1.5).Background(barCol).PassThrough().AccessHidden(true)
		}
		timeStr := eventTimePrefix(event, day)
		if timeStr != "" {
			ui.Text(c, timeStr).FontSize(11).FontFeatures("tnum").FontWeight(400).TextColor(t.TextSecondary).Margin(0, 4, 0, 0).Shrink(0).SingleLine().AccessHidden(true)
		}
		txt := ui.Text(c, event.Title).FontSize(11.5).FontWeight(500).TextColor(fg).SingleLine().Grow(1).MinWidth(0).AccessHidden(true)
		if done {
			txt.Strikethrough().DecorationColor(fg.Alpha(0.6))
		}
	})
	if a.calendarMode != 3 {
		a.calendarDragSource(e, event, day, false, 0)
	}
	return e
}

func (a *App) calendarTimelineButton(c *ui.Context, event api.CalendarEvent, day time.Time, height float32) ui.Element {
	t := tokensOf(c)
	accent := a.calendarEventAccent(c, event)
	done := event.ExtendedProps.Status == "completed"
	selected := a.calendarEventSelected(event)

	mixAmt := float32(0.11)
	if c.Theme().Dark {
		mixAmt = 0.20
	}
	if done {
		mixAmt *= 0.55
	}
	if selected {
		mixAmt = min(0.32, mixAmt+0.06)
	}
	cardBg := t.BgApp.Mix(accent, mixAmt)
	fg := t.TextPrimary
	if done {
		fg = t.TextSecondary
	}
	timeFg := accent.Mix(t.TextSecondary, 0.58)
	barCol := accent.Alpha(0.88)
	if done {
		barCol = accent.Alpha(0.45)
	}

	// Clean breathing gap around timeline cards so adjacent/overlapping items separate smoothly
	frame := ui.Box(c).Height(height).MinWidth(0).Padding(1, 3, 1.5, 2)
	frame.Children(func() {
		e := ui.ButtonBase(c.Key("event")).Label("日程 "+day.Format("2006-01-02")+" "+event.Title).Fill().MinWidth(0).Padding(4, 8, 4, 10).Radius(6).Clip().
			Justify(ui.Start).AlignItems(ui.Start).Background(cardBg).Cursor(ui.CursorPointer).
			Tooltip(eventLabel(event, day) + "\n" + event.Start).Disabled(a.busy).
			OnClick(func() { a.openCalendarEvent(event) })
		if selected {
			e.Border(1, accent.Alpha(0.48))
		} else if e.Hovered() {
			e.Background(t.BgApp.Mix(accent, min(0.34, mixAmt+0.06))).Border(1, accent.Alpha(0.24))
		}
		e.Children(func() {
			ui.Box(c).Absolute().Left(2).Top(2.5).Bottom(2.5).Width(3).Radius(1.5).Background(barCol).PassThrough().AccessHidden(true)
			timeStr := eventTimePrefix(event, day)
			if height < 40 {
				ui.Row(c).Gap(5).MinWidth(0).AlignItems(ui.Center).AccessHidden(true).Children(func() {
					txt := ui.Text(c, event.Title).SingleLine().FontSize(11.5).FontWeight(500).TextColor(fg).Shrink(1).MinWidth(0)
					if done {
						txt.Strikethrough()
					}
					if timeStr != "" {
						ui.Text(c, timeStr).FontSize(10.5).FontFeatures("tnum").TextColor(timeFg).Shrink(0).SingleLine()
					}
				})
			} else {
				ui.Column(c).FillWidth().MinWidth(0).Gap(2).AccessHidden(true).Children(func() {
					txt := ui.Text(c, event.Title).MaxLines(max(1, int((height-22)/16))).FontSize(12).FontWeight(500).TextColor(fg)
					if done {
						txt.Strikethrough()
					}
					if timeStr != "" {
						rangeText := timeStr
						if end, err := eventDate(event.End, day.Location()); err == nil {
							rangeText += " – " + end.Format("15:04")
						}
						ui.Text(c, rangeText).SingleLine().FontSize(10.5).FontFeatures("tnum").TextColor(timeFg)
					}
				})
			}
		})
		a.calendarDragSource(e, event, day, false, float32(a.calendarZoom))
		a.calendarResizeHandle(c, event, day, float32(a.calendarZoom), frame.Hovered())
	})
	return frame
}

func (a *App) calendarMonthView(c *ui.Context, events []api.CalendarEvent) {
	t := tokensOf(c)
	gridLine := calendarGridLine(c)
	start, _ := calendarRange(a.selectedDay, 2)
	_, winHeight := c.Size()

	rows := 6
	sixthRowFirst := start.AddDate(0, 0, 35)
	curMonthStart := time.Date(a.selectedDay.Year(), a.selectedDay.Month(), 1, 0, 0, 0, 0, a.selectedDay.Location())
	if sixthRowFirst.After(curMonthStart) && sixthRowFirst.Month() != a.selectedDay.Month() {
		rows = 5
	}

	// Weekday Header
	ui.Grid(c.Key("month-weekdays")).Columns(7).Gap(0).Height(28).Shrink(0).BorderWidth(0, 0, 1, 0).BorderColor(gridLine).Children(func() {
		for i, name := range []string{"周一", "周二", "周三", "周四", "周五", "周六", "周日"} {
			rightB := float32(1)
			if i == 6 {
				rightB = 0
			}
			ui.Box(c).FillHeight().MinWidth(0).Center().BorderWidth(0, rightB, 0, 0).BorderColor(gridLine).Children(func() {
				ui.Text(c, name).FontSize(11).FontWeight(500).TextColor(t.TextSecondary).SingleLine()
			})
		}
	})

	nowStr := time.Now().In(a.location()).Format("2006-01-02")
	estRowH := max(float32(72), (winHeight-float32(toolbarHeight)-28)/float32(rows))

	const (
		monthHeaderH    = float32(24)
		monthCellPadTop = float32(5)
		monthCellPadBot = float32(4)
		monthSlotH      = float32(20)
		monthSlotGap    = float32(2)
		monthSlotStride = monthSlotH + monthSlotGap                     // 22px
		monthSlotsTopY  = monthCellPadTop + monthHeaderH + monthSlotGap // 31px
	)

	// Equal-height flex week rows with continuous spanning all-day overlay layer
	ui.Column(c.Key("month-grid")).Grow(1).MinHeight(0).MinWidth(0).Children(func() {
		for r := 0; r < rows; r++ {
			weekFirstDay := start.AddDate(0, 0, r*7)
			bottomBorder := float32(1)
			if r == rows-1 {
				bottomBorder = 0
			}
			weekRow := ui.Box(c.Key(fmt.Sprintf("week-%d", r))).
				Grow(1).Basis(0).MinHeight(0).MinWidth(0).
				BorderWidth(0, 0, bottomBorder, 0).BorderColor(gridLine)

			rowH := weekRow.Bounds().H
			if rowH <= 0 {
				rowH = estRowH
			}
			availH := max(float32(0), rowH-monthSlotsTopY-monthCellPadBot)
			totalSlots := int((availH + monthSlotGap) / monthSlotStride)

			spans, _ := allDaySpansForRange(events, weekFirstDay, 7)

			var allByCol [7][]api.CalendarEvent
			var timedByCol [7][]api.CalendarEvent
			var allDayCountByCol [7]int
			var allDayMaxLane [7]int
			for col := 0; col < 7; col++ {
				allDayMaxLane[col] = -1
				day := weekFirstDay.AddDate(0, 0, col)
				allByCol[col] = eventsForDay(events, day)
				timedByCol[col] = timedEventsForDay(events, day)
			}
			for _, sp := range spans {
				for col := sp.StartCol; col < sp.StartCol+sp.Span; col++ {
					allDayCountByCol[col]++
					if sp.Lane > allDayMaxLane[col] {
						allDayMaxLane[col] = sp.Lane
					}
				}
			}

			var usableSlots [7]int
			for col := 0; col < 7; col++ {
				needed := (allDayMaxLane[col] + 1) + len(timedByCol[col])
				if needed > totalSlots {
					usableSlots[col] = max(0, totalSlots-1)
				} else {
					usableSlots[col] = totalSlots
				}
			}

			var visibleSpans []allDaySpan
			var reservedLanes [7]int
			var visibleAllDayCount [7]int
			for _, sp := range spans {
				fits := true
				for col := sp.StartCol; col < sp.StartCol+sp.Span; col++ {
					if sp.Lane >= usableSlots[col] {
						fits = false
						break
					}
				}
				if fits {
					visibleSpans = append(visibleSpans, sp)
					for col := sp.StartCol; col < sp.StartCol+sp.Span; col++ {
						visibleAllDayCount[col]++
						if sp.Lane+1 > reservedLanes[col] {
							reservedLanes[col] = sp.Lane + 1
						}
					}
				}
			}

			weekRow.Children(func() {
				// Layer 1: 7-column day cells
				ui.Grid(c.Key(fmt.Sprintf("week-grid-%d", r))).Columns(7).Gap(0).Fill().MinHeight(0).MinWidth(0).Children(func() {
					for col := 0; col < 7; col++ {
						day := weekFirstDay.AddDate(0, 0, col)
						dayStr := day.Format("2006-01-02")
						today := nowStr == dayStr
						inMonth := day.Month() == a.selectedDay.Month()
						entries := allByCol[col]
						timedEntries := timedByCol[col]

						rightBorder := float32(1)
						if col == 6 {
							rightBorder = 0
						}

						cellBg := t.BgApp
						if !inMonth {
							cellBg = t.BgSubtle.Alpha(0.45)
						} else if today {
							cellBg = t.Accent.Alpha(0.025)
						}

						cell := ui.Column(c.Key(day.Format("20060102"))).Role(ui.RoleGroup).Label("日历日期 "+dayStr).
							FillHeight().MinWidth(0).MinHeight(0).Padding(monthCellPadTop, 5, monthCellPadBot, 5).Gap(monthSlotGap).Clip().
							Background(cellBg).BorderWidth(0, rightBorder, 0, 0).BorderColor(gridLine)
						moreOpen := ui.Local(cell, "more-open", func() bool { return false })

						cell.Children(func() {
							// Day number badge + Lunar subtitle + refined hover '+'
							ui.Row(c).Height(monthHeaderH).FillWidth().MinWidth(0).Shrink(0).AlignItems(ui.Center).Gap(4).Children(func() {
								label := fmt.Sprint(day.Day())
								dayBtn := ui.ButtonBase(c.Key("day-num")).Label("查看 " + dayStr).Height(24).Radius(12).Center().Shrink(0).
									Cursor(ui.CursorPointer).Disabled(a.busy).
									OnClick(func() { a.selectedDay = day; a.setCalendarMode(0) })
								if day.Day() == 1 && !today {
									label = day.Format("1月2日")
									dayBtn.Padding(0, 6)
								} else {
									dayBtn.Width(24)
								}

								numColor := t.TextPrimary
								weight := 500
								if !inMonth {
									numColor = t.TextTertiary
									weight = 400
								}
								if today {
									dayBtn.Background(t.Accent)
									numColor = t.TextOnAccent
									weight = 600
								} else if dayBtn.Hovered() {
									dayBtn.Background(t.BgHover)
								}
								dayBtn.Children(func() {
									ui.Text(c, label).FontSize(12).FontFeatures("tnum").FontWeight(weight).TextColor(numColor).SingleLine()
								})

								if lunar, ok := solarToLunar(day); ok {
									lunarCol := t.TextTertiary
									if lunar.Day == 1 && inMonth {
										lunarCol = t.Accent
									}
									ui.Text(c, lunar.ShortCellLabel()).FontSize(10).TextColor(lunarCol).SingleLine().Shrink(1).MinWidth(0).AccessHidden(true)
								}
								ui.Spacer(c)

								addBtn := ui.ButtonBase(c.Key("add-day")).Label("在 "+dayStr+" 添加日程").Tooltip("新建日程").
									Size(22, 22).Radius(11).Center().Shrink(0).Cursor(ui.CursorPointer)
								addIconCol := t.TextSecondary
								if !cell.Hovered() && !addBtn.Focused() && !addBtn.Hovered() {
									addBtn.Opacity(0)
								} else if addBtn.Hovered() {
									addBtn.Background(t.BgHover)
									addIconCol = t.TextPrimary
								} else {
									addBtn.Background(t.BgSubtle.Alpha(0.85))
								}
								addBtn.OnClick(func() { a.newCalendarTask(day, 9) }).Children(func() {
									ui.Icon(c, lucide.Plus()).Size(12, 12).TextColor(addIconCol).AccessHidden(true)
								})
							})

							// Reserve vertical lanes occupied by continuous all-day spanning bars
							if reservedLanes[col] > 0 {
								spacerH := float32(reservedLanes[col])*monthSlotStride - monthSlotGap
								ui.Box(c).Height(spacerH).FillWidth().Shrink(0).PassThrough().AccessHidden(true)
							}

							// Render timed events in remaining slots
							remSlots := max(0, usableSlots[col]-reservedLanes[col])
							visibleTimed := min(len(timedEntries), remSlots)
							for j := 0; j < visibleTimed; j++ {
								a.calendarCompactEvent(c.Key(eventKey(timedEntries[j])), timedEntries[j], day, monthSlotH, cell.Hovered())
							}

							hiddenCount := (allDayCountByCol[col] - visibleAllDayCount[col]) + max(0, len(timedEntries)-visibleTimed)
							if hiddenCount > 0 {
								moreBtn := ui.ButtonBase(c.Key("more")).Label("更多日程 "+dayStr).Height(18).Shrink(0).Padding(0, 6).Radius(4).Justify(ui.Start).Cursor(ui.CursorPointer).
									OnClick(func() { *moreOpen = !*moreOpen })
								if moreBtn.Hovered() || *moreOpen {
									moreBtn.Background(t.BgHover)
								}
								moreBtn.Children(func() {
									ui.Text(c, fmt.Sprintf("还有 %d 项", hiddenCount)).FontSize(11).FontWeight(500).TextColor(t.TextSecondary).SingleLine()
								})
								if *moreOpen {
									ui.PopoverBase(c.Key("day-more-pop-"+dayStr), cell, moreOpen, func(panel ui.Element) {
										panel.AttachTo(cell, ui.AnchorBottomStart, ui.AnchorTopStart)
										elevatePopup(c, panel.Width(248).Padding(10).Gap(6).Radius(popoverRadius).Background(t.BgElevated).Label(dayStr+" 全部日程"))
										panel.Children(func() {
											wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[day.Weekday()]
											ui.Row(c).AlignItems(ui.Center).Children(func() {
												ui.Text(c, day.Format("1月2日 ")+wk).FontSize(13).FontWeight(600).TextColor(t.TextPrimary).Grow(1)
												iconButton(c, "关闭当日列表", lucide.X()).Size(22, 22).Padding(3).OnClick(func() { *moreOpen = false })
											})
											ui.Scroll(c.Key("more-list-" + dayStr)).MaxHeight(240).Gap(3).Children(func() {
												for _, ev := range entries {
													a.calendarCompactEvent(c.Key("pop-"+eventKey(ev)), ev, day, 22, true)
												}
											})
										})
									})
								}
							}
						})
						a.calendarDropTarget(c, cell, day, false, false, 0)
					}
				})

				// Layer 2: Continuous spanning all-day event ribbons across columns
				if len(visibleSpans) > 0 {
					ui.Box(c.Key(fmt.Sprintf("week-spans-%d", r))).Absolute().Fill().PassThrough().Clip().Children(func() {
						for _, sp := range visibleSpans {
							a.calendarAllDaySpanBar(c, sp, 7, monthSlotH, monthSlotsTopY+float32(sp.Lane)*monthSlotStride)
						}
					})
				}
			})
		}
	})
}

func (a *App) calendarTimelineView(c *ui.Context, events []api.CalendarEvent, effectiveWidth float32) {
	t := tokensOf(c)
	gridLine := calendarGridLine(c)
	start, end := calendarRange(a.selectedDay, a.calendarMode)
	days := 1
	if a.calendarMode == 1 {
		days = 7
	}
	hourHeight := float32(a.calendarZoom)
	if hourHeight < 40 {
		hourHeight = 56
	}
	gutterW := float32(56)
	tracks := []ui.Track{ui.Fixed(gutterW)}
	for i := 0; i < days; i++ {
		tracks = append(tracks, ui.Fr(1))
	}

	now := time.Now().In(a.location())
	nowStr := now.Format("2006-01-02")
	hasToday := !now.Before(start) && now.Before(end)
	nowTopY := float32(now.Hour()*60+now.Minute()) / 60 * hourHeight
	compactCols := days == 7 && effectiveWidth < 760

	allDaySpans, laneCount := allDaySpansForRange(events, start, days)

	// Band 1: Breathable Weekday + Date Header Row
	ui.Grid(c.Key(fmt.Sprintf("timeline-days-%d", days))).ColumnTracks(tracks...).Shrink(0).
		BorderWidth(0, 0, 1, 0).BorderColor(gridLine.Alpha(0.65)).Children(func() {
		ui.Box(c).FillHeight().BorderWidth(0, 1, 0, 0).BorderColor(gridLine)
		for i := 0; i < days; i++ {
			day := start.AddDate(0, 0, i)
			dayStr := day.Format("2006-01-02")
			today := dayStr == nowStr
			rightW := float32(1)
			if i == days-1 {
				rightW = 0
			}
			colBg := ui.Transparent
			if today {
				colBg = t.Accent.Alpha(0.025)
			}
			ui.Column(c.Key("day-head-"+day.Format("20060102"))).MinWidth(0).Padding(10, 4, 10, 4).
				AlignItems(ui.Center).Background(colBg).BorderWidth(0, rightW, 0, 0).BorderColor(gridLine).Children(func() {
				dayBtn := ui.ButtonBase(c.Key("col-day")).Label("查看 "+dayStr).Padding(2, 6).Radius(8).Cursor(ui.CursorPointer).
					OnClick(func() { a.selectedDay = day; a.setCalendarMode(0) })
				if dayBtn.Hovered() && !today {
					dayBtn.Background(t.BgHover)
				}
				dayBtn.Children(func() {
					ui.Column(c).Gap(4).AlignItems(ui.Center).Children(func() {
						wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[day.Weekday()]
						if !compactCols {
							if lunar, ok := solarToLunar(day); ok {
								wk += " · " + lunar.ShortCellLabel()
							}
						}
						wkCol := t.TextSecondary
						if today {
							wkCol = t.Accent
						}
						ui.Text(c, wk).FontSize(11).FontWeight(500).TextColor(wkCol).SingleLine()
						numBox := ui.Box(c).Size(32, 32).Radius(16).Center()
						numCol := t.TextPrimary
						if today {
							numBox.Background(t.Accent)
							numCol = t.TextOnAccent
						}
						numBox.Children(func() {
							ui.Text(c, fmt.Sprint(day.Day())).FontSize(16.5).FontFeatures("tnum").FontWeight(500).TextColor(numCol)
						})
					})
				})
			})
		}
	})

	// Band 2: Dedicated Spanning All-Day Strip (clean separation below today's circle)
	const (
		allDayBarH   = float32(21)
		allDayStride = float32(24)
		allDayPadY   = float32(5)
	)
	stripH := float32(26)
	if laneCount > 0 {
		stripH = max(float32(31), float32(laneCount)*allDayStride+allDayPadY*2-3)
	}
	allDayRow := ui.Box(c.Key(fmt.Sprintf("timeline-allday-%d", days))).Height(stripH).FillWidth().Shrink(0).
		BorderWidth(0, 0, 1, 0).BorderColor(gridLine)
	allDayRow.Children(func() {
		ui.Grid(c.Key(fmt.Sprintf("timeline-allday-grid-%d", days))).ColumnTracks(tracks...).Fill().Children(func() {
			ui.Row(c).FillHeight().Justify(ui.End).AlignItems(ui.Center).Padding(0, 8).
				BorderWidth(0, 1, 0, 0).BorderColor(gridLine).Children(func() {
				ui.Text(c, "全天").FontSize(10.5).TextColor(t.TextTertiary).SingleLine()
			})
			for i := 0; i < days; i++ {
				day := start.AddDate(0, 0, i)
				dayStr := day.Format("2006-01-02")
				today := dayStr == nowStr
				rightW := float32(1)
				if i == days-1 {
					rightW = 0
				}
				slotBg := ui.Transparent
				if today {
					slotBg = t.Accent.Alpha(0.025)
				}
				dropCell := ui.Box(c.Key("header-"+day.Format("20060102"))).Role(ui.RoleGroup).Label("全天栏 "+dayStr).
					FillHeight().MinWidth(0).Background(slotBg).BorderWidth(0, rightW, 0, 0).BorderColor(gridLine)
				a.calendarDropTarget(c, dropCell, day, true, true, 0)
			}
		})

		if len(allDaySpans) > 0 {
			ui.Box(c.Key("timeline-allday-spans")).Absolute().Left(gutterW).Right(0).Top(0).Bottom(0).PassThrough().Clip().Children(func() {
				for _, sp := range allDaySpans {
					a.calendarAllDaySpanBar(c, sp, days, allDayBarH, allDayPadY+float32(sp.Lane)*allDayStride)
				}
			})
		}
	})

	// Pure Vertical Scroll Timeline Body
	ui.Scroll(c.Key(fmt.Sprintf("timeline-%d", days))).TrackScroll(&a.calendarScroll).Grow(1).MinHeight(0).Children(func() {
		ui.Grid(c).ColumnTracks(tracks...).Children(func() {
			// Time Gutter
			ui.Column(c).Height(24*hourHeight).BorderWidth(0, 1, 0, 0).BorderColor(gridLine).Children(func() {
				for hour := 0; hour < 24; hour++ {
					label := fmt.Sprintf("%02d:00", hour)
					if hour == 0 {
						label = ""
					}
					ui.Row(c).Height(hourHeight).Shrink(0).Justify(ui.End).AlignItems(ui.Start).Padding(2, 8, 0, 0).Children(func() {
						if label != "" {
							ui.Text(c, label).FontSize(10.5).FontFeatures("tnum").TextColor(t.TextTertiary)
						}
					})
				}
				if hasToday {
					badgeY := max(float32(2), min(24*hourHeight-18, nowTopY-8.5))
					ui.Box(c.Key("now-time-pill")).Absolute().Right(5).Top(badgeY).Padding(1.5, 4.5).Radius(4).
						Background(t.Danger).ZIndex(7).PassThrough().AccessHidden(true).Children(func() {
						ui.Text(c, now.Format("15:04")).FontSize(9.5).FontFeatures("tnum").FontWeight(600).TextColor(t.TextOnAccent).SingleLine()
					})
				}
			})

			// Day Columns
			for i := 0; i < days; i++ {
				day := start.AddDate(0, 0, i)
				dayStr := day.Format("2006-01-02")
				today := dayStr == nowStr
				rightW := float32(1)
				if i == days-1 {
					rightW = 0
				}
				colBg := ui.Transparent
				if today {
					colBg = t.Accent.Alpha(0.022)
				}
				column := ui.Column(c.Key("day-"+day.Format("20060102"))).Role(ui.RoleGroup).Label("时间轴 "+dayStr).
					MinWidth(0).Height(24*hourHeight).Background(colBg).BorderWidth(0, rightW, 0, 0).BorderColor(gridLine)
				column.Children(func() {
					for hour := 0; hour < 24; hour++ {
						topBorder := float32(1)
						if hour == 0 {
							topBorder = 0
						}
						slot := ui.ButtonBase(c.Key(hour)).Height(hourHeight).Shrink(0).FillWidth().
							BorderWidth(topBorder, 0, 0, 0).BorderColor(gridLine).
							Label(fmt.Sprintf("在 %s %02d:00 添加日程", dayStr, hour)).
							Disabled(a.busy).OnClick(func() { a.newCalendarTask(day, hour) })
						if slot.Hovered() && !a.calendarDragging {
							slot.Background(t.BgHover)
						}
					}

					for _, segment := range timelineSegments(events, day) {
						width := float32(100) / float32(segment.Lanes)
						a.calendarTimelineButton(c.Key(eventKey(segment.Event)), segment.Event, day, float32((segment.To-segment.From)/60)*hourHeight).
							Absolute().Top(float32(segment.From/60) * hourHeight).
							LeftPercent(float32(segment.Lane) * width).WidthPercent(width)
					}

					// Live Current-Time Red Indicator Line + Left Dot (always layered above cards)
					if !now.Before(day) && now.Before(day.AddDate(0, 0, 1)) && now.Before(end) {
						ui.Box(c.Key("now-line")).Absolute().Left(0).Right(0).Top(nowTopY - 0.875).Height(1.75).
							Background(t.Danger).ZIndex(6).PassThrough().AccessHidden(true)
						ui.Box(c.Key("now-dot")).Absolute().Left(-4.5).Top(nowTopY-4.5).Size(9, 9).Radius(4.5).
							Background(t.Danger).Border(1.5, t.BgApp).ZIndex(7).PassThrough().AccessHidden(true)
					}

					a.calendarDropPreview(c, column, day, hourHeight)
				})
				a.calendarDropTarget(c, column, day, true, false, hourHeight)
			}
		})
	})
}

func (a *App) calendarAgendaView(c *ui.Context, events []api.CalendarEvent) {
	t := tokensOf(c)
	gridLine := calendarGridLine(c)
	agendaRoot := ui.Column(c.Key("agenda-root")).FillWidth().Grow(1).MinWidth(0).MinHeight(0).Padding(12, 24).AlignItems(ui.Center)
	listState := ui.Local(agendaRoot, "agenda-list", func() ui.ListState { return ui.ListState{} })

	agendaRoot.Children(func() {
		// Schedule stream (selected day + upcoming 14 days), constrained to comfortable 840px reading width
		type agendaDayGroup struct {
			day     time.Time
			entries []api.CalendarEvent
		}
		var groups []agendaDayGroup
		baseDay := dayStart(a.selectedDay)
		nowDay := dayStart(time.Now().In(a.location()))
		for offset := 0; offset < 14; offset++ {
			d := baseDay.AddDate(0, 0, offset)
			dayEntries := eventsForDay(events, d)
			if offset > 0 && len(dayEntries) == 0 {
				continue
			}
			groups = append(groups, agendaDayGroup{day: d, entries: dayEntries})
		}

		ui.Column(c.Key("agenda-stream")).FillWidth().MaxWidth(840).Grow(1).MinWidth(0).MinHeight(0).Children(func() {
			ui.List(c, listState, len(groups), func(i int) {
				g := groups[i]
				today := g.day.Equal(nowDay)
				wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[g.day.Weekday()]

				ui.Row(c).FillWidth().MinWidth(0).Padding(14, 4).Gap(16).BorderWidth(0, 0, 1, 0).BorderColor(gridLine).AlignItems(ui.Start).Children(func() {
					// Left Date Column: circular day numeral + month/weekday + lunar
					ui.Row(c).Width(116).Shrink(0).Gap(8).AlignItems(ui.Center).Children(func() {
						badge := ui.Box(c).Size(30, 30).Radius(15).Center().Shrink(0)
						numCol := t.TextPrimary
						if today {
							badge.Background(t.Accent)
							numCol = t.TextOnAccent
						}
						badge.Children(func() {
							ui.Text(c, fmt.Sprint(g.day.Day())).FontSize(15).FontFeatures("tnum").FontWeight(600).TextColor(numCol)
						})
						subCol := t.TextSecondary
						if today {
							subCol = t.Accent
						}
						ui.Column(c).Gap(1).Children(func() {
							ui.Text(c, fmt.Sprintf("%d月, %s", g.day.Month(), wk)).FontSize(11.5).FontWeight(500).TextColor(subCol).SingleLine()
							if lunar, ok := solarToLunar(g.day); ok {
								ui.Text(c, lunar.MonthLabel()+lunar.DayLabel()).FontSize(10).TextColor(t.TextTertiary).SingleLine().AccessHidden(true)
							}
						})
					})

					// Right Events Column
					ui.Column(c).Grow(1).MinWidth(0).Gap(4).Children(func() {
						if len(g.entries) == 0 {
							ui.Row(c).FillWidth().MinWidth(0).Height(32).AlignItems(ui.Center).Children(func() {
								ui.Text(c, "暂无日程").FontSize(12.5).TextColor(t.TextTertiary).Grow(1)
								iconButton(c, "在 "+g.day.Format("2006-01-02")+" 添加日程", lucide.Plus()).Size(26, 26).Padding(5).OnClick(func() {
									a.newCalendarTask(g.day, 9)
								})
							})
							return
						}
						for _, ev := range g.entries {
							accent := a.calendarEventAccent(c, ev)
							done := ev.ExtendedProps.Status == "completed"
							selected := a.calendarEventSelected(ev)

							row := ui.Row(c.Key(eventKey(ev))).FillWidth().MinWidth(0).MinHeight(34).Padding(6, 10).Radius(8).Gap(12).AlignItems(ui.Center).Cursor(ui.CursorPointer).
								OnClick(func() { a.openCalendarEvent(ev) })
							if selected {
								selMix := float32(0.09)
								if c.Theme().Dark {
									selMix = 0.18
								}
								row.Background(t.BgApp.Mix(accent, selMix)).Border(1, accent.Alpha(0.28))
							} else if row.Hovered() {
								row.Background(t.BgHover)
							}

							row.Children(func() {
								dotCol := accent
								if done {
									dotCol = accent.Alpha(0.45)
								}
								ui.Box(c).Size(7, 7).Radius(3.5).Background(dotCol).Shrink(0).AccessHidden(true)

								timeCol := "全天"
								if !ev.AllDay {
									if st, err := eventDate(ev.Start, g.day.Location()); err == nil {
										timeCol = st.Format("15:04")
										if en, err2 := eventDate(ev.End, g.day.Location()); err2 == nil && en.After(st) {
											timeCol += " – " + en.Format("15:04")
										}
									}
								}
								ui.Text(c, timeCol).Width(94).Shrink(0).FontSize(12).FontFeatures("tnum").TextColor(t.TextSecondary).SingleLine()

								ui.Column(c).Grow(1).MinWidth(0).Gap(3).Children(func() {
									ui.Row(c).FillWidth().MinWidth(0).Gap(6).AlignItems(ui.Center).Children(func() {
										btn := ui.ButtonBase(c).Label("日程 " + g.day.Format("2006-01-02") + " " + ev.Title).Justify(ui.Start).Padding(0).Shrink(1).MinWidth(0).
											OnClick(func() { a.openCalendarEvent(ev) })
										btn.Children(func() {
											titleTxt := ui.Text(c, ev.Title).FontSize(13).FontWeight(500).TextColor(t.TextPrimary).SingleLine().MinWidth(0)
											if done {
												titleTxt.Strikethrough().TextColor(t.TextSecondary)
											}
										})

										if dayIdx, totalDays, startDay, endDay, ok := multiDayEventInfo(ev, g.day); ok {
											pillText := fmt.Sprintf("第 %d/%d 天 · %s–%s", dayIdx, totalDays, startDay.Format("1/2"), endDay.Format("1/2"))
											pillMix := float32(0.11)
											if c.Theme().Dark {
												pillMix = 0.22
											}
											ui.Box(c).Padding(1.5, 6).Radius(4).Background(t.BgApp.Mix(accent, pillMix)).Shrink(0).
												Tooltip(fmt.Sprintf("%s – %s · 共 %d 天", startDay.Format("1月2日"), endDay.Format("1月2日"), totalDays)).Children(func() {
												ui.Text(c, pillText).FontSize(10.5).FontFeatures("tnum").FontWeight(500).TextColor(accent).SingleLine()
											})
										}

										if ev.ExtendedProps.ReadOnly {
											ui.Row(c).Gap(3).Padding(1.5, 6).Radius(4).Background(t.BgSubtle).AlignItems(ui.Center).Shrink(0).
												Tooltip("外部日历 · 只读").Children(func() {
												ui.Icon(c, lucide.Cloud()).Size(11, 11).TextColor(t.TextTertiary).AccessHidden(true)
												ui.Text(c, "外部").FontSize(10.5).TextColor(t.TextTertiary).SingleLine()
											})
										}
									})

									if cleanDesc := agendaSummaryText(ev.ExtendedProps.Description); cleanDesc != "" {
										ui.Text(c, cleanDesc).FontSize(11.5).MaxLines(1).MinWidth(0).TextColor(t.TextSecondary)
									}
								})
							})
						}
					})
				})
			}).Grow(1).MinHeight(0)
		})
	})
}

func (a *App) calendarEventDialog(c *ui.Context) {
	open := a.calendarDetail != nil
	appDialog(c, &open, func() {
		if a.calendarDetail == nil {
			return
		}
		t := tokensOf(c)
		event := *a.calendarDetail
		ui.Text(c, event.Title).FontSize(fontTitle).FontWeight(600)
		appBadge(c, "外部日历 · 只读").AlignSelf(ui.Start)
		start, end, err := eventBounds(event, a.location())
		if err == nil {
			ui.Text(c, start.Format("2006-01-02 15:04 MST")+" — "+end.Format("2006-01-02 15:04 MST")).FontSize(12).TextColor(t.TextSecondary)
		}
		ui.Scroll(c).MaxHeight(280).Gap(10).Children(func() {
			if event.ExtendedProps.Description != "" {
				ui.Text(c, event.ExtendedProps.Description).FontSize(13)
			}
			for _, field := range []struct{ label, value string }{{"地点", event.ExtendedProps.Location}, {"组织者", event.ExtendedProps.Organizer}, {"会议链接", event.ExtendedProps.MeetingLink}, {"来源", event.ExtendedProps.Source}} {
				if field.value != "" {
					ui.Text(c, field.label+"："+field.value).FontSize(12).TextColor(t.TextSecondary)
				}
			}
		})
		appButton(c, "关闭日程", "secondary").AlignSelf(ui.End).OnClick(func() { a.calendarDetail = nil })
	}).Width(540)
	if !open {
		a.calendarDetail = nil
	}
}
