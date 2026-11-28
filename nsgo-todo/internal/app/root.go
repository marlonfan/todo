package app

import (
	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"
)

// Root mounts the Todo NSGo mobile client using default options.
func Root(cx *core.Scope) core.Node {
	return RootWithOptions(Options{})(cx)
}

// RootWithOptions constructs a Root component with injectable options (e.g., server URL for tests).
func RootWithOptions(opts Options) func(*core.Scope) core.Node {
	return func(cx *core.Scope) core.Node {
		cx.SetTheme(TodoTheme())
		colors := ui.ColorsOf(cx)
		state := newAppState(cx, opts)

		return core.View{
			TestID: "app-root",
			Style:  ui.FillRest,
			StyleFunc: func() core.Style {
				return core.Style{
					Background: colors.Background(),
					Color:      colors.Text(),
				}
			},
			Children: []core.Node{
				core.Show{
					When: state.booting.Get,
					Then: func(*core.Scope) core.Node {
						return core.View{
							Style: core.Style{
								FlexGrow:       1,
								FlexShrink:     1,
								AlignItems:     core.AlignCenter,
								JustifyContent: core.JustifyCenter,
								Gap:            12,
							},
							Children: []core.Node{
								ui.Spinner{},
								core.Text{
									Content:   "正在加载 Todo...",
									Style:     core.Style{FontSize: 14},
									StyleFunc: ui.Colored(colors.Muted),
								},
							},
						}
					},
					Else: func(*core.Scope) core.Node {
						return core.Show{
							When: state.authenticated.Get,
							Then: func(cx *core.Scope) core.Node {
								return warmMobileShell(cx, state)
							},
							Else: func(cx *core.Scope) core.Node {
								return authView(cx, state)
							},
						}
					},
				},

				// Global Voice & AI Settings Sheet (accessible from Settings or Voice HUD)
				voiceAISettingsSheet(cx, state),

				// Global Toast Overlay
				ui.Toasts{
					Toaster:    state.toaster,
					CloseLabel: "关闭提示",
					TestID:     "app-toasts",
				},
			},
		}
	}
}

type shellSection struct {
	text    string
	icon    func() *core.SVG
	testID  string
	badge   func() int
	danger  func() bool
	content func(*core.Scope) core.Node
}

// warmMobileShell renders the 4 lazily-mounted mobile sections over a compact,
// warm-editorial bottom tab bar that matches mygo-todo's palette and hides
// automatically on detail screens or while the software keyboard is open.
func warmMobileShell(cx *core.Scope, state *AppState) core.Node {
	colors := ui.ColorsOf(cx)
	env := cx.Env()

	tabs := []shellSection{
		{
			text:    "任务",
			icon:    lucide.ListTodo,
			testID:  "tab-tasks",
			content: func(cx *core.Scope) core.Node { return tasksTab(cx, state) },
		},
		{
			text:    "分类",
			icon:    lucide.Folder,
			testID:  "tab-categories",
			content: func(cx *core.Scope) core.Node { return categoriesTab(cx, state) },
		},
		{
			text:    "同步",
			icon:    lucide.Cloud,
			testID:  "tab-sync",
			badge:   state.PendingCount,
			danger:  func() bool { return state.ConflictCount() > 0 },
			content: func(cx *core.Scope) core.Node { return syncTab(cx, state) },
		},
		{
			text:    "我的",
			icon:    lucide.User,
			testID:  "tab-settings",
			content: func(cx *core.Scope) core.Node { return settingsTab(cx, state) },
		},
	}

	barVisible := func() bool {
		return !state.hideTabBar.Get() && env.KeyboardHeight() == 0
	}

	sections := make([]core.Node, 0, len(tabs))
	for i, tab := range tabs {
		idx := i
		t := tab
		seen := false
		sections = append(sections, core.View{
			TestID: t.testID,
			StyleFunc: func() core.Style {
				s := ui.FillRest
				if state.activeTab.Get() != idx {
					s.Display = core.DisplayNone
				}
				return s
			},
			Children: []core.Node{
				core.Show{
					When: func() bool {
						seen = seen || state.activeTab.Get() == idx
						return seen
					},
					Then: func(cx *core.Scope) core.Node {
						outer := core.InsetsFunc(cx)
						core.ProvideInsets(cx, func() core.Edges {
							in := outer()
							if barVisible() {
								in.Bottom = 0
							}
							return in
						})
						return t.content(cx)
					},
				},
			},
		})
	}

	// Compact warm-editorial bottom tab bar (52pt + system gesture safe area)
	tabNodes := make([]core.Node, 0, len(tabs))
	for i, tab := range tabs {
		idx := i
		t := tab
		scale := core.NewAnimatedValue(cx, 1)
		active := func() bool { return state.activeTab.Get() == idx }

		tabNodes = append(tabNodes, base.Tab{
			Label:    t.text,
			Selected: active,
			OnPress: func(core.PressEvent) {
				if state.activeTab.GetUntracked() != idx {
					state.activeTab.Set(idx)
					cx.PlayHaptic(core.HapticSelection)
					springPop(cx, scale, 0.84)
				}
			},
			Style: core.Style{
				FlexGrow:       1,
				FlexBasis:      core.Pt(0),
				MinWidth:       core.Pt(0),
				Height:         core.Pt(50),
				AlignItems:     core.AlignCenter,
				JustifyContent: core.JustifyCenter,
				Gap:            2,
				Padding:        core.Edges{Top: 4, Bottom: 4},
			},
			Children: []core.Node{
				// Subtle top warm terracotta hairline pill indicator on active tab
				core.View{
					Style: core.Style{
						Position:     core.Absolute,
						Top:          core.Pt(0),
						Width:        core.Pt(20),
						Height:       core.Pt(2.5),
						CornerRadius: 2,
					},
					StyleFunc: func() core.Style {
						if active() {
							return core.Style{Background: colors.Accent()}
						}
						return core.Style{Background: core.Transparent}
					},
				},
				// Animated icon with optional tiny notification dot
				core.View{
					Style: core.Style{
						Width:          core.Pt(26),
						Height:         core.Pt(22),
						AlignItems:     core.AlignCenter,
						JustifyContent: core.JustifyCenter,
						Animated:       &core.AnimatedStyle{Scale: scale},
					},
					Children: []core.Node{
						ui.Icon(t.icon, 20, func() core.Color {
							if active() {
								return colors.Accent()
							}
							return colors.Faint()
						}),
						core.Show{
							When: func() bool { return t.badge != nil && t.badge() > 0 },
							Then: func(*core.Scope) core.Node {
								return core.View{
									Style: core.Style{
										Position:     core.Absolute,
										Top:          core.Pt(0),
										Right:        core.Pt(0),
										Width:        core.Pt(7),
										Height:       core.Pt(7),
										CornerRadius: 4,
									},
									StyleFunc: func() core.Style {
										if t.danger != nil && t.danger() {
											return core.Style{Background: colors.Danger()}
										}
										return core.Style{Background: colors.Warn()}
									},
								}
							},
						},
					},
				},
				core.Text{
					Content:  t.text,
					MaxLines: 1,
					Style:    core.Style{FontSize: 10.5, LineHeight: 13, FontWeight: ui.Medium},
					StyleFunc: func() core.Style {
						if active() {
							return core.Style{Color: colors.Accent(), FontWeight: ui.Semibold}
						}
						return core.Style{Color: colors.Faint()}
					},
				},
			},
		})
	}

	bottomBar := core.View{
		TestID: "tab-bar",
		Style: core.Style{
			Direction:  core.Row,
			Borders:    core.Edges{Top: 1},
			Padding:    core.Symmetric(0, 6),
			PaddingEnv: core.EnvEdges{Right: core.EnvSafeArea, Bottom: core.EnvSafeArea, Left: core.EnvSafeArea},
		},
		StyleFunc: func() core.Style {
			bg := colors.Surface()
			if cx.Dark() {
				bg = colors.Inset()
			}
			s := core.Style{
				Background:   bg,
				BorderColors: core.EdgeColors{Top: colors.Line()},
			}
			if !barVisible() {
				s.Display = core.DisplayNone
			}
			return s
		},
		Children: []core.Node{
			base.Tabs{
				Label:    "主导航",
				Style:    core.Style{Direction: core.Row, FlexGrow: 1},
				Children: tabNodes,
			},
		},
	}

	return core.View{
		TestID: "main-tabs",
		Style:  ui.FillRest,
		Children: []core.Node{
			core.View{Style: ui.FillRest, Children: sections},
			bottomBar,
			leftNavDrawer(cx, state),
		},
	}
}
