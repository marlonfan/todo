package app

import (
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
)

func detailSectionTitle(c *ui.Context, label string) {
	ui.Text(c, label).FontSize(fontProperty).FontWeight(600).TextColor(tokensOf(c).TextSecondary)
}

// detailCompleteCheckbox renders a refined rounded checkbox optically aligned
// with the first line of the 23px detail title, keeping visual proximity and
// native checkbox accessibility semantics (Space/Enter toggle).
func detailCompleteCheckbox(c *ui.Context, checked *bool, label, priority string, disabled bool, onChange func()) ui.Element {
	t := tokensOf(c)
	cb := ui.CheckboxBase(c.Key("detail-complete"), checked).
		Label(label).Size(26, 26).Margin(3, 0, 0, 0).Shrink(0).
		Center().Radius(6).Cursor(ui.CursorPointer).
		FocusRingColor(t.Accent).Disabled(disabled).
		OnChange(onChange)
	if cb.Hovered() && !disabled {
		cb.Background(t.BgHover)
	}
	cb.Children(func() {
		box := ui.Box(c).Size(18, 18).Radius(5).Center().AccessHidden(true)
		if *checked {
			fill := t.Accent
			if disabled {
				fill = t.TextTertiary.Alpha(0.55)
			}
			box.Background(fill).Children(func() {
				ui.Icon(c, lucide.Check()).Size(12, 12).TextColor(t.TextOnAccent).AccessHidden(true)
			})
		} else {
			borderCol := t.BorderDefault.Mix(t.TextTertiary, 0.35)
			if priority == "高" && !disabled {
				borderCol = t.Warning.Alpha(0.80)
			}
			if disabled {
				borderCol = t.BorderDefault.Alpha(0.65)
			} else if cb.Hovered() {
				borderCol = t.Accent
			}
			box.Border(1.5, borderCol).Background(ui.Transparent)
		}
	})
	return cb
}

// detailTransientStatus shows a whisper-quiet inline sync/save hint in the top
// toolbar only while an edit is in flight, queued locally, or failed. Clean
// synced tasks render nothing so vertical and visual space stay completely calm.
func detailTransientStatus(c *ui.Context, saveLabel string, failed bool) {
	if saveLabel == "" || saveLabel == "已同步" || saveLabel == "新任务 · 待创建" {
		return
	}
	t := tokensOf(c)
	dot := t.Accent
	fg := t.TextSecondary
	if failed || strings.Contains(saveLabel, "失败") {
		dot = t.Danger
		fg = t.Danger
	}
	ui.Row(c.Key("detail-transient-status")).Gap(5).Padding(0, 6).Height(24).Radius(5).AlignItems(ui.Center).Shrink(0).Children(func() {
		ui.Box(c).Size(5, 5).Radius(2.5).Background(dot).Shrink(0).AccessHidden(true)
		ui.Text(c, saveLabel).FontSize(fontAux).FontWeight(400).TextColor(fg).SingleLine()
	})
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
