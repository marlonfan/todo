package app

import (
	"github.com/egoist/mygo/ui"
	"testing"
	"time"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTaskPropertyPopoverFitsNarrowWindow(t *testing.T) {
	for _, size := range [][2]int{{900, 600}, {960, 648}, {1280, 800}} {
		a := New(storage.Store{Dir: t.TempDir()})
		a.client, _ = api.New(api.DefaultServer, "")
		a.editTaskNow(api.Task{ID: 1, Title: "检查日期弹层"})
		tt := ui.NewTester(a.view, size[0], size[1])
		for _, dark := range []bool{false, true} {
			tt.SetDark(dark)
			if err := tt.Click("编辑开始"); err != nil {
				t.Fatal(err)
			}
			panel, ok := tt.AccessByRole(ui.RolePopup, "属性选项")
			if !ok || panel.Bounds.Y < 0 || panel.Bounds.Y+panel.Bounds.H > float32(size[1]) || panel.Bounds.X < 0 || panel.Bounds.X+panel.Bounds.W > float32(size[0]) {
				t.Fatal("property panel outside window", size, panel)
			}
			if err := tt.Click("收起日期与时间"); err != nil {
				t.Fatal(err)
			}
		}
		a.Close()
	}
}

func TestTaskPropertyPopoverKeepsDraftAndDoesNotQueue(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.draft = draftFrom(api.Task{Title: "草稿"}, time.Now())
	tt := ui.NewTester(func(c *ui.Context) { a.taskMetadata(c, &a.draft) }, 800, 700)
	for _, label := range []string{"编辑优先级", "高"} {
		if err := tt.Click(label); err != nil {
			t.Fatal(err)
		}
	}
	if _, open := tt.AccessByRole(ui.RolePopup, "属性选项"); open || !tt.Focused("编辑优先级") {
		t.Fatal("choosing priority must close popup and restore its trigger")
	}
	if a.draft.Priority != "高" || a.taskMetaOpen != "" {
		t.Fatalf("draft priority/close lost: %s %s", a.draft.Priority, a.taskMetaOpen)
	}
	for _, label := range []string{"编辑开始", "明天", "收起日期与时间"} {
		if err := tt.Click(label); err != nil {
			t.Fatal(err)
		}
	}
	tomorrow := time.Now().In(a.location()).AddDate(0, 0, 1).Format("2006-01-02")
	if !a.draft.HasStart || a.draft.Start.Format("2006-01-02") != tomorrow {
		t.Fatal("tomorrow was not applied to draft")
	}
	if err := tt.Click("编辑开始"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("清除日期"); err != nil {
		t.Fatal(err)
	}
	if a.draft.HasStart {
		t.Fatal("clear did not remove start date")
	}
	if a.draft.Start.Format("2006-01-02") != tomorrow {
		t.Fatal("clear destroyed previous date input")
	}
	if len(a.cache.Outbox) != 0 {
		t.Fatal("property editing queued a task before save")
	}
}
