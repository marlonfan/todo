package app

import (
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
)

// taskListItem is used by every task view, including category and history lists.
func (a *App) taskListItem(c *ui.Context, task api.Task, now time.Time) bool {
	return a.taskListItemWithOpen(c, task, now, task.Title, a.taskRowSelected(task), func() { a.openTask(task) })
}

func (a *App) taskListItemWithOpen(c *ui.Context, task api.Task, now time.Time, titleLabel string, selected bool, open func()) bool {
	a.interactionFrame(c)
	ownsKeys := false
	t := tokensOf(c)
	meta := taskMetaIn(task, a.location())
	if isHistoryPage(a.page) {
		meta = historyMeta(task, a.location())
	}
	hints := []string{}
	if task.Priority > 0 {
		hints = append(hints, "高优先级")
	} else if task.Priority < 0 {
		hints = append(hints, "低优先级")
	}
	if task.Recurring() {
		hints = append(hints, "重复")
	}
	overdue := false
	if date := taskPrimaryTime(task); task.Status == "pending" && date != nil && date.Before(dayStart(now)) {
		overdue = true
		hints = append(hints, "逾期")
	}
	if meta != "" {
		hints = append(hints, meta)
	}
	// Never append transient "待同步" for normal pending operations: doing so
	// bounced 1-line rows between 44px and 52px during ~80ms background writes.
	// Surface sync state on the row only when an operation is blocked/conflicted.
	for _, op := range a.cache.Outbox {
		if op.TaskID == task.ID && op.State != "pending" {
			hints = append(hints, "同步受阻")
			break
		}
	}
	summary := strings.Join(hints, " · ")
	height := float32(taskSingleRowHeight)
	if summary != "" {
		height = taskMetaRowHeight
	}
	row := ui.Row(c.Key("task-row")).Label("任务行 "+task.Title).Gap(6).Padding(0, 8).Height(height).Shrink(0).
		BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle.Alpha(0.55)).AlignItems(ui.Center).Background(t.BgList).
		OnClick(open)
	row.Children(func() {
		done := task.Status == "completed"
		checkbox := ui.Checkbox(c.Key("complete"), &done, "").Size(32, 32).Justify(ui.Center).AlignItems(ui.Center).Label("完成 " + task.Title).Disabled(task.ReadOnly || (task.Recurring() && task.InstanceID == "")).OnChange(func() {
			status := "pending"
			if done {
				status = "completed"
			}
			a.setTaskStatus(task, status)
		})
		ownsKeys = checkbox.Focused()
		button := ui.ButtonBase(c.Key("edit")).Label(titleLabel).Description(summary).Tooltip(task.Title).Disabled(a.aiPanel != nil).Grow(1).FillHeight().MinWidth(0).MinHeight(32).Justify(ui.Start).Padding(0).OnClick(open)
		if !task.ReadOnly {
			// Reserve only the trailing hover control, outside the title target.
			button.Margin(0, 38, 0, 0)
		}
		if (button.Pressed() || row.Pressed()) && (!selected || a.quick.Open) && !a.busy && !a.taskDiscardConfirm && a.aiPanel == nil {
			open()
			if a.taskRowSelected(task) {
				selected = true
			}
			c.Invalidate()
		}
		if selected {
			row.Background(t.BgTaskSelected).BorderColor(ui.Transparent).Radius(7)
		} else if row.Hovered() {
			row.Background(t.BgHover).BorderColor(ui.Transparent).Radius(7)
		}
		metaColor := t.TextSecondary
		if selected || row.Hovered() {
			metaColor = t.TextReadable
		}
		button.Children(func() {
			ui.Column(c).Grow(1).FillHeight().MinWidth(0).Gap(3).Justify(ui.Center).Children(func() {
				text := ui.Text(c, task.Title).FontSize(fontTask).FontWeight(500).SingleLine().MinWidth(0)
				if selected {
					text.FontWeight(600).TextColor(t.TextPrimary)
				}
				if task.Status != "pending" {
					text.TextColor(metaColor)
					if task.Status == "completed" {
						text.Strikethrough().DecorationColor(metaColor.Alpha(0.6))
					}
				}
				if summary != "" {
					// Keep the existing overdue predicate, coloring only its date fragment
					// in Danger while keeping priority/categories/recurrence calm.
					dateText := ""
					if overdue {
						format := "01月02日 15:04"
						if task.AllDay {
							format = "01月02日 全天"
						}
						dateText = taskPrimaryTime(task).In(a.location()).Format(format)
					}
					before, after, split := strings.Cut(summary, dateText)
					if overdue && dateText != "" && split {
						ui.Row(c.Key("task-summary")).Gap(0).MinWidth(0).Children(func() {
							ui.Text(c, before).FontSize(fontAux).TextColor(metaColor).SingleLine().Shrink(0)
							ui.Text(c.Key("overdue-date"), dateText).FontSize(fontAux).FontWeight(500).TextColor(t.Danger).SingleLine().Shrink(0)
							ui.Text(c, after).FontSize(fontAux).TextColor(metaColor).SingleLine().Grow(1).MinWidth(0)
						})
					} else if task.Priority > 0 && strings.HasPrefix(summary, "高优先级") {
						rest := strings.TrimPrefix(summary, "高优先级")
						ui.Row(c.Key("task-summary")).Gap(0).MinWidth(0).Children(func() {
							ui.Text(c, "高优先级").FontSize(fontAux).FontWeight(500).TextColor(t.Warning).SingleLine().Shrink(0)
							if rest != "" {
								ui.Text(c, rest).FontSize(fontAux).TextColor(metaColor).SingleLine().Grow(1).MinWidth(0)
							}
						})
					} else {
						ui.Text(c, summary).FontSize(fontAux).TextColor(metaColor).SingleLine().MinWidth(0)
					}
				}
			})
		})
		a.taskCategoryHandle(c, task, row.Hovered() || row.FocusWithin(), open)
		ownsKeys = a.taskActions(c, task, row.Hovered() || row.FocusWithin()) || ownsKeys
	})
	return ownsKeys
}

// Migrate the former default without discarding deliberate widths in the new
// range. Older wider/narrower preferences fit the denser navigation bounds.
func fittedSidebarWidth(width float32) float32 {
	if width <= 0 || width == 228 {
		return sidebarDefaultWidth
	}
	return min(260, max(240, width))
}

func (a *App) rememberWorkspaceLayout() {
	if a.preferencesError != "" {
		return
	}
	prefs := a.preferences
	prefs.SidebarWidth = a.sidebarWidth
	prefs.TaskListWidth = a.taskListWidth
	if err := a.store.SavePreferences(prefs); err != nil {
		a.failure = "无法保存布局偏好：" + err.Error()
		return
	}
	a.preferences = prefs
}
