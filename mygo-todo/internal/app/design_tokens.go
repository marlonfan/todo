package app

import (
	"time"

	"github.com/egoist/mygo/ui"
)

// Motion timing tokens used across all animations in the desktop app.
// MyGo automatically collapses motion when the OS "Reduce motion" preference
// is active, while keeping opacity fades and color/shadow transitions smooth.
const (
	motionFast         = 120 * time.Millisecond
	motionBase         = 200 * time.Millisecond
	motionPopupEnter   = 150 * time.Millisecond
	motionPopupExit    = 100 * time.Millisecond
	motionDetailIn     = 90 * time.Millisecond
	motionPageIn       = 120 * time.Millisecond
	motionCompleteHold = 360 * time.Millisecond
)

func motionColorsFast() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:    true,
		Animation: &ui.Animation{Duration: motionFast, Ease: ui.EaseOut, Oklab: true},
	}
}

func motionColorsShadowsFast() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:    true,
		Shadows:   true,
		Animation: &ui.Animation{Duration: motionFast, Ease: ui.EaseOut, Oklab: true},
	}
}

func motionLayoutBase() ui.ElementTransition {
	return ui.ElementTransition{
		Size:     true,
		Position: true,
		Duration: motionBase,
		Ease:     ui.EaseOut,
	}
}

func motionStructural() ui.ElementTransition {
	return ui.ElementTransition{
		Animation: &ui.Snappy,
	}
}

func motionRowLifecycle() ui.ElementTransition {
	return ui.ElementTransition{
		Animation: &ui.Snappy,
		Position:  true,
		Colors:    true,
		Shadows:   true,
		Enter:     &ui.Motion{Collapse: true},
		Exit:      &ui.Motion{Collapse: true},
	}
}

func motionPopup() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:       true,
		Duration:     motionPopupEnter,
		Ease:         ui.EaseOut,
		ExitDuration: motionPopupExit,
		ExitEase:     ui.EaseIn,
		Enter:        &ui.Motion{Scale: 0.96, Y: -4, Flip: true},
		Exit:         &ui.Motion{Scale: 0.96, Y: -4, Flip: true},
	}
}

func motionModal() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:       true,
		Duration:     motionPopupEnter,
		Ease:         ui.EaseOut,
		ExitDuration: motionPopupExit,
		ExitEase:     ui.EaseIn,
		Enter:        &ui.Motion{Scale: 0.96},
		Exit:         &ui.Motion{Scale: 0.96},
	}
}

func motionDetailSwitch() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:   true,
		Duration: motionDetailIn,
		Ease:     ui.EaseOut,
		Enter:    &ui.Motion{Y: 4},
		Exit:     &ui.Motion{},
	}
}

func motionPageSwitch() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:   true,
		Duration: motionPageIn,
		Ease:     ui.EaseOut,
		Enter:    &ui.Motion{Y: 4},
	}
}

func motionDrawerRight() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:    true,
		Animation: &ui.Snappy,
		Enter:     &ui.Motion{Opacity: 1, XPercent: 100},
		Exit:      &ui.Motion{Opacity: 1, XPercent: 100},
	}
}

func motionPush(dir float32) ui.ElementTransition {
	if dir == 0 {
		dir = 1
	}
	return ui.ElementTransition{
		Colors:    true,
		Animation: &ui.Snappy,
		Enter:     &ui.Motion{Opacity: 1, XPercent: 100 * dir},
		Exit:      &ui.Motion{Opacity: 1, XPercent: -30 * dir},
	}
}

func motionCalendarSlide(dir float32) ui.ElementTransition {
	if dir == 0 {
		return ui.ElementTransition{
			Colors:   true,
			Duration: motionPageIn,
			Ease:     ui.EaseOut,
			Enter:    &ui.Motion{Y: 4},
		}
	}
	return ui.ElementTransition{
		Colors:    true,
		Animation: &ui.Snappy,
		Enter:     &ui.Motion{X: 36 * dir},
		Exit:      &ui.Motion{X: -36 * dir},
	}
}

func motionTextSwap() ui.ElementTransition {
	return ui.ElementTransition{
		Colors:   true,
		Duration: 150 * time.Millisecond,
		Ease:     ui.EaseOut,
		Enter:    &ui.Motion{Y: 4, Blur: 2},
		Exit:     &ui.Motion{Y: -4, Blur: 2},
	}
}

// designTokens is the shared semantic palette. Keep appearance-specific colors
// here so every surface, including native controls, follows the same mapping.
type designTokens struct {
	BgApp, BgSidebar, BgList, BgElevated, BgSubtle, BgHover, BgSelected, BgTaskSelected ui.Color
	TextPrimary, TextSecondary, TextTertiary, TextDecorative, TextReadable              ui.Color
	BorderDefault, BorderSubtle, BorderCard, BorderPopup                                ui.Color
	TextOnAccent                                                                        ui.Color
	Accent, AccentHover, Danger, Warning, Success                                       ui.Color
	ShadowContact, ShadowAmbient                                                        ui.Color
}

// Warm editorial palette with a crisp three-tier canvas gradient:
// Light: #F5F3EE (sidebar) -> #FAF9F6 (list) -> #FFFFFF (main canvas & cards).
// Dark:  #181715 (sidebar) -> #1E1D1B (list) -> #232220 (main canvas).
// Every readable token maintains >= 4.5:1 WCAG contrast across all surfaces.
func tokensOf(c *ui.Context) designTokens {
	if c.Theme().Dark {
		return designTokens{
			BgApp: ui.Hex("#232220"), BgSidebar: ui.Hex("#181715"), BgList: ui.Hex("#1E1D1B"),
			BgElevated: ui.Hex("#33312E"), BgSubtle: ui.Hex("#2A2926"),
			BgHover: ui.RGBA(255, 252, 245, 0.06), BgSelected: ui.RGBA(255, 252, 245, 0.10), BgTaskSelected: ui.Hex("#2A2926"),
			TextPrimary: ui.Hex("#ECEAE4"), TextSecondary: ui.Hex("#A8A39A"), TextTertiary: ui.Hex("#7D7870"),
			TextDecorative: ui.Hex("#7D7870"), TextReadable: ui.Hex("#B6B1A7"),
			BorderDefault: ui.Hex("#3C3A35"), BorderSubtle: ui.Hex("#2F2D29"),
			BorderCard: ui.RGBA(255, 252, 245, 0.08), BorderPopup: ui.RGBA(255, 252, 245, 0.11),
			TextOnAccent: ui.Hex("#191816"),
			Accent:       ui.Hex("#D67E60"), AccentHover: ui.Hex("#E08E72"),
			Danger: ui.Hex("#DC7C73"), Warning: ui.Hex("#D6A061"), Success: ui.Hex("#72B58D"),
			ShadowContact: ui.RGBA(0, 0, 0, 0.34), ShadowAmbient: ui.RGBA(0, 0, 0, 0.48),
		}
	}
	return designTokens{
		BgApp: ui.Hex("#FFFFFF"), BgSidebar: ui.Hex("#F5F3EE"), BgList: ui.Hex("#FAF9F6"),
		BgElevated: ui.Hex("#FFFFFF"), BgSubtle: ui.Hex("#F2F0EA"),
		BgHover: ui.RGBA(28, 25, 23, 0.04), BgSelected: ui.RGBA(28, 25, 23, 0.06), BgTaskSelected: ui.Hex("#FFFFFF"),
		TextPrimary: ui.Hex("#2C2A29"), TextSecondary: ui.Hex("#646058"), TextTertiary: ui.Hex("#8B867D"),
		TextDecorative: ui.Hex("#8B867D"), TextReadable: ui.Hex("#5A564F"),
		BorderDefault: ui.Hex("#E3DFD6"), BorderSubtle: ui.Hex("#EEECE6"),
		BorderCard: ui.RGBA(28, 25, 23, 0.08), BorderPopup: ui.RGBA(28, 25, 23, 0.10),
		TextOnAccent: ui.Hex("#FFFFFF"),
		Accent:       ui.Hex("#C46849"), AccentHover: ui.Hex("#B0573A"),
		Danger: ui.Hex("#BE524B"), Warning: ui.Hex("#A46B2F"), Success: ui.Hex("#4A7D62"),
		ShadowContact: ui.RGBA(28, 25, 23, 0.06), ShadowAmbient: ui.RGBA(28, 25, 23, 0.10),
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
	palette.Selection, palette.Focus = t.Accent.Alpha(0.16), t.Accent
	palette.Scrollbar = t.TextTertiary.Alpha(0.28)
	if c.Theme().Dark {
		palette.Scrollbar = t.TextTertiary.Alpha(0.32)
	}
	palette.ScrollbarWidth = 4
	palette.Radius, palette.Spacing, palette.FontSize, palette.Font = controlRadius, spaceUnit, fontBody, ""
	c.SetTheme(&palette)
}

// Layered soft elevation for floating popovers, menus, and date/time pickers.
func elevatePopup(c *ui.Context, e ui.Element) ui.Element {
	t := tokensOf(c)
	if c.Theme().Dark {
		return e.Border(1, t.BorderPopup).
			Shadow(0, 2, 6, 0, t.ShadowContact).
			Shadow(0, 12, 28, -4, t.ShadowAmbient)
	}
	return e.Border(1, t.BorderPopup).
		Shadow(0, 1, 3, 0, t.ShadowContact).
		Shadow(0, 8, 20, -4, t.ShadowAmbient).
		Shadow(0, 18, 36, -8, ui.RGBA(28, 25, 23, 0.07))
}

// Layered soft elevation for modal dialogs and auth cards.
func elevateModal(c *ui.Context, e ui.Element) ui.Element {
	t := tokensOf(c)
	if c.Theme().Dark {
		return e.Border(1, t.BorderPopup).
			Shadow(0, 4, 12, 0, ui.RGBA(0, 0, 0, 0.42)).
			Shadow(0, 20, 48, -8, ui.RGBA(0, 0, 0, 0.56))
	}
	return e.Border(1, t.BorderPopup).
		Shadow(0, 2, 6, 0, t.ShadowContact).
		Shadow(0, 16, 40, -8, ui.RGBA(28, 25, 23, 0.12)).
		Shadow(0, 28, 60, -12, ui.RGBA(28, 25, 23, 0.08))
}

// Subtle floating card elevation for selected task cards and highlighted items.
func elevateCard(c *ui.Context, e ui.Element) ui.Element {
	t := tokensOf(c)
	e.Background(t.BgTaskSelected).Border(1, t.BorderCard)
	if c.Theme().Dark {
		return e.Shadow(0, 1, 3, 0, ui.RGBA(0, 0, 0, 0.28))
	}
	return e.Shadow(0, 1, 2, 0, ui.RGBA(28, 25, 23, 0.05)).
		Shadow(0, 3, 8, -2, ui.RGBA(28, 25, 23, 0.04))
}

// Crisp tactile elevation for active segmented control pills.
func elevateSegmentActive(c *ui.Context, e ui.Element) ui.Element {
	t := tokensOf(c)
	e.Background(t.BgElevated).Border(1, t.BorderCard)
	if c.Theme().Dark {
		return e.Shadow(0, 1, 2, 0, ui.RGBA(0, 0, 0, 0.30))
	}
	return e.Shadow(0, 1, 2, 0, ui.RGBA(28, 25, 23, 0.07)).
		Shadow(0, 0.5, 1, 0, ui.RGBA(28, 25, 23, 0.04))
}

// Soft leftward ambient separation for side slide-over drawers.
func elevateDrawer(c *ui.Context, e ui.Element) ui.Element {
	t := tokensOf(c)
	e.BorderWidth(0, 0, 0, 1).BorderColor(t.BorderSubtle)
	if c.Theme().Dark {
		return e.Shadow(-8, 0, 24, -4, ui.RGBA(0, 0, 0, 0.40))
	}
	return e.Shadow(-6, 0, 20, -4, ui.RGBA(28, 25, 23, 0.06))
}

// softenAccentColor tempers saturated user category colors into warm editorial tones.
func softenAccentColor(c *ui.Context, raw ui.Color) ui.Color {
	t := tokensOf(c)
	if c.Theme().Dark {
		return raw.Mix(t.TextPrimary, 0.16)
	}
	return raw.Mix(t.TextSecondary, 0.22)
}
