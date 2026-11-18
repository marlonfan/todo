package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
)

func detailSectionTitle(c *ui.Context, label string) {
	ui.Text(c, label).FontSize(fontProperty).FontWeight(600).TextColor(tokensOf(c).TextSecondary)
}

// A native button keeps disclosure reachable through Tab, Enter and Space.
// The caller owns scope and state; collapsing never changes the task draft.
func detailFold(c *ui.Context, key, label string, open *bool, content func()) {
	ui.Column(c.Key(key)).Gap(8).MinWidth(0).Children(func() {
		trigger := styleAppButton(c, ui.ButtonBase(c).Label(label), "", "ghost").MinHeight(32).AlignSelf(ui.Start).Padding(4, 0).OnClick(func() { *open = !*open })
		state := "已折叠"
		icon := lucide.ChevronRight()
		if *open {
			state = "已展开"
			icon = lucide.ChevronDown()
		}
		trigger.Description(state).Children(func() {
			ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
				ui.Icon(c, icon).Size(14, 14).TextColor(tokensOf(c).TextSecondary).AccessHidden(true)
				ui.Text(c, label).FontSize(fontProperty).FontWeight(600).TextColor(tokensOf(c).TextSecondary)
			})
		})
		if *open {
			content()
		}
	})
}
