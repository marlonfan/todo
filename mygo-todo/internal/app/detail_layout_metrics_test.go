package app

import (
	"fmt"
	"math"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
)

func nearDetail(t *testing.T, label string, got, want float32) {
	t.Helper()
	if math.Abs(float64(got-want)) > 1 {
		t.Fatalf("%s: got %.2f, want %.2f", label, got, want)
	}
}

func TestDetailTitleReadingEditingBounds(t *testing.T) {
	for _, width := range []int{380, 480, 984} {
		for _, text := range []string{"短标题", "Mixed 中英 Task 42", "第一行 Second line 第三行", strings.Repeat("中英 mixed 标题 ", 12)} {
			t.Run(fmt.Sprintf("%d/%s", width, text[:min(len(text), 20)]), func(t *testing.T) {
				value := text
				committed := 0
				var ref ui.Handle
				var descRef ui.Handle
				tt := ui.NewTester(func(c *ui.Context) {
					applyAppTheme(c)
					ui.Column(c).Width(float32(width)).Gap(16).Padding(20).Children(func() {
						ui.Row(c).MinWidth(0).Children(func() {
							detailTitle(c, "title", "任务标题", "任务标题", &value, false, false, &ref,
								nil, func() { committed++; descRef.Focus() })
						})
						ui.Button(c, "描述位置").Ref(&descRef)
					})
				}, width, 700)
				tt.Frame()
				initial, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
				if !ok {
					t.Fatal("missing direct 1-click title editor")
				}
				nearDetail(t, "title full row width", initial.Bounds.W, float32(width-40))
				marker, _ := tt.Find("描述位置")
				for cycle := 0; cycle < 3; cycle++ {
					if err := tt.Click("任务标题"); err != nil {
						t.Fatal(err)
					}
					editor, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
					if !ok {
						t.Fatal("missing native title editor")
					}
					nearDetail(t, "title x", editor.Bounds.X, initial.Bounds.X)
					nearDetail(t, "title y", editor.Bounds.Y, initial.Bounds.Y)
					nearDetail(t, "title width", editor.Bounds.W, initial.Bounds.W)
					nearDetail(t, "title height", editor.Bounds.H, initial.Bounds.H)
					after, _ := tt.Find("描述位置")
					nearDetail(t, "description must not move", after.Y, marker.Y)
					if !tt.Focused("任务标题") {
						t.Fatal("native Ref did not receive focus")
					}
					tt.Key(0, ui.KeyEnter)
					tt.Frame()
					if strings.Contains(value, "\n") || value != text || committed != cycle+1 {
						t.Fatalf("Enter must commit without inserting newline: value=%q committed=%d", value, committed)
					}
				}
			})
		}
	}
}

func TestDetailTitleNativeInputAndComposition(t *testing.T) {
	value, editing := "原始标题", true
	composing := false
	var ref ui.Handle
	tt := ui.NewTester(func(c *ui.Context) {
		ui.Row(c).Width(380).Children(func() {
			detailTitle(c, "title", "任务标题", "任务标题", &value, editing, false, &ref,
				func() { editing = true }, func() { editing = false })
		})
		composing = c.Resolve(ref).Composing()
	}, 420, 700)
	tt.Frame()
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Compose("输入法组合", 5)
	if !composing || strings.Contains(value, "输入法组合") {
		t.Fatal("native composition must remain separate from committed draft text", value, composing)
	}
	maximum := strings.Repeat("中英Aa", 50)
	tt.Type(maximum)
	if value != maximum || len([]rune(value)) != 200 {
		t.Fatal("native committed input lost title text")
	}
	editor, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
	if !ok || editor.Bounds.W < 379 || editor.Bounds.H > 5*detailTitleLineHeight+1 {
		t.Fatal("long native title must retain width and a five-line scroll cap", editor.Bounds)
	}
	tt.Key(0, ui.KeyEnd)
	tt.Key(0, ui.KeyBackspace)
	tt.Type("验")
	if !strings.HasSuffix(value, "验") || len([]rune(value)) != 200 {
		t.Fatal("cannot edit the final character")
	}
}

func TestDetailWorkspaceWidthBounds(t *testing.T) {
	for _, workspace := range []float32{927, 1031, 1191, 1671, 2311} {
		for _, preference := range []float32{0, 240, 320, 420, 620, 1200, 2400} {
			list := fittedDetailListWidth(workspace, preference)
			detail := workspace - list - 1
			if list < taskListMinWidth || detail < detailMinWidth || detail > detailMaxWidth {
				t.Fatalf("workspace %.0f preference %.0f: list %.0f detail %.0f", workspace, preference, list, detail)
			}
			nearDetail(t, "split clamp must be stable", fittedDetailListWidth(workspace, list), list)
		}
	}
}
