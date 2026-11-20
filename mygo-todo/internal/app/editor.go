package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/feedback"
	"github.com/lobehub/lobe-mygo/pkg/layout"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/overlay"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

type Draft struct {
	Task                                                                   api.Task
	Title, Description, Priority, Status, Repeat, OriginalRepeat, Reminder string
	Start, End, Due, RepeatEnd                                             time.Time
	HasStart, HasEnd, HasDue, HasRepeatEnd, AllDay                         bool
	ReminderMinutes                                                        string
	Categories                                                             map[int64]bool
	Rule                                                                   RecurrenceDraft
}

var frequencies = map[string]string{"每天": "daily", "每周": "weekly", "每月": "monthly", "每年": "yearly", "农历每年": "lunar_yearly"}

func draftFrom(task api.Task, now time.Time) Draft {
	d := Draft{Task: task, Title: task.Title, Description: task.Description, Priority: "普通", Status: "待办", Repeat: "不重复", Reminder: "跟随账户", ReminderMinutes: "15", Start: now, End: now.Add(time.Hour), Due: now, RepeatEnd: now.AddDate(1, 0, 0), AllDay: task.AllDay, Categories: map[int64]bool{}}
	if task.Priority > 0 {
		d.Priority = "高"
	}
	if task.Priority < 0 {
		d.Priority = "低"
	}
	if task.Status == "completed" {
		d.Status = "已完成"
	}
	if task.Status == "cancelled" {
		d.Status = "已取消"
	}
	if task.Status == "skipped" {
		d.Status = "已跳过"
	}
	if task.StartTime != nil {
		d.HasStart = true
		d.Start = task.StartTime.In(now.Location())
		d.End = d.Start.Add(time.Hour)
	}
	if task.EndTime != nil {
		d.HasEnd = true
		d.End = task.EndTime.In(now.Location())
	}
	if task.DueDate != nil {
		d.HasDue = true
		d.Due = task.DueDate.In(now.Location())
	}
	if task.RecurrenceEndDate != nil {
		d.HasRepeatEnd = true
		d.RepeatEnd = task.RecurrenceEndDate.In(now.Location())
	}
	if task.ReminderPolicy == "none" {
		d.Reminder = "不提醒"
	}
	if task.ReminderPolicy == "offset" {
		d.Reminder = "提前提醒"
	}
	if task.ReminderMinutesBefore != nil {
		d.ReminderMinutes = fmt.Sprint(*task.ReminderMinutesBefore)
	}
	if task.Recurring() {
		d.Repeat = "保留原有重复规则"
	}
	d.OriginalRepeat = d.Repeat
	d.Rule = recurrenceDraft(task.RecurrenceRule)
	for _, cat := range task.Categories {
		d.Categories[cat.ID] = true
	}
	return d
}

func (a *App) newTask() {
	a.requestTaskTransition(a.newTaskNow)
}

func (a *App) newTaskNow() {
	if a.aiPanel != nil {
		return
	}
	a.quick.Open = false
	a.quick.Meta = ""
	a.selectedOccurrence, a.occurrenceSchedule, a.occurrenceScheduleBase = nil, nil, nil
	a.occurrenceEditing = false
	now := time.Now().In(a.location())
	a.draft = draftFrom(api.Task{}, atClock(now, a.session.User.DefaultTaskStartTime))
	a.editing = true
	a.selectedTaskID = 0
	a.taskEditorInline = isTaskWorkspacePage(a.page)
	a.taskDetailOpen = a.taskEditorInline
	a.descriptionPreview = false
	a.taskDraftOrphaned = false
	a.taskTitleEditing = true
	a.taskActivityOpen = false
	a.taskAdvancedOpen = false
	a.taskMetaOpen = ""
	a.failure = ""
	if a.page == "today" || a.page == "calendar" {
		a.draft.HasStart = true
		if a.page == "calendar" {
			a.draft.Start = atClock(a.selectedDay, a.session.User.DefaultTaskStartTime)
		}
	}
	a.draft.End = a.draft.Start.Add(time.Hour)
	for _, cat := range a.categories {
		if a.page == fmt.Sprintf("category:%d", cat.ID) {
			a.draft.Categories[cat.ID] = true
		}
	}
	a.rememberTaskDraft()
}

func (a *App) editTask(task api.Task) {
	a.requestTaskTransition(func() { a.editTaskNow(task) })
}

func (a *App) editTaskNow(task api.Task) {
	if a.aiPanel != nil {
		return
	}
	a.quick.Open = false
	a.quick.Meta = ""
	a.selectedOccurrence, a.occurrenceSchedule, a.occurrenceScheduleBase = nil, nil, nil
	a.occurrenceEditing = false
	a.draft = draftFrom(task, time.Now().In(a.location()).Truncate(time.Minute))
	a.editing = true
	a.selectedTaskID = task.ID
	a.taskEditorInline = isTaskWorkspacePage(a.page)
	a.taskDetailOpen = a.taskEditorInline
	a.descriptionPreview = false
	a.taskDraftOrphaned = false
	a.taskTitleEditing = false
	a.taskActivityOpen = false
	a.taskAdvancedOpen = false
	a.taskMetaOpen = ""
	a.failure = ""
	a.rememberTaskDraft()
}

func (d Draft) payload() (map[string]any, error) {
	title := strings.TrimSpace(d.Title)
	if title == "" || utf8.RuneCountInString(title) > 200 {
		return nil, errors.New("任务标题应为 1–200 个字符")
	}
	if d.HasEnd && (!d.HasStart || !d.End.After(d.Start)) {
		return nil, errors.New("结束时间应晚于开始时间")
	}
	if d.Repeat != "不重复" && !d.HasStart {
		return nil, errors.New("重复任务需要设置开始时间")
	}
	p := map[string]any{"title": title, "description": d.Description, "priority": 0, "all_day": d.AllDay, "category_ids": []int64{}, "start_time": nil, "end_time": nil, "due_date": nil, "recurrence_rule": nil, "recurrence_end_date": nil, "reminder_policy": "inherit", "reminder_minutes_before": nil}
	if d.Priority == "高" {
		p["priority"] = 1
	}
	if d.Priority == "低" {
		p["priority"] = -1
	}
	if d.HasStart {
		p["start_time"] = d.Start
	}
	if d.HasEnd {
		p["end_time"] = d.End
	}
	if d.HasDue {
		p["due_date"] = d.Due
	}
	if d.HasRepeatEnd && d.Repeat != "不重复" {
		if dayStart(d.RepeatEnd).Before(dayStart(d.Start)) {
			return nil, errors.New("重复结束日期不能早于开始日期")
		}
		end := d.RepeatEnd
		if d.Repeat != "保留原有重复规则" {
			end = dayStart(end).AddDate(0, 0, 1).Add(-time.Second)
		}
		p["recurrence_end_date"] = end
	}
	if d.Repeat == "保留原有重复规则" {
		p["recurrence_rule"] = json.RawMessage(d.Task.RecurrenceRule)
	} else if d.Repeat != "不重复" {
		rule, err := d.Rule.rule(d.Repeat)
		if err != nil {
			return nil, err
		}
		p["recurrence_rule"] = rule
	}
	ids := []int64{}
	for id, checked := range d.Categories {
		if checked {
			ids = append(ids, id)
		}
	}
	p["category_ids"] = ids
	if d.Reminder == "不提醒" {
		p["reminder_policy"] = "none"
	}
	if d.Reminder == "提前提醒" {
		n, err := strconv.Atoi(strings.TrimSpace(d.ReminderMinutes))
		if err != nil || n < 0 || n > 10080 {
			return nil, errors.New("提醒时间应为 0–10080 分钟")
		}
		p["reminder_policy"], p["reminder_minutes_before"] = "offset", n
	}
	if d.Task.ID != 0 {
		p["status"] = map[string]string{"待办": "pending", "已完成": "completed", "已取消": "cancelled", "已跳过": "skipped"}[d.Status]
	}
	return p, nil
}

func (a *App) saveDeletedDraftAsNew() {
	if !a.taskDraftOrphaned || a.busy || a.draft.Task.ReadOnly {
		return
	}
	a.draft.Task.ID, a.draft.Task.Revision = 0, 0
	a.draft.Task.InstanceID, a.draft.Task.OccurrenceDate = "", ""
	a.draft.Status = "待办"
	a.selectedTaskID = 0
	a.taskDraftOrphaned = false
	a.failure = ""
	a.saveTask()
}

func (a *App) saveTask() {
	if a.draft.Task.ID != 0 {
		a.flushDetailAutosave()
		return
	}
	if a.taskDraftOrphaned {
		a.failure = "原任务已被删除，草稿仍保留；请另存为新任务。"
		return
	}
	if a.busy || a.draft.Task.ReadOnly {
		return
	}
	a.applySmartTitleToDraft(&a.draft)
	body, err := a.draft.payload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	if a.pruneMissingDraftCategories(&a.draft) {
		a.failure = "部分所选分类已被移除，已取消这些关联；请检查分类后再次保存任务。"
		return
	}
	method, path := "POST", "/tasks"
	if a.draft.Task.ID != 0 {
		method, path = "PUT", fmt.Sprintf("/tasks/%d", a.draft.Task.ID)
	}
	a.mutate(method, path, body, a.draft.Task.Revision, func() {
		if !a.taskEditorInline {
			a.clearTaskSelection()
			return
		}
		id := a.draft.Task.ID
		if method == "POST" {
			id = a.revealTaskID
		}
		for _, task := range a.tasks {
			if task.ID == id {
				a.editTaskNow(task)
				return
			}
		}
	})
}

func (a *App) editorView(c *ui.Context) {
	// Task details are rendered inline by detailWorkspace.
}

func (a *App) taskEditorContent(c *ui.Context, compact ...bool) {
	d := &a.draft
	t := tokensOf(c)

	// Compact Top Action Bar (checkbox moved beside the title for close visual association)
	ui.Row(c.Key("detail-toolbar")).Height(40).Shrink(0).Padding(0, 14, 0, 16).Gap(6).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle.Alpha(0.65)).AlignItems(ui.Center).Children(func() {
		if len(compact) > 0 && compact[0] {
			iconButton(c, "‹ 返回任务列表", lucide.ArrowLeft()).OnClick(func() { a.taskDetailOpen = false })
			iconButton(c, "刷新", lucide.RefreshCw()).Disabled(a.busy || a.syncing).OnClick(a.refreshCurrentPage)
		}
		if d.Task.Recurring() {
			appBadge(c, "重复系列").TextColor(t.Accent).Background(t.Accent.Alpha(0.10))
		} else if d.Task.ID == 0 {
			appBadge(c, "新建任务")
		} else if d.Task.ReadOnly {
			appBadge(c, "外部只读")
		}
		ui.Spacer(c)
		if !d.Task.ReadOnly && d.Task.ID != 0 {
			detailTransientStatus(c, a.detailSaveLabel(), a.failure != "" || a.autosave.failure != "")
		}
		if d.Task.ID != 0 {
			iconButton(c, "提醒与活动记录", lucide.BellRing()).Disabled(a.busy).OnClick(func() { a.openTaskCenter(d.Task) })
		}
		moreHolder := ui.Box(c.Key("detail-more-holder")).Size(0, 0)
		moreOpen := ui.Local(moreHolder, "open", func() bool { return false })
		var moreItems []overlay.MenuItem
		if !d.Task.ReadOnly {
			moreItems = append(moreItems, overlay.MenuItem{Key: "ai", Label: "AI 生成描述", Icon: lucide.Sparkles(), Disabled: a.busy})
		}
		if d.Task.ID != 0 {
			moreItems = append(moreItems, overlay.MenuItem{Key: "activity", Label: "提醒与活动记录", Icon: lucide.History(), Disabled: a.busy})
		}
		if d.Task.ID > 0 && !d.Task.ReadOnly {
			if len(moreItems) > 0 {
				moreItems = append(moreItems, overlay.MenuItem{Divider: true})
			}
			moreItems = append(moreItems, overlay.MenuItem{Key: "delete", Label: "删除任务…", Icon: lucide.Trash2(), Danger: true})
		}
		if len(moreItems) > 0 {
			choice := appDropdown(c, moreOpen, moreItems, func(trigger ui.Element) {
				styleAppButton(c, trigger, "", "ghost").Label("更多任务选项").Tooltip("更多选项").Size(30, 30).Padding(7).Children(func() {
					ui.Icon(c, lucide.Ellipsis()).Size(15, 15).TextColor(t.TextSecondary).AccessHidden(true)
				})
			})
			switch choice {
			case "ai":
				a.openDescriptionAI(false)
			case "activity":
				a.openTaskCenter(d.Task)
			case "delete":
				task := d.Task
				a.deleteTask = &task
			}
		}
		iconButton(c, "关闭", lucide.X()).Disabled(a.busy).OnClick(func() { a.requestTaskTransition(func() {}) })
	})

	// Main Detail Workspace: Checkbox+Title + Ghost Property Bar + Full-Height WYSIWYG Markdown
	body := ui.Column(c.Key("task-editor-content")).Label("任务详情内容").Padding(18, 20, 14, 20).Gap(10).MinWidth(0).Grow(1).Basis(0).MinHeight(0).Clip()
	if a.taskMetaOpen == "" {
		body.OnShortcut(0, ui.KeyEscape, func() { a.requestTaskTransition(func() {}) })
	}
	if d.Task.ID == 0 {
		body.OnShortcut(ui.Cmd, ui.KeyEnter, a.saveTask)
	}

	body.Children(func() {
		titleFocused := ui.Local(body, "title-focused", func() bool { return false })
		titleEdited := ui.Local(body, "title-edited", func() bool { return false })
		ui.Column(c.Key("detail-main")).Fill().Gap(10).MinWidth(0).MinHeight(0).Clip().Children(func() {
			// 1. Completion Checkbox + Direct 1-click editable 23px Title
			ui.Row(c.Key("task-heading")).Shrink(0).MinWidth(0).Gap(8).AlignItems(ui.Start).Children(func() {
				if d.Task.ID != 0 {
					done := d.Status == "已完成"
					detailCompleteCheckbox(c, &done, "完成任务 "+d.Title, d.Priority,
						d.Task.ReadOnly || a.taskDraftOrphaned || d.Task.Recurring(),
						func() {
							status := "pending"
							if done {
								status = "completed"
							}
							a.setTaskStatus(d.Task, status)
						})
				}
				var titleEsc func()
				if !isTaskWorkspacePage(a.page) {
					titleEsc = func() {
						a.taskTitleEditing = false
						*titleEdited = false
						a.applySmartTitleToDraft(d)
						a.requestTaskTransition(func() {})
					}
				}
				detailTitle(c, "task-title", "任务标题", "输入任务标题…", &d.Title, d.Task.ID == 0 && a.taskTitleEditing, d.Task.ReadOnly, &a.taskTitleInput,
					func() {
						a.taskTitleEditing = false
						*titleEdited = true
					},
					func() {
						a.taskTitleEditing = false
						*titleEdited = false
						a.applySmartTitleToDraft(d)
						a.taskDescriptionInput.Focus()
					},
					titleEsc)
			})
			nowFocused := a.taskTitleInput.Focused(c)
			if *titleFocused && !nowFocused && *titleEdited {
				*titleEdited = false
				a.applySmartTitleToDraft(d)
			}
			*titleFocused = nowFocused

			// 2. Always-visible Ghost Property Strip (responsive 1-row or balanced 2-row in narrow drawers)
			ui.Column(c.Key("detail-properties")).Shrink(0).MinWidth(0).Disabled(d.Task.ReadOnly).Children(func() {
				a.taskMetadata(c, d)
			})

			ui.Box(c).Height(1).Shrink(0).FillWidth().Background(t.BorderSubtle.Alpha(0.75))

			// 3. Full-height True WYSIWYG Markdown Description Editor
			a.wysiwygMarkdownEditor(c, "task-description", fmt.Sprintf("task:%d", d.Task.ID), "备注", "输入任务描述，支持 # 标题、- [ ] 待办、**加粗**、代码块…", &d.Description, d.Task.ReadOnly, &a.taskDescriptionInput, nil, func() {
				a.openDescriptionAI(false)
			})
		})
	})

	if a.failure != "" {
		ui.Scroll(c.Key("editor-error")).Shrink(0).MaxHeight(84).Padding(6, 20).Children(func() {
			feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error})
		})
	}
	// Render the bottom action bar only when an explicit user action is required
	// (creating a new task, recovering an orphaned draft, or retrying a failed save).
	// Clean synced tasks reclaim this 48px for the editor canvas.
	needsFooterAction := !d.Task.ReadOnly && (d.Task.ID == 0 || a.taskDraftOrphaned || a.failure != "" || a.autosave.failure != "")
	if needsFooterAction {
		ui.Row(c.Key("task-save-bar")).Label("任务底部操作").Height(44).Shrink(0).Padding(0, 20).Gap(8).AlignItems(ui.Center).BorderWidth(1, 0, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
			saveLabel := a.detailSaveLabel()
			dot := t.Accent
			if strings.Contains(saveLabel, "失败") || a.autosave.failure != "" {
				dot = t.Danger
			}
			ui.Box(c).Size(6, 6).Radius(3).Background(dot).Shrink(0).AccessHidden(true)
			ui.Text(c, saveLabel).FontSize(fontAux).TextColor(t.TextSecondary).Grow(1).MinWidth(0).SingleLine()
			if a.taskDraftOrphaned {
				appButton(c, "另存为新任务", "secondary").Height(30).Disabled(a.busy).OnClick(a.saveDeletedDraftAsNew)
			} else if d.Task.ID == 0 {
				primaryButton(c, "创建任务", theme.Small).Height(30).Disabled(a.busy).Tooltip("创建任务 · ⌘S / ⌘Enter").OnClick(a.saveTask)
			} else if a.failure != "" || a.autosave.failure != "" {
				appActionButton(c, "重试保存", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Disabled(a.busy).OnClick(a.retryDetailAutosave)
			}
		})
	}
}

func draftDateSummary(enabled bool, date time.Time, allDay bool) string {
	if !enabled {
		return "未设置"
	}
	if allDay {
		return date.Format("2006年01月02日")
	}
	return date.Format("2006年01月02日 15:04")
}

func draftScheduleChipText(d *Draft, now time.Time) string {
	if !d.HasStart {
		return "日期"
	}
	sameYear := d.Start.Year() == now.Year()
	dayFmt := "01月02日"
	if !sameYear {
		dayFmt = "2006/01/02"
	}
	dayPrefix := d.Start.Format(dayFmt)
	today := dayStart(now)
	switch dayStart(d.Start) {
	case today:
		dayPrefix = "今天"
	case today.AddDate(0, 0, 1):
		dayPrefix = "明天"
	}
	if d.AllDay {
		if d.HasEnd && dayStart(d.End).After(dayStart(d.Start).AddDate(0, 0, 1)) {
			return dayPrefix + " – " + d.End.AddDate(0, 0, -1).Format("01/02")
		}
		return dayPrefix + " 全天"
	}
	startClock := d.Start.Format("15:04")
	if d.HasEnd {
		if dayStart(d.End).Equal(dayStart(d.Start)) {
			return dayPrefix + " " + startClock + "–" + d.End.Format("15:04")
		}
		return dayPrefix + " " + startClock + " – " + d.End.Format("01/02 15:04")
	}
	return dayPrefix + " " + startClock
}

func (a *App) taskMetaChip(c *ui.Context, key, label, value string, accent ui.Color, active bool) {
	open := strings.Split(a.taskMetaOpen, ":")[0] == key && !strings.Contains(a.taskMetaOpen, ":toolbar")
	icons := map[string]*ui.SVG{
		"status":     lucide.CircleCheck(),
		"start":      lucide.Calendar(),
		"due":        lucide.CalendarCheck(),
		"repeat":     lucide.Repeat(),
		"categories": lucide.Folder(),
		"priority":   lucide.Flag(),
		"reminder":   lucide.Bell(),
	}
	button := detailPropertyChip(c, "task-meta-"+key, label, value, icons[key], active, accent, a.draft.Task.ReadOnly, func() {
		if open {
			a.taskMetaOpen = ""
		} else {
			a.taskMetaOpen = key
		}
	})
	nativeOpen := ownedPropertyOpen(button, open)
	if open {
		propertyPopover(c.Key("property-popover-"+key), button, nativeOpen, func() {
			a.taskMetadataEditor(c, &a.draft)
		}, key)
		if !*nativeOpen {
			a.taskMetaOpen = ""
		}
	}
}

func estimateMetaChipWidth(value string, active bool) float32 {
	if !active {
		return 28
	}
	w, _ := ui.ShapeText(value, ui.Font{Size: 12, Weight: 400}, 0).Size()
	return min(float32(168), w) + 34
}

func (a *App) taskMetadata(c *ui.Context, d *Draft, _ ...bool) {
	t := tokensOf(c)
	now := time.Now().In(a.location())

	categoryNames := []string{}
	for _, cat := range a.categories {
		if d.Categories[cat.ID] {
			categoryNames = append(categoryNames, strings.TrimSpace(cat.Emoji+" "+cat.Name))
		}
	}
	categorySummary := "分类"
	if len(categoryNames) == 1 {
		categorySummary = categoryNames[0]
	} else if len(categoryNames) > 1 {
		categorySummary = fmt.Sprintf("%s +%d", categoryNames[0], len(categoryNames)-1)
	}

	smart := a.previewSmartInput(d.Title)

	priorityLabel := "普通"
	effectivePriority := d.Priority
	if smart.HasPriority {
		effectivePriority = smart.PriorityLabel
	}
	var priorityAccent ui.Color
	switch effectivePriority {
	case "高":
		priorityLabel = "高"
		priorityAccent = t.Warning
	case "低":
		priorityLabel = "低"
	}

	reminderLabel := "默认提醒"
	switch d.Reminder {
	case "不提醒":
		reminderLabel = "静音"
	case "提前提醒":
		mins := strings.TrimSpace(d.ReminderMinutes)
		switch mins {
		case "0":
			reminderLabel = "准时"
		case "60":
			reminderLabel = "1h"
		case "1440":
			reminderLabel = "1d"
		default:
			reminderLabel = mins + "m"
		}
	}

	statusAccent := ui.Color{}
	if d.Status == "已完成" {
		statusAccent = t.Success
	}
	var schedAccent ui.Color
	if d.HasStart && d.Status == "待办" && d.Start.Before(dayStart(now)) {
		schedAccent = t.Danger
	}
	var dueAccent ui.Color
	if d.HasDue && d.Status == "待办" && d.Due.Before(dayStart(now)) {
		dueAccent = t.Danger
	}

	schedText := draftScheduleChipText(d, now)
	dueText := "截止 " + d.Due.Format("01/02")
	repeatText := recurrenceSummary(d)
	statusActive := d.Status != "待办"
	priorityActive := effectivePriority != "普通"
	catActive := len(categoryNames) > 0
	repeatActive := d.Repeat != "不重复"
	reminderActive := d.Reminder != "跟随账户"

	// Estimate natural single-row width so narrow drawers (e.g. Calendar side
	// drawer) intentionally split into 2 balanced rows instead of stranding a
	// lone tiny chip like "15m" on row 2.
	estW := float32(0)
	if d.Task.ID != 0 {
		estW += estimateMetaChipWidth(d.Status, statusActive)
	}
	estW += estimateMetaChipWidth(schedText, d.HasStart)
	if d.HasDue {
		estW += estimateMetaChipWidth(dueText, true)
	}
	estW += estimateMetaChipWidth(priorityLabel, priorityActive)
	estW += estimateMetaChipWidth(categorySummary, catActive)
	estW += estimateMetaChipWidth(repeatText, repeatActive)
	estW += estimateMetaChipWidth(reminderLabel, reminderActive)

	renderSmartPill := func() {
		if !d.Task.ReadOnly && (smart.HasTime || smart.HasPriority) {
			hintText := "已识别：" + smartSummaryText(smart)
			smartPill := ui.ButtonBase(c.Key("smart-parse-pill")).Label("应用智能识别属性").Tooltip("点击立即应用识别出的日期或优先级并清理标题").
				Height(26).Padding(0, 8).Radius(6).Cursor(ui.CursorPointer).
				Background(t.Accent.Alpha(0.10)).OnClick(func() {
				a.applySmartTitleToDraft(d)
			})
			if smartPill.Hovered() {
				smartPill.Background(t.Accent.Alpha(0.16))
			}
			smartPill.Children(func() {
				ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
					ui.Icon(c, lucide.Sparkles()).Size(12, 12).TextColor(t.Accent).AccessHidden(true)
					ui.Text(c, hintText).FontSize(11.5).FontWeight(500).TextColor(t.Accent).SingleLine()
				})
			})
		}
	}

	metaBox := ui.Column(c.Key("task-metadata")).Label("任务属性").Gap(2).FillWidth().MinWidth(0)
	availW := metaBox.Bounds().W
	splitTwoRows := availW > 120 && estW > availW-2

	metaBox.Children(func() {
		if splitTwoRows {
			ui.Row(c.Key("task-metadata-primary")).Gap(2).Wrap().MinWidth(0).AlignItems(ui.Center).Children(func() {
				if d.Task.ID != 0 {
					a.taskMetaChip(c, "status", "状态", d.Status, statusAccent, statusActive)
				}
				a.taskMetaChip(c, "start", "开始", schedText, schedAccent, d.HasStart)
				if d.HasDue {
					a.taskMetaChip(c, "due", "截止", dueText, dueAccent, true)
				}
				renderSmartPill()
			})
			ui.Row(c.Key("task-metadata-secondary")).Gap(2).Wrap().MinWidth(0).AlignItems(ui.Center).Children(func() {
				a.taskMetaChip(c, "priority", "优先级", priorityLabel, priorityAccent, priorityActive)
				a.taskMetaChip(c, "categories", "分类", categorySummary, ui.Color{}, catActive)
				a.taskMetaChip(c, "repeat", "重复", repeatText, ui.Color{}, repeatActive)
				a.taskMetaChip(c, "reminder", "提醒", reminderLabel, ui.Color{}, reminderActive)
			})
			return
		}
		ui.Row(c.Key("task-metadata-single")).Gap(2).Wrap().MinWidth(0).AlignItems(ui.Center).Children(func() {
			if d.Task.ID != 0 {
				a.taskMetaChip(c, "status", "状态", d.Status, statusAccent, statusActive)
			}
			a.taskMetaChip(c, "start", "开始", schedText, schedAccent, d.HasStart)
			if d.HasDue {
				a.taskMetaChip(c, "due", "截止", dueText, dueAccent, true)
			}
			a.taskMetaChip(c, "priority", "优先级", priorityLabel, priorityAccent, priorityActive)
			a.taskMetaChip(c, "categories", "分类", categorySummary, ui.Color{}, catActive)
			a.taskMetaChip(c, "repeat", "重复", repeatText, ui.Color{}, repeatActive)
			a.taskMetaChip(c, "reminder", "提醒", reminderLabel, ui.Color{}, reminderActive)
			renderSmartPill()
		})
	})
}

func (a *App) taskMetadataEditor(c *ui.Context, d *Draft) {
	t := tokensOf(c)
	labels := map[string]string{
		"status":     "任务状态",
		"start":      "日期与时间",
		"due":        "截止日期",
		"categories": "关联分类（可多选）",
		"priority":   "优先级",
		"repeat":     "重复规则",
		"reminder":   "任务提醒",
	}
	key := strings.Split(a.taskMetaOpen, ":")[0]
	ui.Column(c.Key("task-meta-editor")).Gap(8).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Children(func() {
			ui.Text(c, labels[key]).FontSize(13).FontWeight(600).Grow(1)
			appActionButton(c, "完成", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Label("收起" + labels[key]).OnClick(func() { a.taskMetaOpen = "" })
		})
		switch key {
		case "status":
			propertyOptions(c, &d.Status, []string{"待办", "已完成", "已取消", "已跳过"})
		case "start":
			a.taskDateProperty(c, d, true)
		case "due":
			a.taskDateProperty(c, d, false)
		case "categories":
			visuals := propertyCategoryVisuals(c)
			previous := *visuals
			*visuals = make(map[string]api.Category, len(a.categories))
			for _, cat := range a.categories {
				(*visuals)[cat.Name] = cat
			}
			a.taskCategoryProperty(c, d)
			*visuals = previous
		case "priority":
			propertyOptions(c, &d.Priority, []string{"高", "普通", "低"})
		case "repeat":
			repeats := []string{"不重复", "每天", "每周", "每月", "每年", "农历每年"}
			if d.Task.Recurring() {
				repeats = append(repeats, "保留原有重复规则")
			}
			for _, choice := range repeats {
				val := choice
				propertyOptionBehavior(c.Key("repeat-"+val), val, d.Repeat == val, func() {
					d.Repeat = val
					if val != "不重复" && !d.HasStart {
						// Auto-enable start time so picking a repeat frequency works in 1 click.
						d.HasStart = true
						syncDraftEndAfterStart(d)
					}
					if val == "农历每年" {
						if l, ok := solarToLunar(d.Start); ok {
							d.Rule.LunarMonth = strconv.Itoa(l.Month)
							d.Rule.LunarDay = strconv.Itoa(l.Day)
							d.Rule.LunarLeap = l.IsLeap
						}
					}
				}, val != "不重复")
			}
			if d.Repeat != "不重复" {
				ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)
				a.recurrenceFields(c)
			}
		case "reminder":
			propertyOptionsContinuing(c, &d.Reminder, []string{"跟随账户", "提前提醒", "不提醒"}, func(choice string) bool { return choice == "提前提醒" })
			if d.Reminder == "提前提醒" {
				ui.Row(c).Gap(4).Wrap().Children(func() {
					for _, preset := range []struct{ label, mins string }{
						{"准时", "0"}, {"5分钟", "5"}, {"15分钟", "15"}, {"30分钟", "30"}, {"1小时", "60"}, {"1天", "1440"},
					} {
						active := strings.TrimSpace(d.ReminderMinutes) == preset.mins
						pill := ui.ButtonBase(c.Key("rem-"+preset.mins)).Label("提前 "+preset.label).Height(26).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer)
						fg := t.TextReadable
						if active {
							pill.Background(t.Accent)
							fg = t.TextOnAccent
						} else {
							pill.Background(t.BgSubtle)
							if pill.Hovered() {
								pill.Background(t.BgHover)
							}
						}
						minsVal := preset.mins
						pill.OnClick(func() { d.ReminderMinutes = minsVal }).Children(func() {
							ui.Text(c, preset.label).FontSize(11).FontWeight(500).TextColor(fg)
						})
					}
				})
				ui.Field(c, "提前分钟", func() { appInput(c, &d.ReminderMinutes, "提前分钟") })
			}
			if d.Task.ID > 0 {
				ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)
				appActionButton(c, "管理手动提醒与活动记录…", action.ButtonProps{Variant: action.Text, Size: theme.Small}).AlignSelf(ui.Start).OnClick(func() {
					a.taskMetaOpen = ""
					a.openTaskCenter(d.Task)
				})
			}
		}
	})
}

func taskEditorSection(c *ui.Context, title string, content func()) {
	layout.Block(c, layout.BlockProps{Variant: layout.BlockOutlined}).Padding(14).Gap(12).Children(func() {
		ui.Text(c, title).FontSize(13).Bold()
		content()
	})
}

func dateRow(c *ui.Context, label string, enabled *bool, date *time.Time, showTime bool) {
	ui.Column(c).Gap(6).Children(func() {
		ui.Checkbox(c, enabled, label)
		if *enabled {
			ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
				appDatePickerField(c, date, label+"日期", nil)
				if showTime {
					task24TimeField(c, "date-row-time-"+label, label+"时刻", date, 15, nil)
				}
			})
		}
	})
}

func (a *App) confirmations(c *ui.Context) {
	open := a.deleteTask != nil || a.deleteCategory != nil
	appDialog(c, &open, func() {
		ui.Text(c, "确认删除？").FontSize(fontTitle).Bold()
		if a.deleteTask != nil {
			ui.Text(c, a.deleteTask.Title).FontWeight(500)
			if a.deleteTask.Recurring() {
				ui.Text(c, "重复任务将删除整个系列。").FontSize(12).TextColor(c.Theme().TextMuted)
			}
		}
		if a.deleteCategory != nil {
			ui.Text(c, a.deleteCategory.Name).FontWeight(500)
			feedback.Alert(c, "分类中的任务会保留。", feedback.AlertProps{Type: feedback.Warning, Description: "只移除此分类及其与任务的关联，任务的其他分类不受影响。"})
		}
		if a.failure != "" {
			ui.Scroll(c.Key("delete-error")).MaxHeight(72).Children(func() { feedback.Alert(c, a.failure, feedback.AlertProps{Type: feedback.Error}) })
		}
		ui.Row(c).Justify(ui.End).Gap(8).Wrap().Children(func() {
			appActionButton(c, "保留", action.ButtonProps{}).Disabled(a.busy).OnClick(func() { a.deleteTask = nil; a.deleteCategory = nil; a.failure = "" })
			appActionButton(c, "确认删除", action.ButtonProps{Variant: action.Primary}).Disabled(a.busy).OnClick(func() {
				if t := a.deleteTask; t != nil {
					a.mutate("DELETE", fmt.Sprintf("/tasks/%d", t.ID), nil, t.Revision, func() {
						a.deleteTask = nil
						if a.selectedTaskID == t.ID {
							a.clearTaskSelection()
						}
					})
				}
				if cat := a.deleteCategory; cat != nil {
					a.mutate("DELETE", fmt.Sprintf("/categories/%d", cat.ID), nil, 0, func() { a.deleteCategory = nil })
				}
			})
		})
	}).Width(420)
	if !open && !a.busy {
		a.deleteTask = nil
		a.deleteCategory = nil
	}
}
