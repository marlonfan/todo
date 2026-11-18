package app

import (
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

// detailPropertyChip renders an icon-only ghost trigger when unset (!active) so
// untouched properties never clutter the detail view with verbose text buttons,
// and expands into a sleek, borderless tinted tag only when a value is active.
func detailPropertyChip(c *ui.Context, key, label, value string, icon *ui.SVG, active bool, accent ui.Color, disabled bool, onClick func()) ui.Element {
	t := tokensOf(c)
	button := ui.ButtonBase(c.Key(key)).Label("编辑" + label).Description(value).Tooltip(label + " · " + value).
		Height(26).MinWidth(26).Radius(6).
		BorderWidth(0).Background(ui.Transparent).
		FocusRingColor(t.Accent).Disabled(disabled).Cursor(ui.CursorPointer).
		OnClick(onClick)

	fg := t.TextPrimary
	iconColor := t.TextSecondary
	if !active && icon != nil {
		button.Width(28).Padding(0).Center()
	} else {
		button.Padding(0, 8).Justify(ui.Start)
	}
	if active {
		button.Background(t.BgSubtle)
		iconColor = t.Accent
		if accent.A > 0 {
			iconColor = accent
			button.Background(accent.Alpha(0.12))
		}
	}
	if button.Pressed() {
		button.Background(t.BgSelected)
	} else if button.Hovered() {
		if active && accent.A > 0 {
			button.Background(accent.Alpha(0.18))
		} else {
			button.Background(t.BgHover)
		}
		if !active {
			iconColor = t.TextPrimary
		}
	}
	button.Children(func() {
		if !active && icon != nil {
			ui.Icon(c, icon).Size(15, 15).TextColor(iconColor).AccessHidden(true)
			return
		}
		ui.Row(c).Gap(5).MinWidth(0).AlignItems(ui.Center).Children(func() {
			if icon != nil {
				ui.Icon(c, icon).Size(13.5, 13.5).TextColor(iconColor).Shrink(0).AccessHidden(true)
			}
			ui.Text(c, value).FontSize(12).FontWeight(500).TextColor(fg).SingleLine().MaxWidth(168)
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
	panelWidth := min(float32(348), width-16)
	if len(kind) > 0 && (kind[0] == "priority" || kind[0] == "status") {
		panelWidth = min(float32(208), width-16)
	}
	ui.PopoverBase(c, anchor, open, func(panel ui.Element) {
		if len(kind) > 0 {
			panel.AttachTo(anchor, ui.AnchorBottomStart, ui.AnchorTopStart)
		}
		t := tokensOf(c)
		elevatePopup(c, panel.Width(panelWidth).MinWidth(0).MaxHeight(height-16).
			Margin(6, 0, 0, min(float32(0), width-8-bounds.X-panelWidth)).Padding(10).Radius(popoverRadius).Background(t.BgApp).
			Border(1, t.BorderSubtle).Label("属性选项"))
		entered := ui.Local(panel, "property-entered", func() bool { return false })
		hook := propertyPickerScope(c)
		previous := *hook
		*hook = propertyPickerSession{close: func() { *open = false; state.anchor.Focus() }, entering: !*entered}
		defer func() { *hook = previous }()
		ui.Scroll(c.Key("property-panel-scroll")).MaxHeight(max(0, room-20)).KeepScrollbars(true).Gap(8).FocusGroup(ui.Vertical).Children(content)
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

// Unified schedule editor: quick presets, interactive month grid, directly
// visible start/end times (no nested collapsed accordion), all-day toggle, and
// optional due date — all in one cohesive popover.
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

	dateRoot := ui.Column(c.Key("date-prop-" + label)).Gap(8)
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
		// Quick Date Preset Pills
		ui.Row(c).Gap(4).Wrap().Children(func() {
			for _, shortcut := range []struct {
				label string
				days  int
			}{{"今天", 0}, {"明天", 1}, {"本周末", daysUntilSaturday}, {"下周一", daysUntilMonday}} {
				chip := ui.ButtonBase(c.Key("preset-"+shortcut.label)).Label(shortcut.label).Height(26).Padding(0, 9).Radius(6).
					Background(t.BgSubtle).Cursor(ui.CursorPointer)
				if chip.Hovered() {
					chip.Background(t.BgHover)
				}
				chip.OnClick(func() {
					day := now.AddDate(0, 0, shortcut.days)
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
					ui.Text(c, shortcut.label).FontSize(12).FontWeight(500).TextColor(t.TextPrimary)
				})
			}
			ui.Spacer(c)
			appActionButton(c, "清除日期", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Disabled(!*enabled).OnClick(func() {
				*enabled = false
				if start {
					d.HasEnd = false
					*calTarget = "start"
				}
			})
		})

		ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)

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

		targetPill := func(key, targetKey, prefix string, val time.Time) {
			active := *calTarget == targetKey
			btn := ui.ButtonBase(c.Key(key)).Label(prefix+"日期").Tooltip("点击在上方日历中选择"+prefix+"日期").
				Height(26).Padding(0, 8).Radius(6).Cursor(ui.CursorPointer).
				OnClick(func() { *calTarget = targetKey })
			fg := t.TextSecondary
			if active {
				btn.Background(t.Accent.Alpha(0.12)).Border(1, t.Accent)
				fg = t.Accent
			} else {
				btn.Background(t.BgSubtle)
				if btn.Hovered() {
					btn.Background(t.BgHover)
				}
			}
			disp := val.Format("01月02日")
			if prefix != "" && (d.HasEnd || d.HasDue) {
				disp = prefix + " " + disp
			}
			btn.Children(func() {
				ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
					ui.Icon(c, lucide.Calendar()).Size(12, 12).TextColor(fg).AccessHidden(true)
					ui.Text(c, disp).FontSize(11.5).FontFeatures("tnum").FontWeight(500).TextColor(fg).SingleLine()
				})
			})
		}

		// All-day + Lunar/Start summary row (no redundant old DateInput!)
		ui.Row(c).AlignItems(ui.Center).Children(func() {
			ui.Checkbox(c, &d.AllDay, "全天").FontSize(12).OnChange(func() {
				if d.HasEnd {
					syncDraftEndAfterStart(d)
				}
			})
			ui.Spacer(c)
			if d.HasEnd || d.HasDue {
				targetPill("target-start-pill", "start", "开始", *date)
			} else if lunar, ok := solarToLunar(*date); ok {
				ui.Text(c, date.Format("01月02日")+" · "+lunar.FullLabel()).FontSize(11.5).TextColor(t.TextSecondary).SingleLine()
			}
		})

		if !d.AllDay {
			ui.Row(c.Key("start-time-row")).Gap(8).AlignItems(ui.Center).Children(func() {
				ui.Text(c, "开始时刻").FontSize(12).TextColor(t.TextSecondary).Width(56)
				ui.TimeInput(c, date).MinHeight(28).Label("开始时间时刻").OnChange(func() {
					*enabled = true
					syncDraftEndAfterStart(d)
				})
			})
			a.taskTimeShortcuts(c, "开始时间", true, date)
		}

		// End Time inline in the same schedule popover
		ui.Column(c.Key("end-time-block")).Gap(6).Children(func() {
			ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
				ui.Checkbox(c, &d.HasEnd, "结束时间").FontSize(12).OnChange(func() {
					if d.HasEnd {
						d.HasStart = true
						syncDraftEndAfterStart(d)
					} else if *calTarget == "end" {
						*calTarget = "start"
					}
				})
				if d.HasEnd {
					ui.Spacer(c)
					targetPill("target-end-pill", "end", "结束", d.End)
					if !d.AllDay {
						ui.TimeInput(c, &d.End).MinHeight(28).Label("结束时间时刻")
					}
				}
			})
		})

		// Optional Due Date inline toggle
		ui.Column(c.Key("due-date-block")).Gap(6).Children(func() {
			ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
				ui.Checkbox(c, &d.HasDue, "截止日期").FontSize(12).OnChange(func() {
					if !d.HasDue && *calTarget == "due" {
						*calTarget = "start"
					} else if d.HasDue {
						*calTarget = "due"
					}
				})
				if d.HasDue {
					ui.Spacer(c)
					targetPill("target-due-pill", "due", "截止", d.Due)
				}
			})
		})
	})
}
