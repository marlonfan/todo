package app

import (
	"fmt"
	"math"
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
)

// WCAG relative luminance uses linear sRGB, not channel averages. Composite
// alpha first so a future translucent readable token cannot silently pass.
func readableContrast(fg, bg ui.Color) float64 {
	luminance := func(c ui.Color) float64 {
		linear := func(v uint8) float64 {
			s := float64(v) / 255
			if s <= 0.04045 {
				return s / 12.92
			}
			return math.Pow((s+0.055)/1.055, 2.4)
		}
		return 0.2126*linear(c.R) + 0.7152*linear(c.G) + 0.0722*linear(c.B)
	}
	alpha := float64(fg.A) / 255
	blend := func(f, b uint8) uint8 { return uint8(math.Round(float64(f)*alpha + float64(b)*(1-alpha))) }
	fg = ui.RGB(blend(fg.R, bg.R), blend(fg.G, bg.G), blend(fg.B, bg.B))
	a, b := luminance(fg), luminance(bg)
	return (math.Max(a, b) + 0.05) / (math.Min(a, b) + 0.05)
}

func TestReadableTokenContrast(t *testing.T) {
	// Known WCAG endpoints catch accidental changes to the calculation itself.
	if got := readableContrast(ui.Hex("#000000"), ui.Hex("#FFFFFF")); got != 21 {
		t.Fatalf("black/white contrast = %v, want 21", got)
	}
	for _, dark := range []bool{false, true} {
		t.Run(fmt.Sprintf("dark=%t", dark), func(t *testing.T) {
			var palette designTokens
			var native ui.Theme
			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				palette, native = tokensOf(c), *c.Theme()
			}, 200, 100)
			tt.SetDark(dark)
			backgrounds := map[string]ui.Color{"app": palette.BgApp, "sidebar": palette.BgSidebar, "list": palette.BgList, "subtle": palette.BgSubtle, "hover": palette.BgHover, "selected": palette.BgSelected, "task-selected": palette.BgTaskSelected}
			readable := map[string]ui.Color{"primary": palette.TextPrimary, "readable/empty/placeholder": palette.TextReadable, "native placeholder/sync helper": native.TextMuted}
			for role, fg := range readable {
				for surface, bg := range backgrounds {
					ratio := readableContrast(fg, bg)
					if ratio < 4.5 {
						t.Errorf("%s on %s = %.4f:1, want >= 4.5", role, surface, ratio)
					}
					if role == "readable/empty/placeholder" && surface == "selected" {
						t.Logf("readable on selected = %.4f:1", ratio)
					}
				}
			}
			if readableContrast(palette.TextSecondary, palette.BgApp) < 4.5 {
				t.Fatal("secondary text must remain readable on the main surface")
			}
			// Weak/decorative color follows the new brief. Reading-required
			// empty values and placeholders use TextReadable independently.
			wantDecorative := ui.Hex("#858178")
			if dark {
				wantDecorative = ui.Hex("#7E7A71")
			}
			if palette.TextDecorative != wantDecorative {
				t.Fatal("decorative token does not match the latest semantic palette")
			}
		})
	}
}

func TestReadablePlaceholderRenderingAndNativeEditing(t *testing.T) {
	for _, dark := range []bool{false, true} {
		for _, area := range []bool{false, true} {
			t.Run(fmt.Sprintf("dark=%t/area=%t", dark, area), func(t *testing.T) {
				value, changed, escaped := "", false, false
				var ref ui.Ref
				var ink ui.Color
				tt := ui.NewTester(func(c *ui.Context) {
					applyAppTheme(c)
					ink = tokensOf(c).TextReadable
					ui.Column(c).Width(300).Children(func() {
						var input ui.Element
						if area {
							input = appTextArea(c, &value, field.TextAreaProps{Placeholder: "MMMMMM", MinRows: 1})
						} else {
							input = appFieldInput(c, &value, field.InputProps{Placeholder: "MMMMMM"})
						}
						input.Ref(&ref).Label("native editor").FontSize(24).OnShortcut(0, ui.KeyEscape, func() { escaped = true })
						changed = input.Changed() || changed
					})
				}, 320, 140)
				tt.SetDark(dark)
				image := tt.Image()
				pixels := 0
				for y := image.Rect.Min.Y; y < image.Rect.Max.Y; y++ {
					for x := image.Rect.Min.X; x < image.Rect.Max.X; x++ {
						p := image.RGBAAt(x, y)
						if p.R == ink.R && p.G == ink.G && p.B == ink.B && p.A == 255 {
							pixels++
						}
					}
				}
				if pixels == 0 {
					t.Fatal("rendered placeholder does not use the readable semantic color")
				}
				ref.Focus()
				tt.Frame()
				if !tt.Focused("native editor") {
					t.Fatal("helper did not return the native editor for Ref")
				}
				tt.Type("edited")
				tt.Key(0, ui.KeyEscape)
				if value != "edited" || !changed || !escaped {
					t.Fatalf("native editing lost: value=%q Changed=%t shortcut=%t", value, changed, escaped)
				}
			})
		}
	}
}

func TestReadableEmptyPreservesContentAndAction(t *testing.T) {
	for _, dark := range []bool{false, true} {
		for _, page := range []bool{false, true} {
			t.Run(fmt.Sprintf("dark=%t/page=%t", dark, page), func(t *testing.T) {
				clicked := false
				var descriptionInk ui.Color
				tt := ui.NewTester(func(c *ui.Context) {
					applyAppTheme(c)
					descriptionInk = tokensOf(c).TextReadable
					appDisplayEmpty(c, display.EmptyProps{Page: page, Icon: lucide.Calendar(), Title: "No events", Description: "Sync to get started", Action: func() {
						ui.Button(c, "Sync now").OnClick(func() { clicked = true })
					}}).Padding(20)
				}, 600, 240)
				tt.SetDark(dark)
				if !tt.HasText("No events") || !tt.HasText("Sync to get started") {
					t.Fatal("empty props lost their content")
				}
				image := tt.Image()
				readableInk := false
				for y := image.Rect.Min.Y; y < image.Rect.Max.Y; y++ {
					for x := image.Rect.Min.X; x < image.Rect.Max.X; x++ {
						p := image.RGBAAt(x, y)
						if p.R == descriptionInk.R && p.G == descriptionInk.G && p.B == descriptionInk.B && p.A == 255 {
							readableInk = true
						}
					}
				}
				if !readableInk {
					t.Fatal("empty description did not render in the readable semantic color")
				}
				if err := tt.Click("Sync now"); err != nil || !clicked {
					t.Fatalf("empty action was lost: %v", err)
				}
			})
		}
	}
}
