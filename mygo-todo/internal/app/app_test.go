package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestNativeTaskNavigationAndValidation(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "测试用户"}
	a.adoptCache(storage.Cache{Tasks: []api.Task{{ID: 1, Title: "准备发布", Status: "pending", Revision: 1}, {ID: 2, Title: "完成迁移调研", Status: "completed"}}})
	tt := ui.NewTester(a.view, 1280, 800)
	if !tt.HasText("准备发布") || tt.HasText("完成迁移调研") {
		t.Fatalf("initial list: %v", tt.Texts())
	}
	if err := tt.Click("已完成"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("完成迁移调研") || tt.HasText("准备发布") {
		t.Fatalf("completed list: %v", tt.Texts())
	}
	if err := tt.Click("＋ 新建任务"); err != nil {
		t.Fatal(err)
	}
	if !a.editing {
		t.Fatal("editor did not open")
	}
	if err := tt.Click("创建任务"); err != nil {
		t.Fatal(err)
	}
	if !a.editing || !tt.HasText("任务标题应为 1–200 个字符") {
		t.Fatalf("invalid draft was lost: %v", tt.Texts())
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "任务标题"); !ok || !a.taskEditorInline {
		t.Fatal("editor must expose native inputs in the task detail pane")
	}
	a.draft.Title = "合法的新任务"
	tt.Frame()
	if err := tt.Click("创建任务"); err != nil {
		t.Fatal(err)
	}
	cache, err := a.store.Cache("", 0)
	if err != nil || len(cache.Outbox) != 1 {
		t.Fatal("valid creation was not durably queued", err, cache.Outbox)
	}
	var body map[string]any
	if err := json.Unmarshal(cache.Outbox[0].Body, &body); err != nil {
		t.Fatal(err)
	}
	if cache.Outbox[0].Method != "POST" || body["title"] != "合法的新任务" || a.draft.Task.ID >= 0 || a.taskDraftDirty() {
		t.Fatal("creation did not retain the saved local task", cache.Outbox, a.draft)
	}
}

func TestNativeTaskWorkspaceKeepsSelectionAndDraft(t *testing.T) {
	for _, failWrite := range []bool{false, true} {
		name := "autosave-switch"
		if failWrite {
			name = "disk-error-preserves-draft"
		}
		t.Run(name, func(t *testing.T) {
			a := New(storage.Store{Dir: t.TempDir()})
			defer a.Close()
			a.client, _ = api.New(api.DefaultServer, "")
			a.session.User = api.User{ID: 1, Username: "测试用户"}
			a.adoptCache(storage.Cache{Tasks: []api.Task{{ID: 11, Title: "第一项", Status: "pending", Revision: 1}, {ID: 12, Title: "第二项", Status: "pending", Revision: 1}}})
			tt := ui.NewTester(a.view, 1280, 800)
			if err := tt.Click("第一项"); err != nil {
				t.Fatal(err)
			}
			if !a.taskDetailOpen || a.selectedTaskID != 11 {
				t.Fatalf("detail pane did not open: selected=%d open=%v texts=%v", a.selectedTaskID, a.taskDetailOpen, tt.Texts())
			}
			if _, ok := tt.AccessByRole(ui.RoleTextField, "任务标题"); !ok {
				t.Fatal("detail must expose its 1-click editable title field")
			}
			if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok || tt.HasText("未修改") || !tt.HasText("已同步") {
				t.Fatal("clean detail must expose lightweight sync status without a save button")
			}
			if failWrite {
				bad := filepath.Join(t.TempDir(), "file")
				if err := os.WriteFile(bad, []byte("occupied"), 0600); err != nil {
					t.Fatal(err)
				}
				a.store.Dir = bad
			}
			if err := tt.Click("任务标题"); err != nil {
				t.Fatal(err)
			}
			a.draft.Title = "第一项的未保存修改"
			tt.Frame()
			if _, ok := tt.AccessByRole(ui.RoleButton, "保存任务"); ok || !a.taskDraftDirty() || !tt.HasText("待保存…") {
				t.Fatal("dirty detail must expose pending autosave status")
			}
			if err := tt.Click("第二项"); err != nil {
				t.Fatal(err)
			}
			if failWrite {
				if !a.taskDiscardConfirm || a.pendingTaskAction == nil || a.autosave.failure == "" || len(a.cache.Outbox) != 0 {
					t.Fatal("failed disk write did not protect draft", a.autosave.failure)
				}
				if err := tt.Click("继续编辑"); err != nil {
					t.Fatal(err)
				}
				if !a.editing || a.selectedTaskID != 11 || a.draft.Title != "第一项的未保存修改" || !a.taskDraftDirty() {
					t.Fatal("continuing edit lost the current draft")
				}
				return
			}
			if a.taskDiscardConfirm || a.pendingTaskAction != nil || a.selectedTaskID != 12 || a.draft.Title != "第二项" {
				t.Fatal("durably saved draft did not switch directly to the next task")
			}
			cache, err := a.store.Cache("", 0)
			if err != nil || len(cache.Outbox) != 1 {
				t.Fatal("switch did not persist autosave", err, cache.Outbox)
			}
			op := cache.Outbox[0]
			var delta map[string]any
			if err := json.Unmarshal(op.Body, &delta); err != nil {
				t.Fatal(err)
			}
			if op.TaskID != 11 || op.Method != "PUT" || len(delta) != 1 || delta["title"] != "第一项的未保存修改" {
				t.Fatal("autosave changed task scope or unrelated fields", op, delta)
			}
		})
	}
}

func TestSelectedTaskRebasesOnlyCleanDraftAfterSync(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.session.User = api.User{ID: 1, Username: "测试用户"}
	first := api.Task{ID: 11, Title: "本机任务", Status: "pending", Revision: 1}
	a.adoptCache(storage.Cache{Tasks: []api.Task{first}})
	a.editTaskNow(first)
	updated := first
	updated.Title, updated.Revision = "服务端新标题", 2
	a.adoptCache(storage.Cache{Tasks: []api.Task{updated}})
	if a.selectedTaskID != 11 || a.draft.Title != updated.Title || a.taskDraftDirty() {
		t.Fatal("clean selected detail did not reflect the acknowledged task")
	}
	a.draft.Title = "正在输入的草稿"
	updated.Revision = 3
	a.adoptCache(storage.Cache{Tasks: []api.Task{updated}})
	if a.draft.Title != "正在输入的草稿" || a.draft.Task.Revision != 2 || !a.taskDraftDirty() {
		t.Fatal("sync overwrote an unsaved draft or its conflict baseline")
	}
}

func TestSelectedOfflineTaskTracksServerID(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.session.User = api.User{ID: 1, Username: "测试用户"}
	local := api.Task{ID: -1, Title: "离线新任务", Status: "pending"}
	a.adoptCache(storage.Cache{Tasks: []api.Task{local}, ReminderKeys: map[int64]string{-1: "local:create-id"}})
	a.editTaskNow(local)
	confirmed := local
	confirmed.ID, confirmed.Revision = 42, 1
	a.adoptCache(storage.Cache{Tasks: []api.Task{confirmed}, ReminderKeys: map[int64]string{42: "local:create-id"}})
	if a.selectedTaskID != 42 || a.draft.Task.ID != 42 || a.taskDraftDirty() {
		t.Fatalf("saved detail lost its server identity: selected=%d task=%d", a.selectedTaskID, a.draft.Task.ID)
	}
}

func TestNativeNavigationWaitsForForegroundSync(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "测试用户"}
	a.page, a.busy = "sync", true
	tt := ui.NewTester(a.view, 1280, 800)
	node, ok := tt.AccessByRole(ui.RoleTreeItem, "全部任务")
	if !ok || !node.Disabled {
		t.Fatalf("navigation must expose its disabled state during sync: %+v", node)
	}
	a.busy = false
	tt.Frame()
	if err := tt.Click("全部任务"); err != nil {
		t.Fatal(err)
	}
	if a.page != "all" {
		t.Fatalf("navigation after sync: %s", a.page)
	}
}

func TestNativeLoginIsNotWebContent(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	tt := ui.NewTester(a.view, 1000, 760)
	if !tt.HasText("Todo") || !tt.HasText("任务、日历与提醒，随时保持同步。") {
		t.Fatalf("login: %v", tt.Texts())
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "用户名"); !ok {
		t.Fatal("missing native username input")
	}
	if err := tt.Click("登录"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("请输入用户名和密码") {
		t.Fatal("missing login validation")
	}
}

func TestTaskFiltersUseLocalDays(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2026, 11, 9, 10, 0, 0, 0, loc)
	start := time.Date(2026, 11, 8, 18, 0, 0, 0, time.UTC)
	tasks := []api.Task{{ID: 1, Status: "pending", Title: "今日任务", StartTime: &start, Categories: []api.Category{{ID: 4}}}, {ID: 2, Status: "pending", Title: "收件箱"}, {ID: 3, Status: "cancelled", Title: "取消"}}
	for _, tc := range []struct {
		page, query string
		id          int64
	}{{"today", "", 1}, {"category:4", "", 1}, {"inbox", "", 2}, {"cancelled", "", 3}, {"all", "今日", 1}} {
		got := filteredTasks(tasks, tc.page, tc.query, now)
		if len(got) != 1 || got[0].ID != tc.id {
			t.Errorf("%s %q: %+v", tc.page, tc.query, got)
		}
	}
}

func TestEditingPreservesComplexRecurrenceAndNullableFields(t *testing.T) {
	start := time.Date(2026, 11, 9, 9, 0, 0, 0, time.Local)
	rule := json.RawMessage("{\"freq\":\"weekly\",\"interval\":2,\"byday\":[\"MO\",\"FR\"],\"count\":12}")
	d := draftFrom(api.Task{ID: 1, Title: "两周例会", Status: "pending", StartTime: &start, RecurrenceRule: rule}, start)
	d.Description = "只改描述"
	p, err := d.payload()
	if err != nil {
		t.Fatal(err)
	}
	if string(p["recurrence_rule"].(json.RawMessage)) != string(rule) {
		t.Fatal("complex recurrence changed")
	}
	if p["end_time"] != nil || p["due_date"] != nil {
		t.Fatal("nullable dates lost")
	}
	d.HasEnd = true
	d.End = start.Add(-time.Hour)
	if _, err := d.payload(); err == nil {
		t.Fatal("invalid end accepted")
	}
}

func TestCalendarUsesExclusiveEndAndLocalTimezone(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	day := time.Date(2026, 11, 9, 0, 0, 0, 0, loc)
	events := []api.CalendarEvent{
		{ID: "all-day", Start: "2026-11-08", End: "2026-11-10", AllDay: true},
		{ID: "utc", Start: "2026-11-08T18:00:00Z", End: "2026-11-08T19:00:00Z"},
		{ID: "exclusive", Start: "2026-11-08", End: "2026-11-09", AllDay: true},
	}
	got := eventsForDay(events, day)
	if len(got) != 2 || got[0].ID != "all-day" || got[1].ID != "utc" {
		t.Fatalf("events: %+v", got)
	}
}
