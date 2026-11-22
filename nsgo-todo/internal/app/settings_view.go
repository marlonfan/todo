package app

import (
	"fmt"
	"strings"

	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"
)

func settingsTab(cx *core.Scope, state *AppState) core.Node {
	nav := base.NewNav(cx, "settings")
	return nav.Stack(ui.FillRest, func(cx *core.Scope, _ string, _ func() int) base.NavPage {
		return settingsPage(cx, state)
	})
}

func settingsPage(cx *core.Scope, state *AppState) base.NavPage {
	colors := ui.ColorsOf(cx)
	logoutConfirm := core.NewSignal(cx, false)

	header := ui.NavHeader{
		Title: "我的",
	}

	themeOption := func(mode ThemeMode, label string, icon func() *core.SVG, testID string) core.Node {
		active := func() bool { return state.themeMode.Get() == mode }
		return base.Button{
			Label:  label,
			TestID: testID,
			OnPress: func(core.PressEvent) {
				state.SetThemeMode(mode)
			},
			Style: core.Style{
				FlexGrow:       1,
				FlexBasis:      core.Pt(0),
				Direction:      core.Row,
				AlignItems:     core.AlignCenter,
				JustifyContent: core.JustifyCenter,
				Gap:            6,
				Height:         core.Pt(40),
				CornerRadius:   10,
				BorderWidth:    1,
			},
			StyleFunc: func() core.Style {
				if active() {
					return core.Style{
						Background:  colors.AccentFill(),
						BorderColor: colors.AccentFill(),
					}
				}
				return core.Style{
					Background:  colors.Inset(),
					BorderColor: colors.Border(),
				}
			},
			Children: []core.Node{
				ui.Icon(icon, 15, func() core.Color {
					if active() {
						return colors.OnAccent()
					}
					return colors.Muted()
				}),
				core.Text{
					Content: label,
					Style:   core.Style{FontSize: 13, FontWeight: ui.Medium},
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

	miniStat := func(label string, val func() int, tint func() core.Color) core.Node {
		return core.View{
			Style: core.Style{
				FlexGrow:     1,
				FlexBasis:    core.Pt(0),
				Padding:      core.Symmetric(10, 6),
				CornerRadius: 10,
				AlignItems:   core.AlignCenter,
				Gap:          3,
			},
			StyleFunc: ui.Filled(colors.Inset),
			Children: []core.Node{
				core.Text{
					ContentFunc: func() string { return fmt.Sprintf("%d", val()) },
					Style:       core.Style{FontSize: 18, FontWeight: ui.Semibold},
					StyleFunc:   ui.Colored(tint),
				},
				core.Text{
					Content:   label,
					Style:     core.Style{FontSize: 11},
					StyleFunc: ui.Colored(colors.Muted),
				},
			},
		}
	}

	booster := newScrollFrameBooster(cx)

	page := base.NavPage{
		TestID: "settings-page",
		Children: []core.Node{
			core.Scroll{
				OnMomentumStart: booster.onStart,
				OnMomentumEnd:   booster.onEnd,
				OnScrollEnd:     booster.onEnd,
				Style:           core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
				Children: []core.Node{
					core.View{
						Style: core.Style{
							Padding: core.Edges{Top: 12, Right: 14, Bottom: 36, Left: 14},
							Gap:     14,
						},
						Children: []core.Node{
							// Profile Editorial Card
							core.View{
								Style: core.Style{
									CornerRadius: 16,
									Padding:      core.All(16),
									Gap:          14,
								},
								StyleFunc: func() core.Style { return cardStyle(cx) },
								Children: []core.Node{
									core.View{
										Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 12},
										Children: []core.Node{
											core.View{
												Style: core.Style{
													Width:          core.Pt(48),
													Height:         core.Pt(48),
													CornerRadius:   24,
													AlignItems:     core.AlignCenter,
													JustifyContent: core.JustifyCenter,
												},
												StyleFunc: ui.Filled(colors.AccentFill),
												Children: []core.Node{
													core.Text{
														ContentFunc: func() string {
															name := strings.TrimSpace(state.session.Get().User.Username)
															if name == "" {
																return "T"
															}
															runes := []rune(name)
															return strings.ToUpper(string(runes[0]))
														},
														Style:     core.Style{FontSize: 20, FontWeight: ui.Semibold},
														StyleFunc: ui.Colored(colors.OnAccent),
													},
												},
											},
											core.View{
												Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0), Gap: 2},
												Children: []core.Node{
													core.Text{
														ContentFunc: func() string {
															u := state.session.Get().User.Username
															if u == "" {
																return "未登录"
															}
															return u
														},
														MaxLines:  1,
														Style:     core.Style{FontSize: 17, FontWeight: ui.Semibold},
														StyleFunc: ui.Colored(colors.Text),
													},
													core.Text{
														ContentFunc: func() string {
															s := state.session.Get()
															if s.User.Email != "" {
																return s.User.Email
															}
															return s.Server
														},
														MaxLines:  1,
														Style:     core.Style{FontSize: 12.5},
														StyleFunc: ui.Colored(colors.Muted),
													},
												},
											},
										},
									},

									// Task Overview Stats
									core.View{
										Style: core.Style{Direction: core.Row, Gap: 8},
										Children: []core.Node{
											miniStat("今天", func() int { return state.counts.Get().Today }, colors.Accent),
											miniStat("逾期", func() int { return state.counts.Get().Overdue }, func() core.Color {
												if state.counts.Get().Overdue > 0 {
													return colors.Danger()
												}
												return colors.Muted()
											}),
											miniStat("待办", func() int { return state.counts.Get().All }, colors.Text),
											miniStat("已完成", func() int { return state.counts.Get().Completed }, colors.Up),
										},
									},
								},
							},

							// Appearance Card
							core.View{
								Style: core.Style{
									CornerRadius: 14,
									Padding:      core.All(16),
									Gap:          10,
								},
								StyleFunc: func() core.Style { return cardStyle(cx) },
								Children: []core.Node{
									core.Text{
										Content:   "外观主题",
										Style:     core.Style{FontSize: 13, FontWeight: ui.Semibold},
										StyleFunc: ui.Colored(colors.Muted),
									},
									core.View{
										Style: core.Style{Direction: core.Row, Gap: 8},
										Children: []core.Node{
											themeOption(ThemeSystem, "跟随系统", lucide.Monitor, "theme-system"),
											themeOption(ThemeLight, "暖白浅色", lucide.Sun, "theme-light"),
											themeOption(ThemeDark, "深褐暗色", lucide.Moon, "theme-dark"),
										},
									},
								},
							},

							// Voice & AI Section
							ui.FormSection{
								Title: "语音创建与 AI 解析",
								Children: []core.Node{
									ui.FormRow{
										Icon:  lucide.Mic,
										Title: "豆包语音识别（ASR）",
										Value: func() string {
											if state.doubaoConfig.Get().Ready() {
												return "已配置 · 长按 + 可语音新建"
											}
											return "未配置"
										},
										OnPress: func() { state.voiceSettingsOpen.Set(true) },
										TestID:  "settings-voice-asr-row",
									},
									ui.FormRow{
										Icon:  lucide.Bot,
										Title: "大模型任务解析",
										Value: func() string {
											if state.aiConfigured.Get() {
												m := state.aiConfig.Get().ModelID
												if m != "" {
													return "已同步 · " + m
												}
												return "已同步"
											}
											return "未配置"
										},
										OnPress: func() { state.voiceSettingsOpen.Set(true) },
										TestID:  "settings-voice-ai-row",
									},
								},
								Footer: "在任务列表页长按右下角「+」即可按住说话，松开后由豆包转写并经大模型解析为任务预览。",
							},

							// Account & Server Info Section
							ui.FormSection{
								Title: "服务与账户",
								Children: []core.Node{
									ui.FormRow{
										Icon:  lucide.Cloud,
										Title: "服务地址",
										Value: func() string { return state.session.Get().Server },
									},
									ui.FormRow{
										Icon:  lucide.Clock,
										Title: "账户时区",
										Value: func() string {
											tz := state.session.Get().User.Timezone
											if tz == "" {
												return "系统默认"
											}
											return tz
										},
									},
									ui.FormRow{
										Icon:    lucide.RefreshCw,
										Title:   "刷新账户与任务",
										OnPress: func() { state.Refresh(false) },
										TestID:  "settings-refresh-row",
									},
								},
							},

							// Logout Section
							ui.FormSection{
								Children: []core.Node{
									ui.FormRow{
										Icon:    lucide.LogOut,
										Title:   "退出登录",
										Variant: ui.FormRowDanger,
										TestID:  "settings-logout-row",
										OnPress: func() { logoutConfirm.Set(true) },
									},
								},
								Footer: "Todo NSGo Mobile · 暖白/暗褐风格参照 mygo-todo",
							},
						},
					},
				},
			},
			booster.node,

			// Logout Confirmation AlertDialog
			ui.AlertDialog{
				Open: logoutConfirm.Get,
				OnOpenChange: func(open bool, _ base.Reason) {
					logoutConfirm.Set(open)
				},
				Title:       "退出登录",
				Description: "退出后将清除本机登录凭据和任务缓存。未同步的本地修改需要先在同步页面处理。",
				TestID:      "settings-logout-dialog",
				Actions: []ui.AlertAction{
					{Text: "取消", Variant: ui.ButtonOutline, Role: core.AlertCancel},
					{
						Text:   "退出登录",
						Color:  colors.Danger,
						Role:   core.AlertDestructive,
						TestID: "settings-logout-confirm",
						OnPress: func() {
							_ = state.Logout()
						},
					},
				},
			},
		},
	}

	return ui.NavPage(cx, page, header)
}
