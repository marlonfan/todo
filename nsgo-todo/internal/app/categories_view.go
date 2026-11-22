package app

import (
	"fmt"
	"strings"

	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/api"
)

func categoriesTab(cx *core.Scope, state *AppState) core.Node {
	nav := base.NewNav(cx, "categories")
	return nav.Stack(ui.FillRest, func(cx *core.Scope, _ string, _ func() int) base.NavPage {
		return categoriesPage(cx, state)
	})
}

func categoriesPage(cx *core.Scope, state *AppState) base.NavPage {
	colors := ui.ColorsOf(cx)

	sheetOpen := core.NewSignal(cx, false)
	editingID := core.NewSignal(cx, int64(0))
	nameInput := core.NewSignal(cx, "")
	emojiInput := core.NewSignal(cx, "📁")
	colorInput := core.NewSignal(cx, categoryColorPresets[0])
	deleteTarget := core.NewSignalFunc(cx, (*api.Category)(nil), nil)

	openNew := func() {
		cx.Batch(func() {
			editingID.Set(0)
			nameInput.Set("")
			emojiInput.Set("📁")
			colorInput.Set(categoryColorPresets[0])
			sheetOpen.Set(true)
		})
	}

	openEdit := func(c api.Category) {
		cx.Batch(func() {
			editingID.Set(c.ID)
			nameInput.Set(c.Name)
			emojiInput.Set(c.Emoji)
			col := c.Color
			if col == "" {
				col = categoryColorPresets[0]
			}
			colorInput.Set(col)
			sheetOpen.Set(true)
		})
	}

	saveCategory := func() {
		cat := api.Category{
			ID:    editingID.GetUntracked(),
			Name:  strings.TrimSpace(nameInput.GetUntracked()),
			Emoji: strings.TrimSpace(emojiInput.GetUntracked()),
			Color: strings.TrimSpace(colorInput.GetUntracked()),
		}
		if err := state.SaveCategory(cat); err == nil {
			sheetOpen.Set(false)
		}
	}

	header := ui.NavHeader{
		Title: "分类",
		Trailing: []core.Node{
			ui.IconButton{
				Icon:    lucide.Plus,
				Label:   "新建分类",
				TestID:  "categories-add-btn",
				Size:    36,
				OnPress: openNew,
			},
		},
	}

	booster := newScrollFrameBooster(cx)

	page := base.NavPage{
		TestID: "categories-page",
		Children: []core.Node{
			core.View{
				Style: ui.FillRest,
				Children: []core.Node{
					core.Scroll{
						OnRefresh:       func() { state.Refresh(true) },
						Refreshing:      state.refreshing.Get,
						OnMomentumStart: booster.onStart,
						OnMomentumEnd:   booster.onEnd,
						OnScrollEnd:     booster.onEnd,
						Style:           core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
						Children: []core.Node{
							core.View{
								Style: core.Style{
									Padding: core.Edges{Top: 12, Right: 14, Bottom: 36, Left: 14},
									Gap:     10,
								},
								Children: []core.Node{
									core.Show{
										When: func() bool { return len(state.viewCache.Get().Categories) == 0 },
										Then: func(*core.Scope) core.Node {
											return core.View{
												TestID: "categories-empty",
												Style: core.Style{
													Margin:         core.Edges{Top: 28},
													Padding:        core.Symmetric(36, 20),
													CornerRadius:   16,
													AlignItems:     core.AlignCenter,
													JustifyContent: core.JustifyCenter,
													Gap:            10,
												},
												StyleFunc: func() core.Style { return cardStyle(cx) },
												Children: []core.Node{
													ui.Icon(lucide.Folder, 34, colors.Faint),
													core.Text{
														Content:   "还没有分类",
														Style:     core.Style{FontSize: 16, FontWeight: ui.Medium},
														StyleFunc: ui.Colored(colors.Text),
													},
													core.Text{
														Content:   "用分类整理工作、生活与灵感，支持离线创建与同步",
														Style:     core.Style{FontSize: 13, TextAlign: core.TextAlignCenter},
														StyleFunc: ui.Colored(colors.Muted),
													},
													ui.Button{
														Text:    "新建分类",
														Icon:    lucide.Plus,
														Variant: ui.ButtonPrimary,
														OnPress: openNew,
														Style:   core.Style{Margin: core.Edges{Top: 6}, Height: core.Pt(40), CornerRadius: 10},
													},
												},
											}
										},
										Else: func(*core.Scope) core.Node {
											return core.Each(
												func() []api.Category { return state.viewCache.Get().Categories },
												func(c api.Category) int64 { return c.ID },
												func(cx *core.Scope, item func() api.Category, _ func() int) core.Node {
													return categoryCardRow(cx, state, item, openEdit, func(c api.Category) {
														copyCat := c
														deleteTarget.Set(&copyCat)
													})
												},
											)
										},
									},
								},
							},
						},
					},

					// Create / Edit Category Bottom Sheet
					ui.Sheet{
						Open:    sheetOpen.Get,
						OnClose: func() { sheetOpen.Set(false) },
						Children: []core.Node{
							core.View{
								Style: core.Style{Gap: 14, Padding: core.Edges{Top: 4, Bottom: 4}},
								Children: []core.Node{
									core.Text{
										ContentFunc: func() string {
											if editingID.Get() == 0 {
												return "新建分类"
											}
											return "编辑分类"
										},
										Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold},
										StyleFunc: ui.Colored(colors.Text),
									},

									ui.Input{
										Value:       nameInput.Get,
										OnChange:    nameInput.Set,
										Placeholder: "分类名称（例如：工作、阅读）",
										Label:       "分类名称",
										TestID:      "category-name-input",
										AutoFocus:   true,
										OnSubmit:    func(string) { saveCategory() },
										Style: core.Style{
											Height:       core.Pt(44),
											FontSize:     15,
											CornerRadius: 10,
											Padding:      core.Symmetric(0, 12),
										},
									},

									// Emoji Preset Row
									core.View{
										Style: core.Style{Gap: 6},
										Children: []core.Node{
											core.Text{
												Content:   "图标",
												Style:     core.Style{FontSize: 12, FontWeight: ui.Medium},
												StyleFunc: ui.Colored(colors.Muted),
											},
											core.View{
												Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 8},
												Children: func() []core.Node {
													nodes := make([]core.Node, 0, len(categoryEmojiPresets))
													for _, em := range categoryEmojiPresets {
														emVal := em
														active := func() bool { return emojiInput.Get() == emVal }
														nodes = append(nodes, base.Button{
															Label: "选择表情 " + emVal,
															OnPress: func(core.PressEvent) {
																emojiInput.Set(emVal)
																cx.PlayHaptic(core.HapticSelection)
															},
															Style: core.Style{
																Width:          core.Pt(38),
																Height:         core.Pt(38),
																CornerRadius:   10,
																BorderWidth:    1.5,
																AlignItems:     core.AlignCenter,
																JustifyContent: core.JustifyCenter,
															},
															StyleFunc: func() core.Style {
																if active() {
																	return core.Style{
																		Background:  ui.TintsOf(cx).Accent(),
																		BorderColor: colors.Accent(),
																	}
																}
																return core.Style{
																	Background:  colors.Inset(),
																	BorderColor: core.Transparent,
																}
															},
															Children: []core.Node{
																core.Text{Content: emVal, Style: core.Style{FontSize: 18}},
															},
														})
													}
													return nodes
												}(),
											},
										},
									},

									// Warm Editorial Color Swatches
									core.View{
										Style: core.Style{Gap: 6},
										Children: []core.Node{
											core.Text{
												Content:   "颜色",
												Style:     core.Style{FontSize: 12, FontWeight: ui.Medium},
												StyleFunc: ui.Colored(colors.Muted),
											},
											core.View{
												Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 10},
												Children: func() []core.Node {
													nodes := make([]core.Node, 0, len(categoryColorPresets))
													for _, hex := range categoryColorPresets {
														hexVal := hex
														active := func() bool { return strings.EqualFold(colorInput.Get(), hexVal) }
														nodes = append(nodes, base.Button{
															Label: "选择颜色 " + hexVal,
															OnPress: func(core.PressEvent) {
																colorInput.Set(hexVal)
																cx.PlayHaptic(core.HapticSelection)
															},
															Style: core.Style{
																Width:          core.Pt(32),
																Height:         core.Pt(32),
																CornerRadius:   16,
																BorderWidth:    2.5,
																AlignItems:     core.AlignCenter,
																JustifyContent: core.JustifyCenter,
															},
															StyleFunc: func() core.Style {
																c := softenCategoryColor(cx, hexVal)
																border := core.Transparent
																if active() {
																	border = colors.Text()
																}
																return core.Style{
																	Background:  c,
																	BorderColor: border,
																}
															},
															Children: []core.Node{
																core.Show{
																	When: active,
																	Then: func(*core.Scope) core.Node {
																		return ui.Icon(lucide.Check, 14, ui.Fixed(core.RGB(0xFFFFFF)))
																	},
																},
															},
														})
													}
													return nodes
												}(),
											},
										},
									},

									ui.Button{
										Text:    "保存分类",
										Variant: ui.ButtonPrimary,
										TestID:  "category-save-btn",
										OnPress: saveCategory,
										Style:   core.Style{Width: core.Pct(100), Height: core.Pt(46), CornerRadius: 10},
									},
								},
							},
						},
					},

					// Delete Confirmation Dialog
					ui.AlertDialog{
						Open: func() bool { return deleteTarget.Get() != nil },
						OnOpenChange: func(open bool, _ base.Reason) {
							if !open {
								deleteTarget.Set(nil)
							}
						},
						Title: "删除分类",
						DescriptionFunc: func() string {
							if c := deleteTarget.Get(); c != nil {
								return fmt.Sprintf("确定要删除分类「%s」吗？该分类下的任务不会被删除。", c.Name)
							}
							return ""
						},
						TestID: "category-delete-dialog",
						Actions: []ui.AlertAction{
							{Text: "取消", Variant: ui.ButtonOutline, Role: core.AlertCancel},
							{
								Text:   "删除",
								Color:  colors.Danger,
								Role:   core.AlertDestructive,
								TestID: "category-delete-confirm",
								OnPress: func() {
									if c := deleteTarget.GetUntracked(); c != nil {
										_ = state.DeleteCategory(*c)
										deleteTarget.Set(nil)
									}
								},
							},
						},
					},
					booster.node,
				},
			},
		},
	}

	return ui.NavPage(cx, page, header)
}

func categoryCardRow(
	cx *core.Scope,
	state *AppState,
	item func() api.Category,
	onEdit func(api.Category),
	onDelete func(api.Category),
) core.Node {
	colors := ui.ColorsOf(cx)
	return core.View{
		TestID: fmt.Sprintf("category-row-%d", item().ID),
		Style: core.Style{
			Direction:    core.Row,
			AlignItems:   core.AlignCenter,
			CornerRadius: 12,
			Padding:      core.Edges{Top: 10, Right: 8, Bottom: 10, Left: 14},
			Gap:          10,
		},
		StyleFunc: func() core.Style { return cardStyle(cx) },
		Children: []core.Node{
			// Tap category to jump to Tasks tab filtered by this category
			base.Button{
				Label: item().Name,
				OnPress: func(core.PressEvent) {
					cid := item().ID
					cx.Batch(func() {
						state.selectedCategoryID.Set(cid)
						state.activeTab.Set(0)
					})
					cx.PlayHaptic(core.HapticSelection)
				},
				Style: core.Style{
					Direction:  core.Row,
					AlignItems: core.AlignCenter,
					Gap:        10,
					FlexGrow:   1,
					FlexShrink: 1,
					MinWidth:   core.Pt(0),
					MinHeight:  core.Pt(36),
				},
				Children: []core.Node{
					core.View{
						Style: core.Style{
							Width:          core.Pt(34),
							Height:         core.Pt(34),
							CornerRadius:   10,
							AlignItems:     core.AlignCenter,
							JustifyContent: core.JustifyCenter,
							FlexShrink:     0,
						},
						StyleFunc: func() core.Style {
							c := softenCategoryColor(cx, item().Color)
							return core.Style{Background: ui.Alpha(c, 0.16)}
						},
						Children: []core.Node{
							core.Text{
								ContentFunc: func() string {
									if e := item().Emoji; e != "" {
										return e
									}
									return "📁"
								},
								Style: core.Style{FontSize: 16},
							},
						},
					},
					core.View{
						Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0), Gap: 2},
						Children: []core.Node{
							core.Text{
								ContentFunc: func() string { return item().Name },
								MaxLines:    1,
								Style:       core.Style{FontSize: 15, FontWeight: ui.Medium},
								StyleFunc:   ui.Colored(colors.Text),
							},
							core.Text{
								ContentFunc: func() string {
									n := state.counts.Get().Category[item().ID]
									if item().ID < 0 {
										return fmt.Sprintf("%d 项待办 · 待同步", n)
									}
									return fmt.Sprintf("%d 项待办", n)
								},
								Style:     core.Style{FontSize: 12},
								StyleFunc: ui.Colored(colors.Muted),
							},
						},
					},
				},
			},

			ui.IconButton{
				Icon:    lucide.Pencil,
				Label:   "编辑分类",
				Size:    34,
				Tint:    colors.Muted,
				OnPress: func() { onEdit(item()) },
			},
			ui.IconButton{
				Icon:    lucide.Trash,
				Label:   "删除分类",
				Size:    34,
				Tint:    colors.Danger,
				OnPress: func() { onDelete(item()) },
			},
		},
	}
}
