package app

import (
	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/field"
)

// Lobe sets its own placeholder color independently of applyAppTheme. Override
// it on the native editor, preserving Ref, Changed, IME and shortcut behavior.
func appFieldInput(c *ui.Context, value *string, p field.InputProps) ui.Element {
	return field.Input(c, value, p).PlaceholderColor(tokensOf(c).TextReadable).TextColor(tokensOf(c).TextPrimary)
}

func appTextArea(c *ui.Context, value *string, p field.TextAreaProps) ui.Element {
	return field.TextArea(c, value, p).PlaceholderColor(tokensOf(c).TextReadable).TextColor(tokensOf(c).TextPrimary)
}
