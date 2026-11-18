package app

import (
	"fmt"
	"image/color"
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/field"
)

func TestSemanticControlsPaintNativeSurfacesAndPreserveInput(t *testing.T) {
	for _, dark := range []bool{false, true} {
		t.Run(fmt.Sprintf("dark-%v", dark), func(t *testing.T) {
			selected, changes, query, submitted := 0, 0, "", ""
			disabled := false
			var palette designTokens
			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				palette = tokensOf(c)
				ui.Column(c).Padding(20).Gap(20).Children(func() {
					if appSegmented(c, &selected, []string{"提示词", "问答历史"}, action.SegmentedProps{}).Width(320).Label("工作区").Disabled(disabled).Changed() {
						changes++
					}
					appSearchBar(c, &query, field.SearchBarProps{Placeholder: "搜索内容", OnSearch: func(value string) { submitted = value }}).Width(260).Label("内容搜索")
				})
			}, 640, 300)
			tt.SetDark(dark)
			tt.Frame()
			group, ok := tt.AccessByRole(ui.RoleRadioGroup, "工作区")
			if !ok {
				t.Fatal("segmented lost native radio-group semantics")
			}
			input, ok := tt.AccessByRole(ui.RoleTextField, "内容搜索")
			if !ok {
				t.Fatal("search lost native text-field semantics")
			}
			assertPixel := func(x, y float32, want ui.Color) {
				t.Helper()
				got := color.NRGBAModel.Convert(tt.Image().At(int(x), int(y))).(color.NRGBA)
				if got.R != want.R || got.G != want.G || got.B != want.B || got.A != want.A {
					t.Fatalf("surface at %.1f,%.1f = %+v; want %+v", x, y, got, want)
				}
			}
			// Sample empty track and field interiors: catches Lobe's hard-coded
			// black / near-black backgrounds rather than only checking tokens.
			assertPixel(group.Bounds.X+group.Bounds.W-12, group.Bounds.Y+12, palette.BgSubtle)
			assertPixel(input.Bounds.X+input.Bounds.W-5, input.Bounds.Y+input.Bounds.H/2, palette.BgSubtle)
			segment, ok := tt.AccessByRole(ui.RoleRadio, "提示词")
			if !ok {
				t.Fatal("missing native option")
			}
			assertPixel(segment.Bounds.X+4, segment.Bounds.Y+segment.Bounds.H/2, palette.BgSelected)
			if err := tt.Click("问答历史"); err != nil {
				t.Fatal(err)
			}
			if selected != 1 || changes == 0 {
				t.Fatalf("click/Changed lost: selected=%d changes=%d", selected, changes)
			}
			tt.Key(0, ui.KeyLeft)
			if selected != 0 {
				t.Fatal("native radio arrow navigation lost")
			}
			disabled = true
			tt.Frame()
			_ = tt.Click("问答历史")
			if selected != 0 {
				t.Fatal("disabled segmented changed selection")
			}
			if err := tt.Click("内容搜索"); err != nil {
				t.Fatal(err)
			}
			tt.Type("中文 English 123")
			tt.Key(0, ui.KeyEnter)
			if query != "中文 English 123" || submitted != query {
				t.Fatalf("native editing/submission lost: query=%q submitted=%q", query, submitted)
			}
			if err := tt.Click("清除"); err != nil {
				t.Fatal(err)
			}
			if query != "" || !tt.Focused("内容搜索") {
				t.Fatal("clear must empty query and restore native input focus")
			}
		})
	}
}
