package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/display"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

// appDisplayEmpty preserves Lobe's inline/page layout and action slot while applying
// readable semantic colors. Icons are decorative and retain the muted palette.
func appDisplayEmpty(c *ui.Context, p display.EmptyProps) ui.Element {
	t := tokensOf(c)
	if p.Page {
		return ui.Row(c).Padding(8).Gap(20).AlignItems(ui.Start).FillWidth().Children(func() {
			if p.Icon != nil {
				ui.Icon(c, p.Icon).FontSize(36).TextColor(theme.TokensOf(c).TextQuaternary).Shrink(0).AccessHidden(true)
			}
			ui.Column(c).Grow(1).MinWidth(0).Children(func() {
				if p.Title != "" {
					ui.Text(c, p.Title).FontSize(18).FontWeight(600).TextColor(t.TextPrimary).Margin(0, 0, 4, 0)
				}
				if p.Description != "" {
					ui.Text(c, p.Description).FontSize(13).TextColor(t.TextReadable).MaxWidth(13 * 0.55 * 52)
				}
				if p.Action != nil {
					ui.Row(c).Gap(8).Margin(14, 0, 0, 0).Children(p.Action)
				}
			})
		})
	}
	return ui.Column(c).Gap(4).Padding(16, 8).AlignItems(ui.Center).FillWidth().Children(func() {
		if p.Icon != nil {
			ui.Icon(c, p.Icon).FontSize(32).TextColor(theme.TokensOf(c).TextQuaternary).AccessHidden(true)
		}
		if p.Title != "" {
			ui.Text(c, p.Title).FontWeight(500).TextColor(t.TextPrimary).TextAlign(ui.Center).Margin(8, 0, 0, 0)
		}
		if p.Description != "" {
			ui.Text(c, p.Description).FontSize(13).TextColor(t.TextReadable).TextAlign(ui.Center).MaxWidth(13 * 0.55 * 34)
		}
		if p.Action != nil {
			ui.Row(c).Margin(8, 0, 0, 0).Children(p.Action)
		}
	})
}
