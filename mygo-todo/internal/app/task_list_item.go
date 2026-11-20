package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"todo-native/internal/api"
)

// taskListItem is used by every task view, including category and history lists.
func (a *App) taskListItem(c *ui.Context, task api.Task, now time.Time) bool {
	return a.taskListItemWithOpen(c, task, now, task.Title, a.taskRowSelected(task), func() { a.openTask(task) })
}

func taskRowTimeLabel(task api.Task, now time.Time, loc *time.Location, isHistory bool) (string, bool) {
	if isHistory {
		ts := historyTime(task, "处理时间")
		if ts.IsZero() {
			return "", false
		}
		actionWord := map[string]string{"completed": "完成", "cancelled": "取消", "skipped": "跳过"}[task.Status]
		localTS := ts.In(loc)
		localNow := now.In(loc)
		if localDay(localTS, loc).Equal(localDay(localNow, loc)) {
			return localTS.Format("15:04") + " " + actionWord, false
		}
		if localTS.Year() == localNow.Year() {
			return localTS.Format("01/02 15:04") + " " + actionWord, false
		}
		return localTS.Format("2006/01/02 15:04") + " " + actionWord, false
	}
	date := taskPrimaryTime(task)
	if date == nil {
		return "", false
	}
	localDate := date.In(loc)
	overdue := task.Status == "pending" && date.Before(dayStart(now))
	if overdue {
		format := "01月02日 15:04"
		if task.AllDay {
			format = "01月02日 全天"
		}
		return localDate.Format(format), true
	}
	today := localDay(now.In(loc), loc)
	day := localDay(localDate, loc)
	if day.Equal(today) {
		if task.AllDay {
			return "今天 全天", false
		}
		return "今天 " + localDate.Format("15:04"), false
	}
	if day.Equal(today.AddDate(0, 0, 1)) {
		if task.AllDay {
			return "明天 全天", false
		}
		return "明天 " + localDate.Format("15:04"), false
	}
	format := "01月02日 15:04"
	if task.AllDay {
		format = "01月02日 全天"
	}
	return localDate.Format(format), false
}

func (a *App) taskListItemWithOpen(c *ui.Context, task api.Task, now time.Time, titleLabel string, selected bool, open func()) bool {
	a.interactionFrame(c)
	ownsKeys := false
	t := tokensOf(c)
	loc := a.location()
	isHistory := isHistoryPage(a.page)

	timeText, overdue := taskRowTimeLabel(task, now, loc, isHistory)
	recurring := task.Recurring()
	lowPriority := task.Priority < 0
	primaryCat := ""
	extraCats := 0
	if len(task.Categories) > 0 {
		primaryCat = strings.TrimSpace(task.Categories[0].Emoji + " " + task.Categories[0].Name)
		extraCats = len(task.Categories) - 1
	}
	// Never append transient "待同步" for normal pending operations: doing so
	// bounced 1-line rows between 44px and 52px during ~80ms background writes.
	// Surface sync state on the row only when an operation is blocked/conflicted.
	blockedSync := false
	for _, op := range a.cache.Outbox {
		if op.TaskID == task.ID && op.State != "pending" {
			blockedSync = true
			break
		}
	}

	hasMeta := timeText != "" || recurring || primaryCat != "" || blockedSync || lowPriority || task.ReadOnly
	descParts := make([]string, 0, 6)
	if task.Priority > 0 {
		descParts = append(descParts, "高优先级")
	} else if lowPriority {
		descParts = append(descParts, "低优先级")
	}
	if recurring {
		descParts = append(descParts, "重复")
	}
	if overdue {
		descParts = append(descParts, "逾期")
	}
	if timeText != "" {
		descParts = append(descParts, timeText)
	}
	if primaryCat != "" {
		if extraCats > 0 {
			descParts = append(descParts, fmt.Sprintf("%s +%d", primaryCat, extraCats))
		} else {
			descParts = append(descParts, primaryCat)
		}
	}
	if task.ReadOnly {
		descParts = append(descParts, "只读日历")
	}
	if blockedSync {
		descParts = append(descParts, "同步受阻")
	}
	summaryDesc := strings.Join(descParts, " · ")

	height := float32(taskSingleRowHeight)
	if hasMeta {
		height = taskMetaRowHeight
	}
	row := ui.Row(c.Key("task-row")).Label("任务行 "+task.Title).Gap(6).Padding(0, 8).Height(height).FillWidth().Shrink(0).
		Radius(8).AlignItems(ui.Center).Background(ui.Transparent).
		OnClick(open)
	row.Children(func() {
		done := task.Status == "completed"
		checkDisabled := task.ReadOnly || (task.Recurring() && task.InstanceID == "")
		checkTip := "点击标记完成"
		if done {
			checkTip = "点击恢复待办"
		} else if task.Priority > 0 {
			checkTip = "高优先级 · 点击标记完成"
		}
		checkbox := ui.CheckboxBase(c.Key("complete"), &done).Size(32, 32).Justify(ui.Center).AlignItems(ui.Center).
			Label("完成 " + task.Title).Tooltip(checkTip).Disabled(checkDisabled).Cursor(ui.CursorPointer).OnChange(func() {
			status := "pending"
			if done {
				status = "completed"
			}
			a.setTaskStatus(task, status)
		})
		checkbox.Children(func() {
			box := ui.Box(c).Size(16, 16).Radius(5).Center().AccessHidden(true)
			if done {
				box.Background(t.Accent.Alpha(0.88)).Border(1, t.Accent).Children(func() {
					ui.Icon(c, lucide.Check()).Size(10.5, 10.5).TextColor(t.TextOnAccent).AccessHidden(true)
				})
			} else if task.Priority > 0 {
				bg := t.Warning.Alpha(0.10)
				if checkbox.Hovered() && !checkDisabled {
					bg = t.Warning.Alpha(0.18)
				}
				box.Background(bg).Border(1.5, t.Warning)
			} else if lowPriority {
				bg := ui.Transparent
				if checkbox.Hovered() && !checkDisabled {
					bg = t.BgHover
				}
				box.Background(bg).Border(1.25, t.TextTertiary.Alpha(0.55))
			} else {
				borderCol := t.TextTertiary.Alpha(0.82)
				bg := ui.Transparent
				if checkbox.Hovered() && !checkDisabled {
					borderCol = t.Accent
					bg = t.Accent.Alpha(0.08)
				}
				box.Background(bg).Border(1.25, borderCol)
			}
			if checkDisabled {
				box.Opacity(0.42)
			}
		})
		ownsKeys = checkbox.Focused()

		button := ui.ButtonBase(c.Key("edit")).Label(titleLabel).Description(summaryDesc).Tooltip(task.Title).Disabled(a.aiPanel != nil).Grow(1).FillHeight().MinWidth(0).MinHeight(32).Justify(ui.Start).Padding(0).OnClick(open)
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
			row.Background(t.BgTaskSelected)
			if c.Theme().Dark {
				row.InsetShadow(0, 0, 0, 1, t.BorderDefault.Alpha(0.85)).
					Shadow(0, 1, 3, 0, ui.RGBA(0, 0, 0, 0.28))
			} else {
				row.InsetShadow(0, 0, 0, 1, t.BorderDefault.Alpha(0.80)).
					Shadow(0, 1, 2, 0, ui.RGBA(28, 25, 23, 0.05))
			}
		} else if row.Hovered() {
			row.Background(t.BgHover)
		}

		metaColor := t.TextTertiary
		if selected || row.Hovered() {
			metaColor = t.TextSecondary
		}
		button.Children(func() {
			ui.Column(c).Grow(1).FillHeight().MinWidth(0).Gap(2.5).Justify(ui.Center).Children(func() {
				titleWeight := 400
				if selected {
					titleWeight = 500
				}
				text := ui.Text(c, task.Title).FontSize(fontTask).FontWeight(titleWeight).TextColor(t.TextPrimary).SingleLine().MinWidth(0)
				if task.Status != "pending" {
					titleCol := t.TextSecondary
					if selected {
						titleCol = t.TextReadable
					}
					text.TextColor(titleCol)
					if task.Status == "completed" {
						text.Strikethrough().DecorationColor(t.TextTertiary.Alpha(0.65))
					}
				}
				if hasMeta {
					ui.Row(c.Key("task-summary")).Gap(5).AlignItems(ui.Center).MinWidth(0).Children(func() {
						wrote := false
						sep := func() {
							if wrote {
								ui.Text(c, "·").FontSize(fontAux).TextColor(t.TextTertiary.Alpha(0.70)).SingleLine().Shrink(0).AccessHidden(true)
							}
						}
						if timeText != "" {
							if overdue {
								ui.Text(c.Key("overdue-date"), timeText).FontSize(fontAux).FontWeight(500).FontFeatures("tnum").TextColor(t.Danger).SingleLine().Shrink(0)
							} else {
								ui.Text(c, timeText).FontSize(fontAux).FontFeatures("tnum").TextColor(metaColor).SingleLine().Shrink(0)
							}
							wrote = true
						}
						if recurring {
							ui.Icon(c, lucide.Repeat()).Size(10.5, 10.5).TextColor(metaColor).Shrink(0).AccessHidden(true)
							if !wrote {
								ui.Text(c, "重复").FontSize(fontAux).TextColor(metaColor).SingleLine().Shrink(0)
							}
							wrote = true
						}
						if primaryCat != "" {
							sep()
							ui.Text(c, primaryCat).FontSize(fontAux).TextColor(metaColor).SingleLine().Shrink(1).MinWidth(0)
							if extraCats > 0 {
								ui.Text(c, fmt.Sprintf("+%d", extraCats)).FontSize(10).FontFeatures("tnum").TextColor(t.TextTertiary).SingleLine().Shrink(0)
							}
							wrote = true
						}
						if blockedSync {
							sep()
							ui.Text(c, "同步受阻").FontSize(fontAux).FontWeight(500).TextColor(t.Warning).SingleLine().Shrink(0)
							wrote = true
						}
						if lowPriority {
							sep()
							ui.Text(c, "低优先级").FontSize(fontAux).TextColor(t.TextTertiary).SingleLine().Shrink(0)
							wrote = true
						}
						if task.ReadOnly {
							sep()
							ui.Text(c, "只读日历").FontSize(fontAux).TextColor(t.TextTertiary).SingleLine().Shrink(0)
						}
					})
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
