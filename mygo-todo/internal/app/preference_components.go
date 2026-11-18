package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
)

// preferenceRow leaves native input and focus handling to its trailing control.
func preferenceRow(c *ui.Context, title, summary string, control func()) {
	t := tokensOf(c)
	ui.Row(c).MinHeight(44).Gap(12).Padding(8, 0).AlignItems(ui.Center).
		BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).Children(func() {
		ui.Column(c).Grow(1).MinWidth(0).Gap(4).Children(func() {
			ui.Text(c, title).FontSize(13).TextColor(t.TextPrimary)
			if summary != "" {
				ui.Text(c, summary).FontSize(12).TextColor(t.TextSecondary).SingleLine().Tooltip(summary)
			}
		})
		control()
	})
}

func preferenceLink(c *ui.Context, title, value, label string, disabled bool, onClick func()) {
	t := tokensOf(c)
	button := ui.ButtonBase(c).Label(label).Description(value).MinHeight(44).Padding(8, 4).Radius(6).
		BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).Justify(ui.Start).Disabled(disabled).OnClick(onClick)
	if button.Hovered() {
		button.Background(t.BgHover)
	}
	button.Children(func() {
		ui.Row(c).Grow(1).MinWidth(0).Gap(12).AlignItems(ui.Center).Children(func() {
			ui.Text(c, title).FontSize(13).Shrink(0).TextColor(t.TextPrimary)
			ui.Text(c, value).FontSize(12).TextColor(t.TextSecondary).SingleLine().MinWidth(0).Grow(1).TextAlign(ui.End).Tooltip(value)
			ui.Text(c, "›").TextColor(t.TextDecorative)
		})
	})
}

func preferenceChoice(c *ui.Context, label, value string, choices []string, disabled bool, choose func(string)) {
	holder := ui.Box(c.Key(label)).Shrink(0)
	open := ui.Local(holder, "open", func() bool { return false })
	holder.Children(func() {
		items := make([]overlay.MenuItem, 0, len(choices))
		for _, choice := range choices {
			items = append(items, overlay.MenuItem{Key: choice, Label: choice, Disabled: disabled})
		}
		selected := appDropdown(c, open, items, func(trigger ui.Element) {
			styleAppButton(c, trigger, value+" ⌄", "secondary").Height(30).Padding(0, 10).Label(label).Description(value).Disabled(disabled)
		})
		if selected != "" && !disabled {
			choose(selected)
		}
	})
}
