package app

import (
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
)

func detailSectionTitle(c *ui.Context, label string) {
	ui.Text(c, label).FontSize(fontProperty).FontWeight(600).TextColor(tokensOf(c).TextSecondary)
}

func animatedCheckmarkBox(c *ui.Context, box ui.Element, checked, wasChecked bool, fg ui.Color, strokeWidth float32) {
	type checkAnimState struct {
		prev    bool
		run     uint64
		animate bool
	}
	st := ui.Local(box, "check-anim", func() checkAnimState {
		return checkAnimState{prev: checked}
	})
	if checked != st.prev {
		st.prev = checked
		if checked {
			st.run++
			st.animate = true
		} else {
			st.animate = false
		}
	}
	if !checked {
		return
	}
	scale := box.Keyframes("check-bounce", []ui.Keyframe{
		{Value: 1.0},
		{At: 60 * time.Millisecond, Value: 0.84, Ease: ui.EaseOut},
		{At: 170 * time.Millisecond, Value: 1.14, Ease: ui.EaseOut},
		{At: 260 * time.Millisecond, Value: 1.0, Ease: ui.EaseInOut},
	}, ui.KeyframeOptions{Run: st.run})
	if st.run > 0 && scale != 1 {
		box.Scale(scale, scale)
	}
	progress := float32(1)
	if st.animate && !c.Preferences().ReduceMotion {
		progress = box.AnimateTo("check-draw", 1, ui.Animation{Duration: 200 * time.Millisecond, Ease: ui.EaseOut})
	} else {
		progress = box.Jump("check-draw", 1)
	}
	box.Draw(func(p *ui.Painter, r ui.Rect) {
		if progress <= 0.01 {
			return
		}
		path := (&ui.Path{}).
			MoveTo(r.X+r.W*0.24, r.Y+r.H*0.52).
			LineTo(r.X+r.W*0.43, r.Y+r.H*0.71).
			LineTo(r.X+r.W*0.76, r.Y+r.H*0.31)
		if progress < 0.999 {
			path.Trim(0, progress)
		}
		p.StrokePath(path, strokeWidth, fg)
	})
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
		Transition(motionColorsFast()).
		OnChange(onChange)
	if cb.Hovered() && !disabled {
		cb.Background(t.BgHover)
	}
	cb.Children(func() {
		box := ui.Box(c.Key("detail-check-box")).Size(18, 18).Radius(5).Center().AccessHidden(true).
			Transition(motionColorsFast())
		if *checked {
			fill := t.Accent
			if disabled {
				fill = t.TextTertiary.Alpha(0.55)
			}
			box.Background(fill)
			animatedCheckmarkBox(c, box, true, true, t.TextOnAccent, 1.8)
		} else {
			animatedCheckmarkBox(c, box, false, false, t.TextOnAccent, 1.8)
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

// detailTopStrip renders a borderless, canvas-blended top window-drag strip.
// On wide macOS/fullscreen panes (bar.Right == 0 and !compact) it stays a slim
// 16px breathing/drag band so the title sits immediately at the top without a
// 40px blank toolbar or divider line. When bar.Right > 0 (Windows/Linux caption
// buttons) or compact mode is active, it clears the system window controls.
func detailTopStrip(c *ui.Context, key, label string, m detailTopChromeMetrics, leftContent, rightContent func()) {
	row := ui.Row(c.Key(key)).Height(m.Height).Shrink(0).FillWidth().
		Padding(0, m.PadRight, 0, m.PadLeft).Gap(6).AlignItems(ui.Center).DragWindow()
	if label != "" {
		row.Label(label)
	}
	row.Children(func() {
		if leftContent != nil {
			leftContent()
		}
		ui.Spacer(c)
		if rightContent != nil {
			rightContent()
		}
	})
}

// detailTransientStatus shows a whisper-quiet inline sync/save hint in the top
// drag strip only while an edit is in flight, queued locally, or failed. Clean
// synced tasks render nothing so vertical and visual space stay completely calm
// and title wrapping never shifts while typing.
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
	ui.Row(c.Key("detail-transient-status")).Gap(5).Padding(0, 4).Height(16).AlignItems(ui.Center).Shrink(0).Clip().Children(func() {
		ui.Box(c).Size(5, 5).Radius(2.5).Background(dot).Shrink(0).AccessHidden(true)
		ui.Text(c.Key(saveLabel), saveLabel).FontSize(10.5).FontWeight(400).TextColor(fg).SingleLine().Transition(motionTextSwap())
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
