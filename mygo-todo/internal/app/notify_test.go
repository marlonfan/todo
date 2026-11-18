package app

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestNotifyDraftValidationAndConfigIsolation(t *testing.T) {
	d := newNotifyDraft()
	d.URL = "https://notify.example.test/hook"
	d.BotToken = "unrelated-secret"
	p, err := d.payload()
	if err != nil || p.Channel != "webhook" || p.Config["method"] != "POST" || len(p.Config) != 2 {
		t.Fatal(p, err)
	}
	for _, raw := range []string{"", "ftp://example.test", "https://u:p@example.test", "https://example.test/#secret"} {
		d.URL = raw
		if _, err := d.payload(); err == nil {
			t.Fatal("invalid URL accepted", raw)
		}
	}
	d.Channel = "ntfy"
	d.Topic = "fixture"
	d.Token = "private-ntfy-token"
	p, err = d.payload()
	if err != nil || p.Config["token"] != d.Token || p.Config["url"] != "" || p.Config["bot_token"] != "" {
		t.Fatal(p, err)
	}
	d.Priority = "6"
	if _, err := d.payload(); err == nil {
		t.Fatal("invalid priority accepted")
	}
	d.Channel = "Telegram"
	if _, err := d.payload(); err == nil {
		t.Fatal("missing chat ID accepted")
	}
	d.ChatID = "-10042"
	p, err = d.payload()
	if err != nil || p.Config["bot_token"] != d.BotToken || p.Config["token"] != "" || len(p.Config) != 2 {
		t.Fatal(p, err)
	}
}

func TestManualReminderRequestAndStableRetryIdentity(t *testing.T) {
	now := time.Now()
	p := taskCenter{At: now.Add(time.Hour), Delivery: "使用默认渠道"}
	body, err := p.request(now, nil)
	if err != nil || body.Channel != "" || body.Config != nil {
		t.Fatal(body, err)
	}
	id, err := p.operation(body)
	if err != nil || id == "" {
		t.Fatal(id, err)
	}
	repeated, _ := p.operation(body)
	if repeated != id {
		t.Fatal("uncertain retry changed operation identity")
	}
	body.NotifyAt = body.NotifyAt.Add(time.Minute)
	changed, _ := p.operation(body)
	if changed == id {
		t.Fatal("different reminder reused receipt identity")
	}
	p.At = now
	if _, err := p.request(now, nil); err == nil {
		t.Fatal("past time accepted")
	}
	p.At = now.Add(time.Hour)
	p.Delivery, p.Config = "指定配置", newNotifyDraft()
	p.Config.URL = "https://notify.example.test/custom"
	if _, err := p.request(now, []string{"telegram"}); err == nil {
		t.Fatal("server-disabled channel accepted")
	}
	body, err = p.request(now, []string{"webhook"})
	if err != nil || body.Channel != "webhook" {
		t.Fatal(body, err)
	}
	p.EditID = 2
	body, err = p.request(now, nil)
	if err != nil || body.Config != nil || body.Channel != "" {
		t.Fatal("time edit replaced delivery snapshot", body, err)
	}
}

func TestNativeNotifyEditorWipesSecretsAndTaskPanelPreservesDraft(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page, a.notifyLoaded, a.notifyChannels = "notify", true, []string{"webhook", "ntfy", "telegram"}
	tt := ui.NewTester(a.view, 900, 760)
	if err := tt.Click("添加通知渠道"); err != nil {
		t.Fatal(err)
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "Webhook 地址"); !ok {
		t.Fatal("missing native webhook input")
	}
	a.notifyDraft.BotToken = "do-not-retain"
	if err := tt.Click("取消渠道编辑"); err != nil {
		t.Fatal(err)
	}
	if a.notifyDraft.BotToken != "" || a.notifyEditing {
		t.Fatal("cancel retained credentials")
	}
	a.notifyEditing = true
	a.notifyDraft = newNotifyDraft()
	a.notifyDraft.Channel = "Telegram"
	tt.Frame()
	secret, ok := tt.AccessByRole(ui.RoleTextField, "Telegram Bot Token")
	if !ok || !secret.Password {
		t.Fatal("bot token must be a native password field")
	}
	a.notifyEditing = false
	a.page = "all"
	task := api.Task{ID: 4, Title: "已保存标题", Status: "pending"}
	a.adoptCache(storage.Cache{Tasks: []api.Task{task}})
	a.editTask(task)
	a.draft.Title = "尚未保存的标题"
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleButton, "提醒与活动记录"); !ok {
		t.Fatal("activity button should be directly reachable in detail toolbar")
	}
	if err := tt.Click("提醒与活动记录"); err != nil {
		t.Fatal(err)
	}
	if a.taskCenter == nil || a.taskCenter.Task.ID != 4 || !a.editing {
		t.Fatal("task panel replaced editor")
	}
	a.taskCenter.Loaded = true
	tt.Frame()
	if err := tt.Click("添加手动提醒"); err != nil {
		t.Fatal(err)
	}
	if !a.taskCenter.Editing {
		t.Fatal("missing reminder form")
	}
	if err := tt.Click("取消提醒编辑"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("关闭提醒与记录"); err != nil {
		t.Fatal(err)
	}
	if !a.editing || a.draft.Title != "尚未保存的标题" {
		t.Fatal("task draft lost")
	}
}

func TestActivityFormattingUsesAccountTimezoneAndReadableValues(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.session.User.Timezone = "Asia/Shanghai"
	a.categories = []api.Category{{ID: 2, Name: "工作"}}
	for _, tc := range []struct{ field, raw, want string }{
		{"start_time", `"2026-11-09T01:00:00Z"`, "2026-11-09 09:00:00"},
		{"status", `"completed"`, "已完成"},
		{"all_day", `true`, "是"},
		{"category_ids", `[2,3]`, "工作、#3"},
		{"description", `""`, "空"},
		{"end_time", `null`, "未设置"},
	} {
		if got := a.activityValue(tc.field, json.RawMessage(tc.raw)); got != tc.want {
			t.Fatalf("%s: %s != %s", tc.field, got, tc.want)
		}
	}
	got := a.activityValue("recurrence_rule", json.RawMessage(`{"freq":"monthly","interval":2,"byday":["2MO"],"count":6}`))
	if !strings.Contains(got, "第2个周一") || !strings.Contains(got, "共 6 次") {
		t.Fatal(got)
	}
}

func TestNativeNotifyResultsBelongToEachChannelAndChangedConfigIsUntested(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.page, a.notifyLoaded, a.notifyChannels = "notify", true, []string{"webhook"}
	a.notifySettings = []api.NotifySetting{{ID: 1, Channel: "webhook", Configured: true, IsDefault: true}, {ID: 2, Channel: "ntfy", Configured: true}}
	a.notifyTestResults = map[int64]notifyTestResult{1: {At: time.Now()}, 2: {At: time.Now(), Failure: "请求失败（503）：接收服务不可用"}}
	tt := ui.NewTester(a.view, 900, 760)
	for _, label := range []string{"2 个通知渠道", "渠道 #1测试成功", "渠道 #2测试失败", "服务端未启用"} {
		if !tt.HasText(label) {
			t.Fatal("missing channel state", label, tt.Texts())
		}
	}
	n, ok := tt.AccessByRole(ui.RoleButton, "测试渠道 #2")
	if !ok || !n.Disabled {
		t.Fatal("disabled server plugin was testable", n)
	}
	if err := tt.Click("添加通知渠道"); err != nil {
		t.Fatal(err)
	}
	a.notifyDraft.URL = "https://notify.example.test/old"
	a.notifyDraftResult = &notifyTestResult{At: time.Now()}
	tt.Frame()
	if !tt.HasText("配置测试成功") {
		t.Fatal(tt.Texts())
	}
	if err := tt.Click("Webhook 地址"); err != nil {
		t.Fatal(err)
	}
	tt.Type("/changed")
	if a.notifyDraftResult != nil || tt.HasText("配置测试成功") {
		t.Fatal("old success survived a changed configuration")
	}
	if err := tt.Click("取消渠道编辑"); err != nil {
		t.Fatal(err)
	}
	if a.notifyDraft.URL != "" || len(a.notifyTestResults) != 2 {
		t.Fatal("draft cleanup affected saved channel results")
	}
}

func TestNativeNotificationEditorsKeepActionsVisibleAtMinimumSize(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.notifyChannels = []string{"webhook", "ntfy", "telegram"}
	a.notifyEditing, a.notifyDraft = true, newNotifyDraft()
	a.notifyDraft.Channel = "ntfy"
	a.failure = strings.Repeat("服务端拒绝了此修改。", 100)
	a.notifyDraftResult = &notifyTestResult{At: time.Now(), Failure: strings.Repeat("接收服务暂时不可用。", 100)}
	assertActions := func(tt *ui.Tester, labels ...string) {
		t.Helper()
		for _, label := range labels {
			n, ok := tt.AccessByRole(ui.RoleButton, label)
			if !ok || n.Offscreen || n.Bounds.Y < 0 || n.Bounds.Y+n.Bounds.H > 600 || n.Bounds.X+n.Bounds.W > 900 {
				t.Fatal("notification action outside minimum window", label, n)
			}
		}
	}
	tt := ui.NewTester(a.view, 900, 600)
	for _, dark := range []bool{false, true} {
		tt.SetDark(dark)
		tt.Advance(time.Second)
		assertActions(tt, "测试填写的配置", "取消渠道编辑", "保存通知渠道")
	}
	a.notifyEditing = false
	a.taskCenter = &taskCenter{Task: api.Task{ID: 1, Title: "每日会议", RecurrenceRule: []byte(`{"freq":"daily"}`)}, Loaded: true, Editing: true, Config: newNotifyDraft(), Delivery: "指定配置", At: time.Now().Add(time.Hour)}
	a.taskCenter.Config.Channel = "ntfy"
	tt.Frame()
	assertActions(tt, "保存手动提醒", "取消提醒编辑", "关闭提醒与记录")
	if err := tt.Click("取消提醒编辑"); err != nil {
		t.Fatal(err)
	}
	if a.taskCenter.Editing || a.taskCenter.Config.Channel != "" {
		t.Fatal("cancel retained reminder configuration")
	}
}
