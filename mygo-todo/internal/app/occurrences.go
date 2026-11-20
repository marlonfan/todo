package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
	"todo-native/internal/syncer"
)

func (a *App) location() *time.Location {
	if loc, err := time.LoadLocation(a.session.User.Timezone); err == nil && a.session.User.Timezone != "" {
		return loc
	}
	return time.Local
}

// Project a copy for display. The cached series keeps its original anchor,
// description and revision so editing a row can never reschedule the series.
func projectTasks(tasks []api.Task, next, history []api.Occurrence) []api.Task {
	result := make([]api.Task, 0, len(tasks)+len(history))
	series := make(map[int64]api.Task)
	for _, task := range tasks {
		if task.Recurring() {
			series[task.ID] = task
			if task.Status == "pending" && task.ID > 0 {
				continue
			}
		}
		result = append(result, task)
	}
	seen := make(map[string]bool)
	for _, pool := range [][]api.Occurrence{next, history} {
		for _, occurrence := range pool {
			task, ok := series[occurrence.TaskID]
			key := fmt.Sprintf("%d:%s", occurrence.TaskID, occurrence.InstanceID)
			if !ok || seen[key] || occurrence.InstanceID == "" || occurrence.StartTime.IsZero() || occurrence.OriginalDate.IsZero() {
				continue
			}
			seen[key] = true
			task.InstanceID = occurrence.InstanceID
			task.OccurrenceDate = occurrence.OriginalDate.Format("2006-01-02")
			task.StartTime, task.EndTime, task.DueDate = &occurrence.StartTime, occurrence.EndTime, nil
			task.Status, task.Priority, task.AllDay = occurrence.Status, occurrence.Priority, occurrence.AllDay
			if occurrence.Title != "" {
				task.Title = occurrence.Title
			}
			task.Description = occurrence.Description
			task.CreatedAt, task.UpdatedAt = occurrence.CreatedAt, time.Time{}
			task.CompletedAt, task.DeletedAt = occurrence.CompletedAt, occurrence.DeletedAt
			result = append(result, task)
		}
	}
	return result
}

func taskStatusPayload(task api.Task, status string) (map[string]string, error) {
	payload := map[string]string{"status": status}
	if task.Recurring() {
		if task.InstanceID == "" || task.OccurrenceDate == "" {
			return nil, errors.New("请先选择重复任务的具体实例")
		}
		payload["instance_id"], payload["occurrence_date"] = task.InstanceID, task.OccurrenceDate
	}
	return payload, nil
}

func (a *App) setTaskStatus(task api.Task, status string) {
	if task.ReadOnly || !a.flushDetailAutosave() {
		return
	}
	if latest, ok := a.interactionTask(task.ID); ok {
		task.Revision = latest.Revision
		if task.InstanceID == "" {
			task.Status = latest.Status
		}
	}
	if entry, ok := a.interaction.statuses[taskRowKey(task)]; ok {
		task.Status = entry.status
	}
	if task.Status == status {
		return
	}
	payload, err := taskStatusPayload(task, status)
	if err != nil {
		a.failure = err.Error()
		return
	}
	op, err := a.persistTaskIntent("PATCH", fmt.Sprintf("/tasks/%d/status", task.ID), payload, task.Revision)
	if err != nil {
		a.failure = "无法保存任务状态：" + err.Error()
		return
	}
	a.interaction.recordStatus(task, status, op.ID, time.Now())
	a.updateSelectedStatus(task, status)
	a.updateTray()
	a.scheduleTaskSync()
}

func (a *App) openTask(task api.Task) {
	a.quick.Open = false
	a.quick.Meta = ""
	if a.editing && a.draft.Task.ID == task.ID && task.InstanceID == "" {
		a.taskDetailOpen = a.taskEditorInline
		return
	}
	if a.selectedOccurrence != nil && taskRowKey(*a.selectedOccurrence) == taskRowKey(task) {
		a.taskDetailOpen = a.taskEditorInline
		return
	}
	a.requestTaskTransition(func() {
		a.quick.Open = false
		a.quick.Meta = ""
		a.taskEditorInline = isTaskWorkspacePage(a.page)
		a.taskDetailOpen = a.taskEditorInline
		a.selectedTaskID = task.ID
		if task.InstanceID != "" {
			a.editing = false
			a.taskDraftBase = nil
			a.selectedOccurrence = &task
			a.occurrenceTitle = task.Title
			a.occurrenceDescription = task.Description
		} else {
			a.editTaskNow(task)
		}
	})
}

func (a *App) occurrenceView(c *ui.Context) {
	// Instances share the current window's detail workspace; never a Modal.
}

func (a *App) openOccurrenceSeries(task api.Task) {
	for _, series := range a.tasks {
		if series.ID == task.ID {
			a.editTask(series)
			return
		}
	}
}

func (a *App) occurrenceContent(c *ui.Context, compact ...bool) {
	if a.selectedOccurrence == nil {
		return
	}
	task := *a.selectedOccurrence
	t := tokensOf(c)
	blocked := a.aiPanel != nil || task.ReadOnly

	if !a.occurrenceEditing {
		a.occurrenceTitle = task.Title
		a.occurrenceDescription = task.Description
	}
	markEditing := func() {
		if !blocked && !a.occurrenceEditing {
			a.occurrenceEditing = true
		}
	}

	isCompact := len(compact) > 0 && compact[0]
	m := computeDetailTopChrome(c.TitleBar(), isCompact)

	// Borderless canvas-blended top drag / platform window-button clearance strip
	detailTopStrip(c, "occurrence-top-strip", "", m, func() {
		if isCompact {
			iconButton(c, "‹ 返回任务列表", lucide.ArrowLeft()).OnClick(func() { a.taskDetailOpen = false })
			iconButton(c, "刷新", lucide.RefreshCw()).Disabled(a.busy || a.syncing).OnClick(a.refreshCurrentPage)
		}
	}, nil)

	// Body Container
	body := ui.Column(c.Key("occurrence-content")).Label("本次任务详情内容").Padding(m.BodyPadTop, detailBodySidePadding, 12, detailBodySidePadding).Gap(12).MinWidth(0).Grow(1).Basis(0).MinHeight(0).Clip().Disabled(a.aiPanel != nil).
		OnShortcut(0, ui.KeyEscape, func() { a.requestTaskTransition(func() {}) })

	body.Children(func() {
		ui.Column(c.Key("occurrence-main")).Label("本次任务正文").Fill().MaxWidth(960).Gap(12).MinWidth(0).MinHeight(0).Clip().Children(func() {
			// 1. Completion Checkbox + Direct 1-click editable Instance Title + Inline Action Cluster
			ui.Column(c.Key("occurrence-heading")).Shrink(0).Gap(4).MinWidth(0).Children(func() {
				ui.Row(c.Key("occurrence-heading-row")).Shrink(0).MinWidth(0).Gap(detailHeadingGap).AlignItems(ui.Start).Children(func() {
					done := task.Status == "completed"
					occPriority := "普通"
					if task.Priority > 0 {
						occPriority = "高"
					}
					detailCompleteCheckbox(c, &done, "完成本次 "+task.Title, occPriority, blocked || a.busy, func() {
						status := "pending"
						if done {
							status = "completed"
						}
						a.setTaskStatus(task, status)
					})
					var occEsc func()
					if !isTaskWorkspacePage(a.page) {
						occEsc = func() { a.requestTaskTransition(func() {}) }
					}
					detailTitle(c, "occurrence-title", "本次标题", "本次标题（留空恢复系列标题）", &a.occurrenceTitle, false, blocked, &a.taskTitleInput,
						markEditing,
						func() { a.taskDescriptionInput.Focus() },
						occEsc)
					ui.Row(c.Key("occurrence-heading-actions")).Shrink(0).Gap(2).Margin(1, 0, 0, 2).AlignItems(ui.Center).Children(func() {
						iconButton(c, "编辑整个系列", lucide.Layers()).Disabled(blocked || a.busy).OnClick(func() { a.openOccurrenceSeries(task) })
						iconButton(c, "整个系列提醒与活动记录", lucide.BellRing()).Disabled(a.busy || blocked).OnClick(func() { a.openTaskCenter(task) })
						iconButton(c, "关闭", lucide.X()).Disabled(a.busy || a.aiPanel != nil).OnClick(func() { a.requestTaskTransition(func() {}) })
					})
				})
				ui.Row(c.Key("occurrence-subtitle")).Shrink(0).Gap(6).Wrap().AlignItems(ui.Center).Padding(0, 0, 0, 34).Children(func() {
					appBadge(c, "本次实例").TextColor(t.Accent).Background(t.Accent.Alpha(0.10))
					ui.Text(c, "仅影响本次实例 · 原始日期 "+task.OccurrenceDate).FontSize(11).TextColor(t.TextSecondary)
				})
			})

			// 2. Upfront Iconic Instance Actions & Schedule Chip
			ui.Row(c.Key("occurrence-properties")).Label("本次任务属性").Shrink(0).Gap(4).Wrap().AlignItems(ui.Center).Children(func() {
				if !blocked {
					if task.Status == "pending" {
						detailPropertyChip(c, "occ-complete", "完成本次", "完成本次", lucide.Check(), false, t.Success, a.busy, func() {
							a.setTaskStatus(task, "completed")
						}).Label("完成本次")
						detailPropertyChip(c, "occ-skip", "跳过本次", "跳过本次", lucide.SkipForward(), false, ui.Color{}, a.busy, func() {
							a.setTaskStatus(task, "skipped")
						}).Label("跳过本次")
					} else {
						statusText := map[string]string{"completed": "已完成", "skipped": "已跳过", "cancelled": "已取消"}[task.Status]
						detailPropertyChip(c, "occ-restore", "恢复本次待办", statusText, lucide.RotateCcw(), true, t.Success, a.busy, func() {
							a.setTaskStatus(task, "pending")
						}).Label("恢复本次待办")
					}
				}

				timeSummary := "未设置时间"
				if task.StartTime != nil {
					st := task.StartTime.In(a.location())
					if task.AllDay {
						timeSummary = st.Format("01月02日 全天")
					} else if task.EndTime != nil {
						timeSummary = st.Format("01/02 15:04") + "–" + task.EndTime.In(a.location()).Format("15:04")
					} else {
						timeSummary = st.Format("01月02日 15:04")
					}
				}
				detailPropertyChip(c, "occurrence-property-start", "本次开始", timeSummary, lucide.Calendar(), a.occurrenceSchedule != nil || task.StartTime != nil, t.Accent, blocked, func() {
					if a.occurrenceSchedule == nil {
						if a.taskDraftDirty() {
							a.flushDetailAutosave()
						}
						a.editOccurrenceSchedule()
					}
				})

				// Inherited series badges
				series := task
				for _, candidate := range a.tasks {
					if candidate.ID == task.ID {
						series = candidate
						break
					}
				}
				if series.Priority > 0 {
					appBadge(c, "系列 · 高优先级").TextColor(t.Warning)
				}
				for _, cat := range series.Categories {
					appBadge(c, strings.TrimSpace(cat.Emoji+" "+cat.Name))
				}
			})

			// 3. Inline Schedule Editor when adjusting this occurrence's time
			if a.occurrenceSchedule != nil {
				ui.Scroll(c.Key("occurrence-schedule-scroll")).Grow(1).Basis(0).MinHeight(0).MinWidth(0).Children(func() {
					ui.Column(c.Key("occurrence-schedule-card")).Padding(10, 12).Radius(8).Background(t.BgSubtle).Border(1, t.BorderSubtle).Gap(8).MinWidth(0).Children(func() {
						a.occurrenceScheduleFields(c)
					})
				})
			}

			ui.Box(c).Height(1).Shrink(0).FillWidth().Background(t.BorderSubtle)

			// 4. Full-height WYSIWYG Markdown Editor for this occurrence
			if a.occurrenceSchedule == nil {
				a.wysiwygMarkdownEditor(c, "occurrence-description-"+taskRowKey(task), "occ:"+taskRowKey(task), "本次描述", "输入本次实例描述（留空清除单次描述，系列描述不受影响）…", &a.occurrenceDescription, blocked, &a.taskDescriptionInput, markEditing, func() {
					markEditing()
					a.openDescriptionAI(true)
				})
			}

			if a.failure != "" {
				ui.Text(c, a.failure).FontSize(12).TextColor(t.Danger)
			}
		})
	})

	// Bottom Status / Action Bar
	ui.Row(c.Key("occurrence-actions")).Label("本次任务底部操作").Height(48).Shrink(0).Padding(0, 20).Gap(8).AlignItems(ui.Center).BorderWidth(1, 0, 0, 0).BorderColor(t.BorderSubtle).Children(func() {
		saveLabel := a.detailSaveLabel()
		dot := t.Success
		if strings.Contains(saveLabel, "失败") || a.autosave.failure != "" {
			dot = t.Danger
		} else if strings.Contains(saveLabel, "待") {
			dot = t.Accent
		}
		ui.Box(c).Size(6, 6).Radius(3).Background(dot).Shrink(0).AccessHidden(true)
		ui.Text(c, saveLabel).FontSize(fontAux).TextColor(t.TextSecondary).Grow(1).MinWidth(0).SingleLine()

		if a.occurrenceSchedule != nil {
			appActionButton(c, "恢复本次系列时间", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Disabled(blocked || a.busy).OnClick(func() { a.saveOccurrenceSchedule(true) })
			appButton(c, "取消改期", "ghost").Label("取消本次改期").Height(30).Disabled(a.busy || a.aiPanel != nil).OnClick(func() {
				a.requestTaskTransition(func() { a.openTask(task) })
			})
			primaryButton(c, "保存本次时间", theme.Small).Height(30).Disabled(blocked || a.busy || !a.taskDraftDirty()).OnClick(func() { a.saveOccurrenceSchedule(false) })
		} else if (a.failure != "" || a.autosave.failure != "") && !task.ReadOnly {
			appActionButton(c, "重试保存", action.ButtonProps{Variant: action.Text, Size: theme.Small}).Disabled(a.busy || blocked).OnClick(a.retryDetailAutosave)
		}
	})
}

func (a *App) saveOccurrenceDescription() {
	a.flushDetailAutosave()
}

func (a *App) saveCurrentTask() {
	if a.busy || a.aiPanel != nil || !a.taskDraftDirty() {
		return
	}
	if task := a.selectedOccurrence; task != nil {
		if task.ReadOnly {
			return
		}
		if a.occurrenceSchedule != nil {
			a.saveOccurrenceSchedule(false)
		} else if a.occurrenceEditing {
			a.saveOccurrenceDescription()
		}
		return
	}
	if a.editing && !a.draft.Task.ReadOnly {
		a.saveTask()
	}
}

func (a *App) loadMoreHistory() {
	if a.client == nil || a.busy || !a.history.HasMore {
		return
	}
	client, cursor := a.client, a.cache.History.NextCursor
	cache := syncer.Clone(a.cache)
	a.run(func(ctx context.Context) (func(), error) {
		page, err := client.OccurrenceHistory(ctx, cursor)
		if err != nil {
			return nil, err
		}
		if page.NextCursor < cursor || (page.HasMore && page.NextCursor <= cursor) {
			return nil, errors.New("服务器未返回有效的历史分页位置")
		}
		page.Items = api.MergeOccurrenceItems(cache.History.Items, page.Items)
		cache.History = page
		if err := a.store.SaveCache(cache); err != nil {
			return nil, err
		}
		return func() { a.adoptCache(cache) }, nil
	})
}
