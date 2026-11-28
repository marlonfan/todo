package app

import (
	"math"
	"time"

	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/ui"
)

// celebrationBurst draws a brief warm terracotta & amber radial sparkle burst
// around a task checkbox when a task is completed.
func celebrationBurst(cx *core.Scope, progress func() float64) core.Node {
	colors := ui.ColorsOf(cx)
	return core.View{
		PointerEvents: core.PointerEventsNone,
		Style: core.Style{
			Position: core.Absolute,
			Top:      core.Pt(-10),
			Left:     core.Pt(-10),
			Width:    core.Pt(58),
			Height:   core.Pt(58),
		},
		Children: []core.Node{
			core.Canvas{
				Style: core.Style{
					Width:  core.Pt(58),
					Height: core.Pt(58),
				},
				Draw: func(d *core.Drawing, size core.Size) {
					p := progress()
					if p <= 0 || p >= 1 {
						return
					}
					cxPt := float32(size.Width) / 2
					cyPt := float32(size.Height) / 2
					// Ease-out cubic for crisp initial pop and gentle settle
					ease := 1 - math.Pow(1-p, 3)
					fade := float32(1 - math.Pow(p, 1.8))
					if fade <= 0.01 {
						return
					}

					accent := colors.Accent()
					warn := colors.Warn()
					up := colors.Up()

					// Expanding soft ring
					ringR := float32(10 + ease*15)
					d.Save()
					d.BeginPath()
					d.Arc(cxPt, cyPt, ringR, 0, 2*math.Pi, false)
					d.SetStrokeColor(ui.Alpha(accent, fade*0.55))
					d.SetLineWidth(float32(2.2 * (1 - p*0.7)))
					d.Stroke()
					d.Restore()

					// 8 warm editorial confetti particles
					palette := []core.Color{accent, warn, up, accent, warn, accent, up, warn}
					for i := 0; i < 8; i++ {
						angle := float64(i)*(math.Pi/4) + 0.25
						dist := 11.0 + ease*16.5
						if i%2 == 1 {
							dist = 9.0 + ease*12.5
						}
						px := cxPt + float32(math.Cos(angle)*dist)
						py := cyPt + float32(math.Sin(angle)*dist)
						r := float32((2.6 - p*1.4))
						if i%2 == 1 {
							r *= 0.78
						}
						if r <= 0.3 {
							continue
						}
						d.Save()
						d.BeginPath()
						d.Arc(px, py, r, 0, 2*math.Pi, false)
						d.SetFillColor(ui.Alpha(palette[i], fade*0.92))
						d.Fill()
						d.Restore()
					}
				},
			},
		},
	}
}

// warmSunCelebration renders a serene warm terracotta/amber sunrise emblem when
// today's tasks are all cleared. Uses a finite entrance spring (no endless loop
// and no AtFrameRate cap so Android's Choreographer stays at full 90/120Hz).
func warmSunCelebration(cx *core.Scope) core.Node {
	colors := ui.ColorsOf(cx)
	scale := core.NewAnimatedValue(cx, 0.78)
	halo := core.NewAnimatedValue(cx, 0.4)

	if !cx.Env().ReduceMotion() {
		cx.StartAnimation(
			core.Parallel(
				core.Spring(scale, 1.0, core.SpringConfig{Stiffness: 240, Damping: 18}),
				core.Timing(halo, 1.0, core.TimingConfig{Duration: 450 * time.Millisecond}),
			),
			nil,
		)
	} else {
		scale.Set(1.0)
		halo.Set(1.0)
	}

	return core.View{
		Style: core.Style{
			Width:          core.Pt(76),
			Height:         core.Pt(76),
			AlignItems:     core.AlignCenter,
			JustifyContent: core.JustifyCenter,
		},
		Children: []core.Node{
			core.View{
				Style: core.Style{
					Position:     core.Absolute,
					Width:        core.Pt(72),
					Height:       core.Pt(72),
					CornerRadius: 36,
					Animated: &core.AnimatedStyle{
						Scale:   scale,
						Opacity: halo,
					},
				},
				StyleFunc: func() core.Style {
					return core.Style{Background: ui.Alpha(colors.Accent(), 0.12)}
				},
			},
			core.View{
				Style: core.Style{
					Width:          core.Pt(50),
					Height:         core.Pt(50),
					CornerRadius:   25,
					AlignItems:     core.AlignCenter,
					JustifyContent: core.JustifyCenter,
				},
				StyleFunc: func() core.Style {
					return core.Style{Background: ui.Alpha(colors.Accent(), 0.20)}
				},
				Children: []core.Node{
					core.Canvas{
						Style: core.Style{Width: core.Pt(32), Height: core.Pt(32)},
						Draw: func(d *core.Drawing, size core.Size) {
							w, h := float32(size.Width), float32(size.Height)
							accent := colors.Accent()
							warn := colors.Warn()
							// Central warm sun disc
							d.BeginPath()
							d.Arc(w/2, h/2, 6.5, 0, 2*math.Pi, false)
							d.SetFillColor(accent)
							d.Fill()
							// Delicate sun rays
							d.SetStrokeColor(accent)
							d.SetLineWidth(1.8)
							for i := 0; i < 8; i++ {
								a := float64(i) * (math.Pi / 4)
								x1 := w/2 + float32(math.Cos(a)*9.5)
								y1 := h/2 + float32(math.Sin(a)*9.5)
								x2 := w/2 + float32(math.Cos(a)*13.2)
								y2 := h/2 + float32(math.Sin(a)*13.2)
								d.BeginPath()
								d.MoveTo(x1, y1)
								d.LineTo(x2, y2)
								d.Stroke()
							}
							// Tiny accent sparkle dots
							d.BeginPath()
							d.Arc(w*0.84, h*0.2, 1.8, 0, 2*math.Pi, false)
							d.SetFillColor(warn)
							d.Fill()
						},
					},
				},
			},
		},
	}
}

// spinningIcon wraps an icon with smooth continuous rotation while active() is true.
func spinningIcon(cx *core.Scope, icon func() *core.SVG, size core.Points, tint func() core.Color, active func() bool) core.Node {
	rot := core.NewAnimatedValue(cx, 0)
	env := cx.Env()
	var run *core.AnimationRun

	cx.Effect(func() {
		on := active()
		if run != nil {
			run.Stop()
			run = nil
		}
		if on && !env.ReduceMotion() {
			rot.Set(0)
			run = cx.StartAnimation(
				core.Loop(
					core.Timing(rot, 360, core.TimingConfig{Duration: 850 * time.Millisecond}),
					0,
				),
				nil,
			)
		} else {
			rot.Set(0)
		}
	})

	return core.View{
		Style: core.Style{
			Width:          core.Pt(size),
			Height:         core.Pt(size),
			AlignItems:     core.AlignCenter,
			JustifyContent: core.JustifyCenter,
			Animated:       &core.AnimatedStyle{Rotate: rot},
		},
		Children: []core.Node{
			ui.Icon(icon, size, tint),
		},
	}
}

// springPop runs a snappy spring scale pop (e.g. 0.84 -> 1.0) on v.
func springPop(cx *core.Scope, v *core.AnimatedValue, from float64) {
	if cx.Env().ReduceMotion() {
		v.Set(1)
		return
	}
	v.Set(from)
	cx.StartAnimation(
		core.Spring(v, 1, core.SpringConfig{Stiffness: 380, Damping: 18}),
		nil,
	)
}

// scrollFrameBooster keeps Android 14/15's ViewRootImpl frame-rate voter at
// native high refresh rate (90/120Hz) during scroll fling momentum.
//
// NSGo v0.2.0's Android VScroll drives momentum via scrollTo() inside
// postOnAnimation(), which does not trigger Android's OverScroller velocity
// vote and can drop to 30Hz (33.3ms) on LTPO/OriginOS displays as soon as the
// finger lifts. Running a tiny Choreographer-driven TranslateY animation only
// between OnMomentumStart and OnScrollEnd/OnMomentumEnd keeps Choreographer
// locked to full display refresh rate during flings and stops immediately at rest.
type scrollFrameBooster struct {
	node    core.Node
	onStart func(core.ScrollEvent)
	onEnd   func(core.ScrollEvent)
}

func newScrollFrameBooster(cx *core.Scope) scrollFrameBooster {
	if cx.Env().OS() != core.OSAndroid || cx.Env().ReduceMotion() {
		return scrollFrameBooster{
			node:    core.Group(nil),
			onStart: func(core.ScrollEvent) {},
			onEnd:   func(core.ScrollEvent) {},
		}
	}
	v := core.NewAnimatedValue(cx, 0)
	var run *core.AnimationRun

	stop := func() {
		if run != nil {
			run.Stop()
			run = nil
		}
	}
	start := func() {
		stop()
		v.Set(0)
		// Move a tiny nearly-transparent proxy view at native Choreographer
		// rate across the full duration of any momentum fling (capped safely
		// at 8 cycles ~14.4s and stopped immediately on OnMomentumEnd/OnScrollEnd)
		// so Android's ViewRootImpl keeps full high refresh rate while gliding.
		run = cx.StartAnimation(
			core.Loop(
				core.Sequence(
					core.Timing(v, 1800, core.TimingConfig{Duration: 900 * time.Millisecond, Easing: core.BezierEasing(core.Linear)}),
					core.Timing(v, 0, core.TimingConfig{Duration: 900 * time.Millisecond, Easing: core.BezierEasing(core.Linear)}),
				),
				8,
			),
			nil,
		)
	}

	proxy := core.View{
		PointerEvents: core.PointerEventsNone,
		Style: core.Style{
			Position:   core.Absolute,
			Top:        core.Pt(0),
			Left:       core.Pt(0),
			Width:      core.Pt(2),
			Height:     core.Pt(2),
			Background: core.RGBA(0x000000, 0.01),
			Animated:   &core.AnimatedStyle{TranslateY: v},
		},
	}

	return scrollFrameBooster{
		node:    proxy,
		onStart: func(core.ScrollEvent) { start() },
		onEnd:   func(core.ScrollEvent) { stop() },
	}
}

// smoothScroll configures a core.Scroll onto NSGo's ZoomScroll (with zoom
// locked at 1 and pinch/bounce-zoom disabled) so Android flings run on the
// native VSync-timed OverScroller instead of NSGo's uptimeMillis glide() loop.
func smoothScroll(s core.Scroll) core.Scroll {
	s.MinZoomScale = 1
	s.MaxZoomScale = 1.0001
	s.ZoomScale = 1
	s.NoPinchZoom = true
	s.NoBouncesZoom = true
	return s
}

type smoothRefreshScrollOptions struct {
	RefreshTestID string
	ScrollTestID  string
	OnRefresh     func()
	Refreshing    func() bool
	Style         *core.Style
	Children      []core.Node
}

// smoothRefreshScroll combines native pull-to-refresh (outer core.Scroll,
// enabled only while resting at the top) with native OverScroller fling
// momentum (inner locked-zoom ZoomScroll sized to the measured viewport).
func smoothRefreshScroll(cx *core.Scope, opts smoothRefreshScrollOptions) core.Node {
	atTop := core.NewSignal(cx, true)
	viewportH := core.NewSignal(cx, 0.0)
	booster := newScrollFrameBooster(cx)

	pullRefreshing := core.NewSignal(cx, false)
	startPullRefresh := func() {
		pullRefreshing.Set(true)
		if opts.OnRefresh != nil {
			opts.OnRefresh()
		}
		if opts.Refreshing == nil || !opts.Refreshing() {
			pullRefreshing.Set(false)
		}
	}
	cx.Effect(func() {
		if opts.Refreshing != nil && !opts.Refreshing() && pullRefreshing.GetUntracked() {
			pullRefreshing.Set(false)
		}
	})

	wrapperStyle := core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)}
	if opts.Style != nil {
		wrapperStyle = *opts.Style
	}

	inner := smoothScroll(core.Scroll{
		TestID:          opts.ScrollTestID,
		OnMomentumStart: booster.onStart,
		OnMomentumEnd:   booster.onEnd,
		OnScrollEnd:     booster.onEnd,
		OnScroll: func(e core.ScrollEvent) {
			if top := e.Offset.Y <= 0.5; top != atTop.GetUntracked() {
				atTop.Set(top)
			}
		},
		StyleFunc: func() core.Style {
			return core.Style{Width: core.Pct(100), Height: core.Pt(core.Points(viewportH.Get()))}
		},
		Children: opts.Children,
	})

	return core.View{
		Style: wrapperStyle,
		OnLayout: func(b core.Bounds) {
			if h := float64(b.Size.Height); h > 0 && h != viewportH.GetUntracked() {
				viewportH.Set(h)
			}
		},
		Children: []core.Node{
			core.Scroll{
				TestID:     opts.RefreshTestID,
				OnRefresh:  startPullRefresh,
				Refreshing: pullRefreshing.Get,
				BehaviorFunc: func() core.ScrollBehavior {
					return core.ScrollBehavior{NoScroll: !atTop.Get(), NoBounces: true}
				},
				Style:    core.Style{FlexGrow: 1, FlexShrink: 1, MinHeight: core.Pt(0)},
				Children: []core.Node{inner},
			},
			booster.node,
		},
	}
}
