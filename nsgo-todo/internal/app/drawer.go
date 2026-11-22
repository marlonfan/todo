package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/domain"
)

const drawerWidth = 286.0

// leftNavDrawer renders a warm-editorial slide-out left sidebar drawer
// modeled directly after mygo-todo's #F5F3EE / #181715 navigation sidebar.
// It unmounts completely when closed so scrolling stays zero-overhead.
func leftNavDrawer(cx *core.Scope, state *AppState) core.Node {
	colors := ui.ColorsOf(cx)

	mounted := core.NewSignal(cx, false)
	progress := core.NewAnimatedValue(cx, 0)

	cx.Effect(func() {
		open := state.drawerOpen.Get()
		if open {
			mounted.Set(true)
			if cx.Env().ReduceMotion() {
				progress.Set(1)
				return
			}
			cx.StartAnimation(
				core.Spring(progress, 1, core.SpringConfig{Stiffness: 340, Damping: 30}),
				nil,
			)
		} else if mounted.GetUntracked() {
			if cx.Env().ReduceMotion() {
				progress.Set(0)
				mounted.Set(false)
				return
			}
			cx.StartAnimation(
				core.Timing(progress, 0, core.TimingConfig{Duration: 190 * time.Millisecond}),
				func(finished bool) {
					if finished && !state.drawerOpen.GetUntracked() {
						mounted.Set(false)
					}
				},
			)
		}
	})

	backdropOpacity := core.Interpolate(progress, core.Interpolation{
		Input:  []float64{0, 1},
		Output: []float64{0, 0.42},
	})
	drawerX := core.Interpolate(progress, core.Interpolation{
		Input:  []float64{0, 1},
		Output: []float64{-drawerWidth, 0},
	})

	closeDrawer := func() {
		state.drawerOpen.Set(false)
	}

	selectFilter := func(f domain.Filter) {
		cx.Batch(func() {
			state.selectedCategoryID.Set(0)
			state.filter.Set(f)
			state.activeTab.Set(0)
			state.drawerOpen.Set(false)
		})
		cx.PlayHaptic(core.HapticSelection)
	}

	selectCategory := func(id int64) {
		cx.Batch(func() {
			state.selectedCategoryID.Set(id)
			state.activeTab.Set(0)
			state.drawerOpen.Set(false)
		})
		cx.PlayHaptic(core.HapticSelection)
	}

	navRow := func(icon func() *core.SVG, label string, active func() bool, countFn func() int, warnDot func() bool, testID string, onPress func()) core.Node {
		return base.Button{
			Label:   label,
			TestID:  testID,
			OnPress: func(core.PressEvent) { onPress() },
			Style: core.Style{
				Direction:    core.Row,
				AlignItems:   core.AlignCenter,
				Gap:          11,
				Height:       core.Pt(42),
				Padding:      core.Symmetric(0, 12),
				CornerRadius: 10,
			},
			StyleFunc: func() core.Style {
				if active() {
					return core.Style{Background: ui.TintsOf(cx).Accent()}
				}
				return core.Style{Active: &core.Style{Background: colors.Hover()}}
			},
			Children: []core.Node{
				ui.Icon(icon, 18, func() core.Color {
					if active() {
						return colors.Accent()
					}
					return colors.Muted()
				}),
				core.Text{
					Content:  label,
					MaxLines: 1,
					Style:    core.Style{FontSize: 14.5, FontWeight: ui.Medium, FlexGrow: 1, FlexShrink: 1},
					StyleFunc: func() core.Style {
						if active() {
							return core.Style{Color: colors.Accent(), FontWeight: ui.Semibold}
						}
						return core.Style{Color: colors.Text()}
					},
				},
				core.Show{
					When: func() bool { return warnDot != nil && warnDot() },
					Then: func(*core.Scope) core.Node {
						return core.View{
							Style:     core.Style{Width: core.Pt(6), Height: core.Pt(6), CornerRadius: 3},
							StyleFunc: ui.Filled(colors.Danger),
						}
					},
				},
				core.Show{
					When: func() bool { return countFn != nil && countFn() > 0 },
					Then: func(*core.Scope) core.Node {
						return core.Text{
							ContentFunc: func() string { return fmt.Sprintf("%d", countFn()) },
							Style:       core.Style{FontSize: 12.5, FontWeight: ui.Medium},
							StyleFunc: func() core.Style {
								if active() {
									return core.Style{Color: colors.Accent()}
								}
								return core.Style{Color: colors.Faint()}
							},
						}
					},
				},
			},
		}
	}

	return core.Show{
		When: mounted.Get,
		Then: func(cx *core.Scope) core.Node {
			booster := newScrollFrameBooster(cx)
			return core.View{
				TestID: "nav-drawer-overlay",
				Style: core.Style{
					Position: core.Absolute,
					Top:      core.Pt(0),
					Right:    core.Pt(0),
					Bottom:   core.Pt(0),
					Left:     core.Pt(0),
				},
				Children: []core.Node{
					// Dimmed Backdrop
					base.Button{
						Label:   "关闭侧边栏",
						TestID:  "nav-drawer-backdrop",
						OnPress: func(core.PressEvent) { closeDrawer() },
						Style: core.Style{
							Position:   core.Absolute,
							Top:        core.Pt(0),
							Right:      core.Pt(0),
							Bottom:     core.Pt(0),
							Left:       core.Pt(0),
							Background: core.RGB(0x000000),
							Animated:   &core.AnimatedStyle{Opacity: backdropOpacity},
						},
					},

					// Warm Editorial Left Drawer Panel (#F5F3EE light / #181715 dark)
					core.View{
						TestID: "nav-drawer-panel",
						OnPan: func(e core.PanEvent) {
							if e.Phase == core.GestureEnded && e.Translation.X < -55 {
								closeDrawer()
							}
						},
						PanActivation: core.PanActivation{
							ActiveOffsetX: 16,
							FailOffsetY:   14,
						},
						Style: core.Style{
							Position:   core.Absolute,
							Top:        core.Pt(0),
							Bottom:     core.Pt(0),
							Left:       core.Pt(0),
							Width:      core.Pt(drawerWidth),
							Borders:    core.Edges{Right: 1},
							PaddingEnv: core.EnvEdges{Top: core.EnvSafeArea, Bottom: core.EnvSafeArea},
							Animated:   &core.AnimatedStyle{TranslateX: drawerX},
						},
						StyleFunc: func() core.Style {
							bg := colors.Inset()
							if cx.Dark() {
								bg = colors.Background()
							}
							return core.Style{
								Background:   bg,
								BorderColors: core.EdgeColors{Right: colors.Line()},
								Shadows: []core.BoxShadow{
									ui.Shadow(8, 0, 24, -4, core.RGBA(0x000000, 0.22)),
								},
							}
						},
						Children: []core.Node{
							// Top Profile & Quick Theme Toggle
							core.View{
								Style: core.Style{
									Direction:  core.Row,
									AlignItems: core.AlignCenter,
									Gap:        10,
									Padding:    core.Edges{Top: 14, Right: 12, Bottom: 12, Left: 16},
									Borders:    core.Edges{Bottom: 1},
								},
								StyleFunc: func() core.Style {
									return core.Style{BorderColors: core.EdgeColors{Bottom: colors.Line()}}
								},
								Children: []core.Node{
									core.View{
										Style: core.Style{
											Width:          core.Pt(34),
											Height:         core.Pt(34),
											CornerRadius:   17,
											AlignItems:     core.AlignCenter,
											JustifyContent: core.JustifyCenter,
										},
										StyleFunc: ui.Filled(colors.AccentFill),
										Children: []core.Node{
											core.Text{
												ContentFunc: func() string {
													u := strings.TrimSpace(state.session.Get().User.Username)
													if u == "" {
														return "T"
													}
													return strings.ToUpper(string([]rune(u)[0]))
												},
												Style:     core.Style{FontSize: 15, FontWeight: ui.Semibold},
												StyleFunc: ui.Colored(colors.OnAccent),
											},
										},
									},
									core.View{
										Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0), Gap: 1},
										Children: []core.Node{
											core.Text{
												ContentFunc: func() string {
													if u := state.session.Get().User.Username; u != "" {
														return u
													}
													return "Todo"
												},
												MaxLines:  1,
												Style:     core.Style{FontSize: 15, FontWeight: ui.Semibold},
												StyleFunc: ui.Colored(colors.Text),
											},
											core.Text{
												ContentFunc: func() string {
													if state.offline.Get() {
														return "离线模式"
													}
													if p := state.PendingCount(); p > 0 {
														return fmt.Sprintf("%d 项待同步", p)
													}
													return "已同步"
												},
												MaxLines:  1,
												Style:     core.Style{FontSize: 11.5},
												StyleFunc: ui.Colored(colors.Muted),
											},
										},
									},
									ui.IconButton{
										Icon: func() *core.SVG {
											if cx.Dark() {
												return lucide.Sun()
											}
											return lucide.Moon()
										},
										Label:  "切换深浅主题",
										TestID: "drawer-theme-toggle",
										Size:   34,
										Tint:   colors.Muted,
										OnPress: func() {
											if cx.Dark() {
												state.SetThemeMode(ThemeLight)
											} else {
												state.SetThemeMode(ThemeDark)
											}
										},
									},
								},
							},

							// Scrollable Navigation Lists
							core.Scroll{
								OnMomentumStart: booster.onStart,
								OnMomentumEnd:   booster.onEnd,
								OnScrollEnd:     booster.onEnd,
								Style:           core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
								Children: []core.Node{
									core.View{
										Style: core.Style{Padding: core.Symmetric(10, 10), Gap: 2},
										Children: []core.Node{
											navRow(
												lucide.CalendarCheck,
												"今天",
												func() bool { return state.selectedCategoryID.Get() == 0 && state.filter.Get() == domain.FilterToday },
												func() int { return state.counts.Get().Today },
												func() bool { return state.counts.Get().Overdue > 0 },
												"drawer-filter-today",
												func() { selectFilter(domain.FilterToday) },
											),
											navRow(
												lucide.Inbox,
												"收件箱",
												func() bool { return state.selectedCategoryID.Get() == 0 && state.filter.Get() == domain.FilterInbox },
												func() int { return state.counts.Get().Inbox },
												nil,
												"drawer-filter-inbox",
												func() { selectFilter(domain.FilterInbox) },
											),
											navRow(
												lucide.CalendarDays,
												"即将到来",
												func() bool { return state.selectedCategoryID.Get() == 0 && state.filter.Get() == domain.FilterUpcoming },
												func() int { return state.counts.Get().Upcoming },
												nil,
												"drawer-filter-upcoming",
												func() { selectFilter(domain.FilterUpcoming) },
											),
											navRow(
												lucide.ListTodo,
												"全部任务",
												func() bool { return state.selectedCategoryID.Get() == 0 && state.filter.Get() == domain.FilterAll },
												func() int { return state.counts.Get().All },
												nil,
												"drawer-filter-all",
												func() { selectFilter(domain.FilterAll) },
											),
											navRow(
												lucide.CircleCheck,
												"已完成",
												func() bool {
													return state.selectedCategoryID.Get() == 0 && state.filter.Get() == domain.FilterCompleted
												},
												func() int { return state.counts.Get().Completed },
												nil,
												"drawer-filter-completed",
												func() { selectFilter(domain.FilterCompleted) },
											),

											// Hairline divider
											core.View{
												Style:     core.Style{Height: core.Pt(1), Margin: core.Symmetric(10, 8)},
												StyleFunc: ui.Filled(colors.Line),
											},

											// Categories Section Header
											core.View{
												Style: core.Style{
													Direction:      core.Row,
													AlignItems:     core.AlignCenter,
													JustifyContent: core.JustifySpaceBetween,
													Padding:        core.Edges{Top: 2, Right: 6, Bottom: 4, Left: 12},
												},
												Children: []core.Node{
													core.Text{
														Content:   "分类",
														Style:     core.Style{FontSize: 12, FontWeight: ui.Semibold},
														StyleFunc: ui.Colored(colors.Faint),
													},
													ui.IconButton{
														Icon:  lucide.Plus,
														Label: "管理分类",
														Size:  26,
														Tint:  colors.Faint,
														OnPress: func() {
															cx.Batch(func() {
																state.drawerOpen.Set(false)
																state.activeTab.Set(1)
															})
														},
													},
												},
											},

											// Categories List
											core.Show{
												When: func() bool { return len(state.viewCache.Get().Categories) == 0 },
												Then: func(*core.Scope) core.Node {
													return core.Text{
														Content:   "暂无分类",
														Style:     core.Style{FontSize: 12.5, Padding: core.Symmetric(6, 12)},
														StyleFunc: ui.Colored(colors.Faint),
													}
												},
												Else: func(*core.Scope) core.Node {
													return core.Each(
														func() []api.Category { return state.viewCache.Get().Categories },
														func(c api.Category) int64 { return c.ID },
														func(cx *core.Scope, cat func() api.Category, _ func() int) core.Node {
															active := func() bool { return state.selectedCategoryID.Get() == cat().ID }
															return base.Button{
																Label:  cat().Name,
																TestID: fmt.Sprintf("drawer-cat-%d", cat().ID),
																OnPress: func(core.PressEvent) {
																	selectCategory(cat().ID)
																},
																Style: core.Style{
																	Direction:    core.Row,
																	AlignItems:   core.AlignCenter,
																	Gap:          10,
																	Height:       core.Pt(40),
																	Padding:      core.Symmetric(0, 12),
																	CornerRadius: 10,
																},
																StyleFunc: func() core.Style {
																	if active() {
																		return core.Style{Background: ui.TintsOf(cx).Accent()}
																	}
																	return core.Style{Active: &core.Style{Background: colors.Hover()}}
																},
																Children: []core.Node{
																	core.Show{
																		When: func() bool { return cat().Emoji != "" },
																		Then: func(*core.Scope) core.Node {
																			return core.Text{
																				ContentFunc: func() string { return cat().Emoji },
																				Style:       core.Style{FontSize: 15, Width: core.Pt(18), TextAlign: core.TextAlignCenter},
																			}
																		},
																		Else: func(*core.Scope) core.Node {
																			return core.View{
																				Style: core.Style{
																					Width:          core.Pt(18),
																					AlignItems:     core.AlignCenter,
																					JustifyContent: core.JustifyCenter,
																				},
																				Children: []core.Node{
																					core.View{
																						Style: core.Style{Width: core.Pt(8), Height: core.Pt(8), CornerRadius: 4},
																						StyleFunc: func() core.Style {
																							return core.Style{Background: softenCategoryColor(cx, cat().Color)}
																						},
																					},
																				},
																			}
																		},
																	},
																	core.Text{
																		ContentFunc: func() string { return cat().Name },
																		MaxLines:    1,
																		Style:       core.Style{FontSize: 14, FontWeight: ui.Medium, FlexGrow: 1, FlexShrink: 1},
																		StyleFunc: func() core.Style {
																			if active() {
																				return core.Style{Color: colors.Accent(), FontWeight: ui.Semibold}
																			}
																			return core.Style{Color: colors.Text()}
																		},
																	},
																	core.Show{
																		When: func() bool { return state.counts.Get().Category[cat().ID] > 0 },
																		Then: func(*core.Scope) core.Node {
																			return core.Text{
																				ContentFunc: func() string { return fmt.Sprintf("%d", state.counts.Get().Category[cat().ID]) },
																				Style:       core.Style{FontSize: 12, FontWeight: ui.Medium},
																				StyleFunc:   ui.Colored(colors.Faint),
																			}
																		},
																	},
																},
															}
														},
													)
												},
											},
										},
									},
								},
							},
							booster.node,
						},
					},
				},
			}
		},
	}
}
