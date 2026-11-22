package app

import (
	"fmt"
	"math"
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

type taskRouteKind int

const (
	routeTaskList taskRouteKind = iota
	routeTaskDetail
	routeTaskCreate
)

type taskRoute struct {
	kind   taskRouteKind
	taskID int64
	draft  taskDraftSeed
}

type taskDraftSeed struct {
	title       string
	priority    int
	dueDate     *time.Time
	categoryIDs []int64
}

func tasksTab(cx *core.Scope, state *AppState) core.Node {
	nav := base.NewNav(cx, taskRoute{kind: routeTaskList})

	// Hide bottom tab bar and close drawer whenever a detail/create page is pushed.
	cx.Effect(func() {
		inDetail := nav.Depth() > 0
		state.hideTabBar.Set(inDetail)
		if inDetail && state.drawerOpen.GetUntracked() {
			state.drawerOpen.Set(false)
		}
	})

	return nav.Stack(ui.FillRest, func(cx *core.Scope, route taskRoute, depth func() int) base.NavPage {
		switch route.kind {
		case routeTaskDetail:
			return taskDetailPage(cx, state, nav, route.taskID, false, taskDraftSeed{})
		case routeTaskCreate:
			return taskDetailPage(cx, state, nav, 0, true, route.draft)
		default:
			return taskListPage(cx, state, nav)
		}
	})
}

func taskListPage(cx *core.Scope, state *AppState, nav *base.Nav[taskRoute]) base.NavPage {
	colors := ui.ColorsOf(cx)
	quickOpen := core.NewSignal(cx, false)
	quickTitle := core.NewSignal(cx, "")
	quickDatePreset := core.NewSignal(cx, "today") // none | today | tomorrow | next_week
	quickPriority := core.NewSignal(cx, 0)
	quickCatIDs := core.NewSignalFunc(cx, []int64(nil), nil)
	listBoost := newScrollFrameBooster(cx)
	vc := newVoiceController(cx, state)
	fabScale := core.NewAnimatedValue(cx, 1)

	// Pull-to-refresh host state (see the list below): the outer scroll view
	// only takes pulls while the inner list is at its top, and only shows its
	// spinner for refreshes the user pulled (not background syncs).
	viewportH := core.NewSignal(cx, 0.0)
	listAtTop := core.NewSignal(cx, true)
	pullRefreshing := core.NewSignal(cx, false)
	startPullRefresh := func() {
		pullRefreshing.Set(true)
		state.Refresh(true)
		if !state.refreshing.GetUntracked() {
			pullRefreshing.Set(false)
		}
	}
	cx.Effect(func() {
		if !state.refreshing.Get() && pullRefreshing.GetUntracked() {
			pullRefreshing.Set(false)
		}
	})

	fabRotate := core.NewAnimatedValue(cx, 0)
	cx.Effect(func() {
		target := 0.0
		if quickOpen.Get() {
			target = 45
		}
		if cx.Env().ReduceMotion() {
			fabRotate.Set(target)
			return
		}
		cx.StartAnimation(core.Spring(fabRotate, target, core.SpringConfig{Stiffness: 340, Damping: 22}), nil)
	})

	openQuickAdd := func() {
		preset := "none"
		if state.selectedCategoryID.GetUntracked() == 0 && state.filter.GetUntracked() == domain.FilterToday {
			preset = "today"
		}
		var cats []int64
		if cid := state.selectedCategoryID.GetUntracked(); cid != 0 {
			cats = []int64{cid}
		}
		cx.Batch(func() {
			quickDatePreset.Set(preset)
			quickCatIDs.Set(cats)
			quickOpen.Set(true)
		})
		cx.PlayHaptic(core.HapticLight)
	}

	resolvePresetDue := func(preset string) (*time.Time, bool) {
		loc := state.locationUntracked()
		now := state.now().In(loc)
		y, m, d := now.Date()
		switch preset {
		case "today":
			t := time.Date(y, m, d, 0, 0, 0, 0, loc)
			return &t, true
		case "tomorrow":
			t := time.Date(y, m, d, 0, 0, 0, 0, loc).AddDate(0, 0, 1)
			return &t, true
		case "next_week":
			t := time.Date(y, m, d, 0, 0, 0, 0, loc).AddDate(0, 0, 7)
			return &t, true
		default:
			return nil, false
		}
	}

	submitQuickAdd := func() {
		title := strings.TrimSpace(quickTitle.GetUntracked())
		if title == "" {
			state.ToastError("请输入任务标题")
			return
		}
		due, allDay := resolvePresetDue(quickDatePreset.GetUntracked())
		_, err := state.CreateTask(title, "", quickPriority.GetUntracked(), due, nil, allDay, quickCatIDs.GetUntracked())
		if err == nil {
			cx.Batch(func() {
				quickTitle.Set("")
				quickPriority.Set(0)
				quickOpen.Set(false)
			})
		}
	}

	headerTitle := func() string {
		if cid := state.selectedCategoryID.Get(); cid != 0 {
			for _, cat := range state.viewCache.Get().Categories {
				if cat.ID == cid {
					if cat.Emoji != "" {
						return cat.Emoji + " " + cat.Name
					}
					return cat.Name
				}
			}
		}
		return domain.FilterLabel(state.filter.Get())
	}

	header := ui.NavHeader{
		TitleFunc: headerTitle,
		Leading: []core.Node{
			ui.IconButton{
				Icon:   lucide.Menu,
				Label:  "打开侧边栏",
				TestID: "tasks-drawer-btn",
				Size:   36,
				OnPress: func() {
					state.drawerOpen.Set(true)
					cx.PlayHaptic(core.HapticLight)
				},
			},
		},
		Trailing: []core.Node{
			ui.IconButton{
				Icon:     lucide.Search,
				Label:    "搜索任务",
				TestID:   "tasks-search-toggle",
				Size:     36,
				Selected: state.searchOpen.Get,
				OnPress: func() {
					open := !state.searchOpen.GetUntracked()
					cx.Batch(func() {
						state.searchOpen.Set(open)
						if !open {
							state.searchQuery.Set("")
						}
					})
				},
			},
			base.Button{
				Label:    "同步任务",
				TestID:   "tasks-sync-btn",
				Disabled: state.syncing.Get,
				OnPress:  func(core.PressEvent) { state.Refresh(false) },
				Style: core.Style{
					Width:          core.Pt(36),
					Height:         core.Pt(36),
					CornerRadius:   8,
					AlignItems:     core.AlignCenter,
					JustifyContent: core.JustifyCenter,
				},
				Children: []core.Node{
					spinningIcon(cx, lucide.RefreshCw, 19, colors.Text, state.syncing.Get),
				},
			},
		},
	}

	page := base.NavPage{
		TestID: "tasks-page",
		Children: []core.Node{
			core.View{
				Style: ui.FillRest,
				Children: []core.Node{
					// Collapsible Search Bar
					core.Show{
						When: state.searchOpen.Get,
						Then: func(*core.Scope) core.Node {
							return core.View{
								Style: core.Style{
									Direction:  core.Row,
									AlignItems: core.AlignCenter,
									Gap:        8,
									Padding:    core.Edges{Top: 8, Right: 14, Bottom: 6, Left: 14},
									Borders:    core.Edges{Bottom: 1},
								},
								StyleFunc: func() core.Style {
									return core.Style{
										Background:   colors.Background(),
										BorderColors: core.EdgeColors{Bottom: colors.Line()},
									}
								},
								Children: []core.Node{
									core.View{
										Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0)},
										Children: []core.Node{
											ui.Input{
												Value:       state.searchQuery.Get,
												OnChange:    state.searchQuery.Set,
												Placeholder: "搜索标题、描述或分类...",
												Label:       "搜索任务",
												TestID:      "tasks-search-input",
												AutoFocus:   true,
												Style: core.Style{
													Height:       core.Pt(40),
													FontSize:     14,
													CornerRadius: 10,
												},
											},
										},
									},
									core.Show{
										When: func() bool { return state.searchQuery.Get() != "" },
										Then: func(*core.Scope) core.Node {
											return ui.IconButton{
												Icon:    lucide.X,
												Label:   "清除搜索",
												TestID:  "tasks-search-clear",
												Size:    34,
												OnPress: func() { state.searchQuery.Set("") },
											}
										},
									},
								},
							}
						},
					},

					// Offline / Conflict Status Banner (only shown when needed)
					core.Show{
						When: func() bool {
							return state.offline.Get() || state.ConflictCount() > 0 || state.syncError.Get() != ""
						},
						Then: func(*core.Scope) core.Node {
							return base.Button{
								Label:  "查看同步状态",
								TestID: "tasks-sync-banner",
								OnPress: func(core.PressEvent) {
									state.activeTab.Set(2)
								},
								Style: core.Style{
									Direction:    core.Row,
									AlignItems:   core.AlignCenter,
									Gap:          8,
									Margin:       core.Edges{Top: 8, Right: 14, Bottom: 2, Left: 14},
									Padding:      core.Symmetric(9, 12),
									CornerRadius: 10,
									BorderWidth:  1,
								},
								StyleFunc: func() core.Style {
									if state.ConflictCount() > 0 {
										return core.Style{
											Background:  ui.TintsOf(cx).Danger(),
											BorderColor: ui.Alpha(colors.Danger(), 0.32),
										}
									}
									return core.Style{
										Background:  ui.TintsOf(cx).Warn(),
										BorderColor: ui.Alpha(colors.Warn(), 0.32),
									}
								},
								Children: []core.Node{
									ui.Icon(lucide.CloudOff, 15, func() core.Color {
										if state.ConflictCount() > 0 {
											return colors.Danger()
										}
										return colors.Warn()
									}),
									core.Text{
										ContentFunc: func() string {
											if c := state.ConflictCount(); c > 0 {
												return fmt.Sprintf("有 %d 项同步冲突或异常，点击前往处理", c)
											}
											if state.offline.Get() {
												if p := state.PendingCount(); p > 0 {
													return fmt.Sprintf("当前离线 · %d 项本地修改待同步", p)
												}
												return "当前离线，正在浏览本地缓存"
											}
											return state.syncError.Get()
										},
										MaxLines: 2,
										Style:    core.Style{FontSize: 12.5, FlexGrow: 1, FlexShrink: 1},
										StyleFunc: func() core.Style {
											if state.ConflictCount() > 0 {
												return core.Style{Color: colors.Danger()}
											}
											return core.Style{Color: colors.Warn()}
										},
									},
									ui.Icon(lucide.ChevronRight, 14, colors.Faint),
								},
							}
						},
					},

					// Smooth fling + virtualization + pull-to-refresh, all from
					// stock NSGo components:
					//   outer core.Scroll: NSGo's regular scroll view, used only
					//     for its native pull-to-refresh; it never scrolls (its
					//     content is exactly one viewport) and is enabled only
					//     while the list rests at its very top.
					//   inner core.Scroll: "zoomable" with zoom locked at 1, so
					//     NSGo uses its ZoomScroll whose flings run on Android's
					//     VSync-timed OverScroller (NSGo's VScroll glide() loop
					//     samples uptimeMillis per callback and judders).
					//   core.List with ListViewportParent: still virtualized,
					//     rendering the rows near the inner scroll's viewport.
					core.View{
						Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
						OnLayout: func(b core.Bounds) {
							if h := float64(b.Size.Height); h > 0 && h != viewportH.GetUntracked() {
								viewportH.Set(h)
							}
						},
						Children: []core.Node{
							core.Scroll{
								TestID:     "tasks-refresh",
								OnRefresh:  startPullRefresh,
								Refreshing: pullRefreshing.Get,
								BehaviorFunc: func() core.ScrollBehavior {
									return core.ScrollBehavior{NoScroll: !listAtTop.Get(), NoBounces: true}
								},
								Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
								Children: []core.Node{
									core.Scroll{
										TestID:          "tasks-scroll",
										MinZoomScale:    1,
										MaxZoomScale:    1.0001,
										ZoomScale:       1,
										NoPinchZoom:     true,
										NoBouncesZoom:   true,
										OnMomentumStart: listBoost.onStart,
										OnMomentumEnd:   listBoost.onEnd,
										OnScrollEnd:     listBoost.onEnd,
										OnScroll: func(e core.ScrollEvent) {
											if top := e.Offset.Y <= 0.5; top != listAtTop.GetUntracked() {
												listAtTop.Set(top)
											}
										},
										StyleFunc: func() core.Style {
											return core.Style{Width: core.Pct(100), Height: core.Pt(core.Points(viewportH.Get()))}
										},
										Children: []core.Node{
											core.List{
												Viewport:      core.ListViewportParent,
												EstimatedSize: 92,
												Gap:           8,
												Count:         func() int { return len(state.filteredTasks.Get()) },
												Key: func(i int) any {
													tasks := state.filteredTasks.Get()
													if i >= 0 && i < len(tasks) {
														return tasks[i].ID
													}
													return i
												},
												Empty: emptyTasksCard(cx, state, openQuickAdd),
												Style: core.Style{
													Padding: core.Edges{Top: 10, Right: 14, Bottom: 96, Left: 14},
												},
												Row: func(cx *core.Scope, row core.ListRow) core.Node {
													item := func() api.Task {
														tasks := state.filteredTasks.Get()
														idx := row.Index()
														if idx >= 0 && idx < len(tasks) {
															return tasks[idx]
														}
														return api.Task{}
													}
													return swipeableTaskRow(cx, state, nav, item)
												},
											},
										},
									},
								},
							},
						},
					},

					// Sleek 50pt Terracotta FAB:
					//   - Short tap (<260ms): opens Quick-Add Sheet
					//   - Hold (>=260ms): WeChat-style hold-to-talk voice task creation
					//     (slide up >64pt to cancel, release to transcribe & AI-parse)
					func() core.Node {
						var (
							holdTimer        *time.Timer
							holdStartedVoice bool
							touchDown        bool
							lastTouchUp      time.Time
						)
						cancelHoldTimer := func() {
							if holdTimer != nil {
								holdTimer.Stop()
								holdTimer = nil
							}
						}
						cx.Cleanup(cancelHoldTimer)

						animateFAB := func(scale float64) {
							if cx.Env().ReduceMotion() {
								fabScale.Set(scale)
								return
							}
							cx.StartAnimation(core.Spring(fabScale, scale, core.SpringConfig{Stiffness: 420, Damping: 22}), nil)
						}

						return core.View{
							TestID: "tasks-fab-add",
							Label:  "新建任务，长按语音创建",
							OnPress: func(core.PressEvent) {
								// Ignore click if touch responder just handled this gesture.
								if touchDown || time.Since(lastTouchUp) < 250*time.Millisecond {
									return
								}
								openQuickAdd()
							},
							Responder: &core.Responder{
								Claims: []core.TouchClaim{{}},
								Keep:   true,
								BlockNative: func(core.ResponderEvent) bool {
									return true
								},
								OnGrant: func(core.ResponderEvent) {
									touchDown = true
									holdStartedVoice = false
									cancelHoldTimer()
									animateFAB(0.90)
									holdTimer = time.AfterFunc(260*time.Millisecond, func() {
										cx.Post(func() {
											if !touchDown || holdStartedVoice {
												return
											}
											holdStartedVoice = true
											animateFAB(1.14)
											vc.beginHoldRecording()
										})
									})
								},
								OnMove: func(e core.ResponderEvent) {
									if !touchDown {
										return
									}
									if holdStartedVoice {
										vc.setCancelZone(e.Gesture.Delta.Y < -64)
										return
									}
									if math.Abs(float64(e.Gesture.Delta.X)) > 26 || math.Abs(float64(e.Gesture.Delta.Y)) > 26 {
										cancelHoldTimer()
									}
								},
								OnRelease: func(e core.ResponderEvent) {
									if !touchDown {
										return
									}
									touchDown = false
									lastTouchUp = time.Now()
									cancelHoldTimer()
									animateFAB(1.0)
									if holdStartedVoice {
										holdStartedVoice = false
										vc.finishHoldRecording()
										return
									}
									if math.Abs(float64(e.Gesture.Delta.X)) <= 24 && math.Abs(float64(e.Gesture.Delta.Y)) <= 24 {
										openQuickAdd()
									}
								},
								OnTerminate: func(core.ResponderEvent) {
									touchDown = false
									lastTouchUp = time.Now()
									cancelHoldTimer()
									animateFAB(1.0)
									if holdStartedVoice {
										holdStartedVoice = false
										vc.cancelRecording("")
									}
								},
							},
							Style: core.Style{
								Position:       core.Absolute,
								Right:          core.Pt(18),
								Bottom:         core.Pt(18),
								Width:          core.Pt(52),
								Height:         core.Pt(52),
								CornerRadius:   26,
								AlignItems:     core.AlignCenter,
								JustifyContent: core.JustifyCenter,
								Animated:       &core.AnimatedStyle{Scale: fabScale},
							},
							StyleFunc: func() core.Style {
								bg := colors.AccentFill()
								if vc.stage.Get() == voiceRecording && vc.cancelZone.Get() {
									bg = colors.Danger()
								}
								return core.Style{
									Background: bg,
									Shadows: []core.BoxShadow{
										ui.Shadow(0, 4, 14, -2, ui.Alpha(bg, 0.45)),
										ui.Shadow(0, 2, 4, 0, core.RGBA(0x1C1917, 0.12)),
									},
								}
							},
							Children: []core.Node{
								core.Show{
									When: func() bool { return vc.stage.Get() == voiceRecording },
									Then: func(*core.Scope) core.Node {
										return ui.Icon(lucide.Mic, 23, colors.OnAccent)
									},
									Else: func(*core.Scope) core.Node {
										return core.View{
											Style: core.Style{Animated: &core.AnimatedStyle{Rotate: fabRotate}},
											Children: []core.Node{
												ui.Icon(lucide.Plus, 23, colors.OnAccent),
											},
										}
									},
								},
							},
						}
					}(),

					// Mobile Quick-Add Bottom Sheet
					quickAddSheet(cx, state, nav, quickOpen, quickTitle, quickDatePreset, quickPriority, quickCatIDs, submitQuickAdd, resolvePresetDue),

					// WeChat-style Hold-to-Talk Recording / Processing HUD & Task Preview Sheet
					voiceOverlayView(cx, vc, func(text string) {
						quickTitle.Set(text)
						quickOpen.Set(true)
					}),
					voicePreviewSheet(cx, vc),
					listBoost.node,
				},
			},
		},
	}
	return ui.NavPage(cx, page, header)
}

// swipeableTaskRow is a recycled, ultra-lightweight virtualized list cell with:
//   - Zero multi-layer blurred shadows & zero idle Canvas views for buttery 120Hz scrolling
//   - Native horizontal swipe gestures (right = complete/restore, left = postpone to tomorrow)
//   - On-demand sparkle celebration burst mounted ONLY during the 340ms completion animation
func swipeableTaskRow(cx *core.Scope, state *AppState, nav *base.Nav[taskRoute], item func() api.Task) core.Node {
	colors := ui.ColorsOf(cx)
	completed := func() bool { return item().Status == "completed" }

	tx := core.NewAnimatedValue(cx, 0)
	checkScale := core.NewAnimatedValue(cx, 1)
	burstProgress := core.NewSignal(cx, 0.0)
	checkingTaskID := core.NewSignal(cx, int64(0))
	fadingTaskID := core.NewSignal(cx, int64(0))
	swipingDir := core.NewSignal(cx, 0) // -1 left (tomorrow), 0 idle, +1 right (complete)

	const swipeThreshold = 68.0
	const maxSwipe = 112.0

	isCheckedVisual := func() bool {
		t := item()
		return t.Status == "completed" || (checkingTaskID.Get() != 0 && checkingTaskID.Get() == t.ID)
	}

	triggerToggleWithDelight := func() {
		t := item()
		if t.ID == 0 {
			return
		}
		if t.ReadOnly {
			state.ToggleTaskStatus(t)
			return
		}
		if t.Status == "completed" || cx.Env().ReduceMotion() {
			springPop(cx, checkScale, 0.82)
			state.ToggleTaskStatus(t)
			return
		}
		if checkingTaskID.GetUntracked() == t.ID {
			return
		}
		checkingTaskID.Set(t.ID)
		cx.PlayHaptic(core.HapticSuccess)
		springPop(cx, checkScale, 0.72)

		const steps = 8
		for i := 1; i <= steps; i++ {
			step := i
			cx.AfterFunc(time.Duration(step*36)*time.Millisecond, func() {
				if checkingTaskID.GetUntracked() == t.ID {
					burstProgress.Set(float64(step) / float64(steps))
				}
			})
		}
		cx.AfterFunc(140*time.Millisecond, func() {
			if checkingTaskID.GetUntracked() == t.ID {
				fadingTaskID.Set(t.ID)
			}
		})
		cx.AfterFunc(310*time.Millisecond, func() {
			burstProgress.Set(0)
			checkingTaskID.Set(0)
			fadingTaskID.Set(0)
			state.ToggleTaskStatus(t)
		})
	}

	snapBack := func() {
		swipingDir.Set(0)
		if cx.Env().ReduceMotion() {
			tx.Set(0)
			return
		}
		cx.StartAnimation(core.Spring(tx, 0, core.SpringConfig{Stiffness: 360, Damping: 26}), nil)
	}

	onPan := func(e core.PanEvent) {
		t := item()
		if t.ID == 0 || t.ReadOnly {
			return
		}
		dx := float64(e.Translation.X)
		clamped := math.Max(-maxSwipe, math.Min(maxSwipe, dx))
		switch e.Phase {
		case core.GestureBegan, core.GestureChanged:
			tx.Set(clamped)
			if clamped > 14 {
				swipingDir.Set(1)
			} else if clamped < -14 {
				swipingDir.Set(-1)
			} else {
				swipingDir.Set(0)
			}
		case core.GestureEnded:
			if clamped >= swipeThreshold {
				snapBack()
				triggerToggleWithDelight()
			} else if clamped <= -swipeThreshold && t.Status != "completed" {
				snapBack()
				state.RescheduleTaskTomorrow(t)
			} else {
				snapBack()
			}
		case core.GestureCancelled:
			snapBack()
		}
	}

	return core.View{
		Style: core.Style{
			CornerRadius: 12,
		},
		StyleFunc: func() core.Style {
			if swipingDir.Get() != 0 {
				return core.Style{Overflow: core.Hidden}
			}
			return core.Style{}
		},
		Children: []core.Node{
			// Swipe Reveal Backdrop (mounted ONLY while dragging horizontally!)
			core.Show{
				When: func() bool { return swipingDir.Get() != 0 },
				Then: func(*core.Scope) core.Node {
					return core.View{
						Style: core.Style{
							Position:       core.Absolute,
							Top:            core.Pt(0),
							Right:          core.Pt(0),
							Bottom:         core.Pt(0),
							Left:           core.Pt(0),
							Direction:      core.Row,
							AlignItems:     core.AlignCenter,
							JustifyContent: core.JustifySpaceBetween,
							Padding:        core.Symmetric(0, 18),
						},
						StyleFunc: func() core.Style {
							if swipingDir.Get() > 0 {
								return core.Style{Background: colors.Up()}
							}
							return core.Style{Background: colors.Warn()}
						},
						Children: []core.Node{
							core.View{
								Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 6},
								Children: []core.Node{
									ui.Icon(lucide.Check, 16, ui.Fixed(core.RGB(0xFFFFFF))),
									core.Text{
										ContentFunc: func() string {
											if completed() {
												return "恢复待办"
											}
											return "完成"
										},
										Style: core.Style{FontSize: 13, FontWeight: ui.Semibold, Color: core.RGB(0xFFFFFF)},
									},
								},
							},
							core.View{
								Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 6},
								Children: []core.Node{
									core.Text{
										Content: "推迟明天",
										Style:   core.Style{FontSize: 13, FontWeight: ui.Semibold, Color: core.RGB(0xFFFFFF)},
									},
									ui.Icon(lucide.Calendar, 15, ui.Fixed(core.RGB(0xFFFFFF))),
								},
							},
						},
					}
				},
			},

			// Foreground Warm Editorial Task Card (flat hairline border, zero blur overdraw, zero idle opacity layer)
			core.View{
				OnPan: onPan,
				PanActivation: core.PanActivation{
					// Below ZoomScroll's ~8pt touch slop so a sideways swipe
					// claims the touch before the list does; a vertical move
					// fails it first and the list scrolls.
					ActiveOffsetX: 6,
					FailOffsetY:   7,
				},
				Style: core.Style{
					Direction:    core.Row,
					AlignItems:   core.AlignStart,
					CornerRadius: 12,
					Padding:      core.Edges{Top: 10, Right: 12, Bottom: 10, Left: 6},
					Gap:          6,
					Animated: &core.AnimatedStyle{
						TranslateX: tx,
					},
				},
				StyleFunc: func() core.Style {
					s := cardStyle(cx)
					t := item()
					if t.ID != 0 && state.recentTaskID.Get() == t.ID {
						s.BorderColor = colors.Accent()
					}
					if t.ID != 0 && fadingTaskID.Get() == t.ID {
						s.Opacity = core.Alpha(0.35)
					}
					return s
				},
				Children: []core.Node{
					// Circular Check Button + On-Demand Celebration Sparkle Canvas
					core.View{
						Style: core.Style{
							Width:          core.Pt(38),
							Height:         core.Pt(38),
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
								LabelFunc: func() string { return "切换完成 " + item().Title },
								OnPress: func(core.PressEvent) {
									triggerToggleWithDelight()
								},
								Style: core.Style{
									Width:          core.Pt(38),
									Height:         core.Pt(38),
									AlignItems:     core.AlignCenter,
									JustifyContent: core.JustifyCenter,
									CornerRadius:   19,
								},
								Children: []core.Node{
									core.View{
										Style: core.Style{
											Width:          core.Pt(22),
											Height:         core.Pt(22),
											CornerRadius:   11,
											BorderWidth:    1.8,
											AlignItems:     core.AlignCenter,
											JustifyContent: core.JustifyCenter,
											Animated:       &core.AnimatedStyle{Scale: checkScale},
										},
										StyleFunc: func() core.Style {
											t := item()
											if isCheckedVisual() {
												return core.Style{
													Background:  colors.AccentFill(),
													BorderColor: colors.AccentFill(),
												}
											}
											rim := colors.Border()
											if t.Priority > 0 {
												rim = priorityColor(cx, t.Priority)
											}
											return core.Style{
												Background:  core.Transparent,
												BorderColor: rim,
											}
										},
										Children: []core.Node{
											core.Show{
												When: isCheckedVisual,
												Then: func(*core.Scope) core.Node {
													return ui.Icon(lucide.Check, 13, colors.OnAccent)
												},
											},
										},
									},
								},
							},
						},
					},

					// Tappable Task Body -> Push Detail Screen
					base.Button{
						LabelFunc: func() string { return item().Title },
						OnPress: func(core.PressEvent) {
							if t := item(); t.ID != 0 {
								nav.Push(taskRoute{kind: routeTaskDetail, taskID: t.ID})
							}
						},
						Style: core.Style{
							FlexGrow:   1,
							FlexShrink: 1,
							MinWidth:   core.Pt(0),
							Padding:    core.Edges{Top: 3, Right: 2, Bottom: 2, Left: 0},
							Gap:        5,
						},
						Children: []core.Node{
							core.Text{
								ContentFunc: func() string { return item().Title },
								MaxLines:    2,
								Style: core.Style{
									FontSize:   15,
									LineHeight: 21,
									FontWeight: ui.Medium,
								},
								StyleFunc: func() core.Style {
									if isCheckedVisual() {
										return core.Style{
											Color:          colors.Faint(),
											TextDecoration: core.TextDecorationLineThrough,
										}
									}
									return core.Style{Color: colors.Text()}
								},
							},

							// Zero-allocation recycled metadata slots: built ONCE per cell,
							// updated in-place via ContentFunc/StyleFunc with ZERO view churn during scroll!
							core.View{
								Style: core.Style{
									Direction:  core.Row,
									Wrap:       core.Wrap,
									AlignItems: core.AlignCenter,
									Gap:        7,
								},
								StyleFunc: func() core.Style {
									t := item()
									if t.ID == 0 {
										return core.Style{Display: core.DisplayNone}
									}
									dateLabel, _ := domain.FormatTaskDate(t, state.now(), state.location())
									hasMeta := dateLabel != "" || t.Priority > 0 || len(t.Categories) > 0 || t.Recurring() || strings.TrimSpace(t.Description) != "" || state.TaskHasPending(t.ID)
									if !hasMeta {
										return core.Style{Display: core.DisplayNone}
									}
									return core.Style{}
								},
								Children: []core.Node{
									// Slot 1: Date
									core.View{
										Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 3},
										StyleFunc: func() core.Style {
											dateLabel, _ := domain.FormatTaskDate(item(), state.now(), state.location())
											if dateLabel == "" {
												return core.Style{Display: core.DisplayNone}
											}
											return core.Style{}
										},
										Children: []core.Node{
											ui.Icon(lucide.Calendar, 11.5, func() core.Color {
												_, overdue := domain.FormatTaskDate(item(), state.now(), state.location())
												if overdue {
													return colors.Danger()
												}
												return colors.Muted()
											}),
											core.Text{
												ContentFunc: func() string {
													label, _ := domain.FormatTaskDate(item(), state.now(), state.location())
													return label
												},
												MaxLines: 1,
												Style:    core.Style{FontSize: 12, FontWeight: ui.Medium},
												StyleFunc: func() core.Style {
													_, overdue := domain.FormatTaskDate(item(), state.now(), state.location())
													if overdue {
														return core.Style{Color: colors.Danger()}
													}
													return core.Style{Color: colors.Muted()}
												},
											},
										},
									},

									// Slot 2: Priority
									core.View{
										Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 2},
										StyleFunc: func() core.Style {
											if item().Priority <= 0 {
												return core.Style{Display: core.DisplayNone}
											}
											return core.Style{}
										},
										Children: []core.Node{
											ui.Icon(lucide.Flag, 11, func() core.Color {
												return priorityColor(cx, item().Priority)
											}),
											core.Text{
												ContentFunc: func() string { return domain.PriorityLabel(item().Priority) },
												MaxLines:    1,
												Style:       core.Style{FontSize: 11.5, FontWeight: ui.Medium},
												StyleFunc: func() core.Style {
													return core.Style{Color: priorityColor(cx, item().Priority)}
												},
											},
										},
									},

									// Slot 3: Primary Category Pill (+ extra count if >1)
									core.View{
										Style: core.Style{
											Direction:    core.Row,
											AlignItems:   core.AlignCenter,
											Padding:      core.Symmetric(2, 7),
											CornerRadius: 7,
										},
										StyleFunc: func() core.Style {
											cats := item().Categories
											if len(cats) == 0 {
												return core.Style{Display: core.DisplayNone}
											}
											tone := softenCategoryColor(cx, cats[0].Color)
											return core.Style{Background: ui.Alpha(tone, 0.11)}
										},
										Children: []core.Node{
											core.Text{
												ContentFunc: func() string {
													cats := item().Categories
													if len(cats) == 0 {
														return ""
													}
													c := cats[0]
													label := c.Name
													if c.Emoji != "" {
														label = c.Emoji + " " + label
													}
													if len(cats) > 1 {
														label += fmt.Sprintf(" +%d", len(cats)-1)
													}
													return label
												},
												MaxLines:  1,
												Style:     core.Style{FontSize: 11.5},
												StyleFunc: ui.Colored(colors.Muted),
											},
										},
									},

									// Slot 4: Compact Aux Flags (Recurring / Notes / Pending)
									core.Text{
										ContentFunc: func() string {
											t := item()
											var parts []string
											if t.Recurring() {
												parts = append(parts, "↻ 重复")
											}
											if strings.TrimSpace(t.Description) != "" {
												parts = append(parts, "✎ 备注")
											}
											if state.TaskHasPending(t.ID) {
												parts = append(parts, "待同步")
											}
											return strings.Join(parts, " · ")
										},
										MaxLines: 1,
										Style:    core.Style{FontSize: 11.5},
										StyleFunc: func() core.Style {
											t := item()
											if !t.Recurring() && strings.TrimSpace(t.Description) == "" && !state.TaskHasPending(t.ID) {
												return core.Style{Display: core.DisplayNone}
											}
											if state.TaskHasPending(t.ID) {
												return core.Style{Color: colors.Warn()}
											}
											return core.Style{Color: colors.Faint()}
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func emptyTasksCard(cx *core.Scope, state *AppState, onAdd func()) core.Node {
	colors := ui.ColorsOf(cx)
	isTodayClear := func() bool {
		return state.searchQuery.Get() == "" && state.selectedCategoryID.Get() == 0 && state.filter.Get() == domain.FilterToday
	}
	return core.View{
		TestID: "tasks-empty",
		Style: core.Style{
			Margin:         core.Edges{Top: 32},
			Padding:        core.Symmetric(36, 22),
			CornerRadius:   16,
			AlignItems:     core.AlignCenter,
			JustifyContent: core.JustifyCenter,
			Gap:            10,
		},
		StyleFunc: func() core.Style { return cardStyle(cx) },
		Children: []core.Node{
			core.Show{
				When: isTodayClear,
				Then: func(cx *core.Scope) core.Node {
					return warmSunCelebration(cx)
				},
				Else: func(*core.Scope) core.Node {
					return ui.Icon(lucide.Inbox, 34, colors.Faint)
				},
			},
			core.Text{
				ContentFunc: func() string {
					if state.searchQuery.Get() != "" {
						return "没有匹配的任务"
					}
					if isTodayClear() {
						return "今日待办已全部清零"
					}
					return "这里还没有任务"
				},
				Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold},
				StyleFunc: ui.Colored(colors.Text),
			},
			core.Text{
				ContentFunc: func() string {
					if state.searchQuery.Get() != "" {
						return "试试其他关键词，或清空搜索条件"
					}
					if isTodayClear() {
						return "享受片刻从容，或点击右下角 + 记录新灵感"
					}
					return "点击右下角 + 快速记录一条新待办"
				},
				Style:     core.Style{FontSize: 13, LineHeight: 19, TextAlign: core.TextAlignCenter},
				StyleFunc: ui.Colored(colors.Muted),
			},
			core.Show{
				When: func() bool { return state.searchQuery.Get() == "" },
				Then: func(*core.Scope) core.Node {
					return ui.Button{
						Text:    "新建任务",
						Icon:    lucide.Plus,
						Variant: ui.ButtonPrimary,
						OnPress: onAdd,
						Style:   core.Style{Margin: core.Edges{Top: 6}, Height: core.Pt(40), CornerRadius: 10},
					}
				},
			},
		},
	}
}

func quickAddSheet(
	cx *core.Scope,
	state *AppState,
	nav *base.Nav[taskRoute],
	open *core.Signal[bool],
	title *core.Signal[string],
	datePreset *core.Signal[string],
	priority *core.Signal[int],
	catIDs *core.Signal[[]int64],
	onSubmit func(),
	resolveDue func(string) (*time.Time, bool),
) core.Node {
	colors := ui.ColorsOf(cx)

	dateChip := func(key, label string) core.Node {
		active := func() bool { return datePreset.Get() == key }
		return base.Button{
			Label:  label,
			TestID: "quick-date-" + key,
			OnPress: func(core.PressEvent) {
				datePreset.Set(key)
				cx.PlayHaptic(core.HapticSelection)
			},
			Style: core.Style{
				Height:         core.Pt(32),
				Padding:        core.Symmetric(0, 12),
				CornerRadius:   16,
				BorderWidth:    1,
				AlignItems:     core.AlignCenter,
				JustifyContent: core.JustifyCenter,
			},
			StyleFunc: func() core.Style {
				if active() {
					return core.Style{Background: colors.AccentFill(), BorderColor: colors.AccentFill()}
				}
				return core.Style{Background: colors.Inset(), BorderColor: colors.Border()}
			},
			Children: []core.Node{
				core.Text{
					Content: label,
					Style:   core.Style{FontSize: 12.5, FontWeight: ui.Medium},
					StyleFunc: func() core.Style {
						if active() {
							return core.Style{Color: colors.OnAccent()}
						}
						return core.Style{Color: colors.Text()}
					},
				},
			},
		}
	}

	prioChip := func(p int, label string) core.Node {
		active := func() bool { return priority.Get() == p }
		return base.Button{
			Label:  "优先级 " + label,
			TestID: fmt.Sprintf("quick-prio-%d", p),
			OnPress: func(core.PressEvent) {
				priority.Set(p)
				cx.PlayHaptic(core.HapticSelection)
			},
			Style: core.Style{
				Direction:      core.Row,
				AlignItems:     core.AlignCenter,
				Gap:            5,
				Height:         core.Pt(32),
				Padding:        core.Symmetric(0, 12),
				CornerRadius:   16,
				BorderWidth:    1,
				JustifyContent: core.JustifyCenter,
			},
			StyleFunc: func() core.Style {
				if active() {
					return core.Style{Background: ui.TintsOf(cx).Accent(), BorderColor: colors.Accent()}
				}
				return core.Style{Background: colors.Inset(), BorderColor: colors.Border()}
			},
			Children: []core.Node{
				core.View{
					Style: core.Style{Width: core.Pt(7), Height: core.Pt(7), CornerRadius: 4},
					StyleFunc: func() core.Style {
						return core.Style{Background: priorityColor(cx, p)}
					},
				},
				core.Text{
					Content: label,
					Style:   core.Style{FontSize: 12.5, FontWeight: ui.Medium},
					StyleFunc: func() core.Style {
						if active() {
							return core.Style{Color: colors.Accent()}
						}
						return core.Style{Color: colors.Text()}
					},
				},
			},
		}
	}

	return ui.Sheet{
		Open:    open.Get,
		OnClose: func() { open.Set(false) },
		Children: []core.Node{
			core.View{
				Style: core.Style{Gap: 14, Padding: core.Edges{Top: 4, Bottom: 4}},
				Children: []core.Node{
					core.View{
						Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, JustifyContent: core.JustifySpaceBetween},
						Children: []core.Node{
							core.Text{
								Content:   "快速添加任务",
								Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold},
								StyleFunc: ui.Colored(colors.Text),
							},
							ui.Button{
								Text:    "完整编辑",
								Variant: ui.ButtonGhost,
								TestID:  "quick-expand-detail",
								OnPress: func() {
									due, _ := resolveDue(datePreset.GetUntracked())
									seed := taskDraftSeed{
										title:       title.GetUntracked(),
										priority:    priority.GetUntracked(),
										dueDate:     due,
										categoryIDs: slices.Clone(catIDs.GetUntracked()),
									}
									open.Set(false)
									nav.Push(taskRoute{kind: routeTaskCreate, draft: seed})
								},
							},
						},
					},

					ui.Input{
						Value:       title.Get,
						OnChange:    title.Set,
						Placeholder: "准备做点什么？",
						Label:       "任务标题",
						TestID:      "quick-title-input",
						AutoFocus:   true,
						OnSubmit:    func(string) { onSubmit() },
						Style: core.Style{
							Height:       core.Pt(46),
							FontSize:     15,
							CornerRadius: 10,
							Padding:      core.Symmetric(0, 12),
						},
					},

					// Date Presets
					core.View{
						Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 8},
						Children: []core.Node{
							dateChip("none", "无日期"),
							dateChip("today", "今天"),
							dateChip("tomorrow", "明天"),
							dateChip("next_week", "下周"),
						},
					},

					// Priority Presets
					core.View{
						Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 8},
						Children: []core.Node{
							prioChip(0, "无"),
							prioChip(1, "低"),
							prioChip(2, "中"),
							prioChip(3, "高"),
						},
					},

					// Categories Picker
					core.Show{
						When: func() bool { return len(state.viewCache.Get().Categories) > 0 },
						Then: func(*core.Scope) core.Node {
							return core.View{
								Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 8},
								Children: []core.Node{
									core.Each(
										func() []api.Category { return state.viewCache.Get().Categories },
										func(c api.Category) int64 { return c.ID },
										func(cx *core.Scope, cat func() api.Category, _ func() int) core.Node {
											selected := func() bool { return slices.Contains(catIDs.Get(), cat().ID) }
											return base.Button{
												Label: cat().Name,
												OnPress: func(core.PressEvent) {
													id := cat().ID
													cur := slices.Clone(catIDs.GetUntracked())
													if idx := slices.Index(cur, id); idx >= 0 {
														cur = slices.Delete(cur, idx, idx+1)
													} else {
														cur = append(cur, id)
													}
													catIDs.Set(cur)
													cx.PlayHaptic(core.HapticSelection)
												},
												Style: core.Style{
													Direction:    core.Row,
													AlignItems:   core.AlignCenter,
													Gap:          5,
													Height:       core.Pt(30),
													Padding:      core.Symmetric(0, 10),
													CornerRadius: 15,
													BorderWidth:  1,
												},
												StyleFunc: func() core.Style {
													if selected() {
														return core.Style{Background: ui.TintsOf(cx).Accent(), BorderColor: colors.Accent()}
													}
													return core.Style{Background: colors.Inset(), BorderColor: colors.Border()}
												},
												Children: []core.Node{
													core.Text{
														ContentFunc: func() string {
															c := cat()
															if c.Emoji != "" {
																return c.Emoji + " " + c.Name
															}
															return c.Name
														},
														Style: core.Style{FontSize: 12},
														StyleFunc: func() core.Style {
															if selected() {
																return core.Style{Color: colors.Accent()}
															}
															return core.Style{Color: colors.Text()}
														},
													},
												},
											}
										},
									),
								},
							}
						},
					},

					ui.Button{
						Text:    "添加任务",
						Variant: ui.ButtonPrimary,
						TestID:  "quick-submit-btn",
						OnPress: onSubmit,
						Style:   core.Style{Width: core.Pct(100), Height: core.Pt(46), CornerRadius: 10},
					},
				},
			},
		},
	}
}
