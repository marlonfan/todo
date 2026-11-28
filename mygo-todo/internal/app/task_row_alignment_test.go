package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTaskRowTrailingHandleAndPointerPreview(t *testing.T) {
	now := time.Now()
	due := now.Add(2 * time.Hour)
	for _, dark := range []bool{false, true} {
		for _, page := range []string{"all", "completed", "category:2", "search"} {
			for _, readOnly := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/dark=%t/readonly=%t", page, dark, readOnly), func(t *testing.T) {
					a := New(storage.Store{Dir: t.TempDir()})
					defer a.Close()
					a.page = page
					task := api.Task{
						ID:         1,
						InstanceID: "instance",
						Title:      "任务布局",
						Status:     "pending",
						Priority:   1,
						ReadOnly:   readOnly,
						StartTime:  &due,
						Categories: []api.Category{{ID: 2, Name: "产品研发", Emoji: "🚀"}},
					}
					if page == "completed" {
						task.Status = "completed"
						task.CompletedAt = &now
					}
					var background ui.Color
					tt := ui.NewTester(func(c *ui.Context) {
						applyAppTheme(c)
						background = tokensOf(c).BgList
						ui.Column(c).Width(420).Children(func() { a.taskListItem(c, task, now) })
					}, 600, 260)
					tt.SetDark(dark)
					tt.Frame()
					row, _ := tt.Access("任务行 " + task.Title)
					check, _ := tt.Access("完成 " + task.Title)
					title, _ := tt.Access(task.Title)
					if check.Bounds.X-row.Bounds.X != 8 || title.Bounds.X-row.Bounds.X != 46 || check.Bounds.W != 32 || check.Bounds.H != 32 || title.Bounds.X-(check.Bounds.X+check.Bounds.W) != 6 {
						t.Fatal("padding/checkbox/title boundaries", row.Bounds, check.Bounds, title.Bounds)
					}
					titleText, foundTitle := tt.Find(task.Title)
					if !foundTitle || titleText.X != title.Bounds.X {
						t.Fatal("title text origin", titleText, title.Bounds)
					}
					if tt.HasText("高优先级") {
						t.Fatalf("high priority text should be conveyed by checkbox border, not verbose text: %v", tt.Texts())
					}
					timeText, _ := taskRowTimeLabel(task, now, a.location(), page == "completed")
					summary, ok := tt.Find(timeText)
					if !ok || summary.X != title.Bounds.X {
						t.Fatal("summary/title origins", summary, title.Bounds, tt.Texts())
					}
					handle, hasHandle := tt.Access("拖动归类 " + task.Title)
					if readOnly {
						if hasHandle {
							t.Fatal("readonly has drag source")
						}
						return
					}
					more, hasMore := tt.Access("更多操作 " + task.Title)
					if !hasHandle || !hasMore || handle.Bounds.W != 32 || handle.Bounds.H != 32 || more.Bounds.W < 32 || more.Bounds.H < 32 || handle.Bounds.X < title.Bounds.X+title.Bounds.W || handle.Bounds.X+handle.Bounds.W+6 != more.Bounds.X || more.Bounds.X+more.Bounds.W != row.Bounds.X+row.Bounds.W-8 {
						t.Fatal("trailing title/handle/menu boundaries", title.Bounds, handle.Bounds, more.Bounds)
					}
					tt.Move(handle.Bounds.X+16, handle.Bounds.Y+16)
					tt.Frame()
					hoverTitle, _ := tt.Access(task.Title)
					hoverCheck, _ := tt.Access("完成 " + task.Title)
					if hoverTitle.Bounds != title.Bounds || hoverCheck.Bounds != check.Bounds {
						t.Fatal("hover moved leading targets", hoverTitle.Bounds, hoverCheck.Bounds)
					}
					tt.Press(handle.Bounds.X+16, handle.Bounds.Y+16)
					tt.Move(220, 130)
					tt.Frame()
					preview, ok := tt.Access("拖动预览 " + task.Title)
					if !ok || preview.Bounds.W != 248 || preview.Bounds.H != 40 {
						t.Fatal("missing real preview", preview)
					}
					first := preview.Bounds
					tt.Move(260, 160)
					tt.Frame()
					preview, _ = tt.Access("拖动预览 " + task.Title)
					if preview.Bounds.X-first.X != 40 || preview.Bounds.Y-first.Y != 30 {
						t.Fatal("preview does not follow pointer", first, preview.Bounds)
					}
					pixel := tt.Image().RGBAAt(int(preview.Bounds.X+4), int(preview.Bounds.Y+20))
					if pixel.R != background.R || pixel.G != background.G || pixel.B != background.B || pixel.A != 255 {
						t.Fatal("preview plate is not opaque", pixel, background)
					}
					tt.Move(599, 259)
					tt.Frame()
					preview, _ = tt.Access("拖动预览 " + task.Title)
					if preview.Bounds.X < 0 || preview.Bounds.Y < 0 || preview.Bounds.X+preview.Bounds.W > 600 || preview.Bounds.Y+preview.Bounds.H > 260 {
						t.Fatal("preview clips at window edge", preview.Bounds)
					}
					tt.Key(0, ui.KeyEscape)
					tt.Frame()
					if _, ok := tt.Access("拖动预览 " + task.Title); ok {
						t.Fatal("escape leaves preview")
					}
					if len(a.cache.Outbox) != 0 {
						t.Fatal("canceled drag wrote mutation")
					}
				})
			}
		}
	}
}

func TestTaskRowPriorityCheckboxGapAndNoCategoryTruncation(t *testing.T) {
	now := time.Now()
	past := dayStart(now).AddDate(0, 0, -2).Add(9 * time.Hour)
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.page = "all"
	tasks := []api.Task{
		{
			ID:             1,
			InstanceID:     "1_20261118",
			Title:          "高优逾期重复任务",
			Status:         "pending",
			Priority:       1,
			StartTime:      &past,
			RecurrenceRule: []byte(`{"freq":"daily"}`),
			Categories:     []api.Category{{ID: 1, Name: "产品研发", Emoji: "🚀"}},
		},
		{
			ID:        2,
			Title:     "普通任务左对齐基准",
			Status:    "pending",
			Priority:  0,
			StartTime: &now,
		},
	}
	a.editing, a.draft.Task.ID = true, 1
	var warnCol ui.Color
	tt := ui.NewTester(func(c *ui.Context) {
		applyAppTheme(c)
		warnCol = tokensOf(c).Warning
		ui.Column(c).Width(taskListDefaultWidth - 12).Gap(3).Children(func() {
			for _, task := range tasks {
				tItem := task
				ui.Box(c.Key(tItem.ID)).FillWidth().Children(func() {
					a.taskListItem(c, tItem, now)
				})
			}
		})
	}, 420, 200)
	tt.Frame()

	// 1. Strict left alignment of titles across priority levels
	t1, ok1 := tt.Find("高优逾期重复任务")
	t2, ok2 := tt.Find("普通任务左对齐基准")
	if !ok1 || !ok2 || t1.X != t2.X {
		t.Fatalf("titles misaligned across priorities: t1=%+v t2=%+v", t1, t2)
	}
	// 2. Clean vertical gap between adjacent rows (no border clash)
	r1, _ := tt.Access("任务行 高优逾期重复任务")
	r2, _ := tt.Access("任务行 普通任务左对齐基准")
	if r2.Bounds.Y <= r1.Bounds.Y+r1.Bounds.H {
		t.Fatalf("expected clean vertical gap between rows, got r1=%+v r2=%+v", r1.Bounds, r2.Bounds)
	}
	// 3. Verbose "高优先级" text removed; full category name renders cleanly without "🚀..." truncation
	if tt.HasText("高优先级") {
		t.Fatalf("unexpected verbose 高优先级 text in row: %v", tt.Texts())
	}
	if !tt.HasText("🚀 产品研发") {
		t.Fatalf("category label missing or truncated at default list width: %v", tt.Texts())
	}
	// 4. High priority checkbox draws warning border pixels
	chk, _ := tt.Access("完成 高优逾期重复任务")
	img := tt.Image()
	warnPixels := 0
	for y := int(chk.Bounds.Y); y < int(chk.Bounds.Y+chk.Bounds.H); y++ {
		for x := int(chk.Bounds.X); x < int(chk.Bounds.X+chk.Bounds.W); x++ {
			p := img.RGBAAt(x, y)
			if p.R == warnCol.R && p.G == warnCol.G && p.B == warnCol.B && p.A == 255 {
				warnPixels++
			}
		}
	}
	if warnPixels == 0 {
		t.Fatal("high-priority checkbox did not render warning highlight border")
	}
}

func TestTaskRowLongTitleWrapsCleanlyLikeTickTick(t *testing.T) {
	now := time.Now()
	due := now.Add(2 * time.Hour)
	longCN := "梳理并落地原生桌面端长任务标题多行展示方案确保列表内可直接阅读后续关键内容"
	longMixed := "Implement TickTick-style multi-line task title wrapping with top-aligned checkbox and clean metadata layout"

	for _, tc := range []struct {
		name    string
		title   string
		hasMeta bool
		dark    bool
	}{
		{"cn-with-meta-light", longCN, true, false},
		{"cn-no-meta-dark", longCN, false, true},
		{"mixed-with-meta-light", longMixed, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			a.page = "all"
			longTask := api.Task{
				ID:       1,
				Title:    tc.title,
				Status:   "pending",
				Priority: 1,
			}
			if tc.hasMeta {
				longTask.StartTime = &due
				longTask.Categories = []api.Category{{ID: 1, Name: "产品研发", Emoji: "🚀"}}
			}
			shortTask := api.Task{
				ID:     2,
				Title:  "紧随其后的短任务",
				Status: "pending",
			}

			tt := ui.NewTester(func(c *ui.Context) {
				applyAppTheme(c)
				ui.Column(c).Width(taskListDefaultWidth - 12).Gap(3).Children(func() {
					ui.Box(c.Key(longTask.ID)).FillWidth().Children(func() {
						a.taskListItem(c, longTask, now)
					})
					ui.Box(c.Key(shortTask.ID)).FillWidth().Children(func() {
						a.taskListItem(c, shortTask, now)
					})
				})
			}, 420, 260)
			tt.SetDark(tc.dark)
			tt.Frame()
			tt.Frame()

			row, ok := tt.Access("任务行 " + longTask.Title)
			if !ok {
				t.Fatal("missing wrapped long task row")
			}
			shortRow, ok := tt.Access("任务行 " + shortTask.Title)
			if !ok {
				t.Fatal("missing following short task row")
			}

			baseMinH := float32(taskSingleRowHeight)
			if tc.hasMeta {
				baseMinH = taskMetaRowHeight
			}
			if row.Bounds.H <= baseMinH {
				t.Fatalf("expected long title row to expand beyond single-line height %.0f, got %.1f", baseMinH, row.Bounds.H)
			}
			if row.Bounds.H > baseMinH+taskRowTitleLineHeight+4 {
				t.Fatalf("expected wrapped row height to stay bounded to 2 lines, got %.1f", row.Bounds.H)
			}
			if shortRow.Bounds.Y <= row.Bounds.Y+row.Bounds.H {
				t.Fatalf("wrapped row overlapped following row: long=%+v short=%+v", row.Bounds, shortRow.Bounds)
			}

			check, ok := tt.Access("完成 " + longTask.Title)
			handle, hasHandle := tt.Access("拖动归类 " + longTask.Title)
			more, hasMore := tt.Access("更多操作 " + longTask.Title)
			if !ok || !hasHandle || !hasMore {
				t.Fatalf("missing row controls: check=%v handle=%v more=%v", ok, hasHandle, hasMore)
			}
			if check.Bounds.Y != row.Bounds.Y+6 || handle.Bounds.Y != row.Bounds.Y+6 || more.Bounds.Y != row.Bounds.Y+6 {
				t.Fatalf("controls must top-align with first line of wrapped title: rowY=%.1f check=%+v handle=%+v more=%+v",
					row.Bounds.Y, check.Bounds, handle.Bounds, more.Bounds)
			}

			if tc.hasMeta {
				timeText, _ := taskRowTimeLabel(longTask, now, a.location(), false)
				summary, ok := tt.Find(timeText)
				if !ok {
					t.Fatalf("missing metadata summary %q in %v", timeText, tt.Texts())
				}
				if summary.Y < row.Bounds.Y+6+6+2*taskRowTitleLineHeight {
					t.Fatalf("metadata overlaps wrapped 2-line title: row=%+v summary=%+v", row.Bounds, summary)
				}
				if summary.Y+summary.H > row.Bounds.Y+row.Bounds.H {
					t.Fatalf("metadata clipped outside wrapped row: row=%+v summary=%+v", row.Bounds, summary)
				}
			}
		})
	}
}
