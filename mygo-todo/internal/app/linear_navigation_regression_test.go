package app

import (
	"github.com/egoist/mygo/ui"
	"testing"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestCompactCurrentNavigationItemClosesDrawer(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "categories"
	tt := ui.NewTester(a.view, 1024, 800)
	if err := tt.Click("展开导航"); err != nil {
		t.Fatal(err)
	}
	if !a.sidebarOverlay {
		t.Fatal("drawer not opened")
	}
	if err := tt.Click("管理分类"); err != nil {
		t.Fatal(err)
	}
	if a.sidebarOverlay {
		t.Fatal("current navigation item trapped the drawer")
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "新建分类"); !ok {
		t.Fatal("content remained behind drawer")
	}
}

func TestCurrentListCountAndRowsTrackSearchAndHistoryCanContinue(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.tasks = []api.Task{{ID: 1, Title: "唯一匹配", Status: "pending"}, {ID: 2, Title: "不应出现的任务", Status: "pending"}}
	a.query = "唯一"
	tt := ui.NewTester(a.view, 1280, 800)
	if _, ok := tt.AccessByRole(ui.RoleText, "1 个任务"); !ok {
		t.Fatal("count did not follow current query")
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "不应出现的任务"); ok {
		t.Fatal("list did not follow query")
	}
	a.page = "completed"
	a.history.HasMore = true
	a.search.Open = true
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleButton, "加载更多重复任务历史"); !ok {
		t.Fatal("search prevented continuation of loaded history")
	}
	if _, ok := tt.AccessByRole(ui.RoleText, "筛选当前已加载记录；还有重复任务历史未加载。"); !ok {
		t.Fatal("search scope did not explain unloaded history")
	}
}

func TestCompactSyncStatusStaysQuietUntilAttentionIsNeeded(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.remotePulling = true
	tt := ui.NewTester(a.view, 1024, 800)
	if _, ok := tt.AccessByRole(ui.RoleText, "已同步"); ok {
		t.Fatal("successful sync occupied compact footer")
	}
	if _, ok := tt.AccessByRole(ui.RoleText, "正在同步…"); ok {
		t.Fatal("idle long polling appeared as permanent syncing")
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "刷新"); !ok {
		t.Fatal("refresh was lost with the quiet footer")
	}
	a.message = "连接中断；本地修改已保留，将自动重试"
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleText, "离线 · 自动重试中"); !ok {
		t.Fatal("offline status disappeared")
	}
	a.message = ""
	a.sidebarOverlay = true
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleText, "已同步"); !ok {
		t.Fatal("sidebar footer lost sync status")
	}
}
