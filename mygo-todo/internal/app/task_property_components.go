package app

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"todo-native/internal/api"
)

// elevateFloatingSurface gives popovers and menus unmistakable depth above the
// editor canvas and inline tables via a crisp elevated surface, subtle rim
// border, and layered ambient + lifted shadows.
func elevateFloatingSurface(c *ui.Context, panel ui.Element) ui.Element {
	t := tokensOf(c)
	if c.Theme().Dark {
		return panel.
			Background(t.BgSubtle.Mix(ui.Hex("#FFFFFF"), 0.04)).
			Border(1, ui.RGBA(255, 255, 255, 0.11)).
			Shadow(0, 2, 8, -1, ui.RGBA(0, 0, 0, 0.34)).
			Shadow(0, 14, 34, -4, ui.RGBA(0, 0, 0, 0.54))
	}
	return panel.
		Background(ui.Hex("#FFFFFF")).
		Border(1, t.BorderDefault.Alpha(0.85)).
		Shadow(0, 2, 6, -1, ui.RGBA(20, 18, 16, 0.07)).
		Shadow(0, 12, 30, -4, ui.RGBA(20, 18, 16, 0.15))
}

// detailPropertyChip renders a calm Ghost metadata trigger: when unset (!active),
// it shows a subtle icon + muted placeholder label (e.g. "添加提醒") so every
// attribute is immediately intelligible; when set (active), it turns into a
// crisp soft chip (with semantic Danger/Success/Warning tint when appropriate).
func detailPropertyChip(c *ui.Context, key, label, value string, icon *ui.SVG, active bool, accent ui.Color, disabled bool, onClick func()) ui.Element {
	t := tokensOf(c)
	button := ui.ButtonBase(c.Key(key)).Label("编辑" + label).Description(value).Tooltip(label + " · " + value).
		Height(26).MinWidth(26).Radius(6).Padding(0, 7).Justify(ui.Start).
		BorderWidth(0).Background(ui.Transparent).
		FocusRingColor(t.Accent).Disabled(disabled).Cursor(ui.CursorPointer).
		Transition(motionColorsFast()).
		OnClick(onClick)

	isAlert := active && accent == t.Danger && accent.A > 0
	isMutedDone := active && accent == t.Success && accent.A > 0

	fg := t.TextTertiary
	iconColor := t.TextTertiary
	if active {
		button.Background(t.BgSubtle.Alpha(0.85)).Padding(0, 8)
		fg = t.TextPrimary
		iconColor = t.TextSecondary
		if isAlert {
			button.Background(t.Danger.Alpha(0.10))
			iconColor = t.Danger
			fg = t.Danger
		} else if isMutedDone {
			iconColor = t.Success
			fg = t.TextSecondary
		} else if accent.A > 0 {
			iconColor = accent
		}
	}
	if button.Pressed() {
		if isAlert {
			button.Background(t.Danger.Alpha(0.16))
		} else {
			button.Background(t.BgSelected)
		}
	} else if button.Hovered() {
		if isAlert {
			button.Background(t.Danger.Alpha(0.14))
		} else {
			button.Background(t.BgHover)
		}
		if !active {
			iconColor = t.TextSecondary
			fg = t.TextSecondary
		}
	}
	button.Children(func() {
		ui.Row(c).Gap(5).MinWidth(0).AlignItems(ui.Center).Children(func() {
			if icon != nil {
				ui.Icon(c, icon).Size(13, 13).TextColor(iconColor).Shrink(0).AccessHidden(true)
			}
			weight := 400
			if active {
				weight = 500
			}
			ui.Text(c, value).FontSize(12).FontWeight(weight).FontFeatures("tnum").TextColor(fg).SingleLine().MaxWidth(168)
		})
	})
	return button
}

// taskPropertyRow returns the native trigger so callers can assign Ref and
// anchor existing property popovers without changing draft or save semantics.
func taskPropertyRow(c *ui.Context, key, label, value string, icon *ui.SVG, empty bool, onClick func()) ui.Element {
	t := tokensOf(c)
	button := ui.ButtonBase(c.Key(key)).Label("编辑"+label).Description(value).
		Height(36).FillWidth().MaxWidth(440).MinWidth(0).Padding(0, 6).Radius(6).Justify(ui.Start).
		Background(ui.Transparent).FocusRingColor(t.Accent).OnClick(onClick)
	if button.Pressed() {
		button.Background(t.BgSelected)
	} else if button.Hovered() {
		button.Background(t.BgHover)
	}
	button.Children(func() {
		ui.Row(c).FillWidth().MinWidth(0).Gap(8).AlignItems(ui.Center).Children(func() {
			if icon != nil {
				ui.Icon(c, icon).Size(14, 14).TextColor(t.TextSecondary).Shrink(0).AccessHidden(true)
			}
			ui.Text(c, label).FontSize(fontProperty).TextColor(t.TextSecondary).Width(96).Shrink(0)
			valueColor := t.TextPrimary
			if empty {
				valueColor = t.TextReadable
			}
			ui.Text(c, value).FontSize(fontProperty).TextColor(valueColor).Grow(1).MinWidth(0).SingleLine().TextAlign(ui.Start).Tooltip(value)
		})
	})
	return button
}

// propertyTrigger renders an icon-only ghost action when unset (!active) and a
// compact soft tag when set, keeping inline quick-add clean and single-line.
func propertyTrigger(c *ui.Context, key, label, value string, icon *ui.SVG, active bool) ui.Element {
	t := tokensOf(c)
	button := ui.ButtonBase(c.Key(key)).Label("编辑" + label).Description(value).Tooltip(label + " · " + value).
		Height(26).MinWidth(26).Radius(5).BorderWidth(0).FocusRingColor(t.Accent).Cursor(ui.CursorPointer)
	if !active && icon != nil {
		button.Width(26).Padding(0).Center().Background(ui.Transparent)
	} else {
		button.Padding(0, 7).Justify(ui.Start).Background(t.BgSelected)
	}
	if button.Hovered() {
		button.Background(t.BgHover)
	}
	button.Children(func() {
		if !active && icon != nil {
			col := t.TextSecondary
			if button.Hovered() {
				col = t.TextPrimary
			}
			ui.Icon(c, icon).Size(14, 14).TextColor(col).AccessHidden(true)
			return
		}
		ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
			if icon != nil {
				ui.Icon(c, icon).Size(13, 13).TextColor(t.Accent).AccessHidden(true)
			}
			ui.Text(c, value).FontSize(11.5).FontWeight(500).TextColor(t.TextPrimary).SingleLine()
		})
	})
	return button
}

// Bind derived selection state to a persistent bool. Event callbacks run after
// a view build and cannot close an overlay by changing a frame-local bool.
func ownedPropertyOpen(anchor ui.Element, active bool) *bool {
	type ownedState struct{ active, open bool }
	state := ui.Local(anchor, "owned-property-open", func() ownedState { return ownedState{active: active, open: active} })
	if state.active != active {
		state.active, state.open = active, active
	}
	return &state.open
}

func propertyPopover(c *ui.Context, anchor ui.Element, open *bool, content func(), kind ...string) {
	state := ui.Local(anchor, "property-focus", func() propertyPickerFocus { return propertyPickerFocus{} })
	anchor.Ref(&state.anchor)
	if state.open && !*open {
		anchor.Focus()
	}
	state.open = *open
	width, height := c.Size()
	bounds := anchor.Bounds()
	room := max(height-bounds.Y-bounds.H-16, bounds.Y-16)
	panelWidth := min(float32(340), width-16)
	if len(kind) > 0 && (kind[0] == "priority" || kind[0] == "status") {
		panelWidth = min(float32(212), width-16)
	}
	ui.PopoverBase(c, anchor, open, func(panel ui.Element) {
		if len(kind) > 0 {
			panel.AttachTo(anchor, ui.AnchorBottomStart, ui.AnchorTopStart)
		}
		elevateFloatingSurface(c, panel.Width(panelWidth).MinWidth(0).MaxHeight(height-16).
			Margin(6, 0, 0, min(float32(0), width-8-bounds.X-panelWidth)).Padding(12).Radius(10).
			AttachedOrigin().Transition(motionPopup()).Label("属性选项"))
		entered := ui.Local(panel, "property-entered", func() bool { return false })
		hook := propertyPickerScope(c)
		previous := *hook
		*hook = propertyPickerSession{close: func() { *open = false; state.anchor.Focus() }, entering: !*entered}
		defer func() { *hook = previous }()
		ui.Scroll(c.Key("property-panel-scroll")).MaxHeight(max(0, room-24)).KeepScrollbars(true).Gap(8).FocusGroup(ui.Vertical).Children(content)
		*entered = true
	})
	if state.open && !*open {
		anchor.Focus()
	}
}

type propertyCategoryVisualsKey struct{}

func propertyCategoryVisuals(c *ui.Context) *map[string]api.Category {
	return ui.Local(c.Root(), propertyCategoryVisualsKey{}, func() map[string]api.Category { return nil })
}

func propertyOption(c *ui.Context, label string, selected bool, choose func(), icons ...*ui.SVG) {
	propertyOptionBehavior(c, label, selected, choose, false, icons...)
}

func propertyOptionBehavior(c *ui.Context, label string, selected bool, choose func(), continuing bool, icons ...*ui.SVG) {
	propertyOptionWithRole(c, label, selected, choose, ui.RoleRadio, continuing, icons...)
}

// Multi-select checkboxes keep the popover open so users can select or clear
// multiple categories in one session without reopening the picker repeatedly.
func propertyMultiOption(c *ui.Context, label string, selected bool, choose func(), icons ...*ui.SVG) {
	propertyOptionWithRole(c, label, selected, choose, ui.RoleCheckBox, true, icons...)
}

func propertyOptionWithRole(c *ui.Context, label string, selected bool, choose func(), role ui.Role, continuing bool, icons ...*ui.SVG) {
	t := tokensOf(c)
	hook := propertyPickerScope(c)
	close := hook.close
	description := "未选中"
	if selected {
		description = "已选中"
	}
	button := ui.ButtonBase(c).Role(role).Label(label).Description(description).Checked(selected).Height(34).Shrink(0).FillWidth().MinWidth(0).Padding(0, 9).Radius(6).Justify(ui.Start).OnClick(func() {
		choose()
		if close != nil && !continuing {
			close()
		}
	})
	if hook.entering && (!hook.focused || selected) {
		button.Focus()
		hook.focused = true
	}
	if selected {
		button.Background(t.BgSelected)
	}
	if button.Hovered() {
		button.Background(t.BgHover)
	}
	button.Children(func() {
		ui.Row(c).FillWidth().MinWidth(0).Gap(8).AlignItems(ui.Center).Children(func() {
			if len(icons) > 0 && icons[0] != nil {
				ui.Icon(c, icons[0]).Size(14, 14).Shrink(0).TextColor(t.TextSecondary).AccessHidden(true)
			}
			visuals := propertyCategoryVisuals(c)
			if cat, ok := (*visuals)[label]; ok {
				categoryPreview(c, cat)
			} else {
				weight := 400
				if selected {
					weight = 500
				}
				ui.Text(c, label).Grow(1).MinWidth(0).SingleLine().FontSize(13).FontWeight(weight).TextColor(t.TextPrimary)
			}
			mark := ""
			if selected {
				mark = "✓"
			}
			ui.Text(c, mark).Width(16).FontWeight(600).TextColor(t.Accent)
		})
	})
}

func propertyOptions(c *ui.Context, value *string, choices []string) {
	propertyOptionsContinuing(c, value, choices, nil)
}

func propertyOptionsContinuing(c *ui.Context, value *string, choices []string, continuing func(string) bool) {
	ui.Column(c).Gap(2).FocusGroup(ui.Vertical).Children(func() {
		for _, choice := range choices {
			propertyOptionBehavior(c.Key(choice), choice, *value == choice, func() { *value = choice }, continuing != nil && continuing(choice))
		}
	})
}

func syncDraftEndAfterStart(d *Draft) {
	if !d.End.After(d.Start) {
		if d.AllDay {
			d.End = dayStart(d.Start).AddDate(0, 0, 1)
		} else {
			d.End = d.Start.Add(time.Hour)
		}
	}
}

// parse24HourClock parses compact 24-hour inputs such as "09:30", "9:5", "0930",
// "1430", "9", or full-width "09：30" into hour/minute values.
func parse24HourClock(raw string) (int, int, bool) {
	s := strings.TrimSpace(strings.ReplaceAll(raw, "：", ":"))
	if s == "" {
		return 0, 0, false
	}
	var h, m int
	var err1, err2 error
	if parts := strings.Split(s, ":"); len(parts) == 2 {
		h, err1 = strconv.Atoi(strings.TrimSpace(parts[0]))
		m, err2 = strconv.Atoi(strings.TrimSpace(parts[1]))
	} else if len(s) == 4 {
		h, err1 = strconv.Atoi(s[:2])
		m, err2 = strconv.Atoi(s[2:])
	} else if len(s) == 3 {
		h, err1 = strconv.Atoi(s[:1])
		m, err2 = strconv.Atoi(s[1:])
	} else if len(s) == 1 || len(s) == 2 {
		h, err1 = strconv.Atoi(s)
		m = 0
	} else {
		return 0, 0, false
	}
	if err1 != nil || err2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, 0, false
	}
	return h, m, true
}

// task24TimeField renders a unified, tabular 24-hour time control (e.g. "09:30")
// eliminating regional 12-hour AM/PM mismatches and wide colon gaps. Supports
// direct typing ("09:30", "1430"), Enter/blur commit, and Up/Down stepping.
func task24TimeField(c *ui.Context, key, label string, value *time.Time, stepMins int, onChange func()) {
	if stepMins <= 0 {
		stepMins = 15
	}
	t := tokensOf(c)
	formatted := value.Format("15:04")
	type timeFieldState struct {
		text       string
		synced     string
		wasFocused bool
	}
	wrap := ui.Row(c.Key(key)).Width(64).Height(26).Radius(6).Padding(0, 6).
		Background(t.BgSubtle).Border(1, t.BorderSubtle).AlignItems(ui.Center).Justify(ui.Center)
	st := ui.Local(wrap, "time24-state", func() timeFieldState {
		return timeFieldState{text: formatted, synced: formatted}
	})
	if st.synced != formatted && !st.wasFocused {
		st.text = formatted
		st.synced = formatted
	}

	commit := func() {
		if h, m, ok := parse24HourClock(st.text); ok {
			updated := time.Date(value.Year(), value.Month(), value.Day(), h, m, 0, 0, value.Location())
			changed := updated.Hour() != value.Hour() || updated.Minute() != value.Minute()
			*value = updated
			norm := updated.Format("15:04")
			st.text = norm
			st.synced = norm
			if changed && onChange != nil {
				onChange()
			}
		} else {
			st.text = value.Format("15:04")
			st.synced = st.text
		}
	}

	step := func(delta int) {
		updated := value.Add(time.Duration(delta) * time.Minute)
		*value = time.Date(value.Year(), value.Month(), value.Day(), updated.Hour(), updated.Minute(), 0, 0, value.Location())
		norm := value.Format("15:04")
		st.text = norm
		st.synced = norm
		if onChange != nil {
			onChange()
		}
	}

	var input ui.Element
	wrap.Children(func() {
		input = ui.TextInputBase(c.Key("in"), &st.text).Label(label).
			FillWidth().MinWidth(0).FocusRing(false).BorderWidth(0).Padding(0).
			Background(ui.Transparent).
			FontSize(12).FontWeight(500).FontFeatures("tnum").
			TextAlign(ui.Center).TextColor(t.TextPrimary).
			OnSubmit(commit).
			OnShortcut(0, ui.KeyUp, func() { step(stepMins) }).
			OnShortcut(0, ui.KeyDown, func() { step(-stepMins) })
	})

	focused := input.Focused()
	if st.wasFocused && !focused {
		commit()
	}
	st.wasFocused = focused
	if focused {
		wrap.Background(t.BgApp).BorderColor(t.Accent)
	} else if wrap.Hovered() {
		wrap.Background(t.BgHover).BorderColor(t.BorderDefault)
	}
}

// scheduleSwitch renders a crisp Apple Calendar-style pill switch for boolean
// schedule flags (such as 全天).
func scheduleSwitch(c *ui.Context, key, label string, on *bool, onChange func()) {
	t := tokensOf(c)
	sw := ui.SwitchBase(c.Key(key), on).Label(label).
		Size(32, 18).Radius(9).Padding(2).Shrink(0).
		AlignItems(ui.Center).Cursor(ui.CursorPointer).
		FocusRingColor(t.Accent).OnChange(onChange)
	if *on {
		sw.Background(t.Accent).Justify(ui.End)
	} else {
		sw.Background(t.BorderDefault).Justify(ui.Start)
		if sw.Hovered() {
			sw.Background(t.TextTertiary.Alpha(0.65))
		}
	}
	sw.Children(func() {
		ui.Box(c).Size(14, 14).Radius(7).Background(ui.Hex("#FFFFFF")).
			Shadow(0, 1, 2, 0, ui.RGBA(0, 0, 0, 0.18)).AccessHidden(true)
	})
}

// Unified schedule editor: quick presets, interactive month grid, and a clean
// Apple Calendar / Linear Key-Value lower section with unified 24-hour clocks.
func (a *App) taskDateProperty(c *ui.Context, d *Draft, start bool) {
	t := tokensOf(c)
	enabled, date, label := &d.HasDue, &d.Due, "截止日期"
	if start {
		enabled, date, label = &d.HasStart, &d.Start, "开始时间"
	}
	now := time.Now().In(a.location())
	daysUntilMonday := (8 - int(now.Weekday())) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7
	}
	daysUntilSaturday := (6 - int(now.Weekday()) + 7) % 7
	if daysUntilSaturday == 0 {
		daysUntilSaturday = 7
	}

	dateRoot := ui.Column(c.Key("date-prop-" + label)).Gap(10)
	calTarget := ui.Local(dateRoot, "cal-target", func() string { return "start" })
	if !start || (*calTarget == "end" && !d.HasEnd) || (*calTarget == "due" && !d.HasDue) {
		*calTarget = "start"
	}

	activeDatePtr := date
	if start {
		switch *calTarget {
		case "end":
			activeDatePtr = &d.End
		case "due":
			activeDatePtr = &d.Due
		}
	}

	dateRoot.Children(func() {
		// 1. Quick Date Presets + Quiet Clear Action
		ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
			for _, shortcut := range []struct {
				label string
				days  int
			}{{"今天", 0}, {"明天", 1}, {"本周末", daysUntilSaturday}, {"下周一", daysUntilMonday}} {
				sc := shortcut
				targetDay := now.AddDate(0, 0, sc.days)
				isSelected := *enabled && sameCalendarDay(*activeDatePtr, targetDay)
				chip := ui.ButtonBase(c.Key("preset-"+sc.label)).Label(sc.label).
					Height(26).Padding(0, 8).Radius(6).Center().Cursor(ui.CursorPointer)
				fg := t.TextPrimary
				if isSelected {
					chip.Background(t.Accent.Alpha(0.12))
					fg = t.Accent
				} else {
					chip.Background(t.BgSubtle)
					if chip.Hovered() {
						chip.Background(t.BgHover)
					}
				}
				chip.OnClick(func() {
					day := now.AddDate(0, 0, sc.days)
					*activeDatePtr = time.Date(day.Year(), day.Month(), day.Day(), activeDatePtr.Hour(), activeDatePtr.Minute(), 0, 0, day.Location())
					if *calTarget == "start" {
						*enabled = true
						if start {
							syncDraftEndAfterStart(d)
						}
					} else if *calTarget == "end" && d.End.Before(d.Start) {
						d.Start = d.End
					}
				}).Children(func() {
					ui.Text(c, sc.label).FontSize(12).FontWeight(500).TextColor(fg).SingleLine()
				})
			}
			ui.Spacer(c)
			clearBtn := ui.ButtonBase(c.Key("clear-date")).Label("清除日期").
				Height(26).Padding(0, 6).Radius(6).Center().Cursor(ui.CursorPointer).
				Disabled(!*enabled).OnClick(func() {
				*enabled = false
				if start {
					d.HasEnd = false
					*calTarget = "start"
				}
			})
			clearFg := t.TextTertiary
			if *enabled {
				clearFg = t.TextSecondary
				if clearBtn.Hovered() {
					clearBtn.Background(t.Danger.Alpha(0.08))
					clearFg = t.Danger
				}
			}
			clearBtn.Children(func() {
				ui.Text(c, "清除").FontSize(12).FontWeight(500).TextColor(clearFg).SingleLine()
			})
		})

		ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)

		// 2. Interactive Month Calendar
		if appCalendar(c, activeDatePtr, "选择"+label) {
			if *calTarget == "start" {
				*enabled = true
				if start {
					syncDraftEndAfterStart(d)
				}
			} else if *calTarget == "end" && d.End.Before(d.Start) {
				d.Start = d.End
			}
		}

		if !start {
			return
		}

		ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)

		// Unified Date Value Pill (consistent 26px height, 6px radius, tabular numerals)
		dateValuePill := func(key, targetKey, prefix string, val time.Time) {
			active := *calTarget == targetKey
			btn := ui.ButtonBase(c.Key(key)).Label(prefix+"日期").Tooltip("点击在上方日历中选择"+prefix+"日期").
				Height(26).MinWidth(74).Padding(0, 8).Radius(6).Center().Cursor(ui.CursorPointer).
				OnClick(func() { *calTarget = targetKey })
			fg := t.TextPrimary
			if active {
				btn.Background(t.Accent.Alpha(0.10)).Border(1, t.Accent.Alpha(0.65))
				fg = t.Accent
			} else {
				btn.Background(t.BgSubtle).Border(1, t.BorderSubtle)
				if btn.Hovered() {
					btn.Background(t.BgHover).BorderColor(t.BorderDefault)
				}
			}
			btn.Children(func() {
				ui.Text(c, val.Format("01月02日")).FontSize(12).FontFeatures("tnum").FontWeight(500).TextColor(fg).SingleLine()
			})
		}

		inlineAddBtn := func(key, accLabel, text string, onClick func()) {
			btn := ui.ButtonBase(c.Key(key)).Label(accLabel).
				Height(26).Padding(0, 8).Radius(6).Center().Cursor(ui.CursorPointer).
				OnClick(onClick)
			fg := t.TextTertiary
			if btn.Hovered() {
				btn.Background(t.BgHover)
				fg = t.TextPrimary
			}
			btn.Children(func() {
				ui.Row(c).Gap(3).AlignItems(ui.Center).Children(func() {
					ui.Icon(c, lucide.Plus()).Size(12, 12).TextColor(fg).AccessHidden(true)
					ui.Text(c, text).FontSize(12).FontWeight(400).TextColor(fg).SingleLine()
				})
			})
		}

		inlineClearIcon := func(key, accLabel string, onClick func()) {
			btn := ui.ButtonBase(c.Key(key)).Label(accLabel).Tooltip(accLabel).
				Size(22, 22).Radius(5).Center().Cursor(ui.CursorPointer).
				OnClick(onClick)
			fg := t.TextTertiary
			if btn.Hovered() {
				btn.Background(t.BgHover)
				fg = t.TextPrimary
			}
			btn.Children(func() {
				ui.Icon(c, lucide.X()).Size(12, 12).TextColor(fg).AccessHidden(true)
			})
		}

		step := taskGranularity(a.session.User)

		// 3. Clean Key-Value Schedule List (Apple Calendar / Linear style)
		ui.Column(c.Key("schedule-kv-list")).Gap(6).FillWidth().Children(func() {
			// Row 1: All-day switch
			ui.Row(c.Key("kv-allday")).Height(28).FillWidth().AlignItems(ui.Center).Children(func() {
				ui.Text(c, "全天").FontSize(12.5).FontWeight(400).TextColor(t.TextSecondary)
				if lunar, ok := solarToLunar(*activeDatePtr); ok {
					ui.Text(c, "· "+lunar.FullLabel()).FontSize(11).TextColor(t.TextTertiary).Margin(0, 0, 0, 6).SingleLine()
				}
				ui.Spacer(c)
				scheduleSwitch(c, "all-day-switch", "全天", &d.AllDay, func() {
					if d.HasEnd {
						syncDraftEndAfterStart(d)
					}
				})
			})

			// Row 2: Start Date & 24h Time
			ui.Row(c.Key("kv-start")).Height(28).FillWidth().Gap(6).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "开始").FontSize(12.5).FontWeight(400).TextColor(t.TextSecondary)
				ui.Spacer(c)
				dateValuePill("target-start-pill", "start", "开始", *date)
				if !d.AllDay {
					task24TimeField(c, "start-time-24", "开始时间时刻", date, step, func() {
						*enabled = true
						syncDraftEndAfterStart(d)
					})
				}
				if d.HasEnd || d.HasDue {
					ui.Box(c).Size(22, 1).Shrink(0).AccessHidden(true)
				}
			})

			// Compact, flush 6-column 24h Quick Time Preset Row (only when timed)
			if !d.AllDay {
				u := a.session.User
				curClock := date.Format("15:04")
				ui.Grid(c.Key("start-time-presets")).Columns(6).FillWidth().Gap(4).Children(func() {
					presetBtn := func(key, text, accLabel string, active bool, onClick func()) {
						btn := ui.ButtonBase(c.Key(key)).Label(accLabel).Tooltip(accLabel).
							Height(24).FillWidth().Radius(5).Center().Cursor(ui.CursorPointer).OnClick(onClick)
						fg := t.TextSecondary
						if active {
							btn.Background(t.Accent.Alpha(0.12))
							fg = t.Accent
						} else {
							btn.Background(t.BgSubtle)
							if btn.Hovered() {
								btn.Background(t.BgHover)
								fg = t.TextPrimary
							}
						}
						btn.Children(func() {
							ui.Text(c, text).FontSize(11).FontFeatures("tnum").FontWeight(500).TextColor(fg).SingleLine()
						})
					}
					for _, slot := range []struct{ label, clock string }{
						{"早间", clockOr(u.DefaultMorningTime, "09:00")},
						{"午间", clockOr(u.DefaultNoonTime, "12:00")},
						{"下午", clockOr(u.DefaultAfternoonTime, "15:00")},
						{"晚间", clockOr(u.DefaultEveningTime, "20:00")},
					} {
						s := slot
						presetBtn("slot-"+s.label, s.clock, "开始时间"+s.label, *enabled && curClock == s.clock, func() {
							*date = atClock(*date, s.clock)
							*enabled = true
							syncDraftEndAfterStart(d)
						})
					}
					presetBtn("step-minus", fmt.Sprintf("−%dm", step), "开始时间提前一个步长", false, func() {
						*date = date.Add(-time.Duration(step) * time.Minute)
						*enabled = true
						syncDraftEndAfterStart(d)
					})
					presetBtn("step-plus", fmt.Sprintf("+%dm", step), "开始时间推迟一个步长", false, func() {
						*date = date.Add(time.Duration(step) * time.Minute)
						*enabled = true
						syncDraftEndAfterStart(d)
					})
				})
			}

			// Row 3: End Date & 24h Time
			ui.Row(c.Key("kv-end")).Height(28).FillWidth().Gap(6).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "结束").FontSize(12.5).FontWeight(400).TextColor(t.TextSecondary)
				ui.Spacer(c)
				if d.HasEnd {
					dateValuePill("target-end-pill", "end", "结束", d.End)
					if !d.AllDay {
						task24TimeField(c, "end-time-24", "结束时间时刻", &d.End, step, func() {
							d.HasStart = true
							if !d.End.After(d.Start) {
								d.Start = d.End.Add(-time.Hour)
							}
						})
					}
					inlineClearIcon("clear-end", "清除结束时间", func() {
						d.HasEnd = false
						if *calTarget == "end" {
							*calTarget = "start"
						}
					})
				} else {
					inlineAddBtn("add-end", "添加结束时间", "添加", func() {
						d.HasStart = true
						d.HasEnd = true
						syncDraftEndAfterStart(d)
					})
				}
			})

			// Row 4: Due Date
			ui.Row(c.Key("kv-due")).Height(28).FillWidth().Gap(6).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "截止").FontSize(12.5).FontWeight(400).TextColor(t.TextSecondary)
				ui.Spacer(c)
				if d.HasDue {
					dateValuePill("target-due-pill", "due", "截止", d.Due)
					inlineClearIcon("clear-due", "清除截止日期", func() {
						d.HasDue = false
						if *calTarget == "due" {
							*calTarget = "start"
						}
					})
				} else {
					inlineAddBtn("add-due", "添加截止日期", "添加", func() {
						d.HasDue = true
						if d.Due.IsZero() {
							d.Due = d.Start
						}
						*calTarget = "due"
					})
				}
			})
		})
	})
}
