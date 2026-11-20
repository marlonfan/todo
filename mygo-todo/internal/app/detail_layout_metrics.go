package app

import (
	"strings"

	"github.com/egoist/mygo/ui"
)

const (
	taskListMinWidth      = 240
	detailMinWidth        = 360
	detailMaxWidth        = 1600
	detailTitleFontSize   = 23
	detailTitleLineHeight = 32
)

// Allow flexible user-driven split resizing: the task list can shrink down to
// 240px and the task detail can expand all the way across wide screens, while
// clamping safely inside smaller windows without overwriting the stored preference.
func fittedDetailListWidth(workspace, preferred float32) float32 {
	if preferred <= 0 {
		preferred = taskListDefaultWidth
	}
	detail := min(float32(detailMaxWidth), max(float32(detailMinWidth), workspace-preferred-1))
	return max(float32(taskListMinWidth), workspace-detail-1)
}

// Direct 1-click inline heading editor: eliminates the awkward 2-click
// read->edit swap, keeps exact heading typography at all times, and treats
// Enter (without Shift) as commit rather than inserting newlines in titles.
func detailTitle(c *ui.Context, key, label, placeholder string, value *string, autoFocus, disabled bool, ref *ui.Handle, onChange, onCommit func(), onEscape ...func()) {
	t := tokensOf(c)
	ui.Column(c.Key(key + "-slot")).Grow(1).MinWidth(0).Children(func() {
		if disabled {
			ui.Text(c.Key(key+"-readonly"), *value).Label(label).
				FontSize(detailTitleFontSize).FontWeight(600).FixedLineHeight(detailTitleLineHeight).
				TextColor(t.TextPrimary).FillWidth().MinWidth(0).MaxLines(5)
			return
		}
		escHandler := func() {
			if onCommit != nil {
				onCommit()
			}
		}
		if len(onEscape) > 0 && onEscape[0] != nil {
			escHandler = onEscape[0]
		}
		input := ui.TextAreaBase(c.Key(key), value).Label(label).Placeholder(placeholder).
			FontSize(detailTitleFontSize).FontWeight(600).FixedLineHeight(detailTitleLineHeight).
			TextColor(t.TextPrimary).PlaceholderColor(t.TextTertiary).
			Lines(1, 5).FillWidth().MinWidth(0).Padding(0).BorderWidth(0).
			FocusRing(false).Background(ui.Transparent).
			OnTextKey(func(k ui.TextKey) bool {
				if k.Key == ui.KeyEnter && k.Mods&ui.Shift == 0 {
					if onCommit != nil {
						onCommit()
					}
					return true
				}
				return false
			}).
			OnShortcut(0, ui.KeyEscape, escHandler)
		if ref != nil {
			input.Ref(ref)
		}
		if autoFocus {
			input.AutoFocus()
		}
		if input.Changed() {
			if strings.Contains(*value, "\n") {
				*value = strings.ReplaceAll(*value, "\n", " ")
			}
			if onChange != nil {
				onChange()
			}
		}
	})
}
