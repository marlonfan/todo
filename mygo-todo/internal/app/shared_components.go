package app

import (
	"fmt"
	"strconv"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
)

// appInput keeps native text editing, IME, focus and validation behavior. Callers
// can attach Placeholder, OnChange, Error and Ref to the returned element.
func appInput(c *ui.Context, value *string, label string) ui.Element {
	t := tokensOf(c)
	e := ui.TextInput(c, value).Label(label).MinHeight(32).FontSize(fontBody).FontWeight(fontWeightRegular).Radius(controlRadius).
		Background(t.BgSubtle).Border(1, t.BorderSubtle).TextColor(t.TextPrimary).PlaceholderColor(t.TextReadable).FocusRingColor(t.Accent)
	if e.Focused() {
		e.Background(t.BgElevated).BorderColor(t.Accent)
	} else if e.Hovered() {
		e.BorderColor(t.BorderDefault)
	}
	return e
}

func appCheckbox(c *ui.Context, value *bool, label string) ui.Element {
	return ui.Checkbox(c, value, label).FontSize(fontBody).FontWeight(fontWeightRegular).TextColor(tokensOf(c).TextPrimary).FocusRingColor(tokensOf(c).Accent)
}

func appBadge(c *ui.Context, label string) ui.Element {
	t := tokensOf(c)
	return ui.Text(c, label).SingleLine().FontSize(fontAux).FontWeight(fontWeightMedium).FontFeatures("tnum").Padding(2, 7).
		Radius(5).TextColor(t.TextReadable).Background(t.BgSubtle)
}

// appEmptyState takes an optional real action; it never manufactures navigation.
func appEmptyState(c *ui.Context, title, description, actionLabel string, onClick func()) ui.Element {
	t := tokensOf(c)
	return ui.Column(c).Padding(28).Gap(10).AlignItems(ui.Center).Children(func() {
		ui.Text(c, title).FontSize(14).FontWeight(fontWeightSemibold).TextColor(t.TextPrimary)
		if description != "" {
			ui.Text(c, description).FontSize(12).FontWeight(fontWeightRegular).TextColor(t.TextSecondary).TextAlign(ui.Center).MaxWidth(280)
		}
		if actionLabel != "" && onClick != nil {
			appButton(c, actionLabel, "secondary").Margin(4, 0, 0, 0).OnClick(onClick)
		}
	})
}

// appDialog retains the native modal's Escape, focus trap and restoration.
func appDialog(c *ui.Context, open *bool, content func()) ui.Element {
	t := tokensOf(c)
	return elevateModal(c, ui.Modal(c, open, content).Radius(dialogRadius).Padding(24).Gap(16).
		Background(t.BgElevated).MaxWidthPercent(95))
}

func sameCalendarDay(a, b time.Time) bool {
	if a.IsZero() || b.IsZero() {
		return false
	}
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}

func normalizeCalendarDate(d time.Time) time.Time {
	if d.IsZero() {
		return time.Now()
	}
	return d
}

// appCalendar renders a breathable, Monday-first Chinese calendar picker with sleek
// borderless circular navigation buttons, full-width 7-column alignment, Lunar
// date subtitles, and a 1-click 公历 / 农历 (Solar / Lunar) mode switcher.
func appCalendar(c *ui.Context, date *time.Time, label string) bool {
	t := tokensOf(c)
	changed := false
	holder := ui.Column(c.Key("app-cal-" + label)).Role(ui.RoleTable).Label(label).FillWidth().MinWidth(240).Gap(3).Focusable()

	cursor := ui.Local(holder, "cursor", func() time.Time { return normalizeCalendarDate(*date) })
	lastSynced := ui.Local(holder, "last", func() time.Time { return normalizeCalendarDate(*date) })
	lunarMode := ui.Local(holder, "lunar-mode", func() bool { return false })
	if !sameCalendarDay(*lastSynced, *date) {
		*cursor = normalizeCalendarDate(*date)
		*lastSynced = normalizeCalendarDate(*date)
	}
	viewCursor := normalizeCalendarDate(*cursor)
	today := time.Now().In(viewCursor.Location())
	curLunar, hasLunar := solarToLunar(viewCursor)

	selectDay := func(d time.Time) {
		loc := d.Location()
		hr, min, sec, nsec := 9, 0, 0, 0
		if !date.IsZero() {
			loc = date.Location()
			hr, min, sec, nsec = date.Hour(), date.Minute(), date.Second(), date.Nanosecond()
		}
		picked := time.Date(d.Year(), d.Month(), d.Day(), hr, min, sec, nsec, loc)
		*date = picked
		*cursor = picked
		*lastSynced = picked
		changed = true
	}

	stepMonth := func(delta int) {
		if *lunarMode && hasLunar {
			ny, nm, nleap := shiftLunarMonth(curLunar.Year, curLunar.Month, curLunar.IsLeap, delta)
			if s, ok := lunarToSolar(ny, nm, 1, nleap, viewCursor.Location()); ok {
				*cursor = time.Date(s.Year(), s.Month(), s.Day(), viewCursor.Hour(), viewCursor.Minute(), 0, 0, viewCursor.Location())
				return
			}
		}
		*cursor = time.Date(viewCursor.Year(), viewCursor.Month()+time.Month(delta), 1, viewCursor.Hour(), viewCursor.Minute(), 0, 0, viewCursor.Location())
	}

	base := normalizeCalendarDate(*date)
	holder.
		OnShortcut(0, ui.KeyLeft, func() { selectDay(base.AddDate(0, 0, -1)) }).
		OnShortcut(0, ui.KeyRight, func() { selectDay(base.AddDate(0, 0, 1)) }).
		OnShortcut(0, ui.KeyUp, func() { selectDay(base.AddDate(0, 0, -7)) }).
		OnShortcut(0, ui.KeyDown, func() { selectDay(base.AddDate(0, 0, 7)) }).
		OnShortcut(0, ui.KeyPageUp, func() { stepMonth(-1) }).
		OnShortcut(0, ui.KeyPageDown, func() { stepMonth(1) })

	holder.Children(func() {
		// Breathable Header Row: Month-Year title on left, [公历|农历] + sleek borderless < > buttons on right
		ui.Row(c).FillWidth().Height(30).Padding(0, 2).Margin(0, 0, 3, 0).AlignItems(ui.Center).Children(func() {
			headerTitle := fmt.Sprintf("%d年 %d月", viewCursor.Year(), int(viewCursor.Month()))
			if *lunarMode && hasLunar {
				headerTitle = formatLunarYearMonthTitle(curLunar.Year, curLunar.Month, curLunar.IsLeap)
			}
			ui.Text(c, headerTitle).
				FontSize(13.5).FontWeight(600).FontFeatures("tnum").TextColor(t.TextPrimary).SingleLine()

			ui.Spacer(c)

			ui.Row(c).Gap(3).AlignItems(ui.Center).Children(func() {
				// Compact 公历 / 农历 segmented toggle
				ui.Row(c.Key("cal-mode-switch")).Height(24).Padding(2).Gap(1).Radius(6).Background(t.BgSubtle).AlignItems(ui.Center).Children(func() {
					for _, item := range []struct {
						isLunar bool
						text    string
						label   string
					}{{false, "公历", "切换公历日历"}, {true, "农历", "切换农历日历"}} {
						item := item
						active := *lunarMode == item.isLunar
						pill := ui.ButtonBase(c.Key("mode-"+item.text)).Label(item.label).Tooltip(item.label).
							Height(20).Padding(0, 6).Radius(4).Center().Cursor(ui.CursorPointer).
							OnClick(func() { *lunarMode = item.isLunar })
						fg := t.TextSecondary
						if active {
							elevateSegmentActive(c, pill)
							fg = t.TextPrimary
						} else if pill.Hovered() {
							fg = t.TextReadable
						}
						pill.Children(func() {
							weight := fontWeightRegular
							if active {
								weight = fontWeightMedium
							}
							ui.Text(c, item.text).FontSize(10.5).FontWeight(weight).TextColor(fg).SingleLine()
						})
					}
				})

				if viewCursor.Year() != today.Year() || viewCursor.Month() != today.Month() {
					todayBtn := ui.ButtonBase(c.Key("cal-today-month")).Label("回到本月").Tooltip("回到本月").
						Height(24).Padding(0, 6).Radius(6).Center().Cursor(ui.CursorPointer).
						OnClick(func() {
							*cursor = today
						})
					if todayBtn.Hovered() {
						todayBtn.Background(t.BgHover)
					}
					todayBtn.Children(func() {
						ui.Text(c, "本月").FontSize(11).FontWeight(500).TextColor(t.TextSecondary).SingleLine()
					})
				}

				navIconBtn := func(key, lbl string, icon *ui.SVG, delta int) {
					btn := ui.ButtonBase(c.Key(key)).Label(lbl).Tooltip(lbl).
						Size(26, 26).Radius(6).Center().Cursor(ui.CursorPointer).
						OnClick(func() { stepMonth(delta) })
					fg := t.TextSecondary
					if btn.Hovered() {
						btn.Background(t.BgHover)
						fg = t.TextPrimary
					}
					btn.Children(func() {
						ui.Icon(c, icon).Size(15, 15).TextColor(fg).AccessHidden(true)
					})
				}
				navIconBtn("prev-month", "上个月", lucide.ChevronLeft(), -1)
				navIconBtn("next-month", "下个月", lucide.ChevronRight(), 1)
			})
		})

		// Weekday Header Row (Monday-first, flush 7-column grid)
		weekdays := []string{"一", "二", "三", "四", "五", "六", "日"}
		ui.Grid(c).Columns(7).FillWidth().Gap(2).Margin(0, 0, 1, 0).Children(func() {
			for _, wd := range weekdays {
				wd := wd
				ui.Box(c).Height(20).FillWidth().Center().Children(func() {
					ui.Text(c, wd).FontSize(11).FontWeight(500).TextColor(t.TextTertiary).SingleLine()
				})
			}
		})

		// 6-Week Day Grid (Solar mode or Lunar mode)
		firstOfMonth := time.Date(viewCursor.Year(), viewCursor.Month(), 1, viewCursor.Hour(), viewCursor.Minute(), viewCursor.Second(), viewCursor.Nanosecond(), viewCursor.Location())
		if *lunarMode && hasLunar {
			if lunarFirst, ok := lunarToSolar(curLunar.Year, curLunar.Month, 1, curLunar.IsLeap, viewCursor.Location()); ok {
				firstOfMonth = time.Date(lunarFirst.Year(), lunarFirst.Month(), lunarFirst.Day(), viewCursor.Hour(), viewCursor.Minute(), 0, 0, viewCursor.Location())
			}
		}
		offset := (int(firstOfMonth.Weekday()) + 6) % 7
		gridStart := firstOfMonth.AddDate(0, 0, -offset)

		ui.Grid(c).Columns(7).FillWidth().Gap(1).Children(func() {
			for i := 0; i < 42; i++ {
				d := gridStart.AddDate(0, 0, i)
				dayLunar, okLunar := solarToLunar(d)
				inMonth := d.Month() == viewCursor.Month()
				if *lunarMode && hasLunar && okLunar {
					inMonth = dayLunar.Year == curLunar.Year && dayLunar.Month == curLunar.Month && dayLunar.IsLeap == curLunar.IsLeap
				}
				isSelected := !date.IsZero() && sameCalendarDay(d, *date)
				isToday := sameCalendarDay(d, today)

				cell := ui.ButtonBase(c.Key(d.Format("2006-01-02"))).
					Label(strconv.Itoa(d.Day())).
					Height(31).FillWidth().Radius(6).Center().Cursor(ui.CursorPointer).
					OnClick(func() { selectDay(d) })

				fg := t.TextPrimary
				subFg := t.TextTertiary
				weight := 400
				if !inMonth {
					fg = t.TextTertiary
					subFg = t.TextTertiary.Alpha(0.65)
				}
				if isSelected {
					cell.Background(t.Accent)
					fg = t.TextOnAccent
					subFg = t.TextOnAccent.Alpha(0.85)
					weight = 600
				} else if isToday {
					cell.Background(t.Accent.Alpha(0.12))
					if cell.Hovered() {
						cell.Background(t.Accent.Alpha(0.20))
					}
					fg = t.Accent
					subFg = t.Accent.Alpha(0.85)
					weight = 600
				} else if cell.Hovered() {
					cell.Background(t.BgHover)
				}

				primaryText := strconv.Itoa(d.Day())
				secondaryText := ""
				if okLunar {
					secondaryText = dayLunar.ShortCellLabel()
				}
				if *lunarMode && okLunar {
					primaryText = dayLunar.ShortCellLabel()
					secondaryText = strconv.Itoa(d.Day())
				}

				cell.Children(func() {
					ui.Column(c).AlignItems(ui.Center).Justify(ui.Center).Gap(0).Children(func() {
						pSize := float32(12)
						if *lunarMode {
							pSize = 11
						}
						ui.Text(c, primaryText).FontSize(pSize).FontWeight(weight).FontFeatures("tnum").FixedLineHeight(14).TextColor(fg).SingleLine()
						if secondaryText != "" {
							ui.Text(c, secondaryText).FontSize(8.5).FontFeatures("tnum").FixedLineHeight(10).TextColor(subFg).SingleLine().AccessHidden(true)
						}
					})
				})
			}
		})
	})

	return changed
}

// appDatePickerField replaces the built-in ui.DateInput with a clean flat trigger
// that pops open our custom appCalendar (with 公历/农历 support).
func appDatePickerField(c *ui.Context, date *time.Time, label string, onChange func()) {
	t := tokensOf(c)
	holder := ui.Box(c.Key("date-field-" + label)).Shrink(0)
	open := ui.Local(holder, "open", func() bool { return false })
	var anchor ui.Element
	holder.Children(func() {
		anchor = ui.ButtonBase(c.Key("trigger-"+label)).Label(label).
			Height(28).Padding(0, 10).Radius(6).Cursor(ui.CursorPointer).
			Background(t.BgSubtle).Border(1, t.BorderSubtle).
			OnClick(func() { *open = !*open })
		if anchor.Hovered() || *open {
			anchor.Background(t.BgHover).BorderColor(t.BorderDefault)
		}
		disp := normalizeCalendarDate(*date).Format("2006-01-02")
		anchor.Children(func() {
			ui.Row(c).Gap(6).AlignItems(ui.Center).Children(func() {
				ui.Icon(c, lucide.Calendar()).Size(13, 13).TextColor(t.TextSecondary).AccessHidden(true)
				ui.Text(c, disp).FontSize(12).FontFeatures("tnum").FontWeight(500).TextColor(t.TextPrimary).SingleLine()
			})
		})
		if *open {
			ui.PopoverBase(c.Key("pop-"+label), anchor, open, func(panel ui.Element) {
				panel.AttachTo(anchor, ui.AnchorBottomStart, ui.AnchorTopStart)
				elevatePopup(c, panel.Padding(12).Width(272).Radius(popoverRadius).Background(t.BgElevated).Label("选择"+label))
				panel.Children(func() {
					if appCalendar(c, date, "日历"+label) {
						*open = false
						if onChange != nil {
							onChange()
						}
					}
				})
			})
		}
	})
}
