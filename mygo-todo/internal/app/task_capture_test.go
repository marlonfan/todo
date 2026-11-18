package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestQuickCaptureEscapeAndDetailTransferProtectDraft(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "category:7"
	a.categories = []api.Category{{ID: 7, Name: "工作"}}
	a.session.User = api.User{Timezone: "Asia/Shanghai"}
	tt := ui.NewTester(a.view, 1280, 800)
	a.beginQuickAdd()
	tt.Frame()
	if err := tt.Click("快捷添加标题"); err != nil {
		t.Fatal(err)
	}
	tt.Type("待确认的快捷草稿")
	tt.Key(0, ui.KeyEscape)
	if a.quick.Open || a.quick.Draft.Title != "待确认的快捷草稿" || !a.quick.Draft.Categories[7] {
		t.Fatal("Esc lost capture draft", a.quick)
	}
	a.beginQuickAdd()
	tt.Frame()
	if err := tt.Click("编辑快捷优先级"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("高"); err != nil {
		t.Fatal(err)
	}
	if a.quick.Draft.Priority != "高" {
		t.Fatal("priority choice did not apply")
	}
	if err := tt.Click("详细编辑"); err != nil {
		t.Fatal(err)
	}
	if !a.editing || a.draft.Title != "待确认的快捷草稿" || a.draft.Priority != "高" || !a.draft.Categories[7] || !a.taskDraftDirty() {
		t.Fatal("detail transfer lost capture state", a.draft)
	}
	a.changePage("today")
	tt.Frame()
	if !a.taskDiscardConfirm {
		t.Fatal("transferred draft bypassed discard gate")
	}
}

func TestQuickCaptureValidationAndLocalFailureKeepInput(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.ensureQuickDraft()
	a.submitQuickTask()
	if a.busy || a.failure == "" {
		t.Fatal("blank capture accepted")
	}
	a.quick.Draft.Title = "写盘失败仍保留"
	a.cacheError = "测试：本机缓存不可写"
	a.submitQuickTask()
	if a.quick.Draft.Title != "写盘失败仍保留" || a.failure != a.cacheError || a.busy || len(a.cache.Outbox) != 0 {
		t.Fatal("capture failure lost input or reported success")
	}
}

func TestSearchPanelKeyboardScopeAndProtectedSelection(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	now := time.Now()
	a.tasks = []api.Task{{ID: 1, Title: "第一个匹配", Description: "共同关键词", Status: "pending", StartTime: &now}, {ID: 2, Title: "第二个匹配", Description: "共同关键词", Status: "pending"}, {ID: 3, Title: "已完成隐藏", Description: "共同关键词", Status: "completed"}}
	a.editTaskNow(a.tasks[0])
	a.draft.Description = "尚未保存"
	a.query = "共同关键词"
	a.openTaskSearch()
	tt := ui.NewTester(a.view, 1280, 800)
	if len(a.searchResults()) != 2 || !tt.Focused("搜索任务") {
		t.Fatal("scope or focus incorrect", tt.Texts())
	}
	tt.Key(0, ui.KeyDown)
	tt.Key(0, ui.KeyEnter)
	if a.search.Open || !a.search.Return || !a.taskDiscardConfirm || a.draft.Description != "尚未保存" {
		t.Fatal("search selection lost draft or return path")
	}
	if err := tt.Click("放弃并切换"); err != nil {
		t.Fatal(err)
	}
	// Current order is dated task first, followed by the undated task.
	if a.selectedTaskID != 2 {
		t.Fatal("keyboard result did not open", a.selectedTaskID)
	}
	a.openTaskSearch()
	tt.Frame()
	tt.Key(0, ui.KeyEscape)
	if a.search.Open || a.query != "共同关键词" {
		t.Fatal("Esc did not close and retain query")
	}
	a.openTaskSearch()
	tt.Frame()
	if err := tt.Click("清除搜索"); err != nil {
		t.Fatal(err)
	}
	if a.query != "" || !tt.Focused("搜索任务") {
		t.Fatal("clearing search did not restore the input focus")
	}
}

func TestQuickCaptureListDefaultsAndCategoryRefresh(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.categories = []api.Category{{ID: -7, Name: "本机分类"}, {ID: 8, Name: "另一分类"}}
	a.ensureQuickDraft()
	a.page = "today"
	a.ensureQuickDraft()
	if !a.quick.Draft.HasStart {
		t.Fatal("untouched capture did not adopt today's date")
	}
	a.page = "category:-7"
	a.ensureQuickDraft()
	if a.quick.Draft.HasStart || !a.quick.Draft.Categories[-7] {
		t.Fatal("untouched capture kept the previous list defaults")
	}
	a.cache.CategoryAliases = map[int64]int64{-7: 70}
	a.adoptCategoryAliases()
	if !a.quick.Draft.Categories[70] || !a.quick.Base.Categories[70] || a.quick.Draft.Categories[-7] || a.quick.Page != "category:70" {
		t.Fatal("capture category ID was not reconciled")
	}
	a.quick.Draft.Title = "跨清单保留的输入"
	a.page = "category:8"
	a.ensureQuickDraft()
	if a.quick.Draft.Title != "跨清单保留的输入" || !a.quick.Draft.Categories[70] {
		t.Fatal("list navigation discarded edited capture")
	}
	// A remote deletion removes the hidden association on explicit submit,
	// asks for review, and leaves all user text intact without queuing it.
	a.categories = []api.Category{{ID: 8, Name: "另一分类"}}
	a.submitQuickTask()
	if a.quick.Draft.Categories[70] || a.quick.Draft.Title != "跨清单保留的输入" || a.failure == "" || a.busy || len(a.cache.Outbox) != 0 {
		t.Fatal("remote category deletion trapped the capture draft")
	}
}

func TestSearchPanelFitsMinimumNativeWindow(t *testing.T) {
	heights := map[int]float32{}
	for _, count := range []int{0, 1, 30} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		for i := 0; i < count; i++ {
			a.tasks = append(a.tasks, api.Task{ID: int64(i + 1), Title: fmt.Sprintf("任务 %02d", i+1), Status: "pending"})
		}
		a.openTaskSearch()
		tt := ui.NewTester(a.view, 900, 600)
		for _, label := range []string{"搜索任务", "关闭搜索"} {
			var found bool
			for _, role := range []ui.Role{ui.RoleTextField, ui.RoleButton} {
				node, ok := tt.AccessByRole(role, label)
				if ok {
					found = true
					if node.Offscreen || node.Bounds.Y < 0 || node.Bounds.Y+node.Bounds.H > 600 || node.Bounds.X+node.Bounds.W > 900 {
						t.Fatal(label, node)
					}
				}
			}
			if !found {
				t.Fatal("missing search control", label)
			}
		}
		viewport, ok := tt.AccessByRole(ui.RoleScroll, "搜索结果列表")
		if !ok {
			t.Fatal("missing result viewport")
		}
		heights[count] = viewport.Bounds.H
		help, ok := tt.AccessByRole(ui.RoleText, "↑ ↓ 选择 · Enter 打开详情 · Esc 关闭")
		if !ok || help.Offscreen || help.Bounds.Y+help.Bounds.H > 600 {
			t.Fatal("search keyboard help is unreachable", help)
		}
		if count == 30 {
			for i := 0; i < 29; i++ {
				tt.Key(0, ui.KeyDown)
			}
			last, ok := tt.AccessByRole(ui.RoleButton, "搜索结果 任务 01")
			if !ok || last.Offscreen || last.Bounds.Y < viewport.Bounds.Y || last.Bounds.Y+last.Bounds.H > viewport.Bounds.Y+viewport.Bounds.H+1 {
				t.Fatal("keyboard selection did not reveal the last result", last)
			}
			after, _ := tt.AccessByRole(ui.RoleText, "↑ ↓ 选择 · Enter 打开详情 · Esc 关闭")
			if after.Bounds != help.Bounds {
				t.Fatal("keyboard help scrolled with results")
			}
		}
		a.Close()
	}
	if heights[0] >= heights[30] || heights[1] >= heights[30] {
		t.Fatal("short searches did not shrink", heights)
	}
}
