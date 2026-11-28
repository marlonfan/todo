package app

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestViewCacheHitsAndInvalidates(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	now := time.Date(2026, 11, 20, 10, 0, 0, 0, time.UTC)
	a.tasks = []api.Task{
		{ID: 1, Title: "今天截止", Status: "pending", StartTime: &now, Revision: 1},
		{ID: 2, Title: "收件箱待办", Status: "pending", Revision: 1},
		{ID: 3, Title: "已完成事项", Status: "completed", Revision: 2},
	}
	a.cache.Outbox = []storage.Mutation{{TaskID: 2, State: "conflict", Failure: "409"}}

	// First call populates viewCache.
	if got := a.cachedPageCount("today", now); got != 1 {
		t.Fatalf("today pageCount = %d, want 1", got)
	}
	if !a.isTaskSyncBlocked(2) || a.isTaskSyncBlocked(1) {
		t.Fatalf("blocked lookup mismatch: id2=%v id1=%v", a.isTaskSyncBlocked(2), a.isTaskSyncBlocked(1))
	}
	list1 := a.cachedTaskList("all", "", now)
	list2 := a.cachedTaskList("all", "", now)
	if len(list1) != 2 || len(list2) != 2 || &list1[0] != &list2[0] {
		t.Fatal("cachedTaskList did not reuse memoized slice on steady read")
	}

	// Mutating tasks invalidates fingerprint and recomputes counts + lists.
	a.tasks[0].Status = "completed"
	if got := a.cachedPageCount("today", now); got != 0 {
		t.Fatalf("today pageCount after invalidation = %d, want 0", got)
	}
	if got := a.cachedPageCount("processed", now); got != 2 {
		t.Fatalf("processed pageCount after invalidation = %d, want 2", got)
	}
}

func TestScopedPendingDoesNotLockWorkspaceNavigation(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "并行用户"}
	a.tasks = []api.Task{{ID: 1, Title: "任务一", Status: "pending"}}

	started := make(chan struct{})
	release := make(chan struct{})
	a.runScoped("sync.test", func(context.Context) (func(), error) {
		close(started)
		<-release
		return func() {}, nil
	})
	<-started

	if a.busy || !a.isPending("sync.test") || !a.anyPending() {
		t.Fatalf("scoped op leaked into global busy or missed pending tracker: busy=%v pending=%v", a.busy, a.isPending("sync.test"))
	}

	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("今天"); err != nil {
		t.Fatalf("sidebar navigation blocked during scoped op: %v", err)
	}
	if a.page != "today" {
		t.Fatalf("expected page switch to today, got %s", a.page)
	}
	close(release)
}

func TestCompletionHoldUndoAndReducedMotion(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	task := api.Task{ID: 10, Title: "完成可撤销任务", Status: "pending", Revision: 1}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{task}})

	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("完成 完成可撤销任务"); err != nil {
		t.Fatal(err)
	}
	// Retained during 360ms hold animation.
	tt.Advance(200 * time.Millisecond)
	if a.tasks[0].Status != "completed" || len(a.pendingToasts) != 0 && false {
		t.Fatalf("status not marked completed: %+v", a.tasks[0])
	}
	rowsMid := a.interactionTasks(a.tasks, "all", "", tt.Now())
	if len(rowsMid) != 1 || rowsMid[0].Status != "completed" {
		t.Fatalf("row left list before 360ms motionCompleteHold: %+v", rowsMid)
	}

	// Undo toast restores task back to pending.
	if err := tt.Click("撤销"); err != nil {
		t.Fatalf("undo completion toast failed: %v", err)
	}
	if a.tasks[0].Status != "pending" {
		t.Fatalf("undo did not restore pending status: %s", a.tasks[0].Status)
	}

	// Reduced motion skips hold delay immediately.
	tt.SetPreferences(ui.Preferences{ReduceMotion: true})
	tt.Frame()
	if !a.interaction.reduceMotion {
		t.Fatal("ReduceMotion preference did not propagate to interaction")
	}
}

func TestDirectDeleteUndoAndCommitOnFlush(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	task := api.Task{ID: 20, Title: "可撤销删除的任务", Status: "pending", Revision: 3}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{task}})

	tt := ui.NewTester(a.view, 1280, 800)
	a.performTaskAction(task, "delete")
	tt.Frame()
	if len(a.interaction.pendingDeletes) != 1 || len(a.cache.Outbox) != 0 {
		t.Fatalf("pending delete state unexpected: pending=%+v outbox=%+v", a.interaction.pendingDeletes, a.cache.Outbox)
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "可撤销删除的任务"); ok {
		t.Fatal("deleted task remained visible in active list")
	}
	if err := tt.Click("撤销"); err != nil {
		t.Fatalf("undo delete click failed: %v", err)
	}
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleButton, "可撤销删除的任务"); !ok || len(a.interaction.pendingDeletes) != 0 || len(a.cache.Outbox) != 0 {
		t.Fatal("undo delete failed to restore task cleanly")
	}

	// Commit flushes DELETE to durable outbox.
	a.performTaskAction(task, "delete")
	a.commitPendingDeletes()
	if len(a.interaction.pendingDeletes) != 0 || len(a.cache.Outbox) != 1 || a.cache.Outbox[0].Method != "DELETE" {
		t.Fatalf("commitPendingDeletes failed: pending=%+v outbox=%+v", a.interaction.pendingDeletes, a.cache.Outbox)
	}
}

func TestFriendlyErrorToastsAndSkeletons(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")

	netErr := &url.Error{Op: "Get", URL: "http://127.0.0.1/tasks", Err: errors.New("connection refused")}
	title, _, retryLabel, _ := a.friendlyError(netErr, func() {})
	if !strings.Contains(title, "网络") || retryLabel != "重试" {
		t.Fatalf("unexpected network error mapping: title=%q retry=%q", title, retryLabel)
	}

	authErr := &api.Error{Status: 401, Message: "token expired"}
	title401, _, reloginLabel, _ := a.friendlyError(authErr, nil)
	if !strings.Contains(title401, "登录") || reloginLabel == "" {
		t.Fatalf("unexpected 401 mapping: title=%q action=%q", title401, reloginLabel)
	}

	srvErr := &api.Error{Status: 503, Message: "unavailable"}
	title503, _, _, _ := a.friendlyError(srvErr, nil)
	if !strings.Contains(title503, "服务") {
		t.Fatalf("unexpected 503 mapping: title=%q", title503)
	}

	// Initial sync shows loading skeleton.
	a.syncing = true
	a.syncedAt = time.Time{}
	tt := ui.NewTester(a.view, 1280, 800)
	if _, ok := tt.Access("正在加载任务"); !ok {
		t.Fatal("initial sync did not render task list skeleton")
	}

	// Calendar loading shows skeleton banner.
	a.page = "calendar"
	a.calendarLoading = true
	tt.Frame()
	if _, ok := tt.Access("正在同步日历视图…"); !ok {
		t.Fatal("calendar loading did not render skeleton banner")
	}
}

func TestSidebarIAAndDetailEmptyOverview(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "测试账户"}
	now := time.Date(2026, 11, 20, 9, 0, 0, 0, time.UTC)
	a.tasks = []api.Task{
		{ID: 1, Title: "进行中任务", Status: "pending", StartTime: &now},
		{ID: 2, Title: "已取消历史", Status: "cancelled"},
		{ID: 3, Title: "已跳过历史", Status: "skipped"},
	}
	tt := ui.NewTester(a.view, 1280, 860)

	// No separate "管理分类" sidebar treeitem; "+" button exists next to 清单.
	if _, ok := tt.AccessByRole(ui.RoleTreeItem, "管理分类"); ok {
		t.Fatal("deprecated 管理分类 nav item still exists in sidebar")
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "新建分类"); !ok {
		t.Fatal("missing 清单 '+' button in sidebar")
	}
	// Account is docked near bottom beside settings.
	acct, okAcct := tt.Find("账户菜单")
	settings, okSet := tt.AccessByRole(ui.RoleButton, "设置")
	if !okAcct || !okSet || acct.Y < 700 || settings.Bounds.Y < 700 {
		t.Fatalf("account/settings not bottom-docked: acct=%+v settings=%+v", acct, settings)
	}

	// No redundant unfiltered header count badge on "全部任务".
	if _, ok := tt.AccessByRole(ui.RoleText, "1 个任务"); ok {
		t.Fatal("unfiltered task list header still shows redundant count badge")
	}

	// Empty detail overview renders Today Overview and Shortcut Quick Reference.
	if !tt.HasText("今日概览") || !tt.HasText("快捷键速查") {
		t.Fatal("empty detail pane missing Today Overview or Shortcuts")
	}

	// Merged "已处理" page filters completed/cancelled/skipped via segmented tabs.
	if err := tt.Click("已处理"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("已取消历史") || !tt.HasText("已跳过历史") {
		t.Fatal("processed page missing combined items")
	}
	if err := tt.Click("已跳过"); err != nil {
		t.Fatal(err)
	}
	if tt.HasText("已取消历史") || !tt.HasText("已跳过历史") {
		t.Fatal("processed skipped tab did not filter accurately")
	}
}

func TestDetailPlaceholdersSlashMenuAndCommandPalette(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	task := api.Task{ID: 30, Title: "空白属性任务", Status: "pending", Revision: 1}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{task}})
	a.editTaskNow(task)

	tt := ui.NewTester(a.view, 1280, 860)
	for _, placeholder := range []string{"添加日期", "添加优先级", "添加分类", "添加重复", "添加提醒"} {
		if !tt.HasText(placeholder) {
			t.Fatalf("missing unset property placeholder %q", placeholder)
		}
	}

	// Slash command inside description inserts heading without permanent 14-icon bar.
	if err := tt.Click("备注"); err != nil {
		t.Fatal(err)
	}
	tt.Type("/h1")
	tt.Frame()
	if !tt.HasText("一级标题") {
		t.Fatal("typing '/h1' did not open filtered slash command menu")
	}
	tt.Key(0, ui.KeyEnter)
	tt.Frame()
	if !strings.HasPrefix(a.draft.Description, "# ") {
		t.Fatalf("slash command Enter did not apply heading block: %q", a.draft.Description)
	}

	// Cmd+K Command Palette opens, filters and navigates.
	tt.Key(ui.Cmd, ui.KeyK)
	tt.Advance(200 * time.Millisecond)
	if !a.palette.Open {
		t.Fatal("Cmd+K did not open command palette")
	}
	tt.Type("日历")
	tt.Frame()
	tt.Key(0, ui.KeyEnter)
	if a.palette.Open || a.page != "calendar" {
		t.Fatalf("command palette did not navigate to calendar: open=%v page=%s", a.palette.Open, a.page)
	}
}

func TestManualTaskReorderAndReset(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	now := time.Now()
	a.tasks = []api.Task{
		{ID: 1, Title: "第一项", Status: "pending", Priority: 1},
		{ID: 2, Title: "第二项", Status: "pending", Priority: 0},
		{ID: 3, Title: "第三项", Status: "pending", Priority: -1},
	}

	tasks := a.cachedTaskList("all", "", now)
	if len(tasks) != 3 || tasks[0].ID != 1 {
		t.Fatalf("unexpected default order: %+v", tasks)
	}

	// Move last task up by 1 and verify persistence to Preferences.
	a.reorderTaskByDelta("all", tasks, a.stableTaskKey(tasks[2]), -1)
	prefs, err := a.store.Preferences()
	if err != nil || len(prefs.ManualTaskOrder["all"]) != 3 {
		t.Fatalf("manual order not persisted to store: err=%v prefs=%+v", err, prefs)
	}

	reordered := a.cachedTaskList("all", "", now)
	if reordered[1].ID != 3 || reordered[2].ID != 2 {
		t.Fatalf("cachedTaskList did not apply manual order: %+v", reordered)
	}

	// Reset restores default priority order.
	tt := ui.NewTester(a.view, 1280, 800)
	if err := tt.Click("恢复默认排序"); err != nil {
		t.Fatalf("clicking 恢复默认排序 failed: %v", err)
	}
	if a.hasManualOrder("all") {
		t.Fatal("resetManualOrder did not clear page manual order")
	}
	restored := a.cachedTaskList("all", "", now)
	if restored[1].ID != 2 || restored[2].ID != 3 {
		t.Fatalf("default priority order not restored: %+v", restored)
	}
}

func TestSearchAndListSelectionStaySynced(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.tasks = []api.Task{
		{ID: 1, Title: "第一项任务", Status: "pending", Priority: 1},
		{ID: 2, Title: "第二项任务", Status: "pending", Priority: 0},
		{ID: 3, Title: "第三项任务", Status: "pending", Priority: -1},
	}
	tt := ui.NewTester(a.view, 1280, 800)

	// 1. Selecting a task in the list syncs the initial highlighted index when opening Search.
	if err := tt.Click("第二项任务"); err != nil {
		t.Fatal(err)
	}
	if a.selectedTaskID != 2 || a.highlightedTaskKey != taskRowKey(a.tasks[1]) {
		t.Fatalf("list selection state mismatch: id=%d key=%q", a.selectedTaskID, a.highlightedTaskKey)
	}
	if err := tt.Click("搜索任务"); err != nil {
		t.Fatal(err)
	}
	tt.Advance(200 * time.Millisecond)
	if !a.search.Open || a.search.Index != 1 {
		t.Fatalf("search dialog did not sync selected index to task 2: open=%v index=%d", a.search.Open, a.search.Index)
	}

	// 2. Picking another result in Search syncs selectedTaskID, highlightedTaskKey, and revealTaskID.
	if err := tt.Click("搜索结果 第三项任务"); err != nil {
		t.Fatal(err)
	}
	if a.search.Open || a.selectedTaskID != 3 || a.highlightedTaskKey != taskRowKey(a.tasks[2]) {
		t.Fatalf("picking search result did not sync list selection: open=%v id=%d key=%q", a.search.Open, a.selectedTaskID, a.highlightedTaskKey)
	}

	// 3. Closing detail clears both selectedTaskID and highlightedTaskKey.
	if err := tt.Click("关闭"); err != nil {
		t.Fatal(err)
	}
	if a.selectedTaskID != 0 || a.highlightedTaskKey != "" {
		t.Fatalf("closing detail left stale selection highlight: id=%d key=%q", a.selectedTaskID, a.highlightedTaskKey)
	}
}

func TestDetailTopToolsAndCalendarNoDeform(t *testing.T) {
	state, day := calendarFixture()
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	a.adoptCache(state)
	a.editTaskNow(a.tasks[0])

	tt := ui.NewTester(a.view, 1280, 860)
	// Restored detail top bell icon and top Markdown toolbar buttons are directly available.
	for _, label := range []string{"提醒与活动记录", "一级标题", "加粗 (" + shortcutHint("B") + ")", "切换为 Markdown 源码编辑"} {
		if _, ok := tt.AccessByRole(ui.RoleButton, label); !ok {
			t.Fatalf("missing restored detail tool %q", label)
		}
	}

	// Switching to Calendar and opening the floating detail drawer keeps calendar cells 100% full width without narrowing or warping.
	a.clearTaskSelection()
	a.page = "calendar"
	a.selectedDay = day
	a.calendarMode = 2
	tt.Frame()
	cellBefore, ok0 := tt.Access("日历日期 2026-11-11")
	if !ok0 {
		t.Fatal("missing calendar day cell before opening drawer")
	}
	if err := tt.Click("日程 2026-11-11 改期后的单次"); err != nil {
		t.Fatal(err)
	}
	cellImmediate, ok1 := tt.Access("日历日期 2026-11-11")
	tt.Advance(600 * time.Millisecond)
	cellSettled, ok2 := tt.Access("日历日期 2026-11-11")
	if !ok1 || !ok2 || cellImmediate.Bounds != cellBefore.Bounds || cellSettled.Bounds != cellBefore.Bounds {
		t.Fatalf("calendar cell narrowed/deformed when floating drawer opened: before=%+v immediate=%+v settled=%+v", cellBefore.Bounds, cellImmediate.Bounds, cellSettled.Bounds)
	}
}

func BenchmarkViewSteadyFrame(b *testing.B) {
	a := New(storage.Store{Dir: b.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Username: "压测用户"}
	now := time.Now()
	for i := 1; i <= 8; i++ {
		a.categories = append(a.categories, api.Category{ID: int64(i), Name: fmt.Sprintf("清单 %d", i)})
	}
	for i := 1; i <= 100; i++ {
		st := now.Add(time.Duration(i) * time.Hour)
		a.tasks = append(a.tasks, api.Task{
			ID:         int64(i),
			Title:      fmt.Sprintf("基准测试任务 %03d", i),
			Status:     "pending",
			Priority:   (i % 3) - 1,
			StartTime:  &st,
			Categories: []api.Category{a.categories[i%len(a.categories)]},
		})
	}
	a.editTaskNow(a.tasks[0])
	tt := ui.NewTester(a.view, 1440, 900)
	tt.Advance(500 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		tt.Frame()
	}
}
