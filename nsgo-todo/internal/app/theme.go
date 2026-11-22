package app

import (
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/domain"
)

// ThemeMode selects light, dark or system appearance.
type ThemeMode string

const (
	ThemeSystem ThemeMode = "system"
	ThemeLight  ThemeMode = "light"
	ThemeDark   ThemeMode = "dark"
)

// TodoTheme builds NSGo's theme using mygo-todo's warm editorial palette:
//   - Light: #FAF9F6 (canvas) / #FFFFFF (cards) / #F5F3EE (inset) / #C46849 (terracotta accent)
//   - Dark:  #181715 (canvas) / #232220 (cards) / #1E1D1B (inset) / #D67E60 (warm terracotta accent)
func TodoTheme() *core.Theme {
	t := core.DefaultTheme()

	lightText := core.RGB(0x2C2A29)
	darkText := core.RGB(0xECEAE4)

	t.Light = core.Palette{
		Background:     core.RGB(0xFAF9F6),
		Surface:        core.RGB(0xFFFFFF),
		SurfaceHover:   core.RGBA(0x1C1917, 0.04),
		SurfacePressed: core.RGBA(0x1C1917, 0.08),
		Border:         core.RGB(0xE3DFD6),
		Text:           lightText,
		TextMuted:      core.RGB(0x646058),
		Accent:         core.RGB(0xC46849),
		AccentHover:    core.RGB(0xB0573A),
		AccentPressed:  core.RGB(0x9A4B31),
		AccentText:     core.RGB(0xFFFFFF),
		Danger:         core.RGB(0xBE524B),
		Warning:        core.RGB(0xA46B2F),
		Success:        core.RGB(0x4A7D62),
		Selection:      core.RGBA(0xC46849, 0.16),
		Focus:          core.RGBA(0xC46849, 0.60),
		Scrollbar:      lightText.Faded(0.28),
		Colors: map[string]core.Color{
			"inset":       core.RGB(0xF5F3EE),
			"raised":      core.RGB(0xFFFFFF),
			"field":       core.RGB(0xF2F0EA),
			"fieldBorder": core.RGB(0xE3DFD6),
			"line":        core.RGB(0xEEECE6),
			"faint":       core.RGB(0x8B867D),
			"accentFill":  core.RGB(0xC46849),
			"light":       lightText,
			"onLight":     core.RGB(0xFAF9F6),
			"track":       lightText.Faded(0.24),
			"knob":        core.RGB(0xFFFFFF),
			"code":        core.RGB(0x3A3631),
			"info":        core.RGB(0x3D63D1),
			"down":        core.RGB(0xBE524B),
			"cardBorder":  core.RGBA(0x1C1917, 0.08),
		},
	}

	t.Dark = core.Palette{
		Background:     core.RGB(0x181715),
		Surface:        core.RGB(0x232220),
		SurfaceHover:   core.RGBA(0xFFFCF5, 0.06),
		SurfacePressed: core.RGBA(0xFFFCF5, 0.11),
		Border:         core.RGB(0x3C3A35),
		Text:           darkText,
		TextMuted:      core.RGB(0xA8A39A),
		Accent:         core.RGB(0xD67E60),
		AccentHover:    core.RGB(0xE08E72),
		AccentPressed:  core.RGB(0xC46C4F),
		AccentText:     core.RGB(0x191816),
		Danger:         core.RGB(0xDC7C73),
		Warning:        core.RGB(0xD6A061),
		Success:        core.RGB(0x72B58D),
		Selection:      core.RGBA(0xD67E60, 0.22),
		Focus:          core.RGBA(0xD67E60, 0.75),
		Scrollbar:      darkText.Faded(0.32),
		Colors: map[string]core.Color{
			"inset":       core.RGB(0x1E1D1B),
			"raised":      core.RGB(0x33312E),
			"field":       core.RGB(0x2A2926),
			"fieldBorder": core.RGB(0x3C3A35),
			"line":        core.RGB(0x2F2D29),
			"faint":       core.RGB(0x7D7870),
			"accentFill":  core.RGB(0xD67E60),
			"light":       darkText,
			"onLight":     core.RGB(0x181715),
			"track":       darkText.Faded(0.28),
			"knob":        core.RGB(0xF5F3EE),
			"code":        core.RGB(0xE2DCD2),
			"info":        core.RGB(0x7EA8FF),
			"down":        core.RGB(0xDC7C73),
			"cardBorder":  core.RGBA(0xFFFCF5, 0.08),
		},
	}

	return t
}

func applyThemeMode(cx *core.Scope, mode ThemeMode) {
	switch mode {
	case ThemeLight:
		cx.SetAppearance(core.AppearanceLight)
	case ThemeDark:
		cx.SetAppearance(core.AppearanceDark)
	default:
		cx.SetAppearance(core.AppearanceSystem)
	}
}

func cardBorderColor(cx *core.Scope) core.Color {
	if c, ok := cx.Palette().Colors["cardBorder"]; ok && c != 0 {
		return c
	}
	return ui.ColorsOf(cx).Border()
}

// cardStyle creates mygo-todo's crisp warm editorial card surface.
// Scrolling list/detail cards intentionally avoid multi-layer blurred BoxShadows
// so Android's renderer stays lock-smooth at 120Hz with zero blur overdraw.
func cardStyle(cx *core.Scope) core.Style {
	colors := ui.ColorsOf(cx)
	return core.Style{
		Background:  colors.Surface(),
		BorderWidth: 1,
		BorderColor: cardBorderColor(cx),
	}
}

// floatingCardStyle adds soft warm elevation for non-scrolling modals/auth cards.
func floatingCardStyle(cx *core.Scope) core.Style {
	s := cardStyle(cx)
	if cx.Dark() {
		s.Shadows = []core.BoxShadow{
			ui.Shadow(0, 2, 10, 0, core.RGBA(0x000000, 0.36)),
		}
	} else {
		s.Shadows = []core.BoxShadow{
			ui.Shadow(0, 2, 8, -2, core.RGBA(0x1C1917, 0.08)),
		}
	}
	return s
}

// priorityColor maps task priority (0-3) to warm editorial semantic tones.
func priorityColor(cx *core.Scope, priority int) core.Color {
	colors := ui.ColorsOf(cx)
	switch priority {
	case 3:
		return colors.Danger()
	case 2:
		return colors.Warn()
	case 1:
		return colors.Info()
	default:
		return colors.Faint()
	}
}

// softenCategoryColor tempers saturated hex category colors to match mygo-todo.
func softenCategoryColor(cx *core.Scope, hex string) core.Color {
	colors := ui.ColorsOf(cx)
	rgb, ok := domain.ParseHexRGB(hex)
	if !ok {
		return colors.Accent()
	}
	raw := core.RGB(rgb)
	if cx.Dark() {
		return ui.Mix(raw, colors.Text(), 0.16)
	}
	return ui.Mix(raw, colors.Muted(), 0.20)
}

// Curated warm editorial category colors matching mygo-todo style.
var categoryColorPresets = []string{
	"#C46849",
	"#4A7D62",
	"#A46B2F",
	"#3D63D1",
	"#BE524B",
	"#7A5C8F",
	"#4A7C82",
	"#646058",
}

var categoryEmojiPresets = []string{
	"📁", "💼", "🏠", "📚", "🎯", "💡", "🛒", "🏃", "🌿", "⭐",
}
