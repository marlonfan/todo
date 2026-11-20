package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func linearOccurrenceFixture(t *testing.T) (*App, api.Task) {
	t.Helper()
	a := New(storage.Store{Dir: t.TempDir()})
	t.Cleanup(a.Close)
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.Server = api.DefaultServer
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai"}
	start := time.Date(2026, 11, 12, 9, 0, 0, 0, a.location())
	end := start.Add(time.Hour)
	series := api.Task{ID: 7, Title: "系列标题", Description: "系列描述", Status: "pending", Revision: 9, StartTime: &start, EndTime: &end, RecurrenceRule: json.RawMessage(`{"freq":"daily"}`), Categories: []api.Category{{ID: 3, Name: "工作"}}}
	a.adoptCache(storage.Cache{Server: api.DefaultServer, UserID: 1, Tasks: []api.Task{series}, Categories: series.Categories})
	task := series
	task.Title, task.Description = "本次标题内容", strings.TrimRight("## 本次 Markdown\n\n"+strings.Repeat("本次说明段落。\n\n", 18), "\n")
	task.InstanceID, task.OccurrenceDate, task.Priority = "7_20261110", "2026-11-10", -1
	a.openTask(task)
	return a, task
}

func TestLinearOccurrenceReadFirstAndVerticalProperties(t *testing.T) {
	for _, width := range []int{900, 1280} {
		for _, dark := range []bool{false, true} {
			t.Run(fmt.Sprintf("width-%d/dark-%v", width, dark), func(t *testing.T) {
				a, task := linearOccurrenceFixture(t)
				a.descriptionPreview, a.taskTitleEditing = true, true
				tt := ui.NewTester(a.view, width, 800)
				tt.SetDark(dark)
				tt.Frame()

				for _, label := range []string{"完成本次", "跳过本次", "编辑本次开始", "编辑整个系列", "整个系列提醒与活动记录", "AI 生成描述", "关闭"} {
					if _, ok := tt.AccessByRole(ui.RoleButton, label); !ok {
						t.Fatalf("missing upfront occurrence action %q: %v", label, tt.Texts())
					}
				}
				if _, ok := tt.AccessByRole(ui.RoleTextField, "本次标题"); !ok {
					t.Fatal("missing 1-click instance title editor")
				}
				descField, ok := tt.AccessByRole(ui.RoleTextField, "本次描述")
				if !ok || !strings.Contains(descField.Value, "本次 Markdown") || strings.Contains(descField.Value, "## ") {
					t.Fatalf("instance WYSIWYG editor missing or leaked syntax: %+v", descField)
				}
				if _, ok := tt.AccessByRole(ui.RoleButton, "保存本次描述"); ok {
					t.Fatal("text edits must save automatically without a save-description action")
				}
				done, ok := tt.AccessByRole(ui.RoleCheckBox, "完成本次 "+task.Title)
				if !ok || done.Disabled {
					t.Fatal("missing completion control in fixed toolbar")
				}
				for _, node := range tt.AccessAll() {
					if node.Role == ui.RoleDialog && !node.Offscreen {
						t.Fatal("instance detail opened a modal", node.Name)
					}
				}
				for _, label := range []string{"编辑本次提醒", "编辑本次优先级"} {
					if _, ok := tt.AccessByRole(ui.RoleButton, label); ok {
						t.Fatalf("unsupported instance property %q", label)
					}
				}

				if err := tt.Click("本次描述"); err != nil {
					t.Fatal(err)
				}
				if err := tt.Click("本次标题"); err != nil {
					t.Fatal(err)
				}
				if a.taskDraftDirty() {
					t.Fatal("focusing title/description changed instance")
				}

				a.occurrenceEditing = true
				a.occurrenceDescription += "\n\n自动保存"
				tt.Frame()
				// Headless testers have no window timer; flush the same autosave path.
				if !a.flushDetailAutosave() || a.taskDraftDirty() || len(a.cache.Outbox) != 1 || a.selectedOccurrence.Description != a.occurrenceDescription {
					t.Fatal("description edit was not durably autosaved", a.autosave.failure)
				}
				if !a.descriptionPreview || !a.taskTitleEditing || a.cache.Tasks[0].Description != "系列描述" || task.InstanceID != a.selectedOccurrence.InstanceID || task.OccurrenceDate != a.selectedOccurrence.OccurrenceDate {
					t.Fatal("occurrence editor leaked normal state or changed series/scope")
				}
				if err := tt.Click("关闭"); err != nil || a.taskDiscardConfirm || a.selectedOccurrence != nil {
					t.Fatal("autosaved detail did not close cleanly", err)
				}
			})
		}
	}
}

func TestLinearOccurrenceReadOnlyActions(t *testing.T) {
	a, _ := linearOccurrenceFixture(t)
	a.selectedOccurrence.ReadOnly = true
	a.selectedOccurrence.Description = "只读实例描述"
	tt := ui.NewTester(a.view, 900, 700)
	for _, label := range []string{"整个系列提醒与活动记录", "编辑整个系列", "编辑本次开始"} {
		n, ok := tt.AccessByRole(ui.RoleButton, label)
		if !ok || !n.Disabled {
			t.Fatalf("read-only action enabled: %q %+v", label, n)
		}
	}
	for _, hidden := range []string{"完成本次", "跳过本次", "AI 生成描述"} {
		if _, ok := tt.AccessByRole(ui.RoleButton, hidden); ok {
			t.Fatalf("read-only instance exposed mutating button %q", hidden)
		}
	}
	if _, ok := tt.AccessByRole(ui.RoleTextField, "本次标题"); ok {
		t.Fatal("read-only instance exposed editable title TextField")
	}
	if desc, ok := tt.AccessByRole(ui.RoleTextField, "本次描述"); !ok || !desc.ReadOnly {
		t.Fatalf("read-only WYSIWYG description must stay ReadOnly: %+v", desc)
	}
	if done, ok := tt.AccessByRole(ui.RoleCheckBox, "完成本次 "+a.selectedOccurrence.Title); !ok || !done.Disabled {
		t.Fatal("read-only completion control enabled", done)
	}
	if _, ok := tt.AccessByRole(ui.RoleButton, "保存本次描述"); ok {
		t.Fatal("read-only detail exposes obsolete save-description action")
	}
}

func TestLinearOccurrenceSeriesAdvancedScopeAndState(t *testing.T) {
	a, task := linearOccurrenceFixture(t)
	a.selectedOccurrence.Description = "本次说明"
	a.occurrenceDescription = a.selectedOccurrence.Description
	tt := ui.NewTester(a.view, 1280, 900)
	if !tt.HasText("工作") {
		t.Fatal("inherited series category badge missing")
	}
	for _, label := range []string{"整个系列提醒与活动记录", "编辑整个系列"} {
		n, ok := tt.AccessByRole(ui.RoleButton, label)
		if !ok || n.Disabled {
			t.Fatalf("lost upfront series entry %q", label)
		}
	}
	if err := tt.Click("整个系列提醒与活动记录"); err != nil {
		t.Fatal(err)
	}
	if a.taskCenter == nil || a.taskCenter.Task.ID != task.ID || a.selectedOccurrence == nil || a.selectedOccurrence.InstanceID != task.InstanceID {
		t.Fatal("series reminder entry lost its task-ID callback or instance selection")
	}
	if err := tt.Click("关闭提醒与记录"); err != nil {
		t.Fatal(err)
	}
	a.editOccurrenceSchedule()
	tt.Frame()
	if _, ok := tt.AccessByRole(ui.RoleButton, "编辑整个系列"); !ok {
		t.Fatal("scheduling hid series action")
	}
	footer, _ := tt.Access("本次任务底部操作")
	if footer.Bounds.H != 48 {
		t.Fatal("schedule changed footer height", footer.Bounds)
	}
	if save, ok := tt.AccessByRole(ui.RoleButton, "保存本次时间"); !ok || !save.Disabled {
		t.Fatal("clean schedule must retain disabled save")
	}
	if a.selectedOccurrence.InstanceID != task.InstanceID || a.selectedOccurrence.OccurrenceDate != task.OccurrenceDate || len(a.cache.Outbox) != 0 {
		t.Fatal("layout transitions mutated scope or saved")
	}
}

func TestLinearOccurrenceInlineSectionsAndCompactToolbar(t *testing.T) {
	for _, width := range []int{700, 900, 1920} {
		t.Run(fmt.Sprint(width), func(t *testing.T) {
			a, _ := linearOccurrenceFixture(t)
			a.taskEditorInline, a.taskDetailOpen = true, true
			a.selectedOccurrence.Description = "## 本次说明\n\n保留实例操作"
			a.occurrenceDescription = a.selectedOccurrence.Description
			tt := ui.NewTester(a.view, width, 900)
			var lastContent, lastProperty ui.Rect
			wantTopHeight := float32(detailDragStripHeight)
			if width < 1050 {
				wantTopHeight = detailTopBarMinHeight
			}
			for frame := 0; frame < 5; frame++ {
				tt.Frame()
				if _, obsolete := tt.Access("本次任务工具栏"); obsolete {
					t.Fatal("obsolete fixed 50px occurrence toolbar should be removed")
				}
				content, ok := tt.Access("本次任务详情内容")
				if !ok || content.Bounds.Y != wantTopHeight {
					t.Fatalf("unexpected occurrence content top offset: got=%+v wantY=%.0f", content.Bounds, wantTopHeight)
				}
				main, ok := tt.Access("本次任务正文")
				if !ok || main.Bounds.X != content.Bounds.X+detailBodySidePadding || main.Bounds.W > 960 {
					t.Fatalf("detail should have one 20px inset and width <=960: %+v", main.Bounds)
				}
				title, ok := tt.AccessByRole(ui.RoleTextField, "本次标题")
				if !ok {
					t.Fatal("missing occurrence title editor")
				}
				property, ok := tt.AccessByRole(ui.RoleButton, "编辑本次开始")
				if !ok || property.Bounds.X < main.Bounds.X || property.Bounds.W > 480 {
					t.Fatalf("properties must be compact within main: %+v %+v", main.Bounds, property.Bounds)
				}
				if _, ok := tt.Access("本次任务属性栏"); ok {
					t.Fatal("obsolete property sidebar remains")
				}
				notes, ok := tt.AccessByRole(ui.RoleTextField, "本次描述")
				if !ok || property.Bounds.Y > notes.Bounds.Y {
					t.Fatalf("instance property chip should sit above WYSIWYG description: chip=%+v notes=%+v", property.Bounds, notes.Bounds)
				}
				footer, ok := tt.Access("本次任务底部操作")
				if !ok || footer.Bounds.H != 48 {
					t.Fatalf("footer must retain 48px height: %+v", footer)
				}
				if frame > 0 && (lastContent != content.Bounds || lastProperty != property.Bounds) {
					t.Fatal("responsive geometry oscillated between frames")
				}
				lastContent, lastProperty = content.Bounds, property.Bounds
				completion, ok := tt.AccessByRole(ui.RoleCheckBox, "完成本次 "+a.selectedOccurrence.Title)
				if !ok || completion.Disabled || completion.Bounds.X < main.Bounds.X || completion.Bounds.Y < title.Bounds.Y-4 || completion.Bounds.Y > title.Bounds.Y+detailTitleLineHeight {
					t.Fatalf("completion control must align with occurrence title first line: cb=%+v title=%+v", completion, title.Bounds)
				}
				for _, label := range []string{"编辑整个系列", "整个系列提醒与活动记录", "关闭"} {
					btn, ok := tt.AccessByRole(ui.RoleButton, label)
					if !ok || btn.Bounds.Y < title.Bounds.Y-2 || btn.Bounds.Y > title.Bounds.Y+6 {
						t.Fatalf("inline occurrence action %q must align with title first line: btn=%+v title=%+v", label, btn.Bounds, title.Bounds)
					}
				}
				back, compact := tt.AccessByRole(ui.RoleButton, "‹ 返回任务列表")
				if compact != (width < 1050) {
					t.Fatalf("unexpected compact Back at %d", width)
				}
				if compact && (back.Bounds.Y < 0 || back.Bounds.Y+back.Bounds.H > wantTopHeight) {
					t.Fatalf("Back is outside the compact top strip: back=%+v topH=%.0f", back.Bounds, wantTopHeight)
				}
			}
			if width < 1050 {
				a.occurrenceEditing = true
				a.occurrenceDescription += "未保存"
				// A local write failure keeps the draft available when Back hides the pane.
				a.cacheError = "模拟本机缓存写入失败"
				tt.Frame()
				if err := tt.Click("‹ 返回任务列表"); err != nil {
					t.Fatal(err)
				}
				if a.taskDetailOpen || a.selectedOccurrence == nil || !a.taskDraftDirty() || len(a.cache.Outbox) != 0 {
					t.Fatal("compact Back lost or saved the draft")
				}
			}
		})
	}
}

func TestSaveCurrentTaskDispatchAndGuards(t *testing.T) {
	for _, mode := range []string{"normal", "new", "schedule", "description"} {
		for _, guard := range []string{"clean", "busy", "ai", "readonly", "save"} {
			t.Run(mode+"/"+guard, func(t *testing.T) {
				a, _ := linearOccurrenceFixture(t)
				switch mode {
				case "new":
					a.clearTaskSelection()
					a.newTaskNow()
					if guard != "clean" {
						a.draft.Title = "新任务"
					}
				case "normal":
					a.clearTaskSelection()
					a.editTaskNow(a.tasks[0])
					if guard != "clean" {
						a.draft.Description += "修改"
					}
				case "schedule":
					a.editOccurrenceSchedule()
					if guard != "clean" {
						a.occurrenceSchedule.Start = a.occurrenceSchedule.Start.AddDate(0, 0, 1)
						a.occurrenceSchedule.HasEnd = false
					}
				case "description":
					a.occurrenceEditing = true
					if guard != "clean" {
						a.occurrenceTitle, a.occurrenceDescription = "", ""
					}
				}
				switch guard {
				case "busy":
					a.busy = true
				case "ai":
					a.aiPanel = &aiPanel{}
				case "readonly":
					if mode == "normal" || mode == "new" {
						a.draft.Task.ReadOnly = true
					} else {
						a.selectedOccurrence.ReadOnly = true
					}
				}
				// A cache error reports arrival at the save path synchronously,
				// without a native window or an asynchronous disk/network write.
				a.cacheError = "dispatch reached persistence"
				a.saveCurrentTask()
				errMessage := a.failure
				if mode == "normal" || mode == "description" {
					errMessage = a.autosave.failure
				}
				if (errMessage == a.cacheError) != (guard == "save") {
					t.Fatalf("wrong dispatch for %s/%s: failure=%q autosave=%q", mode, guard, a.failure, a.autosave.failure)
				}
				if len(a.cache.Outbox) != 0 {
					t.Fatal("blocked save queued mutation")
				}
			})
		}
	}
}

func TestSaveOccurrenceDescriptionPreservesScopeAndSeries(t *testing.T) {
	a, task := linearOccurrenceFixture(t)
	a.occurrenceEditing = true
	a.occurrenceTitle, a.occurrenceDescription = "", ""
	a.saveOccurrenceDescription()
	deadline := time.Now().Add(3 * time.Second)
	var saved storage.Cache
	for {
		state, err := a.store.Cache(api.DefaultServer, 1)
		if err == nil && len(state.Outbox) == 1 {
			saved = state
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("description save did not persist", err, a.failure)
		}
		time.Sleep(time.Millisecond)
	}
	op := saved.Outbox[0]
	var body map[string]string
	if err := json.Unmarshal(op.Body, &body); err != nil {
		t.Fatal(err)
	}
	if op.Method != "PUT" || op.TaskID != task.ID || op.Revision != task.Revision || len(body) != 4 || body["instance_id"] != task.InstanceID || body["occurrence_date"] != "2026-11-10" || body["title"] != "" || body["description"] != "" {
		t.Fatalf("wrong instance save: %+v %v", op, body)
	}
	if saved.Tasks[0].Title != "系列标题" || saved.Tasks[0].Description != "系列描述" {
		t.Fatal("instance edit overwrote series")
	}
}

func TestSaveOccurrenceDescriptionRejectsMissingScope(t *testing.T) {
	for _, missing := range []string{"instance_id", "occurrence_date"} {
		t.Run(missing, func(t *testing.T) {
			a, _ := linearOccurrenceFixture(t)
			a.occurrenceEditing = true
			a.occurrenceDescription += "修改"
			if missing == "instance_id" {
				a.selectedOccurrence.InstanceID = ""
			} else {
				a.selectedOccurrence.OccurrenceDate = ""
			}
			a.saveOccurrenceDescription()
			if a.autosave.failure == "" || a.busy || len(a.cache.Outbox) != 0 || !a.taskDraftDirty() {
				t.Fatal("unscoped save accepted or lost draft", a.autosave.failure)
			}
		})
	}
}
