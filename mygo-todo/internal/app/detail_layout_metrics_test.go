package app

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
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

func TestComputeDetailTopChrome(t *testing.T) {
	tests := []struct {
		name       string
		bar        ui.TitleBar
		compact    bool
		wantNav    bool
		wantHeight float32
		minLeft    float32
		minRight   float32
	}{
		{
			name:       "macOS wide uses slim drag band without blank toolbar",
			bar:        ui.TitleBar{Height: 40, Left: 78, Right: 0},
			compact:    false,
			wantNav:    false,
			wantHeight: detailDragStripHeight,
			minLeft:    detailBodySidePadding,
			minRight:   detailBodySidePadding,
		},
		{
			name:       "fullscreen wide uses slim drag band",
			bar:        ui.TitleBar{},
			compact:    false,
			wantNav:    false,
			wantHeight: detailDragStripHeight,
			minLeft:    detailBodySidePadding,
			minRight:   detailBodySidePadding,
		},
		{
			name:       "Windows wide clears right system caption buttons",
			bar:        ui.TitleBar{Height: 40, Left: 0, Right: 138},
			compact:    false,
			wantNav:    true,
			wantHeight: 40,
			minLeft:    detailBodySidePadding,
			minRight:   152,
		},
		{
			name:       "macOS compact clears left traffic lights",
			bar:        ui.TitleBar{Height: 38, Left: 78, Right: 0},
			compact:    true,
			wantNav:    true,
			wantHeight: 38,
			minLeft:    86,
			minRight:   14,
		},
		{
			name:       "Windows compact clears right caption buttons",
			bar:        ui.TitleBar{Height: 40, Left: 0, Right: 138},
			compact:    true,
			wantNav:    true,
			wantHeight: 40,
			minLeft:    14,
			minRight:   152,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := computeDetailTopChrome(tc.bar, tc.compact)
			if got.ShowNavBar != tc.wantNav || got.Height != tc.wantHeight || got.PadLeft < tc.minLeft || got.PadRight < tc.minRight {
				t.Fatalf("computeDetailTopChrome(%+v, %v) = %+v, want nav=%v h=%.0f left>=%.0f right>=%.0f",
					tc.bar, tc.compact, got, tc.wantNav, tc.wantHeight, tc.minLeft, tc.minRight)
			}
		})
	}
}

func TestDetailHeaderNoBlankToolbarAndCrossPlatformTitleBar(t *testing.T) {
	setupTaskApp := func(t *testing.T) *App {
		t.Helper()
		a := New(storage.Store{Dir: t.TempDir()})
		t.Cleanup(a.Close)
		a.client, _ = api.New(api.DefaultServer, "")
		a.session.User = api.User{ID: 1, Username: "跨平台验证", Timezone: "Asia/Shanghai"}
		task := api.Task{ID: 10, Title: "重构 MyGo 原生客户端 UI 与所见即所得编辑器", Description: "## 正文\n\n干净无空白顶栏", Status: "pending"}
		a.adoptCache(storage.Cache{Tasks: []api.Task{task}})
		a.editTaskNow(task)
		return a
	}

	t.Run("macOS wide eliminates 40px blank toolbar and divider line", func(t *testing.T) {
		a := setupTaskApp(t)
		var bgApp ui.Color
		tt := ui.NewTester(func(c *ui.Context) {
			applyAppTheme(c)
			bgApp = tokensOf(c).BgApp
			a.view(c)
		}, 1280, 900)
		tt.SetTitleBar(ui.TitleBar{Height: 40, Left: 78, Right: 0})
		tt.Frame()

		pane, ok := tt.Access("任务详情内容")
		if !ok || pane.Bounds.Y != detailDragStripHeight {
			t.Fatalf("expected slim %dpx top drag strip on macOS wide, got pane=%+v", detailDragStripHeight, pane.Bounds)
		}
		title, ok := tt.AccessByRole(ui.RoleTextField, "任务标题")
		if !ok || title.Bounds.Y != detailDragStripHeight+detailBodyTopPadding {
			t.Fatalf("title should sit immediately below slim drag strip: title=%+v", title.Bounds)
		}
		for _, label := range []string{"提醒与活动记录", "更多任务选项", "关闭"} {
			btn, ok := tt.Access(label)
			if !ok {
				t.Fatalf("missing inline heading action %q", label)
			}
			if btn.Bounds.Y < title.Bounds.Y-2 || btn.Bounds.Y > title.Bounds.Y+6 {
				t.Fatalf("action %q must align optically with title first line: btn=%+v title=%+v", label, btn.Bounds, title.Bounds)
			}
		}

		// Verify the top drag strip is pure canvas without any horizontal 1px border line.
		img := tt.Image()
		sampleXStart := int(pane.Bounds.X) + 8
		sampleXEnd := int(pane.Bounds.X+pane.Bounds.W) - 8
		for y := 0; y < int(pane.Bounds.Y)+2; y++ {
			for x := sampleXStart; x < sampleXEnd; x += 4 {
				p := img.RGBAAt(x, y)
				if p.R != bgApp.R || p.G != bgApp.G || p.B != bgApp.B {
					t.Fatalf("unexpected non-canvas pixel at (%d,%d) in top drag strip: got=%v want=%v", x, y, p, bgApp)
				}
			}
		}
	})

	t.Run("Windows wide clears right system caption buttons without divider", func(t *testing.T) {
		a := setupTaskApp(t)
		winBar := ui.TitleBar{Height: 40, Left: 0, Right: 138}
		var bgApp ui.Color
		tt := ui.NewTester(func(c *ui.Context) {
			applyAppTheme(c)
			bgApp = tokensOf(c).BgApp
			a.view(c)
		}, 1280, 900)
		tt.SetTitleBar(winBar)
		tt.Frame()

		pane, ok := tt.Access("任务详情内容")
		if !ok || pane.Bounds.Y < winBar.Height {
			t.Fatalf("Windows detail pane must start below caption bar (%.0f), got %+v", winBar.Height, pane.Bounds)
		}
		for _, label := range []string{"提醒与活动记录", "更多任务选项", "关闭"} {
			btn, ok := tt.Access(label)
			if !ok {
				t.Fatalf("missing action %q", label)
			}
			if btn.Bounds.Y < winBar.Height {
				t.Fatalf("Windows detail action %q overlaps top-right system buttons: btn=%+v bar=%+v", label, btn.Bounds, winBar)
			}
		}

		// Verify the Windows clearance band blends into the canvas with no 1px divider line.
		img := tt.Image()
		sampleXStart := int(pane.Bounds.X) + 8
		sampleXEnd := int(pane.Bounds.X+pane.Bounds.W) - 8
		for y := int(winBar.Height) - 2; y <= int(winBar.Height)+1; y++ {
			for x := sampleXStart; x < sampleXEnd; x += 4 {
				p := img.RGBAAt(x, y)
				if p.R != bgApp.R || p.G != bgApp.G || p.B != bgApp.B {
					t.Fatalf("unexpected divider/artifact pixel at (%d,%d) in Windows top clearance band: got=%v want=%v", x, y, p, bgApp)
				}
			}
		}

		// Dirty state transient status must also stay clear of Windows caption buttons.
		a.draft.Description += "\n变更"
		tt.Frame()
		statusRect, ok := tt.Find("待保存…")
		if !ok {
			t.Fatal("missing transient autosave status")
		}
		if statusRect.X+statusRect.W > 1280-winBar.Right {
			t.Fatalf("transient status overlaps Windows caption buttons: rect=%+v limit=%.0f", statusRect, 1280-winBar.Right)
		}
	})

	t.Run("macOS and Windows compact narrow mode clear system controls", func(t *testing.T) {
		for _, tc := range []struct {
			name string
			bar  ui.TitleBar
		}{
			{"macOS-compact", ui.TitleBar{Height: 40, Left: 78, Right: 0}},
			{"Windows-compact", ui.TitleBar{Height: 40, Left: 0, Right: 138}},
		} {
			t.Run(tc.name, func(t *testing.T) {
				a := setupTaskApp(t)
				a.taskDetailOpen = true
				tt := ui.NewTester(a.view, 900, 800)
				tt.SetTitleBar(tc.bar)
				tt.Frame()

				back, ok := tt.AccessByRole(ui.RoleButton, "‹ 返回任务列表")
				if !ok {
					t.Fatal("missing compact back button")
				}
				if tc.bar.Left > 0 && back.Bounds.X < tc.bar.Left {
					t.Fatalf("compact back button overlaps macOS traffic lights: back=%+v bar=%+v", back.Bounds, tc.bar)
				}
				closeBtn, ok := tt.AccessByRole(ui.RoleButton, "关闭")
				if !ok {
					t.Fatal("missing close button")
				}
				if tc.bar.Right > 0 && closeBtn.Bounds.Y < tc.bar.Height {
					t.Fatalf("compact close button overlaps Windows caption buttons: close=%+v bar=%+v", closeBtn.Bounds, tc.bar)
				}
			})
		}
	})

	t.Run("Calendar side drawer clears Windows caption buttons", func(t *testing.T) {
		a := detailEntryApp(t, "calendar")
		day := time.Date(2026, 11, 20, 9, 0, 0, 0, time.UTC)
		a.selectedDay, a.calendarMode = day, 1
		task := api.Task{ID: 42, Title: "日历抽屉任务", Status: "pending", StartTime: &day}
		a.tasks, a.cache.Tasks = []api.Task{task}, []api.Task{task}
		a.editTaskNow(task)

		winBar := ui.TitleBar{Height: 40, Left: 0, Right: 138}
		tt := ui.NewTester(a.view, 1280, 900)
		tt.SetTitleBar(winBar)
		tt.Frame()

		closeBtn, ok := tt.AccessByRole(ui.RoleButton, "关闭")
		if !ok || closeBtn.Bounds.Y < winBar.Height {
			t.Fatalf("calendar drawer close button must clear Windows caption buttons: btn=%+v bar=%+v", closeBtn.Bounds, winBar)
		}
	})

	t.Run("Occurrence detail follows identical cross-platform top chrome", func(t *testing.T) {
		for _, tc := range []struct {
			name     string
			bar      ui.TitleBar
			wantMinY float32
			wantMaxY float32
		}{
			{"macOS-wide", ui.TitleBar{Height: 40, Left: 78, Right: 0}, detailDragStripHeight, detailDragStripHeight},
			{"Windows-wide", ui.TitleBar{Height: 40, Left: 0, Right: 138}, 40, 40},
		} {
			t.Run(tc.name, func(t *testing.T) {
				a := New(storage.Store{Dir: t.TempDir()})
				defer a.Close()
				a.client, _ = api.New(api.DefaultServer, "")
				a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
				start := time.Date(2026, 11, 20, 9, 0, 0, 0, a.location())
				series := api.Task{ID: 7, Title: "每日晨会", Status: "pending", StartTime: &start, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
				a.adoptCache(storage.Cache{Tasks: []api.Task{series}})
				occ := series
				occ.InstanceID, occ.OccurrenceDate = "7_20261120", "2026-11-20"
				a.openTask(occ)

				tt := ui.NewTester(a.view, 1280, 900)
				tt.SetTitleBar(tc.bar)
				tt.Frame()

				content, ok := tt.Access("本次任务详情内容")
				if !ok || content.Bounds.Y < tc.wantMinY || content.Bounds.Y > tc.wantMaxY {
					t.Fatalf("occurrence content Y out of expected range [%.0f, %.0f]: %+v", tc.wantMinY, tc.wantMaxY, content.Bounds)
				}
				closeBtn, ok := tt.AccessByRole(ui.RoleButton, "关闭")
				if !ok {
					t.Fatal("missing occurrence close button")
				}
				if tc.bar.Right > 0 && closeBtn.Bounds.Y < tc.bar.Height {
					t.Fatalf("occurrence close button overlaps Windows caption buttons: %+v", closeBtn.Bounds)
				}
			})
		}
	})
}
