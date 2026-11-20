package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
)

// appDropdown shares the menu appearance while MenuBase retains native keyboard
// navigation, focus restoration, disabled items and menu accessibility roles.
func appDropdown(c *ui.Context, open *bool, items []overlay.MenuItem, trigger func(ui.Element)) string {
	t := tokensOf(c)
	menu := ui.MenuBase(c, open)
	trigger(menu.Trigger)
	chosen := ""
	menu.Popup(func(panel ui.Element) {
		elevateFloatingSurface(c, panel.Padding(5).Radius(10).MinWidth(212).MaxWidthPercent(95))
		panel.Children(func() {
			for index, item := range items {
				if item.Divider {
					ui.Box(c.Key(index)).Height(1).Margin(4, 4).Background(t.BorderSubtle)
					continue
				}
				row := menu.Item().Label(item.Label).Disabled(item.Disabled).Padding(6, 10).MinHeight(32).Radius(6).AlignSelf(ui.Stretch).FontSize(13)
				color := t.TextPrimary
				if item.Danger {
					color = t.Danger
				}
				if row.Pressed() || row.Highlighted() {
					if item.Danger {
						row.Background(t.Danger.Alpha(0.10))
					} else {
						row.Background(t.BgHover)
					}
				}
				row.TextColor(color).Children(func() {
					ui.Row(c).Gap(8).MinWidth(0).AlignItems(ui.Center).Children(func() {
						if item.Icon != nil {
							ui.Icon(c, item.Icon).Size(15, 15).TextColor(color).AccessHidden(true)
						}
						ui.Text(c, item.Label).Grow(1).MinWidth(0).SingleLine()
						if item.Extra != "" {
							ui.Text(c, item.Extra).FontSize(11).TextColor(t.TextSecondary).SingleLine()
						}
						if item.Hotkey != "" {
							ui.Text(c, item.Hotkey).FontSize(11).TextColor(t.TextTertiary).SingleLine()
						}
					})
				})
				if row.Clicked() && !item.Disabled {
					chosen = item.Key
				}
			}
		})
	})
	return chosen
}
