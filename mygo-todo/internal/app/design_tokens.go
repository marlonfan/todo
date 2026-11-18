package app

import "github.com/egoist/mygo/ui"

// designTokens is the shared semantic palette. Keep appearance-specific colors
// here so every surface, including native controls, follows the same mapping.
type designTokens struct {
	BgApp, BgSidebar, BgList, BgSubtle, BgHover, BgSelected, BgTaskSelected ui.Color
	TextPrimary, TextSecondary, TextTertiary, TextDecorative, TextReadable  ui.Color
	BorderDefault, BorderSubtle                                             ui.Color
	TextOnAccent                                                            ui.Color
	Accent, AccentHover, Danger, Warning, Success                           ui.Color
}

// Claude-inspired warm editorial palette: warm parchment ivory + terracotta in
// light mode, warm espresso charcoal + coral terracotta in dark mode. Every
// readable token maintains >= 4.5:1 WCAG contrast across all seven surfaces.
func tokensOf(c *ui.Context) designTokens {
	if c.Theme().Dark {
		return designTokens{
			BgApp: ui.Hex("#21201E"), BgSidebar: ui.Hex("#191816"), BgList: ui.Hex("#21201E"),
			BgSubtle: ui.Hex("#2A2926"), BgHover: ui.Hex("#33312D"), BgSelected: ui.Hex("#3B342E"), BgTaskSelected: ui.Hex("#2E2C28"),
			TextPrimary: ui.Hex("#F0EEE6"), TextSecondary: ui.Hex("#B0ABA0"), TextTertiary: ui.Hex("#7E7A71"),
			TextDecorative: ui.Hex("#7E7A71"), TextReadable: ui.Hex("#B5B0A4"),
			BorderDefault: ui.Hex("#3A3833"), BorderSubtle: ui.Hex("#2D2B27"),
			TextOnAccent: ui.Hex("#191816"),
			Accent:       ui.Hex("#D97757"), AccentHover: ui.Hex("#E38A6C"),
			Danger: ui.Hex("#E57368"), Warning: ui.Hex("#DFA055"), Success: ui.Hex("#6BBF8A"),
		}
	}
	return designTokens{
		BgApp: ui.Hex("#FAF9F5"), BgSidebar: ui.Hex("#F0EEE6"), BgList: ui.Hex("#FAF9F5"),
		BgSubtle: ui.Hex("#F4F2EB"), BgHover: ui.Hex("#E8E5DC"), BgSelected: ui.Hex("#E5DFD3"), BgTaskSelected: ui.Hex("#EFECE2"),
		TextPrimary: ui.Hex("#141413"), TextSecondary: ui.Hex("#5F5B53"), TextTertiary: ui.Hex("#858178"),
		TextDecorative: ui.Hex("#858178"), TextReadable: ui.Hex("#57534C"),
		BorderDefault: ui.Hex("#DEDAD0"), BorderSubtle: ui.Hex("#EBE8DF"),
		TextOnAccent: ui.Hex("#FAF9F5"),
		Accent:       ui.Hex("#C96442"), AccentHover: ui.Hex("#B55333"),
		Danger: ui.Hex("#C84337"), Warning: ui.Hex("#C4792B"), Success: ui.Hex("#3D7F58"),
	}
}

// applyAppTheme preserves the caller's light/dark selection and native focus,
// while mapping framework controls onto the app's semantic design system.
func applyAppTheme(c *ui.Context) {
	t := tokensOf(c)
	palette := *c.Theme()
	palette.Background, palette.Surface = t.BgApp, t.BgSubtle
	palette.SurfaceHover, palette.SurfacePressed = t.BgHover, t.BgSelected
	palette.Text, palette.TextMuted, palette.Border = t.TextPrimary, t.TextReadable, t.BorderDefault
	palette.Accent, palette.AccentHover = t.Accent, t.AccentHover
	palette.AccentPressed = t.AccentHover.Mix(t.TextPrimary, 0.12)
	palette.AccentText = t.TextOnAccent
	palette.Inverse, palette.InverseText = t.TextPrimary, t.BgApp
	palette.Danger, palette.Warning, palette.Success = t.Danger, t.Warning, t.Success
	palette.Selection, palette.Focus = t.Accent.Alpha(0.18), t.Accent
	palette.Radius, palette.Spacing, palette.FontSize, palette.Font = controlRadius, spaceUnit, fontBody, ""
	c.SetTheme(&palette)
}

// Flat, architectural surfaces with crisp 1px borders — zero drop shadows.
func elevatePopup(c *ui.Context, e ui.Element) ui.Element {
	return e.Border(1, tokensOf(c).BorderDefault)
}

func elevateModal(c *ui.Context, e ui.Element) ui.Element {
	return e.Border(1, tokensOf(c).BorderDefault)
}
