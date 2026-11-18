package app

import (
	"encoding/json"
	"image/png"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestHistoryFiltersAccountDaysAndMissingTimestamps(t *testing.T) {
	loc, _ := time.LoadLocation("America/New_York")
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, loc) // 25-hour local day
	start := localDay(now, loc)
	end := start.AddDate(0, 0, 1)
	previous, last := start.Add(-time.Nanosecond), end.Add(-time.Nanosecond)
	old := start.AddDate(0, -1, 0)
	tasks := []api.Task{
		{ID: 1, Status: "completed", CompletedAt: &start, StartTime: &old, Priority: 1, Categories: []api.Category{{ID: 7}}},
		{ID: 2, Status: "completed", CompletedAt: &last, Priority: -1},
		{ID: 3, Status: "completed", CompletedAt: &end},
		{ID: 4, Status: "completed", CompletedAt: &previous},
		{ID: 5, Status: "completed", UpdatedAt: start.Add(time.Hour)},
		{ID: 6, Status: "completed", StartTime: &start}, // no guessed completion time
	}
	ids := func(rows []api.Task) []int64 {
		var result []int64
		for _, task := range rows {
			result = append(result, task.ID)
		}
		return result
	}
	for _, tc := range []struct {
		filter historyFilter
		want   []int64
	}{
		{historyFilter{Range: "今天"}, []int64{2, 5, 1}},
		{historyFilter{Range: "昨天"}, []int64{4}},
		{historyFilter{Range: "今天", Order: "最早在前"}, []int64{1, 5, 2}},
		{historyFilter{Range: "今天", CategoryID: 7, Priority: "高优先级"}, []int64{1}},
		{historyFilter{Range: "今天", CategoryID: -1, Priority: "低优先级"}, []int64{2}},
		{historyFilter{Range: "今天", Basis: "任务时间"}, []int64{6}},
		{historyFilter{Range: "自定义日期", From: now, To: now}, []int64{2, 5, 1}},
		{historyFilter{Range: "自定义日期", From: end, To: now}, nil},
		{historyFilter{Range: "最近7天"}, []int64{2, 5, 1, 4}},
	} {
		if got := ids(filterHistory(tasks, tc.filter, now)); !slices.Equal(got, tc.want) {
			t.Fatalf("%+v got=%v want=%v", tc.filter, got, tc.want)
		}
	}
	if rows := filterHistory(tasks, historyFilter{}, now); rows[len(rows)-1].ID != 6 {
		t.Fatal("missing dates must be last")
	}
	if rows := filterHistory(tasks, historyFilter{Order: "最早在前"}, now); rows[len(rows)-1].ID != 6 {
		t.Fatal("missing dates must be last ascending")
	}
	if !tasks[0].StartTime.Equal(old) || tasks[0].ID != 1 {
		t.Fatal("filter mutated cache")
	}
}

func TestHistoryInstanceDoesNotInheritSeriesActionTimes(t *testing.T) {
	now := time.Now()
	old := now.AddDate(-1, 0, 0)
	series := api.Task{ID: 1, Status: "pending", CreatedAt: old, UpdatedAt: now, CompletedAt: &now, DeletedAt: &now, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)}
	occurrence := api.Occurrence{TaskID: 1, InstanceID: "one", OriginalDate: old, StartTime: old, Status: "completed", CreatedAt: old, CompletedAt: &old}
	rows := projectTasks([]api.Task{series}, nil, []api.Occurrence{occurrence})
	if len(rows) != 1 || !rows[0].CreatedAt.Equal(old) || rows[0].DeletedAt != nil || !rows[0].UpdatedAt.IsZero() || !historyTime(rows[0], "处理时间").Equal(old) {
		t.Fatal(rows)
	}
	occurrence.CompletedAt = nil
	rows = projectTasks([]api.Task{series}, nil, []api.Occurrence{occurrence})
	if !historyTime(rows[0], "处理时间").IsZero() {
		t.Fatal("legacy occurrence inherited series date")
	}
	cancelled := api.Task{Status: "cancelled", DeletedAt: &old, UpdatedAt: now}
	if !historyTime(cancelled, "处理时间").Equal(old) {
		t.Fatal("wrong cancelled date")
	}
	skipped := api.Task{Status: "skipped", StartTime: &old, UpdatedAt: now}
	if !historyTime(skipped, "处理时间").Equal(old) {
		t.Fatal("skipped must use schedule, not update")
	}
}

func TestNativeHistoryToolbarEmptyPaginationAndSmallWindow(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{Username: "marlon", Timezone: "Asia/Shanghai"}
	a.page, a.syncedAt, a.history.HasMore = "completed", time.Now(), true
	now := time.Now().In(a.location())
	yesterday := now.AddDate(0, 0, -1)
	threeDaysAgo := now.AddDate(0, 0, -3)
	catWork := api.Category{ID: 1, Name: "产品研发", Emoji: "🚀", Color: "#C96442"}
	catDesign := api.Category{ID: 2, Name: "设计打磨", Emoji: "🎨", Color: "#3D7F58"}
	a.categories = []api.Category{catWork, catDesign}
	a.tasks = []api.Task{
		{ID: 10, Title: "重构原生日历与所见即所得编辑器", Description: "## 归档总结\n\n已完成全部交互验收。", Status: "completed", Priority: 1, CompletedAt: &now, Categories: []api.Category{catWork}},
		{ID: 9, Title: "消除后台同步导致的任务行跳动", Status: "completed", CompletedAt: &now, Categories: []api.Category{catWork}},
		{ID: 8, Title: "统一 Claude 温润纸感明暗配色", Status: "completed", CompletedAt: &yesterday, Categories: []api.Category{catDesign}},
		{ID: 7, Title: "梳理桌面端快捷键与无障碍焦点保护", Status: "completed", CompletedAt: &threeDaysAgo},
	}

	for _, size := range [][2]int{{900, 600}, {1280, 820}} {
		a.historyFilter = historyFilter{}
		a.query = ""
		if size[0] >= 1180 {
			a.editTaskNow(a.tasks[0])
		} else {
			a.clearTaskSelection()
		}
		tt := ui.NewTester(a.view, size[0], size[1])
		tt.Frame()

		// 1. Quick-add bar must NOT clutter history pages; inline search is directly available
		if _, hasQuick := tt.Access("快捷添加区"); hasQuick {
			t.Fatal("quick-add bar should not appear on history pages")
		}
		if _, ok := tt.AccessByRole(ui.RoleTextField, "搜索历史记录"); !ok {
			t.Fatal("missing inline history search input")
		}
		// Reset button stays hidden when no filter or query is active
		if _, hasReset := tt.AccessByRole(ui.RoleButton, "重置筛选"); hasReset {
			t.Fatal("reset button should stay hidden when filters are at default")
		}
		// Date group headers render cleanly
		if size[0] >= 1180 && (!tt.HasText("今天") || !tt.HasText("昨天")) {
			t.Fatalf("expected grouped date headers (今天 / 昨天), got %v", tt.Texts())
		}

		// 2. Verify all 1-click range pills fit inside bounds
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			tt.Frame()
			if size[0] >= 1180 {
				for _, label := range []string{"历史排序", "历史筛选条件", "历史范围 全部时间", "历史范围 今天", "历史范围 昨天", "历史范围 最近7天", "历史范围 最近30天", "自定义日期范围"} {
					n, ok := tt.AccessByRole(ui.RoleButton, label)
					if !ok || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > float32(size[1]) || n.Bounds.X+n.Bounds.W > float32(size[0]) {
						t.Fatalf("history control %q out of bounds: %+v", label, n)
					}
				}
			}
			if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" && size[0] == 900 {
				name := "native-history-headless-light.png"
				if dark {
					name = "native-history-headless-dark.png"
				}
				if err := os.MkdirAll(dir, 0o700); err == nil {
					if f, err := os.Create(filepath.Join(dir, name)); err == nil {
						_ = png.Encode(f, tt.Image())
						_ = f.Close()
					}
				}
			}
		}
		tt.SetDark(false)
		tt.Frame()

		if size[0] == 1280 {
			// Test 1-click sort toggle, filter popover, and preview export
			if err := tt.Click("历史排序"); err != nil || a.historyFilter.Order != "最早在前" {
				t.Fatalf("1-click sort toggle failed: err=%v order=%q", err, a.historyFilter.Order)
			}
			if err := tt.Click("历史排序"); err != nil || a.historyFilter.Order != "最新在前" {
				t.Fatalf("1-click sort toggle back failed: err=%v order=%q", err, a.historyFilter.Order)
			}

			// Open filter popover, pick category & priority via 1-click pills
			if err := tt.Click("历史筛选条件"); err != nil {
				t.Fatal(err)
			}
			if err := tt.Click("筛选分类 🚀 产品研发"); err != nil {
				t.Fatal(err)
			}
			if err := tt.Click("筛选优先级 高优先级"); err != nil {
				t.Fatal(err)
			}
			tt.Key(0, ui.KeyEscape)
			tt.Frame()
			if a.historyFilter.CategoryID != 1 || a.historyFilter.Priority != "高优先级" {
				t.Fatalf("filter popover pills did not apply: %+v", a.historyFilter)
			}

			if previewDir := os.Getenv("TODO_PREVIEW_DIR"); previewDir != "" {
				// Capture clean History view with active removable chips + open filter popover
				a.historyFilter = historyFilter{Range: "最近7天", CategoryID: 1}
				tt.Frame()
				savePreviewPNG(t, previewDir, "09-history-filter-light.png", tt)
				tt.SetDark(true)
				tt.Frame()
				savePreviewPNG(t, previewDir, "10-history-filter-dark.png", tt)
				tt.SetDark(false)
			}

			// Test custom date range popover
			if err := tt.Click("自定义日期范围"); err != nil {
				t.Fatal(err)
			}
			if _, ok := tt.Access("历史起始日期"); !ok {
				t.Fatal("custom date range popover missing start DateInput")
			}
			tt.Key(0, ui.KeyEscape)
			tt.Frame()
		}

		// 3. Empty filtered state + pagination + 1-click reset
		if size[0] < 1180 {
			a.taskDetailOpen = false
		}
		a.query = "不存在的关键词"
		a.historyFilter.Priority = "高优先级"
		tt.Frame()
		if !tt.HasText("已加载记录中没有匹配项，可调整筛选。") || !tt.HasText("加载更多重复任务历史") {
			t.Fatal(tt.Texts())
		}
		n, ok := tt.AccessByRole(ui.RoleButton, "加载更多重复任务历史")
		if !ok || n.Bounds.Y+n.Bounds.H > float32(size[1]) {
			t.Fatal("pagination unreachable", n)
		}
		if err := tt.Click("重置筛选"); err != nil || a.query != "" || a.historyFilter.isActive() {
			t.Fatal(err, a.query, a.historyFilter)
		}
	}
}
