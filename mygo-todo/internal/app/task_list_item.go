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
	blockedSync := a.isTaskSyncBlocked(task.ID)

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

	rowKey := a.stableTaskKey(task)
	highlighted := !a.search.Open && a.highlightedTaskKey != "" && a.highlightedTaskKey == taskRowKey(task)

	// Uniform 52px row height across all items for steady list rhythm.
	row := ui.Row(c.Key("task-row")).Label("任务行 "+task.Title).Gap(6).Padding(0, 8).Height(taskSingleRowHeight).FillWidth().Shrink(0).
		Radius(8).AlignItems(ui.Center).Background(ui.Transparent).
		Transition(motionColorsShadowsFast()).
		OnClick(open)

	// Manual drag-to-reorder drop indicator & handler on non-history pages.
	var dropPos int // -1 top, +1 bottom
	if !isHistory && !a.search.Open {
		if drag, over := ui.DragOver[taskCategoryDrag](row); over && drag.TaskKey != "" && drag.TaskKey != rowKey {
			_, py, _ := row.PointerPosition()
			if py < row.Bounds().H/2 {
				dropPos = -1
			} else {
				dropPos = 1
			}
		}
		if drag, dropped := ui.Drop[taskCategoryDrag](row); dropped && drag.TaskKey != "" && drag.TaskKey != rowKey {
			_, py, _ := row.PointerPosition()
			after := py >= row.Bounds().H/2
			currentTasks := a.cachedTaskList(a.page, a.query, now)
			a.reorderTaskInPage(a.page, currentTasks, drag.TaskKey, rowKey, after)
		}
	}

	row.Children(func() {
		if dropPos == -1 {
			ui.Box(c.Key("drop-top")).Absolute().Left(8).Right(8).Top(0).Height(2).Radius(1).Background(t.Accent).PassThrough().AccessHidden(true)
		} else if dropPos == 1 {
			ui.Box(c.Key("drop-bot")).Absolute().Left(8).Right(8).Bottom(0).Height(2).Radius(1).Background(t.Accent).PassThrough().AccessHidden(true)
		}

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
			box := ui.Box(c.Key("row-check-box")).Size(16, 16).Radius(5).Center().AccessHidden(true).
				Transition(motionColorsFast())
			if done {
				box.Background(t.Accent.Alpha(0.90)).Border(1, t.Accent)
				animatedCheckmarkBox(c, box, true, true, t.TextOnAccent, 1.65)
			} else {
				animatedCheckmarkBox(c, box, false, false, t.TextOnAccent, 1.65)
				if task.Priority > 0 {
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
		if (button.Pressed() || row.Pressed()) && (!selected || a.quick.Open) && !a.taskDiscardConfirm && a.aiPanel == nil {
			open()
			if a.taskRowSelected(task) {
				selected = true
			}
			c.Invalidate()
		}
		if selected {
			row.Background(t.BgTaskSelected)
			if c.Theme().Dark {
				row.InsetShadow(0, 0, 0, 1, t.BorderDefault.Alpha(0.90)).
					Shadow(0, 2, 8, -1, ui.RGBA(0, 0, 0, 0.36)).
					Shadow(0, 1, 2, 0, ui.RGBA(0, 0, 0, 0.24))
			} else {
				row.InsetShadow(0, 0, 0, 1, t.BorderDefault.Alpha(0.85)).
					Shadow(0, 2, 8, -2, ui.RGBA(28, 25, 23, 0.08)).
					Shadow(0, 1, 2, 0, ui.RGBA(28, 25, 23, 0.05))
			}
		} else if highlighted {
			row.Background(t.BgSelected.Alpha(0.75)).
				InsetShadow(0, 0, 0, 1, t.Accent.Alpha(0.45))
		} else if row.Hovered() {
			row.Background(t.BgHover)
		}

		rowFocusedOrHovered := selected || row.Hovered() || row.FocusWithin()
		metaColor := t.TextTertiary.Alpha(0.85)
		if rowFocusedOrHovered {
			metaColor = t.TextSecondary
		}
		button.Children(func() {
			ui.Column(c).Grow(1).FillHeight().MinWidth(0).Gap(2.5).Justify(ui.Center).Children(func() {
				titleWeight := 400
				if selected {
					titleWeight = 500
				}
				titleWrap := ui.Box(c.Key("title-wrap")).MinWidth(0)
				_, completingHold := a.interaction.statuses[taskRowKey(task)]
				animateStrike := done && completingHold && !a.interaction.reduceMotion
				strikeTarget := float32(0)
				if done {
					strikeTarget = 1
				}
				var strikeProgress float32
				if animateStrike {
					strikeProgress = titleWrap.AnimateTo("strike", strikeTarget, ui.Animation{Duration: 240 * time.Millisecond, Ease: ui.EaseOut})
				} else {
					strikeProgress = titleWrap.Jump("strike", strikeTarget)
				}

				titleWrap.Children(func() {
					text := ui.Text(c, task.Title).FontSize(fontTask).FontWeight(titleWeight).TextColor(t.TextPrimary).SingleLine().MinWidth(0)
					if task.Status != "pending" {
						titleCol := t.TextSecondary
						if selected {
							titleCol = t.TextReadable
						}
						text.TextColor(titleCol)
						if task.Status == "completed" && !animateStrike {
							text.Strikethrough().DecorationColor(t.TextTertiary.Alpha(0.65))
						}
					}
					if animateStrike && strikeProgress > 0.01 {
						strikeCol := t.TextTertiary.Alpha(0.72)
						text.Draw(func(p *ui.Painter, r ui.Rect) {
							if r.W <= 2 {
								return
							}
							y := r.Y + r.H*0.52
							p.Fill(ui.Rect{X: r.X, Y: y, W: r.W * strikeProgress, H: 1.25}, strikeCol, 0.5)
						})
					}
				})

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
							if extraCats > 0 && rowFocusedOrHovered {
								ui.Text(c, fmt.Sprintf("+%d", extraCats)).FontSize(10).FontFeatures("tnum").TextColor(t.TextTertiary).SingleLine().Shrink(0)
							}
							wrote = true
						}
						if blockedSync {
							sep()
							ui.Text(c, "同步受阻").FontSize(fontAux).FontWeight(500).TextColor(t.Warning).SingleLine().Shrink(0)
							wrote = true
						}
						if lowPriority && rowFocusedOrHovered {
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
		a.taskCategoryHandle(c, task, rowFocusedOrHovered, open)
		ownsKeys = a.taskActions(c, task, rowFocusedOrHovered) || ownsKeys
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
