package app

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/domain"
)

func timeToDateValue(t *time.Time, loc *time.Location) base.DateValue {
	if t == nil {
		return base.DateValue{}
	}
	l := t.In(loc)
	return base.DateValue{
		Start: base.NewDate(l.Year(), l.Month(), l.Day(), base.TimeOfDay{Hour: l.Hour(), Minute: l.Minute()}),
	}
}

func dateValueToTime(v base.DateValue, allDay bool, loc *time.Location) *time.Time {
	if v.Start.IsZero() {
		return nil
	}
	y, m, d := v.Start.Date()
	hour, min := v.Start.Hour(), v.Start.Minute()
	if allDay {
		hour, min = 0, 0
	}
	t := time.Date(y, m, d, hour, min, 0, 0, loc)
	return &t
}

func formatDetailDate(v base.DateValue, allDay bool) string {
	if v.Start.IsZero() {
		return "未设置"
	}
	y, m, d := v.Start.Date()
	now := time.Now()
	if !allDay && (v.Start.Hour() != 0 || v.Start.Minute() != 0) {
		if y == now.Year() {
			return fmt.Sprintf("%d月%d日 %02d:%02d", int(m), d, v.Start.Hour(), v.Start.Minute())
		}
		return fmt.Sprintf("%d/%d/%d %02d:%02d", y, int(m), d, v.Start.Hour(), v.Start.Minute())
	}
	if y == now.Year() {
		return fmt.Sprintf("%d月%d日", int(m), d)
	}
	return fmt.Sprintf("%d/%d/%d", y, int(m), d)
}

func taskDetailPage(
	cx *core.Scope,
	state *AppState,
	nav *base.Nav[taskRoute],
	taskID int64,
	creating bool,
	seed taskDraftSeed,
) base.NavPage {
	colors := ui.ColorsOf(cx)
	loc := state.locationUntracked()

	var initial api.Task
	found := false
	if !creating {
		initial, found = state.FindTask(taskID)
	}

	initTitle := seed.title
	initDesc := ""
	initStatus := "pending"
	initPriority := seed.priority
	initAllDay := true
	initDue := timeToDateValue(seed.dueDate, loc)
	initStart := base.DateValue{}
	initCats := slices.Clone(seed.categoryIDs)

	if found {
		initTitle = initial.Title
		initDesc = initial.Description
		initStatus = initial.Status
		if initStatus == "" {
			initStatus = "pending"
		}
		initPriority = initial.Priority
		initAllDay = initial.AllDay
		initDue = timeToDateValue(initial.DueDate, loc)
		initStart = timeToDateValue(initial.StartTime, loc)
		initCats = nil
		for _, c := range initial.Categories {
			initCats = append(initCats, c.ID)
		}
	}

	title := core.NewSignal(cx, initTitle)
	desc := core.NewSignal(cx, initDesc)
	status := core.NewSignal(cx, initStatus)
	priority := core.NewSignal(cx, initPriority)
	allDay := core.NewSignal(cx, initAllDay)
	dueVal := core.NewSignal(cx, initDue)
	startVal := core.NewSignal(cx, initStart)
	catIDs := core.NewSignalFunc(cx, initCats, nil)

	// Reading-first Markdown UX: default to rendered Markdown for existing tasks with content;
	// default to edit mode when creating a new task.
	editingDesc := core.NewSignal(cx, creating)
	dirty := core.NewSignal(cx, creating)
	savedHint := core.NewSignal(cx, "")

	// Bottom Sheets
	dueSheetOpen := core.NewSignal(cx, false)
	startSheetOpen := core.NewSignal(cx, false)
	prioSheetOpen := core.NewSignal(cx, false)
	statusSheetOpen := core.NewSignal(cx, false)
	catSheetOpen := core.NewSignal(cx, false)
	deleteConfirm := core.NewSignal(cx, false)

	// Delightful checkbox animation
	checkScale := core.NewAnimatedValue(cx, 1)
	burstProgress := core.NewSignal(cx, 0.0)
	detailBoost := newScrollFrameBooster(cx)

	readOnly := found && initial.ReadOnly

	persistExisting := func(showToast bool) bool {
		if creating || readOnly {
			return false
		}
		curLoc := state.locationUntracked()
		due := dateValueToTime(dueVal.GetUntracked(), allDay.GetUntracked(), curLoc)
		start := dateValueToTime(startVal.GetUntracked(), allDay.GetUntracked(), curLoc)
		latest, ok := state.FindTask(taskID)
		if !ok {
			latest = initial
		}
		var err error
		if showToast {
			err = state.UpdateTask(latest, title.GetUntracked(), desc.GetUntracked(), status.GetUntracked(), priority.GetUntracked(), due, start, allDay.GetUntracked(), catIDs.GetUntracked())
		} else {
			err = state.UpdateTaskQuiet(latest, title.GetUntracked(), desc.GetUntracked(), status.GetUntracked(), priority.GetUntracked(), due, start, allDay.GetUntracked(), catIDs.GetUntracked())
		}
		if err == nil {
			dirty.Set(false)
			savedHint.Set("已自动保存")
			cx.AfterFunc(1800*time.Millisecond, func() {
				savedHint.Set("")
			})
			return true
		}
		return false
	}

	saveAndClose := func() {
		curLoc := state.locationUntracked()
		due := dateValueToTime(dueVal.GetUntracked(), allDay.GetUntracked(), curLoc)
		start := dateValueToTime(startVal.GetUntracked(), allDay.GetUntracked(), curLoc)
		if creating {
			if _, err := state.CreateTask(
				title.GetUntracked(),
				desc.GetUntracked(),
				priority.GetUntracked(),
				due,
				start,
				allDay.GetUntracked(),
				catIDs.GetUntracked(),
			); err == nil {
				nav.Pop(1)
			}
			return
		}
		if persistExisting(true) {
			nav.Pop(1)
		}
	}

	toggleCompleted := func() {
		if readOnly {
			return
		}
		next := "completed"
		if status.GetUntracked() == "completed" {
			next = "pending"
		}
		status.Set(next)
		springPop(cx, checkScale, 0.74)
		if next == "completed" {
			cx.PlayHaptic(core.HapticSuccess)
			if !cx.Env().ReduceMotion() {
				for i := 1; i <= 10; i++ {
					step := i
					cx.AfterFunc(time.Duration(step*32)*time.Millisecond, func() {
						burstProgress.Set(float64(step) / 10.0)
					})
				}
				cx.AfterFunc(360*time.Millisecond, func() { burstProgress.Set(0) })
			}
		} else {
			cx.PlayHaptic(core.HapticSelection)
		}
		if !creating {
			persistExisting(false)
		}
	}

	categorySummary := func() string {
		ids := catIDs.Get()
		if len(ids) == 0 {
			return "未分类"
		}
		var names []string
		for _, c := range state.viewCache.Get().Categories {
			if slices.Contains(ids, c.ID) {
				if c.Emoji != "" {
					names = append(names, c.Emoji+" "+c.Name)
				} else {
					names = append(names, c.Name)
				}
			}
		}
		if len(names) == 0 {
			return "未分类"
		}
		return strings.Join(names, "、")
	}

	pageTitle := "任务详情"
	if creating {
		pageTitle = "新建任务"
	}

	var trailing []core.Node
	if !readOnly {
		if !creating {
			trailing = append(trailing, ui.IconButton{
				Icon:    lucide.Trash,
				Label:   "删除任务",
				TestID:  "detail-delete-btn",
				Tint:    colors.Muted,
				Size:    34,
				OnPress: func() { deleteConfirm.Set(true) },
			})
		}
		trailing = append(trailing, ui.Button{
			Text:    "保存",
			Variant: ui.ButtonPrimary,
			TestID:  "detail-save-btn",
			OnPress: saveAndClose,
			Style:   core.Style{Height: core.Pt(32), CornerRadius: 8, Padding: core.Symmetric(0, 12)},
		})
	}

	header := ui.NavHeader{
		Title: pageTitle,
		OnBack: func() {
			// Auto-save edits on back for existing tasks so nothing is lost.
			if !creating && !readOnly && dirty.GetUntracked() && strings.TrimSpace(title.GetUntracked()) != "" {
				persistExisting(false)
			}
			nav.Pop(1)
		},
		BackLabel: "返回",
		Trailing:  trailing,
	}

	// Compact shortcut pill under title
	shortcutPill := func(icon func() *core.SVG, textFn func() string, tintFn func() core.Color, activeFn func() bool, testID string, onPress func()) core.Node {
		return base.Button{
			Label:  testID,
			TestID: testID,
			OnPress: func(core.PressEvent) {
				if readOnly {
					return
				}
				cx.PlayHaptic(core.HapticSelection)
				onPress()
			},
			Style: core.Style{
				Direction:      core.Row,
				AlignItems:     core.AlignCenter,
				Gap:            5,
				Height:         core.Pt(30),
				Padding:        core.Symmetric(0, 10),
				CornerRadius:   15,
				BorderWidth:    1,
				JustifyContent: core.JustifyCenter,
			},
			StyleFunc: func() core.Style {
				if activeFn() {
					t := tintFn()
					return core.Style{
						Background:  ui.Alpha(t, 0.11),
						BorderColor: ui.Alpha(t, 0.28),
					}
				}
				return core.Style{
					Background:  colors.Inset(),
					BorderColor: colors.Line(),
				}
			},
			Children: []core.Node{
				ui.Icon(icon, 13, func() core.Color {
					if activeFn() {
						return tintFn()
					}
					return colors.Muted()
				}),
				core.Text{
					ContentFunc: textFn,
					MaxLines:    1,
					Style:       core.Style{FontSize: 12, FontWeight: ui.Medium},
					StyleFunc: func() core.Style {
						if activeFn() {
							return core.Style{Color: tintFn()}
						}
						return core.Style{Color: colors.Muted()}
					},
				},
			},
		}
	}

	// Clean editorial inset property row (46pt touch target)
	propRow := func(icon func() *core.SVG, label string, valueFn func() string, valueTint func() core.Color, testID string, onPress func()) core.Node {
		return base.Button{
			Label:  label,
			TestID: testID,
			OnPress: func(core.PressEvent) {
				if readOnly {
					return
				}
				cx.PlayHaptic(core.HapticSelection)
				onPress()
			},
			Style: core.Style{
				Direction:  core.Row,
				AlignItems: core.AlignCenter,
				Gap:        10,
				MinHeight:  core.Pt(46),
				Padding:    core.Symmetric(8, 14),
			},
			StyleFunc: func() core.Style {
				return core.Style{Active: &core.Style{Background: colors.Hover()}}
			},
			Children: []core.Node{
				ui.Icon(icon, 16, colors.Muted),
				core.Text{
					Content:   label,
					Style:     core.Style{FontSize: 14, FontWeight: ui.Medium},
					StyleFunc: ui.Colored(colors.Text),
				},
				core.View{Style: core.Style{FlexGrow: 1}},
				core.Text{
					ContentFunc: valueFn,
					MaxLines:    1,
					Style:       core.Style{FontSize: 13.5, FlexShrink: 1},
					StyleFunc:   ui.Colored(valueTint),
				},
				core.Show{
					When: func() bool { return !readOnly },
					Then: func(*core.Scope) core.Node {
						return ui.Icon(lucide.ChevronRight, 14, colors.Faint)
					},
				},
			},
		}
	}

	hairline := func() core.Node {
		return core.View{
			Style:     core.Style{Height: core.Pt(1), Margin: core.Edges{Left: 40}},
			StyleFunc: ui.Filled(colors.Line),
		}
	}

	insertMarkdownSnippet := func(snippet string) {
		cur := desc.GetUntracked()
		if cur != "" && !strings.HasSuffix(cur, "\n") && strings.HasPrefix(snippet, "\n") {
			desc.Set(cur + snippet)
		} else if cur != "" && !strings.HasSuffix(cur, "\n") && !strings.HasPrefix(snippet, "**") && !strings.HasPrefix(snippet, "`") {
			desc.Set(cur + "\n" + snippet)
		} else {
			desc.Set(cur + snippet)
		}
		dirty.Set(true)
	}

	mdToolChip := func(label, snippet string) core.Node {
		return base.Button{
			Label: label,
			OnPress: func(core.PressEvent) {
				insertMarkdownSnippet(snippet)
				cx.PlayHaptic(core.HapticSelection)
			},
			Style: core.Style{
				Height:         core.Pt(26),
				Padding:        core.Symmetric(0, 9),
				CornerRadius:   6,
				BorderWidth:    1,
				AlignItems:     core.AlignCenter,
				JustifyContent: core.JustifyCenter,
			},
			StyleFunc: func() core.Style {
				return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
			},
			Children: []core.Node{
				core.Text{
					Content:   label,
					Style:     core.Style{FontSize: 11.5, FontWeight: ui.Medium},
					StyleFunc: ui.Colored(colors.Muted),
				},
			},
		}
	}

	// Sheet option row helper
	sheetChoiceRow := func(label string, leading core.Node, selected func() bool, testID string, onSelect func()) core.Node {
		return base.Button{
			Label:  label,
			TestID: testID,
			OnPress: func(core.PressEvent) {
				cx.PlayHaptic(core.HapticSelection)
				onSelect()
			},
			Style: core.Style{
				Direction:    core.Row,
				AlignItems:   core.AlignCenter,
				Gap:          10,
				MinHeight:    core.Pt(46),
				Padding:      core.Symmetric(8, 12),
				CornerRadius: 10,
			},
			StyleFunc: func() core.Style {
				if selected() {
					return core.Style{Background: ui.TintsOf(cx).Accent()}
				}
				return core.Style{Active: &core.Style{Background: colors.Hover()}}
			},
			Children: []core.Node{
				leading,
				core.Text{
					Content: label,
					Style:   core.Style{FontSize: 14.5, FontWeight: ui.Medium, FlexGrow: 1},
					StyleFunc: func() core.Style {
						if selected() {
							return core.Style{Color: colors.Accent(), FontWeight: ui.Semibold}
						}
						return core.Style{Color: colors.Text()}
					},
				},
				core.Show{
					When: selected,
					Then: func(*core.Scope) core.Node {
						return ui.Icon(lucide.Check, 16, colors.Accent)
					},
				},
			},
		}
	}

	// Quick date preset helper for Date Sheet
	datePresetBtn := func(label string, target *core.Signal[base.DateValue], daysOffset int, clear bool, closeSheet func()) core.Node {
		return base.Button{
			Label: label,
			OnPress: func(core.PressEvent) {
				if clear {
					target.Set(base.DateValue{})
				} else {
					now := state.now().In(state.locationUntracked()).AddDate(0, 0, daysOffset)
					y, m, d := now.Date()
					target.Set(base.DateValue{Start: base.NewDate(y, m, d, base.TimeOfDay{})})
					allDay.Set(true)
				}
				dirty.Set(true)
				cx.PlayHaptic(core.HapticSelection)
				if !creating {
					persistExisting(false)
				}
				closeSheet()
			},
			Style: core.Style{
				FlexGrow:       1,
				FlexBasis:      core.Pt(0),
				Height:         core.Pt(36),
				CornerRadius:   9,
				BorderWidth:    1,
				AlignItems:     core.AlignCenter,
				JustifyContent: core.JustifyCenter,
			},
			StyleFunc: func() core.Style {
				if clear {
					return core.Style{Background: colors.Inset(), BorderColor: colors.Border()}
				}
				return core.Style{Background: ui.TintsOf(cx).Accent(), BorderColor: ui.Alpha(colors.Accent(), 0.28)}
			},
			Children: []core.Node{
				core.Text{
					Content: label,
					Style:   core.Style{FontSize: 12.5, FontWeight: ui.Medium},
					StyleFunc: func() core.Style {
						if clear {
							return core.Style{Color: colors.Muted()}
						}
						return core.Style{Color: colors.Accent()}
					},
				},
			},
		}
	}

	dateSheet := func(heading string, open *core.Signal[bool], target *core.Signal[base.DateValue]) core.Node {
		closeIt := func() { open.Set(false) }
		return ui.Sheet{
			Open:    open.Get,
			OnClose: closeIt,
			Children: []core.Node{
				core.View{
					Style: core.Style{Gap: 14, Padding: core.Edges{Top: 4, Bottom: 6}},
					Children: []core.Node{
						core.Text{
							Content:   heading,
							Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold},
							StyleFunc: ui.Colored(colors.Text),
						},
						core.View{
							Style: core.Style{Direction: core.Row, Gap: 8},
							Children: []core.Node{
								datePresetBtn("今天", target, 0, false, closeIt),
								datePresetBtn("明天", target, 1, false, closeIt),
								datePresetBtn("下周", target, 7, false, closeIt),
								datePresetBtn("清除", target, 0, true, closeIt),
							},
						},
						core.View{
							Style: core.Style{
								Direction:      core.Row,
								AlignItems:     core.AlignCenter,
								JustifyContent: core.JustifySpaceBetween,
								Padding:        core.Symmetric(6, 2),
							},
							Children: []core.Node{
								core.Text{
									Content:   "全天任务",
									Style:     core.Style{FontSize: 14, FontWeight: ui.Medium},
									StyleFunc: ui.Colored(colors.Text),
								},
								ui.Switch{
									Checked: allDay.Get,
									OnChange: func(v bool) {
										allDay.Set(v)
										dirty.Set(true)
										if !creating {
											persistExisting(false)
										}
									},
									Label:  "全天任务",
									TestID: "detail-allday-switch",
								},
							},
						},
						ui.DatePicker{
							Value: target.Get,
							OnChange: func(v base.DateValue) {
								target.Set(v)
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
							},
							Placeholder:  "点击选择精确日期",
							Cleanable:    true,
							Presentation: base.PresentSheet,
							Label:        heading,
							Style:        core.Style{Width: core.Pct(100), Height: core.Pt(42)},
						},
						ui.Button{
							Text:    "完成",
							Variant: ui.ButtonPrimary,
							OnPress: closeIt,
							Style:   core.Style{Width: core.Pct(100), Height: core.Pt(44), CornerRadius: 10},
						},
					},
				},
			},
		}
	}

	page := base.NavPage{
		TestID: "task-detail-page",
		Children: []core.Node{
			core.Scroll{
				// A/B experiment: a "zoomable" Scroll (pinch disabled, zoom
				// locked at 1) makes NSGo use its ZoomScroll, which flings
				// with Android's native OverScroller instead of NSGo's own
				// uptimeMillis-driven glide() loop in Scrolling.java.
				MinZoomScale:    1,
				MaxZoomScale:    1.0001,
				ZoomScale:       1,
				NoPinchZoom:     true,
				NoBouncesZoom:   true,
				OnMomentumStart: detailBoost.onStart,
				OnMomentumEnd:   detailBoost.onEnd,
				OnScrollEnd:     detailBoost.onEnd,
				Style:           core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
				Children: []core.Node{
					core.View{
						Style: core.Style{
							Padding:    core.Edges{Top: 10, Right: 14, Bottom: 42, Left: 14},
							PaddingEnv: core.EnvEdges{Bottom: core.EnvKeyboard},
							Gap:        14,
						},
						Children: []core.Node{
							// Read-only notice for external CalDAV tasks
							core.Show{
								When: func() bool { return readOnly },
								Then: func(*core.Scope) core.Node {
									return core.View{
										Style: core.Style{
											Padding:      core.Symmetric(9, 12),
											CornerRadius: 10,
											BorderWidth:  1,
										},
										StyleFunc: func() core.Style {
											return core.Style{
												Background:  ui.TintsOf(cx).Info(),
												BorderColor: ui.Alpha(colors.Info(), 0.30),
											}
										},
										Children: []core.Node{
											core.Text{
												Content:   "此任务来自外部日历来源，当前为只读视图",
												Style:     core.Style{FontSize: 12.5},
												StyleFunc: ui.Colored(colors.Info),
											},
										},
									}
								},
							},

							// HERO EDITORIAL PAPER CARD (Title + Quick Pills + Native Markdown Description)
							core.View{
								Style: core.Style{
									CornerRadius: 16,
									Padding:      core.Edges{Top: 14, Right: 16, Bottom: 16, Left: 14},
									Gap:          12,
								},
								StyleFunc: func() core.Style { return cardStyle(cx) },
								Children: []core.Node{
									// Title Row with Animated Completion Checkbox + Borderless Editorial Title
									core.View{
										Style: core.Style{
											Direction:  core.Row,
											AlignItems: core.AlignStart,
											Gap:        8,
										},
										Children: []core.Node{
											core.Show{
												When: func() bool { return !creating },
												Then: func(*core.Scope) core.Node {
													return core.View{
														Style: core.Style{
															Width:          core.Pt(34),
															Height:         core.Pt(34),
															Margin:         core.Edges{Top: 1},
															AlignItems:     core.AlignCenter,
															JustifyContent: core.JustifyCenter,
															FlexShrink:     0,
														},
														Children: []core.Node{
															core.Show{
																When: func() bool { return burstProgress.Get() > 0 },
																Then: func(cx *core.Scope) core.Node {
																	return celebrationBurst(cx, burstProgress.Get)
																},
															},
															base.Button{
																Label:   "切换任务完成状态",
																TestID:  "detail-complete-toggle",
																OnPress: func(core.PressEvent) { toggleCompleted() },
																Style: core.Style{
																	Width:          core.Pt(34),
																	Height:         core.Pt(34),
																	AlignItems:     core.AlignCenter,
																	JustifyContent: core.JustifyCenter,
																},
																Children: []core.Node{
																	core.View{
																		Style: core.Style{
																			Width:          core.Pt(23),
																			Height:         core.Pt(23),
																			CornerRadius:   12,
																			BorderWidth:    2,
																			AlignItems:     core.AlignCenter,
																			JustifyContent: core.JustifyCenter,
																			Animated:       &core.AnimatedStyle{Scale: checkScale},
																		},
																		StyleFunc: func() core.Style {
																			if status.Get() == "completed" {
																				return core.Style{
																					Background:  colors.AccentFill(),
																					BorderColor: colors.AccentFill(),
																				}
																			}
																			rim := colors.Border()
																			if p := priority.Get(); p > 0 {
																				rim = priorityColor(cx, p)
																			}
																			return core.Style{
																				Background:  core.Transparent,
																				BorderColor: rim,
																			}
																		},
																		Children: []core.Node{
																			core.Show{
																				When: func() bool { return status.Get() == "completed" },
																				Then: func(*core.Scope) core.Node {
																					return ui.Icon(lucide.Check, 13.5, colors.OnAccent)
																				},
																			},
																		},
																	},
																},
															},
														},
													}
												},
											},

											// Borderless Paper Title Input (no ugly grey rectangle!)
											core.View{
												Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0)},
												Children: []core.Node{
													base.Input{
														Value: title.Get,
														OnChange: func(v string) {
															title.Set(v)
															dirty.Set(true)
														},
														Placeholder: "输入任务标题...",
														Label:       "任务标题",
														Multiline:   true,
														Readonly:    readOnly,
														TestID:      "detail-title-input",
														Style: core.Style{
															FontSize:          19,
															FontWeight:        ui.Semibold,
															LineHeight:        26,
															MinHeight:         core.Pt(34),
															Padding:           core.Edges{Top: 3, Bottom: 2},
															TextAlignVertical: core.TextAlignVerticalTop,
														},
														StyleFunc: func() core.Style {
															c := colors.Text()
															var dec core.TextDecoration
															if status.Get() == "completed" {
																c = colors.Faint()
																dec = core.TextDecorationLineThrough
															}
															return core.Style{
																Color:            c,
																TextDecoration:   dec,
																Background:       core.Transparent,
																PlaceholderColor: colors.Faint(),
																CaretColor:       colors.Accent(),
																SelectionColor:   cx.Palette().Selection,
															}
														},
													},
												},
											},
										},
									},

									// Compact Quick-Action Property Strip (TickTick / Things 3 style)
									core.View{
										Style: core.Style{
											Direction: core.Row,
											Wrap:      core.Wrap,
											Gap:       7,
											Padding:   core.Edges{Left: 2},
										},
										Children: []core.Node{
											shortcutPill(
												lucide.Calendar,
												func() string {
													if dueVal.Get().Start.IsZero() {
														return "截止日期"
													}
													return formatDetailDate(dueVal.Get(), allDay.Get())
												},
												colors.Accent,
												func() bool { return !dueVal.Get().Start.IsZero() },
												"detail-pill-due",
												func() { dueSheetOpen.Set(true) },
											),
											shortcutPill(
												lucide.Flag,
												func() string {
													if p := priority.Get(); p > 0 {
														return domain.PriorityLabel(p) + "优先级"
													}
													return "优先级"
												},
												func() core.Color { return priorityColor(cx, priority.Get()) },
												func() bool { return priority.Get() > 0 },
												"detail-pill-priority",
												func() { prioSheetOpen.Set(true) },
											),
											shortcutPill(
												lucide.Tag,
												func() string {
													if len(catIDs.Get()) == 0 {
														return "分类"
													}
													return categorySummary()
												},
												colors.Accent,
												func() bool { return len(catIDs.Get()) > 0 },
												"detail-pill-category",
												func() { catSheetOpen.Set(true) },
											),
											core.Show{
												When: func() bool { return !creating },
												Then: func(*core.Scope) core.Node {
													return shortcutPill(
														lucide.Circle,
														func() string { return domain.StatusLabel(status.Get()) },
														func() core.Color {
															switch status.Get() {
															case "completed":
																return colors.Up()
															case "in_progress":
																return colors.Info()
															case "cancelled", "skipped":
																return colors.Muted()
															default:
																return colors.Accent()
															}
														},
														func() bool { return status.Get() != "pending" },
														"detail-pill-status",
														func() { statusSheetOpen.Set(true) },
													)
												},
											},
										},
									},

									// Subtle Hairline Divider
									core.View{
										Style:     core.Style{Height: core.Pt(1)},
										StyleFunc: ui.Filled(colors.Line),
									},

									// Native Markdown Description Area (Reading First + Smooth Edit Mode!)
									core.View{
										Style: core.Style{Gap: 8},
										Children: []core.Node{
											core.View{
												Style: core.Style{
													Direction:      core.Row,
													AlignItems:     core.AlignCenter,
													JustifyContent: core.JustifySpaceBetween,
												},
												Children: []core.Node{
													core.Text{
														Content:   "备注 · Markdown",
														Style:     core.Style{FontSize: 12, FontWeight: ui.Medium},
														StyleFunc: ui.Colored(colors.Faint),
													},
													core.Show{
														When: func() bool { return !readOnly },
														Then: func(*core.Scope) core.Node {
															return base.Button{
																Label:  "切换备注编辑或预览",
																TestID: "detail-desc-mode-toggle",
																OnPress: func(core.PressEvent) {
																	next := !editingDesc.GetUntracked()
																	editingDesc.Set(next)
																	cx.PlayHaptic(core.HapticSelection)
																	if !next && !creating && dirty.GetUntracked() {
																		persistExisting(false)
																	}
																},
																Style: core.Style{
																	Direction:    core.Row,
																	AlignItems:   core.AlignCenter,
																	Gap:          4,
																	Height:       core.Pt(26),
																	Padding:      core.Symmetric(0, 10),
																	CornerRadius: 13,
																},
																StyleFunc: func() core.Style {
																	if editingDesc.Get() {
																		return core.Style{Background: ui.TintsOf(cx).Accent()}
																	}
																	return core.Style{Background: colors.Inset()}
																},
																Children: []core.Node{
																	core.Text{
																		ContentFunc: func() string {
																			if editingDesc.Get() {
																				return "预览"
																			}
																			return "编辑"
																		},
																		Style: core.Style{FontSize: 11.5, FontWeight: ui.Medium},
																		StyleFunc: func() core.Style {
																			if editingDesc.Get() {
																				return core.Style{Color: colors.Accent()}
																			}
																			return core.Style{Color: colors.Muted()}
																		},
																	},
																},
															}
														},
													},
												},
											},

											core.Show{
												When: editingDesc.Get,
												Then: func(*core.Scope) core.Node {
													return core.View{
														Style: core.Style{Gap: 8},
														Children: []core.Node{
															// Quick Markdown Formatting Bar
															core.View{
																Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 6},
																Children: []core.Node{
																	mdToolChip("[ ] 清单", "- [ ] "),
																	mdToolChip("- 列表", "- "),
																	mdToolChip("# 标题", "### "),
																	mdToolChip("加粗", "**文字**"),
																	mdToolChip("代码", "`code`"),
																},
															},
															// Soft paper multiline editor
															base.Input{
																Value: desc.Get,
																OnChange: func(v string) {
																	desc.Set(v)
																	dirty.Set(true)
																},
																Placeholder: "支持 Markdown：标题、清单 - [ ]、引用、代码块、链接...",
																Label:       "任务描述",
																Multiline:   true,
																Readonly:    readOnly,
																TestID:      "detail-desc-input",
																Style: core.Style{
																	FontSize:          14.5,
																	LineHeight:        22,
																	MinHeight:         core.Pt(120),
																	Padding:           core.All(10),
																	CornerRadius:      10,
																	BorderWidth:       1,
																	TextAlignVertical: core.TextAlignVerticalTop,
																},
																StyleFunc: func() core.Style {
																	return core.Style{
																		Color:            colors.Text(),
																		Background:       colors.Inset(),
																		BorderColor:      colors.Line(),
																		PlaceholderColor: colors.Faint(),
																		CaretColor:       colors.Accent(),
																		SelectionColor:   cx.Palette().Selection,
																	}
																},
															},
														},
													}
												},
												Else: func(*core.Scope) core.Node {
													return core.Show{
														When: func() bool { return strings.TrimSpace(desc.Get()) != "" },
														Then: func(*core.Scope) core.Node {
															return core.View{
																TestID: "detail-markdown-preview",
																Style:  core.Style{Padding: core.Symmetric(4, 2)},
																Children: []core.Node{
																	ui.TextView{
																		MarkdownFunc: desc.Get,
																		OpenLinks:    true,
																		Selectable:   true,
																	},
																},
															}
														},
														Else: func(*core.Scope) core.Node {
															return base.Button{
																Label:  "点击添加备注",
																TestID: "detail-desc-empty",
																OnPress: func(core.PressEvent) {
																	if !readOnly {
																		editingDesc.Set(true)
																	}
																},
																Style: core.Style{
																	Padding:      core.Symmetric(12, 6),
																	CornerRadius: 8,
																},
																Children: []core.Node{
																	core.Text{
																		Content:   "点击添加备注、清单或 Markdown 内容...",
																		Style:     core.Style{FontSize: 14, LineHeight: 20},
																		StyleFunc: ui.Colored(colors.Faint),
																	},
																},
															}
														},
													}
												},
											},
										},
									},
								},
							},

							// CLEAN MINIMAL INSET PROPERTY LIST CARD
							core.View{
								Style: core.Style{
									CornerRadius: 14,
									Overflow:     core.Hidden,
								},
								StyleFunc: func() core.Style { return cardStyle(cx) },
								Children: []core.Node{
									propRow(
										lucide.Calendar,
										"截止日期",
										func() string { return formatDetailDate(dueVal.Get(), allDay.Get()) },
										func() core.Color {
											if dueVal.Get().Start.IsZero() {
												return colors.Faint()
											}
											return colors.Text()
										},
										"detail-row-due",
										func() { dueSheetOpen.Set(true) },
									),
									hairline(),
									propRow(
										lucide.Clock,
										"开始日期",
										func() string { return formatDetailDate(startVal.Get(), allDay.Get()) },
										func() core.Color {
											if startVal.Get().Start.IsZero() {
												return colors.Faint()
											}
											return colors.Text()
										},
										"detail-row-start",
										func() { startSheetOpen.Set(true) },
									),
									hairline(),
									propRow(
										lucide.Flag,
										"优先级",
										func() string { return domain.PriorityLabel(priority.Get()) },
										func() core.Color {
											if priority.Get() > 0 {
												return priorityColor(cx, priority.Get())
											}
											return colors.Faint()
										},
										"detail-row-priority",
										func() { prioSheetOpen.Set(true) },
									),
									hairline(),
									propRow(
										lucide.Tag,
										"分类",
										categorySummary,
										func() core.Color {
											if len(catIDs.Get()) > 0 {
												return colors.Text()
											}
											return colors.Faint()
										},
										"detail-row-category",
										func() { catSheetOpen.Set(true) },
									),
									core.Show{
										When: func() bool { return !creating },
										Then: func(*core.Scope) core.Node {
											return core.View{
												Children: []core.Node{
													hairline(),
													propRow(
														lucide.Circle,
														"任务状态",
														func() string { return domain.StatusLabel(status.Get()) },
														colors.Text,
														"detail-row-status",
														func() { statusSheetOpen.Set(true) },
													),
												},
											}
										},
									},
								},
							},

							// Clean Sync Status & Subtle Footer
							core.Show{
								When: func() bool { return found },
								Then: func(*core.Scope) core.Node {
									return core.View{
										Style: core.Style{
											Direction:      core.Row,
											AlignItems:     core.AlignCenter,
											JustifyContent: core.JustifySpaceBetween,
											Padding:        core.Symmetric(2, 6),
										},
										Children: []core.Node{
											core.Text{
												ContentFunc: func() string {
													if h := savedHint.Get(); h != "" {
														return h
													}
													if state.TaskHasPending(taskID) {
														return "本机已保存 · 等待服务器确认"
													}
													return fmt.Sprintf("已同步 · 版本 #%d", initial.Revision)
												},
												Style: core.Style{FontSize: 12},
												StyleFunc: func() core.Style {
													if savedHint.Get() != "" {
														return core.Style{Color: colors.Up()}
													}
													if state.TaskHasPending(taskID) {
														return core.Style{Color: colors.Warn()}
													}
													return core.Style{Color: colors.Faint()}
												},
											},
											core.Show{
												When: func() bool { return !readOnly },
												Then: func(*core.Scope) core.Node {
													return base.Button{
														Label:   "删除任务",
														OnPress: func(core.PressEvent) { deleteConfirm.Set(true) },
														Style:   core.Style{Padding: core.Symmetric(4, 6)},
														Children: []core.Node{
															core.Text{
																Content:   "删除此任务",
																Style:     core.Style{FontSize: 12.5, FontWeight: ui.Medium},
																StyleFunc: ui.Colored(colors.Danger),
															},
														},
													}
												},
											},
										},
									}
								},
							},
						},
					},
				},
			},

			// BOTTOM SHEETS FOR EFFORTLESS ONE-HANDED EDITING
			detailBoost.node,
			dateSheet("截止日期", dueSheetOpen, dueVal),
			dateSheet("开始日期", startSheetOpen, startVal),

			// Priority Sheet
			ui.Sheet{
				Open:    prioSheetOpen.Get,
				OnClose: func() { prioSheetOpen.Set(false) },
				Children: []core.Node{
					core.View{
						Style: core.Style{Gap: 4, Padding: core.Edges{Top: 4, Bottom: 8}},
						Children: []core.Node{
							core.Text{
								Content:   "选择优先级",
								Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold, Padding: core.Edges{Bottom: 6, Left: 4}},
								StyleFunc: ui.Colored(colors.Text),
							},
							sheetChoiceRow("高优先级", ui.Icon(lucide.Flag, 16, func() core.Color { return priorityColor(cx, 3) }), func() bool { return priority.Get() == 3 }, "prio-3", func() {
								priority.Set(3)
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								prioSheetOpen.Set(false)
							}),
							sheetChoiceRow("中优先级", ui.Icon(lucide.Flag, 16, func() core.Color { return priorityColor(cx, 2) }), func() bool { return priority.Get() == 2 }, "prio-2", func() {
								priority.Set(2)
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								prioSheetOpen.Set(false)
							}),
							sheetChoiceRow("低优先级", ui.Icon(lucide.Flag, 16, func() core.Color { return priorityColor(cx, 1) }), func() bool { return priority.Get() == 1 }, "prio-1", func() {
								priority.Set(1)
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								prioSheetOpen.Set(false)
							}),
							sheetChoiceRow("无优先级", ui.Icon(lucide.Flag, 16, colors.Faint), func() bool { return priority.Get() == 0 }, "prio-0", func() {
								priority.Set(0)
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								prioSheetOpen.Set(false)
							}),
						},
					},
				},
			},

			// Status Sheet
			ui.Sheet{
				Open:    statusSheetOpen.Get,
				OnClose: func() { statusSheetOpen.Set(false) },
				Children: []core.Node{
					core.View{
						Style: core.Style{Gap: 4, Padding: core.Edges{Top: 4, Bottom: 8}},
						Children: []core.Node{
							core.Text{
								Content:   "任务状态",
								Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold, Padding: core.Edges{Bottom: 6, Left: 4}},
								StyleFunc: ui.Colored(colors.Text),
							},
							sheetChoiceRow("待办", ui.Icon(lucide.Circle, 16, colors.Muted), func() bool { return status.Get() == "pending" }, "status-pending", func() {
								status.Set("pending")
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								statusSheetOpen.Set(false)
							}),
							sheetChoiceRow("进行中", ui.Icon(lucide.Clock, 16, colors.Info), func() bool { return status.Get() == "in_progress" }, "status-in-progress", func() {
								status.Set("in_progress")
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								statusSheetOpen.Set(false)
							}),
							sheetChoiceRow("已完成", ui.Icon(lucide.Check, 16, colors.Up), func() bool { return status.Get() == "completed" }, "status-completed", func() {
								status.Set("completed")
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								statusSheetOpen.Set(false)
							}),
							sheetChoiceRow("已取消", ui.Icon(lucide.X, 16, colors.Muted), func() bool { return status.Get() == "cancelled" }, "status-cancelled", func() {
								status.Set("cancelled")
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								statusSheetOpen.Set(false)
							}),
							sheetChoiceRow("已跳过", ui.Icon(lucide.ChevronRight, 16, colors.Muted), func() bool { return status.Get() == "skipped" }, "status-skipped", func() {
								status.Set("skipped")
								dirty.Set(true)
								if !creating {
									persistExisting(false)
								}
								statusSheetOpen.Set(false)
							}),
						},
					},
				},
			},

			// Category Multi-Select Sheet
			ui.Sheet{
				Open: catSheetOpen.Get,
				OnClose: func() {
					catSheetOpen.Set(false)
					if !creating && dirty.GetUntracked() {
						persistExisting(false)
					}
				},
				Children: []core.Node{
					core.View{
						Style: core.Style{Gap: 6, Padding: core.Edges{Top: 4, Bottom: 8}},
						Children: []core.Node{
							core.Text{
								Content:   "选择分类",
								Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold, Padding: core.Edges{Bottom: 4, Left: 4}},
								StyleFunc: ui.Colored(colors.Text),
							},
							core.Show{
								When: func() bool { return len(state.viewCache.Get().Categories) == 0 },
								Then: func(*core.Scope) core.Node {
									return core.Text{
										Content:   "暂无分类，可在底部「分类」页创建",
										Style:     core.Style{FontSize: 13.5, Padding: core.All(12)},
										StyleFunc: ui.Colored(colors.Muted),
									}
								},
								Else: func(*core.Scope) core.Node {
									return core.Each(
										func() []api.Category { return state.viewCache.Get().Categories },
										func(c api.Category) int64 { return c.ID },
										func(cx *core.Scope, cat func() api.Category, _ func() int) core.Node {
											selected := func() bool { return slices.Contains(catIDs.Get(), cat().ID) }
											leading := core.View{
												Style: core.Style{
													Width:          core.Pt(26),
													Height:         core.Pt(26),
													CornerRadius:   7,
													AlignItems:     core.AlignCenter,
													JustifyContent: core.JustifyCenter,
												},
												StyleFunc: func() core.Style {
													return core.Style{Background: ui.Alpha(softenCategoryColor(cx, cat().Color), 0.16)}
												},
												Children: []core.Node{
													core.Text{
														ContentFunc: func() string {
															if e := cat().Emoji; e != "" {
																return e
															}
															return "📁"
														},
														Style: core.Style{FontSize: 14},
													},
												},
											}
											return sheetChoiceRow(cat().Name, leading, selected, fmt.Sprintf("detail-cat-%d", cat().ID), func() {
												id := cat().ID
												cur := slices.Clone(catIDs.GetUntracked())
												if idx := slices.Index(cur, id); idx >= 0 {
													cur = slices.Delete(cur, idx, idx+1)
												} else {
													cur = append(cur, id)
												}
												catIDs.Set(cur)
												dirty.Set(true)
											})
										},
									)
								},
							},
							ui.Button{
								Text:    "完成",
								Variant: ui.ButtonPrimary,
								OnPress: func() {
									catSheetOpen.Set(false)
									if !creating && dirty.GetUntracked() {
										persistExisting(false)
									}
								},
								Style: core.Style{Width: core.Pct(100), Height: core.Pt(44), CornerRadius: 10, Margin: core.Edges{Top: 6}},
							},
						},
					},
				},
			},

			// Delete Confirmation AlertDialog
			ui.AlertDialog{
				Open: deleteConfirm.Get,
				OnOpenChange: func(open bool, _ base.Reason) {
					deleteConfirm.Set(open)
				},
				Title:       "删除任务",
				Description: "确定要删除这条任务吗？该操作会同步到服务器。",
				TestID:      "detail-delete-dialog",
				Actions: []ui.AlertAction{
					{
						Text:    "取消",
						Variant: ui.ButtonOutline,
						Role:    core.AlertCancel,
					},
					{
						Text:   "删除",
						Color:  colors.Danger,
						Role:   core.AlertDestructive,
						TestID: "detail-delete-confirm",
						OnPress: func() {
							latest, ok := state.FindTask(taskID)
							if !ok {
								latest = initial
							}
							if err := state.DeleteTask(latest); err == nil {
								nav.Pop(1)
							}
						},
					},
				},
			},
		},
	}

	return ui.NavPage(cx, page, header)
}
