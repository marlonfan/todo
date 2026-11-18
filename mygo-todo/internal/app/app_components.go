package app

import (
	"strconv"
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

// appButton accepts primary, secondary, ghost or destructive. Unknown variants
// use secondary styling. The native element retains keyboard focus, activation,
// Disabled and Ref behavior.
func appButton(c *ui.Context, label, variant string) ui.Element {
	return styleAppButton(c, ui.ButtonBase(c).Label(label), label, variant)
}

func styleAppButton(c *ui.Context, button ui.Element, label, variant string) ui.Element {
	t := tokensOf(c)
	bg, border, text := t.BgSubtle, t.BorderSubtle, t.TextPrimary
	switch variant {
	case "primary":
		bg, border, text = t.Accent, t.Accent, t.TextOnAccent
		if button.Hovered() || button.Pressed() {
			bg, border = t.AccentHover, t.AccentHover
		}
	case "ghost":
		bg, border = ui.Transparent, ui.Transparent
	case "destructive":
		bg, border, text = ui.Transparent, ui.Transparent, t.Danger
		if button.Pressed() {
			bg = t.Danger.Alpha(0.16)
		} else if button.Hovered() {
			bg = t.Danger.Alpha(0.10)
		}
	}
	if variant != "primary" && variant != "destructive" {
		if button.Pressed() {
			bg = t.BgSelected
			if variant != "ghost" {
				border = t.BorderDefault
			}
		} else if button.Hovered() {
			bg = t.BgHover
			if variant != "ghost" {
				border = t.BorderDefault
			}
		}
	}
	button.Height(controlHeight).Padding(0, 10).Radius(controlRadius).Center().Cursor(ui.CursorPointer).
		FontSize(12.5).FontWeight(500).
		Background(bg).Border(1, border).TextColor(text).FocusRingColor(t.Accent)
	if label != "" {
		button.Children(func() {
			ui.Text(c, label).SingleLine()
		})
	}
	return button
}

// appActionButton is a drop-in adapter for Lobe button call sites. It uses the
// semantic palette for every variant while retaining native activation and size.
func appActionButton(c *ui.Context, label string, props action.ButtonProps) ui.Element {
	variant := "secondary"
	switch props.Variant {
	case action.Primary:
		variant = "primary"
	case action.Text, action.Link:
		variant = "ghost"
	}
	destructive := strings.HasPrefix(label, "确认删除") || strings.HasPrefix(label, "确认放弃") ||
		strings.HasPrefix(label, "删除提醒") || strings.HasPrefix(label, "放弃此") ||
		label == "移除头像" || label == "放弃本机账户偏好" || label == "放弃并切换"
	if destructive {
		variant = "destructive"
	}
	button := appButton(c, label, variant)
	t := tokensOf(c)
	if !destructive {
		switch props.Variant {
		case action.Filled:
			if !button.Hovered() && !button.Pressed() {
				button.Background(t.BgSubtle)
			}
			button.BorderColor(ui.Transparent)
		case action.Link:
			color := t.Accent
			if button.Hovered() || button.Pressed() {
				color = t.AccentHover
			}
			button.TextColor(color)
		case action.Dashed:
			button.BorderStyle(ui.BorderDashed).BorderColor(t.BorderDefault)
		}
	}
	switch props.Size {
	case theme.Small:
		button.Height(28).PaddingX(9).FontSize(12)
	case theme.Large:
		button.Height(40).PaddingX(16).FontSize(14)
	}
	if props.Variant == action.Link {
		button.PaddingX(0)
	}
	return button
}

// primaryButton retains the existing optional Lobe size API.
func primaryButton(c *ui.Context, label string, size ...theme.Size) ui.Element {
	button := appButton(c, label, "primary")
	if len(size) > 0 {
		switch size[0] {
		case theme.Small:
			button.Height(28).PaddingX(10).FontSize(12)
		case theme.Large:
			button.Height(40).PaddingX(16).FontSize(14)
		}
	}
	return button
}

// Secondary actions retain their layout and keyboard/accessibility order.
func revealSecondary(button, region ui.Element) ui.Element {
	if !region.Hovered() && !region.FocusWithin() && !button.Focused() {
		button.Opacity(0)
	}
	return button
}

func iconButton(c *ui.Context, label string, icon *ui.SVG) ui.Element {
	t := tokensOf(c)
	button := styleAppButton(c, ui.ButtonBase(c).Label(label).Tooltip(label), "", "ghost").Size(30, 30).Padding(7)
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

// A hidden count still returns an element so callers can safely assign refs.
func countBadge(c *ui.Context, count int) ui.Element {
	t := tokensOf(c)
	return ui.Text(c, strconv.Itoa(count)).Hidden(count <= 0).FontSize(11).FontWeight(500).FontFeatures("tnum").
		TextColor(t.TextReadable).Radius(5).Padding(1, 6).Shrink(0)
}

// Keep SidebarItem's selection, type-to-select and tree semantics.
func (a *App) sidebarEntry(c *ui.Context, id, title, emoji string, icon *ui.SVG) ui.Element {
	t := tokensOf(c)
	selected := a.page == id
	item := ui.SidebarItem(c, id, nil, title).Height(navigationRowHeight).Padding(0, 10, 0, 36).Radius(7).FontSize(13).FontWeight(400).Label(title)
	item.OnClick(func() {
		if selected {
			a.sidebarOverlay = false
		}
	})
	iconColor := t.TextSecondary
	item.TextColor(t.TextPrimary).Background(ui.Transparent)
	if item.Hovered() {
		item.Background(t.BgHover)
	}
	if a.page == id {
		item.Background(t.BgSelected).FontWeight(600)
		iconColor = t.Accent
	}
	item.Children(func() {
		ui.Column(c.Key("identity")).Absolute().Start(11).Top(0).Bottom(0).Width(18).Center().Children(func() {
			if emoji != "" {
				ui.Text(c, emoji).FontSize(15).SingleLine()
			} else if icon != nil {
				ui.Icon(c, icon).Size(16, 16).TextColor(iconColor)
			}
		})
	})
	return item
}
