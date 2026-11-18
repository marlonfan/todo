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

func (a *App) calendarEventAccent(c *ui.Context, event api.CalendarEvent) ui.Color {
	t := tokensOf(c)
	if event.ExtendedProps.ReadOnly || event.ExtendedProps.Source == "caldav" {
		if c.Theme().Dark {
			return ui.Hex("#9F8FEF")
		}
		return ui.Hex("#6E5DC6")
	}
	for _, task := range a.tasks {
		if task.ID == event.ExtendedProps.TaskID {
			for _, cat := range task.Categories {
				if strings.HasPrefix(cat.Color, "#") && len(cat.Color) == 7 {
					return ui.Hex(cat.Color)
				}
			}
			break
		}
	}
	if event.ExtendedProps.Priority > 0 {
		return t.Warning
	}
	return t.Accent
}

func (a *App) calendarView(c *ui.Context) {
	t := tokensOf(c)
	state := a.cache
	if state.Calendar != nil && state.Calendar.Timezone != a.location().String() {
		state.Calendar = nil
	}
	events := filterCalendarEvents(projectedCalendar(state), a.calendarFilter)
	windowWidth, _ := c.Size()

	ui.Column(c.Key("calendar-content")).Grow(1).MinHeight(0).MinWidth(0).Background(t.BgApp).Children(func() {
		// Google Calendar-inspired Toolbar: [今天]  < >  2026年 11月      [日|周|月|日程]  ⚲  - +  [+]
		ui.Row(c.Key("calendar-toolbar")).Height(toolbarHeight).Padding(0, 16).Gap(6).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).AlignItems(ui.Center).Children(func() {
			if windowWidth < 1180 {
				iconButton(c, "展开导航", lucide.PanelLeft()).OnClick(func() { a.sidebarOverlay = true })
			}

			// Outlined Google-style "Today" pill
			todayBtn := ui.ButtonBase(c.Key("cal-today")).Label("回到今天").Tooltip("回到今天").
				Height(28).Padding(0, 12).Radius(14).Center().Border(1, t.BorderDefault).Background(ui.Transparent).Cursor(ui.CursorPointer).
				OnClick(func() {
					a.selectedDay = time.Now().In(a.location())
					a.focusCalendarWorkingHours()
					a.loadCalendar()
				})
			if todayBtn.Hovered() {
				todayBtn.Background(t.BgHover)
			}
			todayBtn.Children(func() {
				ui.Text(c, "今天").FontSize(12).FontWeight(500).TextColor(t.TextPrimary)
			})

			// Clean circular Prev / Next arrows without an enclosing box
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

			jumpHolder := ui.Box(c.Key("cal-jump-holder")).Shrink(0)
			jumpOpen := ui.Local(jumpHolder, "open", func() bool { return false })
			var titleAnchor ui.Element
			jumpHolder.Children(func() {
				titleAnchor = ui.ButtonBase(c.Key("cal-period-title")).Label("日历定位日期").Tooltip("点击快速跳转日期").
					Height(30).Padding(0, 8).Radius(6).Cursor(ui.CursorPointer).OnClick(func() { *jumpOpen = !*jumpOpen })
				if titleAnchor.Hovered() || *jumpOpen {
					titleAnchor.Background(t.BgHover)
				}
				titleAnchor.Children(func() {
					ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
						ui.Text(c, title).FontSize(16.5).FontWeight(600).TextColor(t.TextPrimary).SingleLine()
						ui.Icon(c, lucide.ChevronDown()).Size(13, 13).TextColor(t.TextSecondary).AccessHidden(true)
					})
				})
				if *jumpOpen {
					ui.PopoverBase(c.Key("cal-jump-popover"), titleAnchor, jumpOpen, func(panel ui.Element) {
						panel.AttachTo(titleAnchor, ui.AnchorBottomStart, ui.AnchorTopStart)
						elevatePopup(c, panel.Padding(12).Width(268).Radius(popoverRadius).Background(t.BgApp).Label("选择跳转日期"))
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

			if a.calendarMode < 2 && windowWidth >= 960 {
				zoomStep := func(delta float64) {
					oldZoom := max(40.0, a.calendarZoom)
					topHour := float64(a.calendarScroll.Y) / oldZoom
					a.calendarZoom = min(96, max(40, a.calendarZoom+delta))
					a.calendarScroll.Y = float32(topHour * a.calendarZoom)
				}
				zOut := ui.ButtonBase(c.Key("zoom-out")).Label("缩小时间轴").Tooltip("缩小时间轴").Size(28, 28).Radius(14).Center().Cursor(ui.CursorPointer).
					Disabled(a.calendarZoom <= 40).OnClick(func() { zoomStep(-8) })
				if zOut.Hovered() {
					zOut.Background(t.BgHover)
				}
				zOut.Children(func() { ui.Icon(c, lucide.Minus()).Size(14, 14).TextColor(t.TextSecondary).AccessHidden(true) })

				zIn := ui.ButtonBase(c.Key("zoom-in")).Label("放大时间轴").Tooltip("放大时间轴").Size(28, 28).Radius(14).Center().Cursor(ui.CursorPointer).
					Disabled(a.calendarZoom >= 96).OnClick(func() { zoomStep(8) })
				if zIn.Hovered() {
					zIn.Background(t.BgHover)
				}
				zIn.Children(func() { ui.Icon(c, lucide.Plus()).Size(14, 14).TextColor(t.TextSecondary).AccessHidden(true) })
			}

			// Icon-only source filter menu (keeps toolbar uncluttered)
			filterHolder := ui.Box(c.Key("cal-filter-holder")).Shrink(0)
			filterOpen := ui.Local(filterHolder, "open", func() bool { return false })
			filterHolder.Children(func() {
				items := []overlay.MenuItem{
					{Key: "0", Label: "显示全部日程"},
					{Key: "1", Label: "仅显示 Todo 任务"},
					{Key: "2", Label: "仅显示外部日历"},
				}
				choice := appDropdown(c, filterOpen, items, func(trigger ui.Element) {
					trigger.Label("日程来源").Tooltip("筛选日程来源").Size(28, 28).Radius(6).Center().Cursor(ui.CursorPointer)
					if a.calendarFilter != 0 {
						trigger.Background(t.BgSelected)
					} else if trigger.Hovered() {
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

			if appSegmented(c, &a.calendarMode, calendarModes, action.SegmentedProps{Size: theme.Small}).Label("日历视图").Changed() {
				a.setCalendarMode(a.calendarMode)
			}

			// Compact iconic "+" create action instead of a bulky text button
			addBtn := ui.ButtonBase(c.Key("cal-create")).Label("添加日程").Tooltip("新建日程").Size(28, 28).Radius(7).Center().
				Background(t.Accent).Cursor(ui.CursorPointer).Disabled(a.busy).OnClick(a.newTask)
			if addBtn.Hovered() {
				addBtn.Background(t.AccentHover)
			}
			addBtn.Children(func() {
				ui.Icon(c, lucide.Plus()).Size(15, 15).TextColor(t.TextOnAccent).AccessHidden(true)
			})
		})

		start, end := calendarRange(a.selectedDay, a.calendarMode)
		if !calendarCovered(a.cache, start, end, a.location().String()) && !a.calendarLoading && !a.syncing {
			ui.Row(c).Padding(4, 16).Gap(8).AlignItems(ui.Center).Background(t.BgSubtle).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).Children(func() {
				ui.Icon(c, lucide.Info()).Size(13, 13).TextColor(t.TextSecondary)
				ui.Text(c, "当前范围仅显示本机已缓存日程，联网刷新可同步完整周期与外部日历").FontSize(11).TextColor(t.TextSecondary).Grow(1)
				iconButton(c, "刷新日历范围", lucide.RefreshCw()).Size(24, 24).Padding(4).OnClick(a.loadCalendar)
			})
		}

		// Edge-to-edge full-bleed canvas for Month & Week/Day, matching Google Calendar
		ui.Column(c.Key("calendar-surface")).Background(t.BgApp).Grow(1).MinHeight(0).MinWidth(0).Clip().Children(func() {
			switch a.calendarMode {
			case 0, 1:
				a.calendarTimelineView(c, events)
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

// Google Calendar-style compact event item:
// - All-day / multi-day events render as solid pastel pills.
// - Timed events render as clean dot + time + title rows without heavy boxes.
func (a *App) calendarEventButton(c *ui.Context, event api.CalendarEvent, day time.Time) ui.Element {
	t := tokensOf(c)
	accent := a.calendarEventAccent(c, event)
	done := event.ExtendedProps.Status == "completed"

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
		mixAmt := float32(0.18)
		if c.Theme().Dark {
			mixAmt = 0.28
		}
		if done {
			mixAmt *= 0.55
		}
		e.Background(t.BgApp.Mix(accent, mixAmt))
		if e.Hovered() {
			e.Background(t.BgApp.Mix(accent, min(0.42, mixAmt+0.08)))
		}
	} else {
		e.Background(ui.Transparent)
		if e.Hovered() {
			e.Background(t.BgHover)
		}
	}

	e.Children(func() {
		if !event.AllDay {
			dotCol := accent
			if done {
				dotCol = accent.Alpha(0.5)
			}
			ui.Box(c).Size(6, 6).Radius(3).Margin(0, 5, 0, 0).Background(dotCol).Shrink(0).AccessHidden(true)
		}
		timeStr := eventTimePrefix(event, day)
		if timeStr != "" {
			ui.Text(c, timeStr).FontSize(11).FontFeatures("tnum").FontWeight(400).TextColor(t.TextSecondary).Margin(0, 4, 0, 0).Shrink(0).SingleLine().AccessHidden(true)
		}
		weight := 500
		if event.AllDay {
			weight = 600
		}
		txt := ui.Text(c, event.Title).FontSize(11.5).FontWeight(weight).TextColor(fg).SingleLine().Grow(1).MinWidth(0).AccessHidden(true)
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

	mixAmt := float32(0.16)
	if c.Theme().Dark {
		mixAmt = 0.26
	}
	if done {
		mixAmt *= 0.55
	}
	cardBg := t.BgApp.Mix(accent, mixAmt)
	fg := t.TextPrimary
	if done {
		fg = t.TextSecondary
	}

	// 1px gap around timeline cards so adjacent/overlapping items separate cleanly like Google Calendar
	frame := ui.Box(c).Height(height).MinWidth(0).Padding(0.5, 2, 1, 1)
	frame.Children(func() {
		e := ui.ButtonBase(c.Key("event")).Label("日程 "+day.Format("2006-01-02")+" "+event.Title).Fill().MinWidth(0).Padding(4, 7, 5, 9).Radius(4).Clip().
			Justify(ui.Start).AlignItems(ui.Start).Background(cardBg).Border(1, accent.Alpha(0.24)).Cursor(ui.CursorPointer).
			Tooltip(eventLabel(event, day) + "\n" + event.Start).Disabled(a.busy).
			OnClick(func() { a.openCalendarEvent(event) })
		if e.Hovered() {
			e.Background(t.BgApp.Mix(accent, min(0.38, mixAmt+0.08))).BorderColor(accent.Alpha(0.42))
		}
		e.Children(func() {
			ui.Box(c).Absolute().Left(0).Top(0).Bottom(0).Width(3).Background(accent).PassThrough().AccessHidden(true)
			timeStr := eventTimePrefix(event, day)
			if height < 40 {
				ui.Row(c).Gap(5).MinWidth(0).AlignItems(ui.Center).AccessHidden(true).Children(func() {
					txt := ui.Text(c, event.Title).SingleLine().FontSize(11.5).FontWeight(600).TextColor(fg).Shrink(1).MinWidth(0)
					if done {
						txt.Strikethrough()
					}
					if timeStr != "" {
						ui.Text(c, timeStr).FontSize(10.5).FontFeatures("tnum").TextColor(t.TextSecondary).Shrink(0).SingleLine()
					}
				})
			} else {
				ui.Column(c).FillWidth().MinWidth(0).Gap(2).AccessHidden(true).Children(func() {
					txt := ui.Text(c, event.Title).MaxLines(max(1, int((height-22)/16))).FontSize(12).FontWeight(600).TextColor(fg)
					if done {
						txt.Strikethrough()
					}
					if timeStr != "" {
						rangeText := timeStr
						if end, err := eventDate(event.End, day.Location()); err == nil {
							rangeText += " – " + end.Format("15:04")
						}
						ui.Text(c, rangeText).SingleLine().FontSize(10.5).FontFeatures("tnum").TextColor(t.TextSecondary)
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
	start, _ := calendarRange(a.selectedDay, 2)
	_, winHeight := c.Size()

	rows := 6
	sixthRowFirst := start.AddDate(0, 0, 35)
	curMonthStart := time.Date(a.selectedDay.Year(), a.selectedDay.Month(), 1, 0, 0, 0, 0, a.selectedDay.Location())
	if sixthRowFirst.After(curMonthStart) && sixthRowFirst.Month() != a.selectedDay.Month() {
		rows = 5
	}

	// Google Calendar Weekday Header
	ui.Grid(c.Key("month-weekdays")).Columns(7).Gap(0).Height(28).Shrink(0).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).Children(func() {
		for i, name := range []string{"周一", "周二", "周三", "周四", "周五", "周六", "周日"} {
			rightB := float32(1)
			if i == 6 {
				rightB = 0
			}
			ui.Box(c).FillHeight().Center().BorderWidth(0, rightB, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
				ui.Text(c, name).FontSize(11).FontWeight(500).TextColor(t.TextSecondary)
			})
		}
	})

	nowStr := time.Now().In(a.location()).Format("2006-01-02")
	estRowH := max(float32(72), (winHeight-float32(toolbarHeight)-28)/float32(rows))

	// Equal-height flex week rows: fills 100% of the viewport and clips each cell
	// strictly so events can NEVER spill out or be overlapped by the row below!
	ui.Column(c.Key("month-grid")).Grow(1).MinHeight(0).MinWidth(0).Children(func() {
		for r := 0; r < rows; r++ {
			bottomBorder := float32(1)
			if r == rows-1 {
				bottomBorder = 0
			}
			weekRow := ui.Grid(c.Key(fmt.Sprintf("week-%d", r))).Columns(7).Gap(0).
				Grow(1).Basis(0).MinHeight(0).MinWidth(0).
				BorderWidth(0, 0, bottomBorder, 0).BorderColor(t.BorderSubtle)
			rowH := weekRow.Bounds().H
			if rowH <= 0 {
				rowH = estRowH
			}
			// Exact slot budget: 24px day number header + 8px vertical padding = 32px
			// Each event row is 19px + 2px gap = 21px.
			availH := max(float32(0), rowH-32)
			totalSlots := int((availH + 2) / 21)

			weekRow.Children(func() {
				for col := 0; col < 7; col++ {
					day := start.AddDate(0, 0, r*7+col)
					dayStr := day.Format("2006-01-02")
					today := nowStr == dayStr
					inMonth := day.Month() == a.selectedDay.Month()
					entries := eventsForDay(events, day)

					rightBorder := float32(1)
					if col == 6 {
						rightBorder = 0
					}

					cellBg := t.BgApp
					if !inMonth {
						cellBg = t.BgSubtle.Alpha(0.55)
					}

					cell := ui.Column(c.Key(day.Format("20060102"))).Role(ui.RoleGroup).Label("日历日期 "+dayStr).
						FillHeight().MinWidth(0).MinHeight(0).Padding(4, 5).Gap(2).Clip().
						Background(cellBg).BorderWidth(0, rightBorder, 0, 0).BorderColor(t.BorderSubtle)
					moreOpen := ui.Local(cell, "more-open", func() bool { return false })

					cell.Children(func() {
						// Google Calendar day badge + Lunar date subtitle + quiet hover '+' in corner
						ui.Row(c).Height(24).FillWidth().Shrink(0).AlignItems(ui.Center).Gap(4).Children(func() {
							label := fmt.Sprint(day.Day())
							dayBtn := ui.ButtonBase(c.Key("day-num")).Label("查看 " + dayStr).Height(24).Radius(12).Center().
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
								ui.Text(c, lunar.ShortCellLabel()).FontSize(10).TextColor(lunarCol).SingleLine().AccessHidden(true)
							}
							ui.Spacer(c)

							addBtn := ui.ButtonBase(c.Key("add-day")).Label("在 "+dayStr+" 添加日程").Tooltip("新建日程").
								Size(20, 20).Radius(10).Center().Shrink(0).Cursor(ui.CursorPointer)
							if !cell.Hovered() && !addBtn.Focused() {
								addBtn.Opacity(0)
							} else if addBtn.Hovered() {
								addBtn.Background(t.BgHover)
							}
							addBtn.OnClick(func() { a.newCalendarTask(day, 9) }).Children(func() {
								ui.Icon(c, lucide.Plus()).Size(12, 12).TextColor(t.TextSecondary).AccessHidden(true)
							})
						})

						// Calculate exact visible count without ever overflowing into "+N 项"
						visibleCount := len(entries)
						needMore := false
						if len(entries) > totalSlots {
							needMore = true
							visibleCount = max(0, totalSlots-1)
						}

						for j := 0; j < visibleCount; j++ {
							a.calendarCompactEvent(c.Key(eventKey(entries[j])), entries[j], day, 19, cell.Hovered())
						}
						if needMore {
							rem := len(entries) - visibleCount
							moreBtn := ui.ButtonBase(c.Key("more")).Label("更多日程 "+dayStr).Height(18).Shrink(0).Padding(0, 6).Radius(4).Justify(ui.Start).Cursor(ui.CursorPointer).
								OnClick(func() { *moreOpen = !*moreOpen })
							if moreBtn.Hovered() || *moreOpen {
								moreBtn.Background(t.BgHover)
							}
							moreBtn.Children(func() {
								ui.Text(c, fmt.Sprintf("还有 %d 项", rem)).FontSize(11).FontWeight(600).TextColor(t.TextSecondary).SingleLine()
							})
							if *moreOpen {
								ui.PopoverBase(c.Key("day-more-pop-"+dayStr), cell, moreOpen, func(panel ui.Element) {
									panel.AttachTo(cell, ui.AnchorBottomStart, ui.AnchorTopStart)
									elevatePopup(c, panel.Width(240).Padding(10).Gap(6).Radius(popoverRadius).Background(t.BgApp).Label(dayStr+" 全部日程"))
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
		}
	})
}

func (a *App) calendarTimelineView(c *ui.Context, events []api.CalendarEvent) {
	t := tokensOf(c)
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

	maxAllDay := 0
	for i := 0; i < days; i++ {
		day := start.AddDate(0, 0, i)
		cnt := 0
		for _, ev := range eventsForDay(events, day) {
			if ev.AllDay {
				cnt++
			}
		}
		if cnt > maxAllDay {
			maxAllDay = cnt
		}
	}

	// Google Calendar Stacked Week/Day Header (Weekday label above large circular numeral)
	ui.Grid(c.Key(fmt.Sprintf("timeline-header-%d", days))).ColumnTracks(tracks...).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).Children(func() {
		ui.Column(c).Justify(ui.End).AlignItems(ui.End).Padding(6, 8).BorderWidth(0, 1, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
			if maxAllDay > 0 {
				ui.Text(c, "全天").FontSize(10.5).TextColor(t.TextTertiary)
			}
		})
		for i := 0; i < days; i++ {
			day := start.AddDate(0, 0, i)
			dayStr := day.Format("2006-01-02")
			today := dayStr == nowStr
			rightW := float32(1)
			if i == days-1 {
				rightW = 0
			}
			header := ui.Column(c.Key("header-"+day.Format("20060102"))).Role(ui.RoleGroup).Label("全天栏 "+dayStr).
				MinWidth(0).Padding(8, 4, 6, 4).Gap(4).BorderWidth(0, rightW, 0, 0).BorderColor(t.BorderSubtle)
			header.Children(func() {
				dayBtn := ui.ButtonBase(c.Key("col-day")).Label("查看 "+dayStr).AlignSelf(ui.Center).Padding(2, 6).Radius(8).Cursor(ui.CursorPointer).
					OnClick(func() { a.selectedDay = day; a.setCalendarMode(0) })
				if dayBtn.Hovered() && !today {
					dayBtn.Background(t.BgHover)
				}
				dayBtn.Children(func() {
					ui.Column(c).Gap(2).AlignItems(ui.Center).Children(func() {
						wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[day.Weekday()]
						if lunar, ok := solarToLunar(day); ok {
							wk += " · " + lunar.ShortCellLabel()
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
							ui.Text(c, fmt.Sprint(day.Day())).FontSize(17).FontFeatures("tnum").FontWeight(500).TextColor(numCol)
						})
					})
				})
				for _, event := range eventsForDay(events, day) {
					if event.AllDay {
						a.calendarCompactEvent(c.Key(eventKey(event)), event, day, 20, header.Hovered())
					}
				}
			})
			a.calendarDropTarget(c, header, day, true, true, 0)
		}
	})

	// Pure Vertical Scroll Timeline Body
	ui.Scroll(c.Key(fmt.Sprintf("timeline-%d", days))).TrackScroll(&a.calendarScroll).Grow(1).MinHeight(0).Children(func() {
		ui.Grid(c).ColumnTracks(tracks...).Children(func() {
			// Time Gutter
			ui.Column(c).Height(24*hourHeight).BorderWidth(0, 1, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
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
			})

			// Day Columns
			for i := 0; i < days; i++ {
				day := start.AddDate(0, 0, i)
				dayStr := day.Format("2006-01-02")
				rightW := float32(1)
				if i == days-1 {
					rightW = 0
				}
				column := ui.Column(c.Key("day-"+day.Format("20060102"))).Role(ui.RoleGroup).Label("时间轴 "+dayStr).
					MinWidth(0).Height(24*hourHeight).BorderWidth(0, rightW, 0, 0).BorderColor(t.BorderSubtle)
				column.Children(func() {
					for hour := 0; hour < 24; hour++ {
						topBorder := float32(1)
						if hour == 0 {
							topBorder = 0
						}
						slot := ui.ButtonBase(c.Key(hour)).Height(hourHeight).Shrink(0).FillWidth().
							BorderWidth(topBorder, 0, 0, 0).BorderColor(t.BorderSubtle).
							Label(fmt.Sprintf("在 %s %02d:00 添加日程", dayStr, hour)).
							Disabled(a.busy).OnClick(func() { a.newCalendarTask(day, hour) })
						if slot.Hovered() && !a.calendarDragging {
							slot.Background(t.BgHover.Alpha(0.5))
						}
					}

					for _, segment := range timelineSegments(events, day) {
						width := float32(100) / float32(segment.Lanes)
						a.calendarTimelineButton(c.Key(eventKey(segment.Event)), segment.Event, day, float32((segment.To-segment.From)/60)*hourHeight).
							Absolute().Top(float32(segment.From/60) * hourHeight).
							LeftPercent(float32(segment.Lane) * width).WidthPercent(width)
					}

					// Google Calendar Current-Time Indicator Line + Left Dot
					if !now.Before(day) && now.Before(day.AddDate(0, 0, 1)) && now.Before(end) {
						topY := float32(now.Hour()*60+now.Minute()) / 60 * hourHeight
						ui.Box(c).Absolute().Left(0).Right(0).Top(topY).Height(1.5).Background(t.Accent).PassThrough().AccessHidden(true)
						ui.Box(c).Absolute().Left(-4).Top(topY-3.5).Size(8, 8).Radius(4).Background(t.Accent).PassThrough().AccessHidden(true)
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
	agendaRoot := ui.Row(c.Key("agenda-root")).FillWidth().Grow(1).MinWidth(0).MinHeight(0).Padding(12, 24).AlignItems(ui.Stretch)
	listState := ui.Local(agendaRoot, "agenda-list", func() ui.ListState { return ui.ListState{} })

	agendaRoot.Children(func() {
		// Google Calendar Schedule Stream (selected day + upcoming 14 days, full width without bulky side calendar)
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

		ui.Column(c).Grow(1).MinWidth(0).MinHeight(0).Children(func() {
			ui.List(c, listState, len(groups), func(i int) {
				g := groups[i]
				today := g.day.Equal(nowDay)
				wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[g.day.Weekday()]

				ui.Row(c).FillWidth().MinWidth(0).Padding(12, 4).Gap(16).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).AlignItems(ui.Start).Children(func() {
					// Left Google-Schedule Date Column: circular day numeral + month/weekday
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
					ui.Column(c).Grow(1).MinWidth(0).Gap(2).Children(func() {
						if len(g.entries) == 0 {
							ui.Row(c).FillWidth().MinWidth(0).Height(30).AlignItems(ui.Center).Children(func() {
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
							row := ui.Row(c.Key(eventKey(ev))).FillWidth().MinWidth(0).MinHeight(32).Padding(5, 8).Radius(6).Gap(12).AlignItems(ui.Center).Cursor(ui.CursorPointer).
								OnClick(func() { a.openCalendarEvent(ev) })
							if row.Hovered() {
								row.Background(t.BgHover)
							}
							row.Children(func() {
								ui.Box(c).Size(8, 8).Radius(4).Background(accent).Shrink(0).AccessHidden(true)
								timeCol := "全天"
								if !ev.AllDay {
									if st, err := eventDate(ev.Start, g.day.Location()); err == nil {
										timeCol = st.Format("15:04")
										if en, err2 := eventDate(ev.End, g.day.Location()); err2 == nil && en.After(st) {
											timeCol += " – " + en.Format("15:04")
										}
									}
								}
								ui.Text(c, timeCol).Width(92).Shrink(0).FontSize(12).FontFeatures("tnum").TextColor(t.TextSecondary)
								ui.Column(c).Grow(1).MinWidth(0).Gap(2).Children(func() {
									btn := ui.ButtonBase(c).Label("日程 " + g.day.Format("2006-01-02") + " " + ev.Title).Justify(ui.Start).Padding(0).MinWidth(0).
										OnClick(func() { a.openCalendarEvent(ev) })
									btn.Children(func() {
										titleTxt := ui.Text(c, ev.Title).FontSize(13).FontWeight(500).TextColor(t.TextPrimary).SingleLine()
										if done {
											titleTxt.Strikethrough().TextColor(t.TextSecondary)
										}
									})
									if cleanDesc := plainMarkdownPreview(ev.ExtendedProps.Description); cleanDesc != "" {
										ui.Text(c, cleanDesc).FontSize(11.5).MaxLines(1).MinWidth(0).TextColor(t.TextSecondary)
									}
								})
								if ev.ExtendedProps.ReadOnly {
									ui.Icon(c, lucide.Cloud()).Size(13, 13).TextColor(t.TextTertiary).Tooltip("外部日历 · 只读")
								}
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
