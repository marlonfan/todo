package app

import (
	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/ui"
)

func authView(cx *core.Scope, state *AppState) core.Node {
	colors := ui.ColorsOf(cx)
	registerMode := core.NewSignal(cx, false)
	server := core.NewSignal(cx, state.serverInput.GetUntracked())
	username := core.NewSignal(cx, "")
	email := core.NewSignal(cx, "")
	password := core.NewSignal(cx, "")

	submit := func() {
		state.LoginOrRegister(
			server.GetUntracked(),
			username.GetUntracked(),
			email.GetUntracked(),
			password.GetUntracked(),
			registerMode.GetUntracked(),
		)
	}

	modeTab := func(label string, isRegister bool, testID string) core.Node {
		active := func() bool { return registerMode.Get() == isRegister }
		return base.Button{
			Label:  label,
			TestID: testID,
			OnPress: func(core.PressEvent) {
				registerMode.Set(isRegister)
				state.authError.Set("")
				cx.PlayHaptic(core.HapticSelection)
			},
			Style: core.Style{
				FlexGrow:       1,
				FlexBasis:      core.Pt(0),
				Height:         core.Pt(38),
				CornerRadius:   8,
				AlignItems:     core.AlignCenter,
				JustifyContent: core.JustifyCenter,
			},
			StyleFunc: func() core.Style {
				if active() {
					return core.Style{
						Background:  colors.Surface(),
						BorderWidth: 1,
						BorderColor: cardBorderColor(cx),
					}
				}
				return core.Style{Background: core.Transparent}
			},
			Children: []core.Node{
				core.Text{
					Content: label,
					Style:   core.Style{FontSize: 14, FontWeight: ui.Medium},
					StyleFunc: func() core.Style {
						if active() {
							return core.Style{Color: colors.Text()}
						}
						return core.Style{Color: colors.Muted()}
					},
				},
			},
		}
	}

	fieldBlock := func(label string, input core.Node) core.Node {
		return core.View{
			Style: core.Style{Gap: 6},
			Children: []core.Node{
				core.Text{
					Content:   label,
					Style:     core.Style{FontSize: 12, FontWeight: ui.Medium},
					StyleFunc: ui.Colored(colors.Muted),
				},
				input,
			},
		}
	}

	inputStyle := core.Style{
		Height:       core.Pt(44),
		FontSize:     15,
		CornerRadius: 10,
		Padding:      core.Symmetric(0, 12),
	}

	return smoothScroll(core.Scroll{
		TestID: "auth-scroll",
		Style: core.Style{
			FlexGrow:   1,
			FlexShrink: 1,
			MinHeight:  core.Pt(0),
		},
		StyleFunc: ui.Filled(colors.Background),
		Children: []core.Node{
			core.View{
				Style: core.Style{
					FlexGrow:       1,
					Padding:        core.Symmetric(28, 20),
					PaddingEnv:     core.EnvEdges{Top: core.EnvSafeArea, Bottom: core.EnvKeyboard},
					JustifyContent: core.JustifyCenter,
					AlignItems:     core.AlignCenter,
					Gap:            20,
				},
				Children: []core.Node{
					// Warm Editorial Brand Header
					core.View{
						Style: core.Style{AlignItems: core.AlignCenter, Gap: 10},
						Children: []core.Node{
							core.View{
								Style: core.Style{
									Width:          core.Pt(56),
									Height:         core.Pt(56),
									CornerRadius:   16,
									AlignItems:     core.AlignCenter,
									JustifyContent: core.JustifyCenter,
								},
								StyleFunc: ui.Filled(colors.AccentFill),
								Children: []core.Node{
									ui.Icon(lucide.ListTodo, 28, colors.OnAccent),
								},
							},
							core.Text{
								Content:   "Todo",
								Style:     core.Style{FontSize: 26, FontWeight: ui.Semibold, LineHeight: 32},
								StyleFunc: ui.Colored(colors.Text),
							},
							core.Text{
								Content:   "连接你的 Todo 服务，随时随地离线同步任务",
								Style:     core.Style{FontSize: 13, LineHeight: 19, TextAlign: core.TextAlignCenter},
								StyleFunc: ui.Colored(colors.Muted),
							},
						},
					},

					// Elevated Warm Editorial Auth Card
					core.View{
						Style: core.Style{
							Width:        core.Pct(100),
							MaxWidth:     core.Pt(420),
							CornerRadius: 16,
							Padding:      core.All(20),
							Gap:          14,
						},
						StyleFunc: func() core.Style { return floatingCardStyle(cx) },
						Children: []core.Node{
							// Mode Switcher
							core.View{
								Style: core.Style{
									Direction:    core.Row,
									Padding:      core.All(3),
									CornerRadius: 10,
									Gap:          4,
								},
								StyleFunc: ui.Filled(colors.Inset),
								Children: []core.Node{
									modeTab("登录", false, "auth-tab-login"),
									modeTab("注册", true, "auth-tab-register"),
								},
							},

							fieldBlock("服务地址", ui.Input{
								Value:       server.Get,
								OnChange:    server.Set,
								Placeholder: "https://todo.marlon.life",
								Label:       "服务地址",
								TestID:      "auth-server",
								Style:       inputStyle,
							}),

							fieldBlock("用户名", ui.Input{
								Value:       username.Get,
								OnChange:    username.Set,
								Placeholder: "请输入用户名",
								Label:       "用户名",
								TestID:      "auth-username",
								Style:       inputStyle,
							}),

							core.Show{
								When: registerMode.Get,
								Then: func(*core.Scope) core.Node {
									return fieldBlock("邮箱（可选）", ui.Input{
										Value:       email.Get,
										OnChange:    email.Set,
										Placeholder: "name@example.com",
										Label:       "邮箱",
										TestID:      "auth-email",
										Style:       inputStyle,
									})
								},
							},

							fieldBlock("密码", ui.Input{
								Value:       password.Get,
								OnChange:    password.Set,
								Masked:      true,
								Placeholder: "请输入密码",
								Label:       "密码",
								TestID:      "auth-password",
								OnSubmit:    func(string) { submit() },
								Style:       inputStyle,
							}),

							// Inline Error Banner
							core.Show{
								When: func() bool { return state.authError.Get() != "" },
								Then: func(*core.Scope) core.Node {
									return core.View{
										TestID: "auth-error",
										Style: core.Style{
											Padding:      core.Symmetric(10, 12),
											CornerRadius: 10,
											BorderWidth:  1,
										},
										StyleFunc: func() core.Style {
											return core.Style{
												Background:  ui.TintsOf(cx).Danger(),
												BorderColor: ui.Alpha(colors.Danger(), 0.35),
											}
										},
										Children: []core.Node{
											core.Text{
												ContentFunc: state.authError.Get,
												Style:       core.Style{FontSize: 13, LineHeight: 18},
												StyleFunc:   ui.Colored(colors.Danger),
											},
										},
									}
								},
							},

							// Submit Button
							core.Show{
								When: registerMode.Get,
								Then: func(*core.Scope) core.Node {
									return ui.Button{
										Text:    "注册并登录",
										Variant: ui.ButtonPrimary,
										Busy:    state.authBusy.Get,
										OnPress: submit,
										TestID:  "auth-submit",
										Style:   core.Style{Width: core.Pct(100), Height: core.Pt(46), CornerRadius: 10},
									}
								},
								Else: func(*core.Scope) core.Node {
									return ui.Button{
										Text:    "登录",
										Variant: ui.ButtonPrimary,
										Busy:    state.authBusy.Get,
										OnPress: submit,
										TestID:  "auth-submit",
										Style:   core.Style{Width: core.Pct(100), Height: core.Pt(46), CornerRadius: 10},
									}
								},
							},
						},
					},

					core.Text{
						Content:   "默认已填入 https://todo.marlon.life，也可修改为其他自托管服务地址",
						Style:     core.Style{FontSize: 11.5, LineHeight: 16, TextAlign: core.TextAlignCenter, MaxWidth: core.Pt(340)},
						StyleFunc: ui.Colored(colors.Faint),
					},
				},
			},
		},
	})
}
