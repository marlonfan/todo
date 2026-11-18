package app

import (
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

// Lobe's TokensOf reads its built-in light/dark palettes rather than the
// context's semantic colors. Style these native primitives here so nested
// tracks, indicators and search containers share the application palette.
func appSegmented(c *ui.Context, selected *int, options []string, p action.SegmentedProps) ui.Element {
	t := tokensOf(c)
	height, padding, fontSize := float32(28), float32(11), float32(12)
	switch p.Size {
	case theme.Small:
		height, padding, fontSize = 26, 9, 12
	case theme.Large:
		height, padding, fontSize = 34, 15, 13
	}
	parts := ui.SegmentedBase(c, selected, len(options))
	// Borderless recessed pill track — zero wireframe double-boxes.
	track := parts.Track.Padding(3).Gap(2).Radius(8).Background(t.BgSubtle)
	if p.Variant == action.SegmentedOutlined {
		track.Background(ui.Transparent).Border(1, t.BorderSubtle)
	}
	if p.Block {
		track.AlignSelf(ui.Stretch)
	}
	track.Children(func() {
		for i, option := range options {
			seg := parts.Segment(i).Label(option).Height(height).PaddingX(padding).Radius(6).
				FontSize(fontSize).FontWeight(500).Cursor(ui.CursorPointer).
				BorderWidth(0).TextColor(t.TextReadable).FocusRingColor(t.Accent)
			if p.Block {
				seg.Grow(1).Basis(0)
			}
			switch {
			case i == *selected:
				seg.Background(t.BgSelected).TextColor(t.TextPrimary).FontWeight(600)
			case seg.Pressed():
				seg.Background(t.BgSelected).TextColor(t.TextPrimary)
			case seg.Hovered():
				seg.Background(t.BgHover).TextColor(t.TextPrimary)
			}
			seg.Children(func() { ui.Text(c, option).SingleLine() })
		}
	})
	return track
}

// Return the native input, matching SearchBar's Ref, Changed, focus, shortcut,
// submission and IME contract. The surrounding field owns its border and ring.
func appSearchBar(c *ui.Context, query *string, p field.SearchBarProps) ui.Element {
	t := tokensOf(c)
	height, padding, fontSize := float32(32), float32(10), float32(13)
	switch p.Size {
	case theme.Small:
		height, padding, fontSize = 30, 8, 12
	case theme.Large:
		height, fontSize = 38, 15
	}
	focusNow := false
	if mods, key, ok := display.HotkeyBinding(p.ShortKey, p.Platform); ok && p.ShortKey != "" {
		focusNow = c.Shortcut(mods, key)
	}
	placeholder := p.Placeholder
	if placeholder == "" {
		placeholder = "搜索…"
	}
	root := ui.Row(c).MinHeight(height).PaddingX(padding).Gap(4).Radius(controlRadius).
		AlignItems(ui.Center).FontSize(fontSize).TextColor(t.TextPrimary).Cursor(ui.CursorText).
		Background(t.BgSubtle).Border(1, ui.Transparent)
	var input ui.Element
	root.Children(func() {
		glyph := lucide.Search()
		if p.Loading {
			glyph = lucide.LoaderCircle()
		}
		icon := ui.Icon(c, glyph).Size(15, 15).TextColor(t.TextSecondary).Shrink(0).AccessHidden(true)
		if p.Loading {
			icon.Rotate(icon.Loop("spin", time.Second, ui.Linear) * 360)
		}
		icon.Margin(0, 4, 0, 0)
		input = ui.TextInputBase(c, query).Grow(1).MinWidth(0).FocusRing(false).
			Placeholder(placeholder).PlaceholderColor(t.TextReadable)
		if focusNow {
			input.Focus()
		}
		if mods, key, ok := display.HotkeyBinding(p.ShortKey, p.Platform); ok && p.ShortKey != "" {
			input.KeyShortcuts(mods, key)
		}
		if input.Submitted() && p.OnSearch != nil {
			p.OnSearch(*query)
		}
		switch {
		case *query != "":
			clear := ui.ButtonBase(c).Label("清除").Tooltip("清除搜索").Size(26, 26).Radius(6).Center().Shrink(0).
				Cursor(ui.CursorPointer).TextColor(t.TextSecondary).FocusRingColor(t.Accent)
			if clear.Hovered() {
				clear.TextColor(t.TextPrimary)
			}
			if clear.Clicked() {
				*query = ""
				input.Focus()
			}
			clear.Children(func() { ui.Icon(c, lucide.CircleX()).FontSize(14) })
		case p.ShortKey != "" && !input.Focused():
			display.Hotkey(c, p.ShortKey, display.HotkeyProps{Compact: true, Platform: p.Platform}).TextColor(t.TextReadable)
		}
	})
	if p.Variant == field.InputBorderless {
		root.Background(ui.Transparent).BorderColor(ui.Transparent)
	} else if input.Focused() {
		root.Background(t.BgApp).BorderColor(t.Accent)
	} else if root.Hovered() {
		root.Background(t.BgHover)
	}
	return input
}
