package app

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestSharedComponentsThemeAndKeyboard(t *testing.T) {
	for _, dark := range []bool{false, true} {
		t.Run(map[bool]string{false: "light", true: "dark"}[dark], func(t *testing.T) {
			clicked := 0
			var palette designTokens
			var native ui.Theme
			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				palette, native = tokensOf(c), *c.Theme()
				ui.Column(c).Children(func() {
					taskPropertyRow(c, "priority", "优先级", "普通", nil, false, func() { clicked++ })
					appButton(c, "不可用操作", "primary").Disabled(true).OnClick(func() { clicked += 100 })
					countBadge(c.Key("zero"), 0)
					countBadge(c.Key("three"), 3)
				})
			}, 480, 320)
			tt.SetDark(dark)
			if native.Dark != dark || native.Background != palette.BgApp || native.Accent != palette.Accent || native.Text != palette.TextPrimary || native.FontSize != 13 {
				t.Fatal("native controls do not follow semantic theme")
			}
			if tt.HasText("0") || !tt.HasText("3") {
				t.Fatal("count badge should hide zero and display real counts")
			}
			tt.Key(0, ui.KeyTab)
			if !tt.Focused("编辑优先级") {
				t.Fatal("property row lost native keyboard focus")
			}
			tt.Key(0, ui.KeyEnter)
			if clicked != 1 {
				t.Fatal("keyboard did not activate property row", clicked)
			}
			_ = tt.Click("不可用操作")
			if clicked != 1 {
				t.Fatal("disabled action was activated")
			}
		})
	}
}
