package app

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"github.com/lobehub/lobe-mygo/pkg/theme"
	"todo-native/internal/api"
)

type historyFilter struct {
	Basis, Range, Order, Priority string
	CategoryID                    int64 // 0: all, -1: uncategorized
	From, To                      time.Time
}

func (f historyFilter) normalized() historyFilter {
	if f.Basis == "" {
		f.Basis = "处理时间"
	}
	if f.Range == "" {
		f.Range = "全部时间"
	}
	if f.Order == "" {
		f.Order = "最新在前"
	}
	if f.Priority == "" {
		f.Priority = "全部优先级"
	}
	return f
}

func (f historyFilter) isActive() bool {
	n := f.normalized()
	return n.Range != "全部时间" || n.Basis != "处理时间" || n.Order != "最新在前" || n.Priority != "全部优先级" || n.CategoryID != 0
}

func (f historyFilter) extraCount() int {
	n := f.normalized()
	cnt := 0
	if n.CategoryID != 0 {
		cnt++
	}
	if n.Priority != "全部优先级" {
		cnt++
	}
	if n.Basis != "处理时间" {
		cnt++
	}
	return cnt
}

func isHistoryPage(page string) bool {
	return page == "completed" || page == "cancelled" || page == "skipped"
}

func historyTime(task api.Task, basis string) time.Time {
	switch basis {
	case "创建时间":
		return task.CreatedAt
	case "任务时间":
		if t := taskPrimaryTime(task); t != nil {
			return *t
		}
	default:
		if task.Status == "completed" && task.CompletedAt != nil {
			return *task.CompletedAt
		}
		if task.Status == "cancelled" && task.DeletedAt != nil {
			return *task.DeletedAt
		}
		// Legacy ordinary tasks have updated_at, but an occurrence must never
		// inherit its series' timestamps. Skipped rows have no action timestamp.
		if task.Status != "skipped" {
			return task.UpdatedAt
		}
		if t := taskPrimaryTime(task); t != nil {
			return *t
		}
	}
	return time.Time{}
}

func localDay(t time.Time, loc *time.Location) time.Time {
	// Date picker values are calendar dates; retain their date components
	// when the account timezone changes instead of converting an old instant.
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
}

func (f historyFilter) bounds(now time.Time) (time.Time, time.Time, bool) {
	day := localDay(now, now.Location())
	switch f.Range {
	case "今天":
		return day, day.AddDate(0, 0, 1), true
	case "昨天":
		return day.AddDate(0, 0, -1), day, true
	case "最近7天":
		return day.AddDate(0, 0, -6), day.AddDate(0, 0, 1), true
	case "最近30天":
		return day.AddDate(0, 0, -29), day.AddDate(0, 0, 1), true
	case "自定义日期":
		if f.From.IsZero() || f.To.IsZero() {
			return time.Time{}, time.Time{}, false
		}
		from, to := localDay(f.From, now.Location()), localDay(f.To, now.Location())
		return from, to.AddDate(0, 0, 1), !to.Before(from)
	}
	return time.Time{}, time.Time{}, true
}

func filterHistory(tasks []api.Task, f historyFilter, now time.Time) []api.Task {
	from, end, valid := f.bounds(now)
	result := make([]api.Task, 0, len(tasks))
	if !valid {
		return result
	}
	for _, task := range tasks {
		if f.CategoryID == -1 && len(task.Categories) != 0 {
			continue
		}
		if f.CategoryID > 0 && !slices.ContainsFunc(task.Categories, func(c api.Category) bool { return c.ID == f.CategoryID }) {
			continue
		}
		switch f.Priority {
		case "高优先级":
			if task.Priority != 1 {
				continue
			}
		case "普通优先级":
			if task.Priority != 0 {
				continue
			}
		case "低优先级":
			if task.Priority != -1 {
				continue
			}
		}
		t := historyTime(task, f.Basis)
		if !from.IsZero() && (t.IsZero() || t.Before(from) || !t.Before(end)) {
			continue
		}
		result = append(result, task)
	}
	slices.SortStableFunc(result, func(a, b api.Task) int {
		at, bt := historyTime(a, f.Basis), historyTime(b, f.Basis)
		// Undated legacy rows stay last in both directions.
		if at.IsZero() != bt.IsZero() {
			if at.IsZero() {
				return 1
			}
			return -1
		}
		if order := at.Compare(bt); order != 0 {
			if f.Order == "最早在前" {
				return order
			}
			return -order
		}
		if a.ID > b.ID {
			return -1
		}
		if a.ID < b.ID {
			return 1
		}
		return strings.Compare(b.InstanceID, a.InstanceID)
	})
	return result
}

type historyDisplayItem struct {
	isHeader  bool
	headerKey string
	title     string
	count     int
	task      api.Task
	taskIndex int
}

func historyGroupLabel(ts, now time.Time) (string, string) {
	if ts.IsZero() {
		return "undated", "未记录时间"
	}
	loc := now.Location()
	d := localDay(ts.In(loc), loc)
	today := localDay(now, loc)
	key := d.Format("2006-01-02")
	switch d {
	case today:
		return key, "今天"
	case today.AddDate(0, 0, -1):
		return key, "昨天"
	}
	wk := "周" + []string{"日", "一", "二", "三", "四", "五", "六"}[d.Weekday()]
	if d.Year() == today.Year() {
		return key, d.Format("01月02日 ") + wk
	}
	return key, d.Format("2006年01月02日 ") + wk
}

func buildGroupedHistoryRows(tasks []api.Task, basis string, now time.Time) ([]historyDisplayItem, []int) {
	if basis == "" {
		basis = "处理时间"
	}
	rows := make([]historyDisplayItem, 0, len(tasks)+8)
	taskToRow := make([]int, len(tasks))
	currentKey := ""
	headerIdx := -1
	for i, task := range tasks {
		gKey, gTitle := historyGroupLabel(historyTime(task, basis), now)
		if gKey != currentKey {
			currentKey = gKey
			headerIdx = len(rows)
			rows = append(rows, historyDisplayItem{
				isHeader:  true,
				headerKey: "hdr:" + gKey,
				title:     gTitle,
				count:     0,
			})
		}
		rows[headerIdx].count++
		taskToRow[i] = len(rows)
		rows = append(rows, historyDisplayItem{
			task:      task,
			taskIndex: i,
		})
	}
	return rows, taskToRow
}

// Streamlined 2-row History Filter Bar:
// - Row 1: Instant inline keyword search + 1-click sort direction icon + filter popover icon
// - Row 2: 1-click date range pills (全部 / 今天 / 昨天 / 近7天 / 近30天 / 自定义) + removable active filter chips + conditional Reset
func (a *App) historyToolbar(c *ui.Context, now time.Time) {
	t := tokensOf(c)
	f := &a.historyFilter
	*f = f.normalized()

	holder := ui.Column(c.Key("history-toolbar")).Padding(8, 10, 8, 10).Gap(6).
		BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle)
	filterOpen := ui.Local(holder, "filter-open", func() bool { return false })
	customOpen := ui.Local(holder, "custom-open", func() bool { return false })
	customPickingEnd := ui.Local(holder, "custom-end", func() bool { return false })

	holder.Children(func() {
		// Row 1: Inline Live Search + Sort Toggle + Advanced Filter Popover
		ui.Row(c.Key("history-search-row")).Gap(6).AlignItems(ui.Center).Children(func() {
			placeholder := map[string]string{
				"completed": "搜索已完成记录…",
				"cancelled": "搜索已取消记录…",
				"skipped":   "搜索已跳过记录…",
			}[a.page]
			if placeholder == "" {
				placeholder = "搜索历史记录…"
			}
			appSearchBar(c.Key("history-search-input"), &a.query, field.SearchBarProps{
				Size:        theme.Small,
				Placeholder: placeholder,
			}).Label("搜索历史记录")

			// 1-Click Sort Direction Toggle
			asc := f.Order == "最早在前"
			sortIcon := lucide.ArrowDownWideNarrow()
			sortTip := "排序：最新在前（点击切换为最早在前）"
			if asc {
				sortIcon = lucide.ArrowUpNarrowWide()
				sortTip = "排序：最早在前（点击切换为最新在前）"
			}
			sortBtn := ui.ButtonBase(c.Key("history-sort-btn")).Label("历史排序").Description(f.Order).Tooltip(sortTip).
				Size(30, 30).Radius(6).Center().Cursor(ui.CursorPointer).OnClick(func() {
				if f.Order == "最早在前" {
					f.Order = "最新在前"
				} else {
					f.Order = "最早在前"
				}
			})
			if asc {
				sortBtn.Background(t.BgSelected)
			} else if sortBtn.Hovered() {
				sortBtn.Background(t.BgHover)
			}
			sortBtn.Children(func() {
				col := t.TextSecondary
				if asc {
					col = t.Accent
				}
				ui.Icon(c, sortIcon).Size(15, 15).TextColor(col).AccessHidden(true)
			})

			// Compact Filter Popover Trigger (Category + Priority + Time Basis)
			extraCnt := f.extraCount()
			var filterAnchor ui.Element
			filterBox := ui.Box(c.Key("history-filter-holder")).Shrink(0)
			filterBox.Children(func() {
				filterAnchor = ui.ButtonBase(c.Key("history-filter-btn")).Label("历史筛选条件").Tooltip("筛选分类、优先级与时间依据").
					Height(30).MinWidth(30).Padding(0, 7).Radius(6).Center().Cursor(ui.CursorPointer).
					OnClick(func() { *filterOpen = !*filterOpen })
				if extraCnt > 0 || *filterOpen {
					filterAnchor.Background(t.Accent.Alpha(0.14))
				} else if filterAnchor.Hovered() {
					filterAnchor.Background(t.BgHover)
				}
				filterAnchor.Children(func() {
					col := t.TextSecondary
					if extraCnt > 0 || *filterOpen {
						col = t.Accent
					}
					ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
						ui.Icon(c, lucide.SlidersHorizontal()).Size(14, 14).TextColor(col).AccessHidden(true)
						if extraCnt > 0 {
							ui.Text(c, fmt.Sprint(extraCnt)).FontSize(11).FontFeatures("tnum").FontWeight(600).TextColor(t.Accent)
						}
					})
				})

				if *filterOpen {
					ui.PopoverBase(c.Key("history-filter-popover"), filterAnchor, filterOpen, func(panel ui.Element) {
						panel.AttachTo(filterAnchor, ui.AnchorBottomEnd, ui.AnchorBottomStart)
						elevatePopup(c, panel.Width(284).Padding(12).Gap(12).Radius(popoverRadius).Background(t.BgApp).Label("历史筛选面板"))
						panel.Children(func() {
							ui.Row(c).AlignItems(ui.Center).Children(func() {
								ui.Text(c, "筛选条件").FontSize(13).FontWeight(600).TextColor(t.TextPrimary).Grow(1)
								if extraCnt > 0 {
									appActionButton(c, "清空", action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() {
										f.CategoryID = 0
										f.Priority = "全部优先级"
										f.Basis = "处理时间"
									})
								}
							})

							// 1. Category Pills
							ui.Column(c).Gap(6).Children(func() {
								ui.Text(c, "分类").FontSize(11.5).FontWeight(500).TextColor(t.TextSecondary)
								ui.Row(c).Gap(5).Wrap().Children(func() {
									catPill := func(key, label string, id int64) {
										sel := f.CategoryID == id
										btn := ui.ButtonBase(c.Key("hcat-"+key)).Label("筛选分类 "+label).Height(25).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer)
										fg := t.TextReadable
										if sel {
											btn.Background(t.Accent)
											fg = t.TextOnAccent
										} else {
											btn.Background(t.BgSubtle)
											if btn.Hovered() {
												btn.Background(t.BgHover)
												fg = t.TextPrimary
											}
										}
										btn.OnClick(func() {
											if f.CategoryID == id && id != 0 {
												f.CategoryID = 0
											} else {
												f.CategoryID = id
											}
										}).Children(func() {
											ui.Text(c, label).FontSize(11.5).FontWeight(500).TextColor(fg).SingleLine()
										})
									}
									catPill("all", "全部", 0)
									catPill("none", "无分类", -1)
									for _, cat := range a.categories {
										cid := cat.ID
										lbl := strings.TrimSpace(cat.Emoji + " " + cat.Name)
										catPill(fmt.Sprint(cid), lbl, cid)
									}
								})
							})

							// 2. Priority Pills
							ui.Column(c).Gap(6).Children(func() {
								ui.Text(c, "优先级").FontSize(11.5).FontWeight(500).TextColor(t.TextSecondary)
								ui.Row(c).Gap(5).Wrap().Children(func() {
									for _, p := range []struct{ short, full string }{
										{"全部", "全部优先级"},
										{"高", "高优先级"},
										{"普通", "普通优先级"},
										{"低", "低优先级"},
									} {
										item := p
										sel := f.Priority == item.full
										btn := ui.ButtonBase(c.Key("hpri-"+item.full)).Label("筛选优先级 "+item.full).Height(25).Padding(0, 9).Radius(5).Center().Cursor(ui.CursorPointer)
										fg := t.TextReadable
										if sel {
											btn.Background(t.Accent)
											fg = t.TextOnAccent
										} else {
											btn.Background(t.BgSubtle)
											if btn.Hovered() {
												btn.Background(t.BgHover)
												fg = t.TextPrimary
											}
										}
										btn.OnClick(func() {
											if f.Priority == item.full && item.full != "全部优先级" {
												f.Priority = "全部优先级"
											} else {
												f.Priority = item.full
											}
										}).Children(func() {
											ui.Text(c, item.short).FontSize(11.5).FontWeight(500).TextColor(fg)
										})
									}
								})
							})

							// 3. Time Basis Pills
							ui.Column(c).Gap(6).Children(func() {
								ui.Text(c, "时间统计依据").FontSize(11.5).FontWeight(500).TextColor(t.TextSecondary)
								ui.Row(c).Gap(5).Wrap().Children(func() {
									for _, b := range []string{"处理时间", "任务时间", "创建时间"} {
										basisVal := b
										sel := f.Basis == basisVal
										btn := ui.ButtonBase(c.Key("hbasis-"+basisVal)).Label("时间依据 "+basisVal).Height(25).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer)
										fg := t.TextReadable
										if sel {
											btn.Background(t.Accent)
											fg = t.TextOnAccent
										} else {
											btn.Background(t.BgSubtle)
											if btn.Hovered() {
												btn.Background(t.BgHover)
												fg = t.TextPrimary
											}
										}
										btn.OnClick(func() { f.Basis = basisVal }).Children(func() {
											ui.Text(c, basisVal).FontSize(11.5).FontWeight(500).TextColor(fg)
										})
									}
								})
								if a.page == "skipped" && f.Basis == "处理时间" {
									ui.Text(c, "已跳过记录无独立操作时刻，默认按任务时间匹配").FontSize(11).TextColor(t.TextTertiary)
								}
							})
						})
					})
				}
			})
		})

		// Row 2: 1-Click Time Range Pills + Interactive Custom Range Popover + Active Filter Chips
		ui.Row(c.Key("history-range-pills")).Gap(4).Wrap().AlignItems(ui.Center).Children(func() {
			for _, rng := range []struct{ short, val string }{
				{"全部", "全部时间"},
				{"今天", "今天"},
				{"昨天", "昨天"},
				{"近7天", "最近7天"},
				{"近30天", "最近30天"},
			} {
				item := rng
				sel := f.Range == item.val
				pill := ui.ButtonBase(c.Key("hrng-"+item.val)).Label("历史范围 "+item.val).Height(24).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer)
				fg := t.TextReadable
				if sel {
					pill.Background(t.BgSelected)
					fg = t.TextPrimary
				} else if pill.Hovered() {
					pill.Background(t.BgHover)
					fg = t.TextPrimary
				}
				pill.OnClick(func() {
					f.Range = item.val
					*customOpen = false
				}).Children(func() {
					weight := 400
					if sel {
						weight = 600
					}
					ui.Text(c, item.short).FontSize(11.5).FontWeight(weight).TextColor(fg)
				})
			}

			// Custom Date Range Pill + Interactive Calendar Popover
			customBox := ui.Box(c.Key("history-custom-holder")).Shrink(0)
			customBox.Children(func() {
				isCustom := f.Range == "自定义日期"
				customLabel := "自定义"
				if isCustom && !f.From.IsZero() && !f.To.IsZero() {
					customLabel = f.From.Format("01/02") + "–" + f.To.Format("01/02")
				}
				customAnchor := ui.ButtonBase(c.Key("hrng-custom")).Label("自定义日期范围").Height(24).Padding(0, 8).Radius(5).Center().Cursor(ui.CursorPointer).
					OnClick(func() {
						if f.From.IsZero() || f.To.IsZero() {
							today := localDay(now, now.Location())
							f.From, f.To = today.AddDate(0, 0, -6), today
						}
						f.Range = "自定义日期"
						*customPickingEnd = false
						*customOpen = !*customOpen
					})
				fg := t.TextReadable
				if isCustom {
					customAnchor.Background(t.Accent.Alpha(0.14))
					fg = t.Accent
				} else if customAnchor.Hovered() {
					customAnchor.Background(t.BgHover)
					fg = t.TextPrimary
				}
				customAnchor.Children(func() {
					ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
						ui.Icon(c, lucide.Calendar()).Size(12, 12).TextColor(fg).AccessHidden(true)
						ui.Text(c, customLabel).FontSize(11.5).FontFeatures("tnum").FontWeight(500).TextColor(fg).SingleLine()
					})
				})

				if *customOpen {
					ui.PopoverBase(c.Key("history-custom-popover"), customAnchor, customOpen, func(panel ui.Element) {
						panel.AttachTo(customAnchor, ui.AnchorBottomStart, ui.AnchorTopStart)
						elevatePopup(c, panel.Width(296).Padding(12).Gap(8).Radius(popoverRadius).Background(t.BgApp).Label("选择自定义日期范围"))
						panel.Children(func() {
							// Quick Range Presets inside Custom Popover
							today := localDay(now, now.Location())
							ui.Row(c).Gap(4).Wrap().AlignItems(ui.Center).Children(func() {
								preset := func(id, name string, from, to time.Time) {
									b := ui.ButtonBase(c.Key("cpre-"+id)).Label(name).Height(23).Padding(0, 7).Radius(5).Background(t.BgSubtle).Center().Cursor(ui.CursorPointer)
									if b.Hovered() {
										b.Background(t.BgHover)
									}
									b.OnClick(func() {
										f.Range = "自定义日期"
										f.From, f.To = from, to
									}).Children(func() {
										ui.Text(c, name).FontSize(11).FontWeight(500).TextColor(t.TextSecondary)
									})
								}
								weekdayOffset := (int(today.Weekday()) + 6) % 7
								thisMonday := today.AddDate(0, 0, -weekdayOffset)
								thisMonthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
								lastMonthStart := thisMonthStart.AddDate(0, -1, 0)
								lastMonthEnd := thisMonthStart.AddDate(0, 0, -1)
								preset("week", "本周", thisMonday, today)
								preset("month", "本月", thisMonthStart, today)
								preset("prev-month", "上月", lastMonthStart, lastMonthEnd)
								ui.Spacer(c)
								appActionButton(c, "完成", action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { *customOpen = false })
							})

							// Start / End Interactive Tab Selector + Calendar Grid (no redundant old DateInputs)
							ui.Row(c).Gap(6).Children(func() {
								tabBtn := func(pickingEnd bool, title, accessLabel string, val time.Time) {
									active := *customPickingEnd == pickingEnd
									tb := ui.ButtonBase(c.Key(fmt.Sprintf("ctab-%t", pickingEnd))).Label(accessLabel).Grow(1).Height(28).Padding(0, 8).Radius(6).Justify(ui.Start).Cursor(ui.CursorPointer)
									if active {
										tb.Background(t.Accent.Alpha(0.12)).Border(1, t.Accent)
									} else {
										tb.Background(t.BgSubtle).Border(1, ui.Transparent)
									}
									tb.OnClick(func() { *customPickingEnd = pickingEnd }).Children(func() {
										ui.Text(c, title+" "+val.Format("2006-01-02")).FontSize(11.5).FontFeatures("tnum").FontWeight(500).TextColor(t.TextPrimary)
									})
								}
								tabBtn(false, "起", "历史起始日期", f.From)
								tabBtn(true, "止", "历史结束日期", f.To)
							})

							targetDate := &f.From
							if *customPickingEnd {
								targetDate = &f.To
							}
							if appCalendar(c, targetDate, "选择历史区间日期") {
								f.Range = "自定义日期"
								if !*customPickingEnd {
									if f.To.Before(f.From) {
										f.To = f.From
									}
									*customPickingEnd = true
								} else if f.To.Before(f.From) {
									f.From = f.To
								}
							}
							if _, _, valid := f.bounds(now); !valid {
								ui.Text(c, "结束日期不能早于开始日期").FontSize(11).TextColor(t.Danger)
							}
						})
					})
				}
			})

			// Removable Active Filter Chips (one-click dismiss)
			removableTag := func(key, text, clearTip string, onClear func()) {
				chip := ui.ButtonBase(c.Key("hchip-"+key)).Label(clearTip).Tooltip(clearTip).
					Height(22).Padding(0, 6).Radius(5).Background(t.Accent.Alpha(0.12)).Center().Cursor(ui.CursorPointer).OnClick(onClear)
				if chip.Hovered() {
					chip.Background(t.Accent.Alpha(0.20))
				}
				chip.Children(func() {
					ui.Row(c).Gap(3).AlignItems(ui.Center).Children(func() {
						ui.Text(c, text).FontSize(11).FontWeight(500).TextColor(t.Accent).SingleLine()
						ui.Icon(c, lucide.X()).Size(10, 10).TextColor(t.Accent).AccessHidden(true)
					})
				})
			}

			if f.CategoryID != 0 {
				catName := "无分类"
				if f.CategoryID > 0 {
					catName = "分类已不可用"
					for _, cat := range a.categories {
						if cat.ID == f.CategoryID {
							catName = strings.TrimSpace(cat.Emoji + " " + cat.Name)
							break
						}
					}
				}
				removableTag("cat", catName, "移除分类筛选 "+catName, func() { f.CategoryID = 0 })
			}
			if f.Priority != "全部优先级" {
				removableTag("pri", strings.TrimSuffix(f.Priority, "优先级")+"优", "移除优先级筛选", func() { f.Priority = "全部优先级" })
			}
			if f.Basis != "处理时间" {
				removableTag("basis", "按"+f.Basis, "恢复按处理时间", func() { f.Basis = "处理时间" })
			}

			// Conditional 1-Click Reset (only visible when filters or search are active!)
			if f.isActive() || strings.TrimSpace(a.query) != "" {
				ui.Spacer(c)
				resetBtn := ui.ButtonBase(c.Key("history-reset")).Label("重置筛选").Tooltip("清空所有筛选与搜索").
					Height(22).Padding(0, 6).Radius(5).Center().Cursor(ui.CursorPointer).
					OnClick(func() {
						a.historyFilter = historyFilter{}
						a.query = ""
						*customOpen = false
						*filterOpen = false
					})
				if resetBtn.Hovered() {
					resetBtn.Background(t.BgHover)
				}
				resetBtn.Children(func() {
					ui.Row(c).Gap(3).AlignItems(ui.Center).Children(func() {
						ui.Icon(c, lucide.RotateCcw()).Size(11, 11).TextColor(t.TextSecondary).AccessHidden(true)
						ui.Text(c, "重置").FontSize(11).FontWeight(500).TextColor(t.TextSecondary)
					})
				})
			}
		})

		// Inline validation / sync error only when actionable
		if f.Range == "自定义日期" {
			if _, _, valid := f.bounds(now); !valid {
				ui.Text(c, "结束日期不能早于开始日期").FontSize(11).TextColor(t.Danger)
			}
		}
		if a.syncedAt.IsZero() && len(a.tasks) == 0 && len(a.history.Items) == 0 {
			ui.Text(c, "尚未同步历史记录，联网刷新后可查看").FontSize(11).TextColor(t.TextTertiary)
		}
	})
}

func historyMeta(task api.Task, loc *time.Location) string {
	actionWord := map[string]string{"completed": "完成", "cancelled": "取消", "skipped": "跳过"}[task.Status]
	var parts []string
	if ts := historyTime(task, "处理时间"); !ts.IsZero() {
		localTS := ts.In(loc)
		now := time.Now().In(loc)
		if localDay(localTS, loc).Equal(localDay(now, loc)) {
			parts = append(parts, localTS.Format("15:04")+" "+actionWord)
		} else if localTS.Year() == now.Year() {
			parts = append(parts, localTS.Format("01/02 15:04")+" "+actionWord)
		} else {
			parts = append(parts, localTS.Format("2006/01/02 15:04")+" "+actionWord)
		}
	}
	for _, cat := range task.Categories {
		parts = append(parts, strings.TrimSpace(cat.Emoji+" "+cat.Name))
	}
	if task.ReadOnly {
		parts = append(parts, "只读日历")
	}
	return strings.Join(parts, "  ·  ")
}
