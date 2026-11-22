package app

import (
	"fmt"

	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/storage"
)

func syncTab(cx *core.Scope, state *AppState) core.Node {
	nav := base.NewNav(cx, "sync")
	return nav.Stack(ui.FillRest, func(cx *core.Scope, _ string, _ func() int) base.NavPage {
		return syncPage(cx, state)
	})
}

func syncPage(cx *core.Scope, state *AppState) base.NavPage {
	colors := ui.ColorsOf(cx)

	header := ui.NavHeader{
		Title: "同步",
		Trailing: []core.Node{
			ui.IconButton{
				Icon:     lucide.RefreshCw,
				Label:    "立即同步",
				TestID:   "sync-refresh-icon",
				Size:     36,
				Disabled: state.syncing.Get,
				OnPress:  func() { state.Refresh(false) },
			},
		},
	}

	statBox := func(label string, valueFn func() string, tintFn func() core.Color) core.Node {
		return core.View{
			Style: core.Style{
				FlexGrow:     1,
				FlexBasis:    core.Pt(0),
				Padding:      core.Symmetric(12, 10),
				CornerRadius: 10,
				AlignItems:   core.AlignCenter,
				Gap:          4,
			},
			StyleFunc: ui.Filled(colors.Inset),
			Children: []core.Node{
				core.Text{
					ContentFunc: valueFn,
					Style:       core.Style{FontSize: 20, FontWeight: ui.Semibold},
					StyleFunc:   ui.Colored(tintFn),
				},
				core.Text{
					Content:   label,
					Style:     core.Style{FontSize: 11.5},
					StyleFunc: ui.Colored(colors.Muted),
				},
			},
		}
	}

	page := base.NavPage{
		TestID: "sync-page",
		Children: []core.Node{
			smoothRefreshScroll(cx, smoothRefreshScrollOptions{
				RefreshTestID: "sync-refresh",
				ScrollTestID:  "sync-scroll",
				OnRefresh:     func() { state.Refresh(true) },
				Refreshing:    state.refreshing.Get,
				Children: []core.Node{
					core.View{
						Style: core.Style{
							Padding: core.Edges{Top: 12, Right: 14, Bottom: 36, Left: 14},
							Gap:     14,
						},
						Children: []core.Node{
							// Sync Summary Card
							core.View{
								Style: core.Style{
									CornerRadius: 14,
									Padding:      core.All(16),
									Gap:          14,
								},
								StyleFunc: func() core.Style { return cardStyle(cx) },
								Children: []core.Node{
									core.View{
										Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 10},
										Children: []core.Node{
											core.View{
												Style: core.Style{
													Width:          core.Pt(36),
													Height:         core.Pt(36),
													CornerRadius:   10,
													AlignItems:     core.AlignCenter,
													JustifyContent: core.JustifyCenter,
												},
												StyleFunc: func() core.Style {
													if state.offline.Get() || state.ConflictCount() > 0 {
														return core.Style{Background: ui.TintsOf(cx).Warn()}
													}
													return core.Style{Background: ui.TintsOf(cx).Up()}
												},
												Children: []core.Node{
													core.Show{
														When: state.offline.Get,
														Then: func(*core.Scope) core.Node {
															return ui.Icon(lucide.CloudOff, 18, colors.Warn)
														},
														Else: func(*core.Scope) core.Node {
															return ui.Icon(lucide.Cloud, 18, colors.Up)
														},
													},
												},
											},
											core.View{
												Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0), Gap: 2},
												Children: []core.Node{
													core.Text{
														ContentFunc: func() string {
															if state.syncing.Get() {
																return "正在同步..."
															}
															if state.ConflictCount() > 0 {
																return "存在版本冲突或待处理项"
															}
															if state.offline.Get() {
																return "离线模式"
															}
															if state.PendingCount() > 0 {
																return "有待提交的本地修改"
															}
															return "所有数据已同步"
														},
														Style:     core.Style{FontSize: 15, FontWeight: ui.Semibold},
														StyleFunc: ui.Colored(colors.Text),
													},
													core.Text{
														ContentFunc: func() string {
															t := state.lastSyncAt.Get()
															if t.IsZero() {
																return state.session.Get().Server
															}
															return fmt.Sprintf("上次同步 %s · %s", t.In(state.location()).Format("15:04:05"), state.session.Get().Server)
														},
														MaxLines:  1,
														Style:     core.Style{FontSize: 12},
														StyleFunc: ui.Colored(colors.Muted),
													},
												},
											},
										},
									},

									// Counters
									core.View{
										Style: core.Style{Direction: core.Row, Gap: 8},
										Children: []core.Node{
											statBox("待提交", func() string { return fmt.Sprintf("%d", state.PendingCount()) }, colors.Text),
											statBox("冲突/异常", func() string { return fmt.Sprintf("%d", state.ConflictCount()) }, func() core.Color {
												if state.ConflictCount() > 0 {
													return colors.Danger()
												}
												return colors.Muted()
											}),
											statBox("本地任务", func() string { return fmt.Sprintf("%d", len(state.projectedTasks.Get())) }, colors.Accent),
										},
									},

									core.Show{
										When: func() bool { return state.syncError.Get() != "" },
										Then: func(*core.Scope) core.Node {
											return core.View{
												Style: core.Style{
													Padding:      core.Symmetric(8, 10),
													CornerRadius: 8,
													BorderWidth:  1,
												},
												StyleFunc: func() core.Style {
													return core.Style{
														Background:  ui.TintsOf(cx).Danger(),
														BorderColor: ui.Alpha(colors.Danger(), 0.30),
													}
												},
												Children: []core.Node{
													core.Text{
														ContentFunc: state.syncError.Get,
														Style:       core.Style{FontSize: 12.5, LineHeight: 18},
														StyleFunc:   ui.Colored(colors.Danger),
													},
												},
											}
										},
									},

									ui.Button{
										Text:    "立即同步",
										Icon:    lucide.RefreshCw,
										Variant: ui.ButtonPrimary,
										Busy:    state.syncing.Get,
										TestID:  "sync-now-btn",
										OnPress: func() { state.Refresh(false) },
										Style:   core.Style{Width: core.Pct(100), Height: core.Pt(44), CornerRadius: 10},
									},
								},
							},

							// Task Outbox Queue Section
							core.Show{
								When: func() bool { return len(state.cache.Get().Outbox) > 0 },
								Then: func(*core.Scope) core.Node {
									return core.View{
										Style: core.Style{Gap: 8},
										Children: []core.Node{
											core.Text{
												Content:   "待同步任务队列",
												Style:     core.Style{FontSize: 12.5, FontWeight: ui.Semibold, Padding: core.Symmetric(0, 4)},
												StyleFunc: ui.Colored(colors.Muted),
											},
											core.Each(
												func() []storage.Mutation { return state.cache.Get().Outbox },
												func(op storage.Mutation) string { return op.ID },
												func(cx *core.Scope, op func() storage.Mutation, _ func() int) core.Node {
													return taskMutationCard(cx, state, op)
												},
											),
										},
									}
								},
							},

							// Category Outbox Queue Section
							core.Show{
								When: func() bool { return len(state.cache.Get().CategoryOutbox) > 0 },
								Then: func(*core.Scope) core.Node {
									return core.View{
										Style: core.Style{Gap: 8},
										Children: []core.Node{
											core.Text{
												Content:   "待同步分类队列",
												Style:     core.Style{FontSize: 12.5, FontWeight: ui.Semibold, Padding: core.Symmetric(0, 4)},
												StyleFunc: ui.Colored(colors.Muted),
											},
											core.Each(
												func() []storage.CategoryMutation { return state.cache.Get().CategoryOutbox },
												func(op storage.CategoryMutation) string { return op.ID },
												func(cx *core.Scope, op func() storage.CategoryMutation, _ func() int) core.Node {
													return categoryMutationCard(cx, state, op)
												},
											),
										},
									}
								},
							},

							// Clean State Message
							core.Show{
								When: func() bool { return state.PendingCount() == 0 },
								Then: func(*core.Scope) core.Node {
									return core.View{
										Style: core.Style{
											Padding:        core.Symmetric(28, 20),
											CornerRadius:   14,
											AlignItems:     core.AlignCenter,
											JustifyContent: core.JustifyCenter,
											Gap:            6,
										},
										StyleFunc: func() core.Style { return cardStyle(cx) },
										Children: []core.Node{
											ui.Icon(lucide.Check, 24, colors.Up),
											core.Text{
												Content:   "队列为空，离线修改会在联网后自动提交",
												Style:     core.Style{FontSize: 13, TextAlign: core.TextAlignCenter},
												StyleFunc: ui.Colored(colors.Muted),
											},
										},
									}
								},
							},
						},
					},
				},
			}),
		},
	}

	return ui.NavPage(cx, page, header)
}

func taskMutationCard(cx *core.Scope, state *AppState, op func() storage.Mutation) core.Node {
	colors := ui.ColorsOf(cx)
	m := op()
	title := m.Local.Title
	if title == "" {
		title = m.Base.Title
	}
	if title == "" {
		title = fmt.Sprintf("任务 #%d", m.TaskID)
	}
	actionLabel := map[string]string{
		"POST":   "新建",
		"PUT":    "更新",
		"PATCH":  "状态更新",
		"DELETE": "删除",
	}[m.Method]
	if actionLabel == "" {
		actionLabel = m.Method
	}

	badgeText := "待同步"
	badgeVariant := ui.BadgeWarn
	if m.State == "conflict" {
		badgeText = "版本冲突"
		badgeVariant = ui.BadgeDanger
	} else if m.State == "rejected" {
		badgeText = "已拒绝"
		badgeVariant = ui.BadgeDanger
	}

	return core.View{
		Style: core.Style{
			CornerRadius: 12,
			Padding:      core.All(14),
			Gap:          8,
		},
		StyleFunc: func() core.Style { return cardStyle(cx) },
		Children: []core.Node{
			core.View{
				Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, JustifyContent: core.JustifySpaceBetween, Gap: 8},
				Children: []core.Node{
					core.Text{
						Content:   fmt.Sprintf("[%s] %s", actionLabel, title),
						MaxLines:  1,
						Style:     core.Style{FontSize: 14, FontWeight: ui.Medium, FlexGrow: 1, FlexShrink: 1},
						StyleFunc: ui.Colored(colors.Text),
					},
					ui.Badge{Text: badgeText, Variant: badgeVariant},
				},
			},
			core.Show{
				When: func() bool { return op().Failure != "" },
				Then: func(*core.Scope) core.Node {
					return core.Text{
						ContentFunc: func() string { return op().Failure },
						Style:       core.Style{FontSize: 12, LineHeight: 17},
						StyleFunc:   ui.Colored(colors.Danger),
					}
				},
			},
			core.View{
				Style: core.Style{Direction: core.Row, Gap: 8},
				Children: []core.Node{
					core.Show{
						When: func() bool { return op().State == "conflict" },
						Then: func(*core.Scope) core.Node {
							return ui.Button{
								Text:    "以本地覆盖",
								Variant: ui.ButtonPrimary,
								Size:    ui.SizeSmall,
								OnPress: func() { state.ResolveConflictOverwrite(op().ID) },
							}
						},
					},
					ui.Button{
						Text:    "放弃修改",
						Variant: ui.ButtonOutline,
						Size:    ui.SizeSmall,
						OnPress: func() { state.DiscardTaskMutations(op().TaskID) },
					},
				},
			},
		},
	}
}

func categoryMutationCard(cx *core.Scope, state *AppState, op func() storage.CategoryMutation) core.Node {
	colors := ui.ColorsOf(cx)
	m := op()
	name := m.Local.Name
	if name == "" {
		name = m.Base.Name
	}
	return core.View{
		Style: core.Style{
			CornerRadius: 12,
			Padding:      core.All(14),
			Gap:          8,
		},
		StyleFunc: func() core.Style { return cardStyle(cx) },
		Children: []core.Node{
			core.View{
				Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, JustifyContent: core.JustifySpaceBetween, Gap: 8},
				Children: []core.Node{
					core.Text{
						Content:   fmt.Sprintf("[%s] %s", m.Method, name),
						MaxLines:  1,
						Style:     core.Style{FontSize: 14, FontWeight: ui.Medium, FlexGrow: 1, FlexShrink: 1},
						StyleFunc: ui.Colored(colors.Text),
					},
					ui.Badge{Text: "待同步", Variant: ui.BadgeWarn},
				},
			},
			core.Show{
				When: func() bool { return op().Failure != "" },
				Then: func(*core.Scope) core.Node {
					return core.Text{
						ContentFunc: func() string { return op().Failure },
						Style:       core.Style{FontSize: 12, LineHeight: 17},
						StyleFunc:   ui.Colored(colors.Danger),
					}
				},
			},
			ui.Button{
				Text:    "放弃分类修改",
				Variant: ui.ButtonOutline,
				Size:    ui.SizeSmall,
				OnPress: func() { state.DiscardCategoryMutation(op().CategoryID) },
			},
		},
	}
}
