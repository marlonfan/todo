package app

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func TestNativeSyncConflictComparisonAndLogoutGuard(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	session := api.Session{Server: api.DefaultServer, Token: "cached", User: api.User{ID: 1}}
	if err := s.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	state := storage.Cache{Server: session.Server, UserID: 1, Tasks: []api.Task{{ID: 1, Title: "原始内容", Status: "pending", Revision: 1}}}
	state, err := syncer.Enqueue(state, "PUT", "/tasks/1", map[string]string{"title": "我的离线修改"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	state.Outbox[0].State = "conflict"
	state.Outbox[0].Latest = &api.Task{ID: 1, Title: "其他客户端修改", Revision: 2}
	if err := s.SaveCache(state); err != nil {
		t.Fatal(err)
	}
	a := New(s)
	defer a.Close()
	a.page = "sync"
	tt := ui.NewTester(a.view, 1280, 800)
	for _, text := range []string{"最初读取", "原始内容", "本地修改", "我的离线修改", "服务器最新", "其他客户端修改", "用本地修改覆盖此版本"} {
		if !tt.HasText(text) {
			t.Errorf("missing conflict comparison %q", text)
		}
	}
	a.logout()
	if a.client == nil || a.failure == "" {
		t.Fatal("logout discarded pending changes")
	}
	if _, err := s.Session(); err != nil {
		t.Fatal("pending session removed")
	}
}

func TestSyncDiffFieldsExcludeMetadataAndRespectInstanceScope(t *testing.T) {
	start := time.Date(2026, 11, 10, 9, 0, 0, 0, time.UTC)
	base := api.Task{ID: 1, Title: "会议", Status: "pending", Revision: 1}
	local, latest := base, base
	local.Description, local.StartTime = "本地描述", &start
	latest.Title, latest.Revision, latest.UpdatedAt = "服务器标题", 2, start
	op := storage.Mutation{Base: base, Local: local, Latest: &latest}
	if got := syncChangedFields(op); !reflect.DeepEqual(got, []string{"标题", "描述", "开始时间"}) {
		t.Fatal("wrong conflict fields", got)
	}
	op.Body = []byte(`{"instance_id":"1_20261110","description":"仅本次"}`)
	if got := syncChangedFields(op); !reflect.DeepEqual(got, []string{"标题"}) {
		t.Fatal("instance intent was compared as a locally edited series", got)
	}
	op.Latest = nil
	if got := syncChangedFields(op); len(got) != 0 {
		t.Fatal(got)
	}
}

func TestNativeSyncCompactFullAndDiscardPreview(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "sync"
	base := api.Task{ID: 1, Title: "原始版本", Status: "pending", Description: strings.Repeat("长描述", 100)}
	local, latest := base, base
	local.Title, latest.Title = "本地版本", "服务器版本"
	a.cache.Outbox = []storage.Mutation{{ID: "conflict", TaskID: 1, Method: "PUT", State: "conflict", Base: base, Local: local, Latest: &latest}, {ID: "next", TaskID: 1, Method: "PATCH", State: "pending", Local: local}}
	for _, width := range []int{900, 1280} {
		tt := ui.NewTester(a.view, width, 800)
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			tt.Advance(time.Second)
			if !tt.HasText("2 条本地修改") || !tt.HasText("等待前序修改处理") || !tt.HasText("差异字段：标题") || tt.HasText(base.Description) {
				t.Fatal(tt.Texts())
			}
			if err := tt.Click("展开完整版本"); err != nil {
				t.Fatal(err)
			}
			if !tt.HasText(base.Description) || !tt.HasText("提醒：跟随账户") || !tt.HasText("分类：未设置") {
				t.Fatal(tt.Texts())
			}
			if err := tt.Click("收起完整版本"); err != nil {
				t.Fatal(err)
			}
		}
	}
	tt := ui.NewTester(a.view, 900, 600)
	// Scroll in the actual content area before using an offscreen control.
	tt.Scroll(700, 400, 0, 160)
	if err := tt.Click("放弃此任务全部待同步修改"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("将移除这项任务的 2 条待同步修改") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("保留本地修改"); err != nil {
		t.Fatal(err)
	}
	if a.discardSyncID != nil || len(a.cache.Outbox) != 2 {
		t.Fatal("cancel modified outbox")
	}
}

func TestNativeSyncInstanceResetPreviewDoesNotInventLocalSeries(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "sync"
	base := api.Task{ID: 1, Title: "每日会议", Status: "pending"}
	latest := base
	latest.Title = "其他客户端的系列标题"
	a.cache.Outbox = []storage.Mutation{{ID: "instance", TaskID: 1, Method: "PATCH", Suffix: "/occurrences/schedule", State: "conflict", Base: base, Local: base, Latest: &latest, Body: []byte(`{"instance_id":"1_20261110","occurrence_date":"2026-11-10","reset_schedule":true}`)}}
	tt := ui.NewTester(a.view, 900, 800)
	if !tt.HasText("恢复本次的系列时间") || !tt.HasText("仅 2026-11-10 本次") || slices.Contains(tt.Texts(), "本地修改") || strings.Contains(strings.Join(tt.Texts(), " "), "0001-01-01") {
		t.Fatal(tt.Texts())
	}
}

func TestNativeSyncAuthenticationRecoveryIsVisibleBeforeQueue(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page = "sync"
	for i := 0; i < 12; i++ {
		a.cache.Outbox = append(a.cache.Outbox, storage.Mutation{ID: fmt.Sprint(i), State: "pending", Local: api.Task{Title: "离线任务"}})
	}
	tt := ui.NewTester(a.view, 900, 600)
	if _, ok := tt.AccessByRole(ui.RoleTextField, "当前账户密码"); ok {
		t.Fatal("healthy sync view exposed a reauthentication form")
	}
	a.setSyncFailure(&api.Error{Status: 401})
	tt = ui.NewTester(a.view, 900, 600)
	n, ok := tt.AccessByRole(ui.RoleTextField, "当前账户密码")
	if !ok || n.Offscreen || !a.reauthRequired || !strings.Contains(a.message, "重新验证") || len(a.cache.Outbox) != 12 {
		t.Fatal(n, a.message)
	}
	a.setSyncFailure(errors.New("offline"))
	if a.reauthRequired || !strings.Contains(a.message, "连接中断") {
		t.Fatal(a.message)
	}
	tt = ui.NewTester(a.view, 900, 600)
	if _, ok := tt.AccessByRole(ui.RoleTextField, "当前账户密码"); ok {
		t.Fatal("offline sync view exposed an unnecessary password form")
	}
}

func TestUnreadableCacheCannotBeOverwrittenOrRemoved(t *testing.T) {
	s := storage.Store{Dir: t.TempDir()}
	if err := s.SaveSession(api.Session{Server: api.DefaultServer, Token: "cached", User: api.User{ID: 1}}); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(s.Dir, "cache.json")
	broken := []byte(`{"outbox":[`)
	if err := os.WriteFile(path, broken, 0600); err != nil {
		t.Fatal(err)
	}
	a := New(s)
	defer a.Close()
	a.refresh()
	a.queueTask("POST", "/tasks", map[string]string{"title": "不能覆盖"}, 0, nil)
	a.logout()
	got, err := os.ReadFile(path)
	if err != nil || string(got) != string(broken) || a.client == nil || a.cacheError == "" || a.busy {
		t.Fatal("unreadable outbox was overwritten or removed")
	}
}
