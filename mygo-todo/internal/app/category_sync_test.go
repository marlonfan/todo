package app

import (
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func TestCategoryOfflineRestoreAliasAndNativeDiscardPreview(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	session := api.Session{Server: api.DefaultServer, Token: "cached", User: api.User{ID: 1, Timezone: "Asia/Shanghai"}}
	if err := store.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	state, err := syncer.QueueCategory(storage.Cache{Server: session.Server, UserID: 1}, "POST", api.Category{Name: "离线工作", Emoji: "📁", Color: "#3788d8"})
	if err != nil {
		t.Fatal(err)
	}
	state.CategoryOutbox[0].State = "rejected"
	state.CategoryOutbox[0].Failure = "服务端已存在同名分类，请更换名称后重试"
	if err := store.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	a := New(store)
	defer a.Close()
	if len(a.categories) != 1 || a.categories[0].ID >= 0 || a.pendingChanges() != 1 {
		t.Fatal(a.categories, a.pendingChanges())
	}
	a.logout()
	if a.client == nil || a.failure == "" {
		t.Fatal("logout lost category queue")
	}
	a.page, a.failure = "sync", ""
	for _, dark := range []bool{false, true} {
		tt := ui.NewTester(a.view, 900, 600)
		tt.SetDark(dark)
		tt.Advance(time.Second)
		if !tt.HasText("1 条本地修改") || tt.HasText("所有本地修改均已同步") || !tt.HasText("需要处理") {
			t.Fatal(tt.Texts())
		}
		tt.Scroll(500, 350, 0, 250)
		if err := tt.Click("放弃分类修改 离线工作"); err != nil {
			t.Fatal(err)
		}
		if a.discardCategoryID == nil || a.canApplyRemote() {
			t.Fatal("discard preview must pause remote commit")
		}
		for _, label := range []string{"保留分类修改", "确认放弃分类修改"} {
			node, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok || node.Offscreen || node.Bounds.Y+node.Bounds.H > 600 {
				t.Fatal(label, node)
			}
		}
		if err := tt.Click("保留分类修改"); err != nil {
			t.Fatal(err)
		}
		if a.discardCategoryID != nil || len(a.cache.CategoryOutbox) != 1 {
			t.Fatal("cancel lost intent")
		}
	}
	a.draft.Categories = map[int64]bool{-1: true}
	a.page = "category:-1"
	state.CategoryAliases = map[int64]int64{-1: 41}
	a.adoptCache(state)
	if a.page != "category:41" || !a.draft.Categories[41] || a.draft.Categories[-1] {
		t.Fatal("open selections did not adopt mapped ID", a.page, a.draft.Categories)
	}
}

func TestTaskEditorRemovedCategoryRequiresReviewWithoutLosingDraft(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.newTask()
	a.draft.Title = "保留任务草稿"
	a.draft.Description = "正在编辑中的描述"
	a.draft.Categories = map[int64]bool{17: true, -1: true}
	a.cache.CategoryAliases = map[int64]int64{-1: 41}
	a.categories = []api.Category{{ID: 41, Name: "保留分类"}}
	a.saveTask()
	if a.failure != "部分所选分类已被移除，已取消这些关联；请检查分类后再次保存任务。" || !a.editing || len(a.cache.Outbox) != 0 {
		t.Fatal(a.failure, a.editing, a.cache.Outbox)
	}
	if a.draft.Categories[17] || !a.draft.Categories[-1] || a.draft.Description != "正在编辑中的描述" {
		t.Fatal(a.draft)
	}
}
