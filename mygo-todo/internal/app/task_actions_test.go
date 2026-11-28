package app

import (
	"encoding/json"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestNativeTaskMenuKeepsInstanceScopeAndCanonicalSeries(t *testing.T) {
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "原生任务预览", Timezone: "Asia/Shanghai"}
	occurrences := []api.Occurrence{{TaskID: 7, InstanceID: "7_20261110", OriginalDate: day.AddDate(0, 0, 1), StartTime: day.AddDate(0, 0, 2).Add(9 * time.Hour), Title: "改期后的单次", Status: "pending"}}
	state.Next = occurrences
	a.adoptCache(state)
	tt := ui.NewTester(a.view, 900, 600)
	if err := tt.Click("更多操作 改期后的单次"); err != nil {
		t.Fatal(err)
	}
	tt.Advance(time.Second)
	if !a.taskMenuOpen || !tt.HasText("跳过本次") || tt.HasText("删除任务") || !tt.HasText("删除整个系列") {
		t.Fatal(a.taskMenuOpen, tt.Texts())
	}
	tt.Key(0, ui.KeyEscape)
	if a.taskMenuOpen || a.editing || a.deleteTask != nil || len(a.cache.Outbox) > 0 {
		t.Fatal("Escape changed the task or kept synchronization paused")
	}
	if err := tt.Click("更多操作 改期后的单次"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("编辑整个系列"); err != nil {
		t.Fatal(err)
	}
	tt.Advance(500 * time.Millisecond)
	if !a.editing || !a.draft.Start.Equal(*state.Tasks[0].StartTime) || a.draft.Task.InstanceID != "" {
		t.Fatal("projected occurrence replaced series anchor", a.draft)
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok {
		t.Fatal("unchanged series must not expose a persistent save button")
	}
	if _, ok := tt.Access("任务底部操作"); ok {
		t.Fatal("clean synced series should not occupy space with redundant bottom sync bar")
	}
	// Preserve the minimum-window action visibility assertion for a real edit.
	a.draft.Description += "\n新增系列备注"
	tt.Frame() // The unfocused edit flushes after rendering this frame.
	tt.Frame() // Render the durable local status in the top toolbar.
	statusNode, ok := tt.AccessByRole(ui.RoleText, "已存本机 · 待同步")
	if !ok || statusNode.Offscreen || statusNode.Bounds.Y < 0 || statusNode.Bounds.Y+statusNode.Bounds.H > 600 || a.taskDraftDirty() || len(a.cache.Outbox) != 1 {
		t.Fatal("autosave status outside minimum window", statusNode)
	}
	for _, label := range []string{"关闭"} {
		n, ok := tt.AccessByRole(ui.RoleButton, label)
		if !ok || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 {
			t.Fatal("editor action outside minimum window", label, n.Bounds)
		}
	}
	cache, err := a.store.Cache(state.Server, state.UserID)
	if err != nil || len(cache.Outbox) != 1 {
		t.Fatal("series description was not durably saved", err, cache.Outbox)
	}
	var delta map[string]any
	if err := json.Unmarshal(cache.Outbox[0].Body, &delta); err != nil {
		t.Fatal(err)
	}
	if cache.Outbox[0].TaskID != state.Tasks[0].ID || len(delta) != 1 || delta["description"] != a.draft.Description {
		t.Fatal("description autosave changed series anchor or instance scope", delta)
	}
	savedOp := a.cache.Outbox[0]
	a.editing = false
	projectedTasks := projectTasks(state.Tasks, occurrences, nil)
	if len(projectedTasks) != 1 || projectedTasks[0].InstanceID == "" {
		t.Fatal("fixture must project a scoped occurrence", projectedTasks)
	}
	projected := projectedTasks[0]
	a.performTaskAction(projected, "delete")
	tt.Frame()
	if len(a.interaction.pendingDeletes) != 1 || len(a.cache.Outbox) != 1 || a.cache.Outbox[0].ID != savedOp.ID || string(a.cache.Outbox[0].Body) != string(savedOp.Body) {
		t.Fatalf("direct delete with undo altered outbox prematurely: pendingDeletes=%+v outbox=%+v", a.interaction.pendingDeletes, a.cache.Outbox)
	}
	if err := tt.Click("撤销"); err != nil {
		t.Fatalf("undo delete toast failed: %v", err)
	}
	if len(a.interaction.pendingDeletes) != 0 || len(a.tasks) != 1 {
		t.Fatalf("undo did not restore task: pendingDeletes=%+v tasks=%d", a.interaction.pendingDeletes, len(a.tasks))
	}
	a.performTaskAction(projected, "delete")
	a.commitPendingDeletes()
	if len(a.interaction.pendingDeletes) != 0 || len(a.cache.Outbox) != 2 || a.cache.Outbox[1].Method != "DELETE" || a.cache.Outbox[1].TaskID != projected.ID {
		t.Fatalf("committing pending delete did not enqueue canonical series DELETE: pending=%+v outbox=%+v", a.interaction.pendingDeletes, a.cache.Outbox)
	}
}

func TestTaskActionsReadOnlyAndMissingScopeCannotWrite(t *testing.T) {
	for _, task := range []api.Task{
		{ID: 1, Title: "只读", Status: "pending", ReadOnly: true},
		{ID: 2, Title: "未展开系列", Status: "pending", RecurrenceRule: json.RawMessage(`{"freq":"daily"}`)},
	} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		a.tasks = []api.Task{task}
		for _, key := range []string{"completed", "pending", "skipped", "cancelled"} {
			a.performTaskAction(task, key)
			if a.busy || len(a.cache.Outbox) > 0 {
				t.Fatal("status without permission or instance scope", task, key)
			}
		}
		if task.ReadOnly {
			for _, key := range []string{"delete", "series", "activity"} {
				a.performTaskAction(task, key)
				if a.editing || a.deleteTask != nil || a.taskCenter != nil {
					t.Fatal("read-only action was enabled", key)
				}
			}
			tt := ui.NewTester(a.view, 900, 600)
			if err := tt.Click("更多操作 只读"); err != nil {
				t.Fatal(err)
			}
			if !tt.HasText("查看只读任务") || tt.HasText("取消任务") || tt.HasText("删除任务") {
				t.Fatal(tt.Texts())
			}
		}
		a.Close()
	}
}

func TestNativeTaskSearchEmptyAndLobePreview(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "原生任务预览", Timezone: "Asia/Shanghai"}
	a.tasks = []api.Task{{ID: 1, Title: "完善原生客户端交互", Status: "pending", Priority: 1}, {ID: 2, Title: "整理设计参考", Status: "pending", Priority: -1}}
	a.query = "不存在的关键词"
	a.search.Open = true
	tt := ui.NewTester(a.view, 900, 600)
	if !tt.HasText("没有匹配的任务") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("清除搜索"); err != nil {
		t.Fatal(err)
	}
	if a.query != "" || !tt.HasText("完善原生客户端交互") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("关闭搜索"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("低优先级") {
		t.Fatal(tt.Texts())
	}
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		tt.Advance(time.Second)
		if dir := os.Getenv("TODO_NATIVE_TEST_ARTIFACTS"); dir != "" {
			name := "native-lobe-tasks-headless-light.png"
			if dark {
				name = "native-lobe-tasks-headless-dark.png"
			}
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			f, err := os.Create(filepath.Join(dir, name))
			if err != nil {
				t.Fatal(err)
			}
			err = png.Encode(f, tt.Image())
			closeErr := f.Close()
			if err != nil || closeErr != nil {
				t.Fatal(err, closeErr)
			}
		}
	}
}

func TestNewTaskIsRevealedInVirtualList(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	for i := 1; i <= 120; i++ {
		a.tasks = append(a.tasks, api.Task{ID: int64(i), Title: fmt.Sprintf("已有任务 %d", i), Status: "pending", Priority: 1})
	}
	// Low-priority local task starts below the 120 high-priority tasks until revealed.
	a.tasks = append(a.tasks, api.Task{ID: -1, Title: "刚刚创建的离线任务", Status: "pending", Priority: -1})
	tt := ui.NewTester(a.view, 900, 600)
	if initialNode, ok := tt.AccessByRole(ui.RoleButton, "刚刚创建的离线任务"); !ok || !initialNode.Offscreen {
		t.Fatalf("fixture must start offscreen below the initial viewport: %+v", initialNode)
	}
	a.revealTaskID = -1
	tt.Frame()
	if revealedNode, ok := tt.AccessByRole(ui.RoleButton, "刚刚创建的离线任务"); !ok || revealedNode.Offscreen || a.revealTaskID != 0 {
		t.Fatalf("new task remained offscreen after reveal: %+v revealID=%d", revealedNode, a.revealTaskID)
	}
	if err := clickNavigation(tt, "今天"); err != nil {
		t.Fatal(err)
	}
	if err := clickNavigation(tt, "全部任务"); err != nil {
		t.Fatal(err)
	}
	if topNode, ok := tt.AccessByRole(ui.RoleButton, "已有任务 120"); !ok || topNode.Offscreen {
		t.Fatalf("switching task pages retained stale list position: %+v", topNode)
	}
}
