package app

import (
	"fmt"
	"maps"
	"reflect"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

type quickAddState struct {
	Draft, Base Draft
	Page        string
	Ready, Open bool
	Meta        string
	Input       ui.Handle
}

type taskSearchState struct {
	Open, Return bool
	Index        int
	Input        ui.Handle
}

func (a *App) quickDraftDirty() bool {
	return a.quick.Ready && !reflect.DeepEqual(a.quick.Draft, a.quick.Base)
}

func (a *App) ensureQuickDraft() {
	if a.quick.Ready {
		// Change only untouched defaults when navigating between task lists.
		// A title or property choice belongs to the user's draft across pages.
		if a.quick.Page == a.page || !reflect.DeepEqual(a.quick.Draft, a.quick.Base) {
			return
		}
	}
	now := atClock(time.Now().In(a.location()), a.session.User.DefaultTaskStartTime)
	a.quick.Draft = draftFrom(api.Task{}, now)
	a.quick.Draft.End = now.Add(time.Hour)
	if a.page == "today" {
		a.quick.Draft.HasStart = true
	}
	for _, cat := range a.categories {
		if a.page == fmt.Sprintf("category:%d", cat.ID) {
			a.quick.Draft.Categories[cat.ID] = true
		}
	}
	a.quick.Base = a.quick.Draft
	a.quick.Base.Categories = maps.Clone(a.quick.Draft.Categories)
	a.quick.Page = a.page
	a.quick.Ready = true
}

func (a *App) activateQuickAdd() {
	if a.selectedOccurrence != nil || (a.editing && (a.draft.Task.ID != 0 || !a.taskDraftDirty())) {
		if a.taskDraftDirty() {
			a.flushDetailAutosave()
		}
		if !a.taskDraftDirty() {
			a.clearTaskSelection()
		}
	} else {
		a.taskDetailOpen = false
	}
	a.quick.Open = true
}

func (a *App) beginQuickAdd() {
	if a.client == nil || a.aiPanel != nil {
		return
	}
	begin := func() {
		if !isTaskWorkspacePage(a.page) {
			a.page = "all"
		}
		a.ensureQuickDraft()
		a.activateQuickAdd()
		a.quick.Input.Focus()
	}
	if !isTaskWorkspacePage(a.page) {
		a.requestTaskTransition(begin)
	} else {
		begin()
	}
}

func (a *App) submitQuickTask() {
	if a.busy {
		return
	}
	if a.pruneMissingDraftCategories(&a.quick.Draft) {
		a.failure = "部分所选分类已被移除，已取消这些关联；请检查分类后再次添加任务。"
		return
	}
	a.applySmartQuickDraft()
	body, err := a.quick.Draft.payload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.queueTask("POST", "/tasks", body, 0, func() {
		a.quick = quickAddState{Input: a.quick.Input, Open: true}
		a.ensureQuickDraft()
		a.quick.Input.Focus()
	})
}

func (a *App) expandQuickTask() {
	a.requestTaskTransition(func() {
		a.ensureQuickDraft()
		a.applySmartQuickDraft()
		draft := a.quick.Draft
		a.newTaskNow()
		a.draft = draft
		// This transferred input is unsaved and must remain protected on navigation.
		a.quick = quickAddState{Input: a.quick.Input}
	})
}

func (a *App) quickAddBar(c *ui.Context) {
	a.ensureQuickDraft()
	q := &a.quick
	t := tokensOf(c)
	// Single-line 42px inline quick-add row: never expands into a bulky multi-row
	// box when clicked, keeping the task list completely steady beneath it.
	panel := ui.Row(c.Key("quick-add")).Label("快捷添加区").Margin(6, 10, 4, 10).Padding(0, 8).Height(42).Gap(6).Radius(7).
		AlignItems(ui.Center).Background(ui.Transparent).BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).
		OnShortcut(0, ui.KeyEscape, func() { q.Open = false; q.Meta = "" })
	wasFocused := ui.Local(panel, "input-focused", func() bool { return false })
	if q.Open && q.Meta == "" && panel.PressedOutside() {
		q.Open = false
	} else if panel.PressedInside() && (!q.Open || a.editing || a.selectedOccurrence != nil) {
		a.activateQuickAdd()
	}
	if q.Open {
		panel.Background(t.BgSubtle).Border(1, t.BorderDefault)
	} else if panel.Hovered() {
		panel.Background(t.BgSubtle.Alpha(0.65)).BorderColor(ui.Transparent)
	}
	panel.Children(func() {
		iconCol := t.TextTertiary
		if q.Open {
			iconCol = t.Accent
		}
		ui.Icon(c, lucide.Plus()).Size(15, 15).TextColor(iconCol).Shrink(0).AccessHidden(true)
		input := ui.TextInputBase(c.Key("quick-title"), &q.Draft.Title).Ref(&q.Input).Grow(1).MinWidth(0).FontSize(fontBody).MinHeight(30).
			Label("快捷添加标题").Placeholder("添加任务…").PlaceholderColor(t.TextReadable).
			OnSubmit(a.submitQuickTask).OnChange(a.activateQuickAdd).OnClick(a.activateQuickAdd)
		if input.Focused() && !*wasFocused {
			a.activateQuickAdd()
		}
		*wasFocused = input.Focused()
		if !q.Open {
			return
		}

		smart := a.previewSmartInput(q.Draft.Title)

		// Inline iconic property & commit actions on the exact same row
		date := "日期"
		dateActive := q.Draft.HasStart
		if q.Draft.HasStart && (!smart.HasTime || q.Draft.HasStart != q.Base.HasStart || !q.Draft.Start.Equal(q.Base.Start)) {
			date = q.Draft.Start.Format("01/02")
		} else if smart.HasTime {
			date = smart.TimeDisplay
			dateActive = true
		} else if q.Draft.HasStart {
			date = q.Draft.Start.Format("01/02")
		}
		a.quickProperty(c, "date", "快捷日期", date, lucide.Calendar(), dateActive, func() {
			a.taskDateProperty(c, &q.Draft, true)
		})

		names := []string{}
		for _, cat := range a.categories {
			if q.Draft.Categories[cat.ID] {
				names = append(names, cat.Name)
			}
		}
		category := "分类"
		if len(names) == 1 {
			category = names[0]
		} else if len(names) > 1 {
			category = fmt.Sprintf("%s+%d", names[0], len(names)-1)
		}
		a.quickProperty(c, "category", "快捷分类", category, lucide.Folder(), len(names) > 0, func() {
			if len(a.categories) == 0 {
				ui.Text(c, "尚无分类，可在管理分类中创建。").FontSize(12)
			}
			ui.Scroll(c.Key("quick-category-options")).MaxHeight(220).Gap(3).Children(func() {
				for _, cat := range a.categories {
					propertyMultiOption(c, cat.Name, q.Draft.Categories[cat.ID], func() { q.Draft.Categories[cat.ID] = !q.Draft.Categories[cat.ID] })
				}
			})
		})

		prioVal := q.Draft.Priority
		if prioVal == q.Base.Priority && smart.HasPriority {
			prioVal = smart.PriorityLabel
		}
		a.quickProperty(c, "priority", "快捷优先级", prioVal, lucide.Flag(), prioVal != "普通", func() {
			for _, value := range []string{"高", "普通", "低"} {
				propertyOption(c, value, q.Draft.Priority == value, func() { q.Draft.Priority = value; q.Meta = "" })
			}
		})

		expandBtn := ui.ButtonBase(c.Key("quick-expand")).Label("详细编辑").Tooltip("展开完整详情").Size(26, 26).Radius(5).Center().
			Cursor(ui.CursorPointer).OnClick(a.expandQuickTask)
		if expandBtn.Hovered() {
			expandBtn.Background(t.BgHover)
		}
		expandBtn.Children(func() {
			ui.Icon(c, lucide.Maximize2()).Size(13.5, 13.5).TextColor(t.TextSecondary).AccessHidden(true)
		})

		hasTitle := strings.TrimSpace(q.Draft.Title) != ""
		submitBtn := ui.ButtonBase(c.Key("quick-submit")).Label("添加").Tooltip("创建任务 (Enter)").Size(26, 26).Radius(6).Center().
			Cursor(ui.CursorPointer).Disabled(!hasTitle).OnClick(a.submitQuickTask)
		if hasTitle {
			submitBtn.Background(t.Accent)
			if submitBtn.Hovered() {
				submitBtn.Background(t.AccentHover)
			}
		} else {
			submitBtn.Background(t.BgHover.Alpha(0.6))
		}
		submitBtn.Children(func() {
			col := t.TextTertiary
			if hasTitle {
				col = t.TextOnAccent
			}
			ui.Icon(c, lucide.CornerDownLeft()).Size(13.5, 13.5).TextColor(col).AccessHidden(true)
		})
	})
}

func (a *App) quickProperty(c *ui.Context, key, label, value string, icon *ui.SVG, active bool, content func()) {
	q := &a.quick
	trigger := propertyTrigger(c, "quick-"+key, label, value, icon, active).OnClick(func() {
		if q.Meta == key {
			q.Meta = ""
		} else {
			q.Meta = key
		}
	})
	open := ownedPropertyOpen(trigger, q.Meta == key)
	propertyPopover(c.Key("quick-popup-"+key), trigger, open, func() {
		ui.Column(c).Gap(8).Children(func() {
			ui.Text(c, label).FontSize(13).Bold()
			content()
			ui.Text(c, "草稿 · 添加任务后保存").FontSize(11).TextColor(c.Theme().TextMuted)
			appActionButton(c, "完成", action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { q.Meta = "" })
		})
	})
	if !*open && q.Meta == key {
		q.Meta = ""
	}
}

func (a *App) syncSearchSelection() {
	results := a.searchResults()
	for i, task := range results {
		if a.taskRowSelected(task) {
			a.search.Index = i
			return
		}
	}
	if a.search.Index >= len(results) {
		a.search.Index = max(0, len(results)-1)
	}
}

func (a *App) openTaskSearch() {
	if a.client == nil || a.aiPanel != nil {
		return
	}
	if !isTaskWorkspacePage(a.page) {
		a.requestTaskTransition(func() {
			a.page = "all"
			a.query = ""
			a.search.Open = true
			a.search.Return = false
			a.syncSearchSelection()
			a.search.Input.Focus()
		})
		return
	}
	a.search.Open = true
	a.search.Return = false
	a.syncSearchSelection()
	a.search.Input.Focus()
}

func (a *App) searchResults() []api.Task {
	now := time.Now().In(a.location())
	return a.cachedTaskList(a.page, a.query, now)
}

func (a *App) openSearchResult(task api.Task) {
	a.search.Open, a.search.Return = false, true
	a.highlightedTaskKey = taskRowKey(task)
	a.highlightPending = nil
	a.openTask(task)
	if a.selectedTaskID == task.ID || (a.selectedOccurrence != nil && taskRowKey(*a.selectedOccurrence) == taskRowKey(task)) {
		a.revealTaskID = task.ID
	}
}

func (a *App) taskSearchPanel(c *ui.Context) {
	t := tokensOf(c)
	appDialog(c.Key("task-search-panel"), &a.search.Open, func() {
		results := a.searchResults()
		if a.search.Index >= len(results) {
			a.search.Index = max(0, len(results)-1)
		}
		selectResult := func() {
			if len(results) > 0 {
				a.openSearchResult(results[a.search.Index])
			}
		}
		ui.Column(c).Gap(10).OnShortcut(0, ui.KeyDown, func() {
			if len(results) > 0 {
				a.search.Index = (a.search.Index + 1) % len(results)
			}
		}).OnShortcut(0, ui.KeyUp, func() {
			if len(results) > 0 {
				a.search.Index = (a.search.Index + len(results) - 1) % len(results)
			}
		}).OnShortcut(0, ui.KeyEscape, func() { a.search.Open = false }).Children(func() {
			ui.Row(c).Gap(10).Padding(2, 0).AlignItems(ui.Center).Children(func() {
				ui.Icon(c, lucide.Search()).Size(18, 18).TextColor(t.Accent)
				ui.TextInputBase(c.Key("search-query"), &a.query).Ref(&a.search.Input).Label("搜索任务").Placeholder("搜索任务标题或备注…").PlaceholderColor(t.TextReadable).FontSize(16).Grow(1).MinWidth(0).AutoFocus().OnChange(func() { a.search.Index = 0 }).OnSubmit(selectResult)
				if a.query != "" {
					iconButton(c, "清除搜索", lucide.CircleX()).Size(28, 28).Padding(6).OnClick(func() { a.query = ""; a.search.Index = 0; a.search.Input.Focus() })
				}
				appActionButton(c, "关闭搜索", action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { a.search.Open = false })
			})
			scope := fmt.Sprintf("%s · 当前已读取任务与备注 · %d 项", a.title(), len(results))
			ui.Text(c, scope).Label(fmt.Sprintf("%d 个任务", len(results))).Description(scope).FontSize(12).TextColor(t.TextSecondary)
			if a.failure != "" {
				ui.Text(c, "同步未完成，仍可搜索本机数据："+a.failure).FontSize(12).TextColor(t.Danger)
			}
			ui.Box(c).Height(1).FillWidth().Background(t.BorderSubtle)
			_, windowHeight := c.Size()
			resultsHeight := float32(max(60, len(results)*54+max(0, len(results)-1)*3))
			if len(results) == 0 {
				resultsHeight = 84
			}
			resultsHeight = min(resultsHeight, min(320, max(96, windowHeight-260)))
			ui.Scroll(c.Key("search-results")).Label("搜索结果列表").Height(resultsHeight).MinHeight(0).Gap(2).Children(func() {
				if len(results) == 0 {
					ui.Column(c).Padding(16, 0).Gap(4).AlignItems(ui.Center).FillWidth().Children(func() {
						ui.Text(c, "没有匹配的任务").FontSize(14).FontWeight(600)
						ui.Text(c, "试试其他关键词，或清除搜索。").FontSize(12).TextColor(t.TextSecondary)
					})
				}
				for i, task := range results {
					row := ui.Box(c.Key(a.stableTaskKey(task))).Shrink(0)
					if i == a.search.Index {
						row.ScrollIntoView()
					}
					row.Children(func() {
						a.taskListItemWithOpen(c, task, time.Now(), "搜索结果 "+task.Title, i == a.search.Index, func() { a.openSearchResult(task) })
					})
				}
			})
			if isHistoryPage(a.page) {
				if a.history.HasMore {
					ui.Text(c, "筛选当前已加载记录；还有重复任务历史未加载。").FontSize(fontAux).TextColor(t.TextSecondary)
					appButton(c, "加载更多重复任务历史", "secondary").Disabled(a.busy).OnClick(a.loadMoreHistory)
				} else {
					ui.Text(c, "全部历史已加载；日期按账户时区计算。").FontSize(fontAux).TextColor(t.TextSecondary)
				}
			}
			ui.Text(c, "↑ ↓ 选择 · Enter 打开详情 · Esc 关闭").FontSize(11).TextColor(t.TextTertiary)
		})
	}).Width(600).Padding(18)
}
