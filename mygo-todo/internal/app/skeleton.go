package app

import (
	"time"

	"github.com/egoist/mygo/ui"
)

func skeletonOpacity(c *ui.Context, el ui.Element, phase float32) float32 {
	if c.Preferences().ReduceMotion {
		return 0.65
	}
	return el.Keyframes("skeleton-pulse", []ui.Keyframe{
		{Value: 0.45},
		{At: 700 * time.Millisecond, Value: 0.85, Ease: ui.EaseInOut},
	}, ui.KeyframeOptions{
		Run:       1,
		Repeat:    ui.RepeatForever,
		Alternate: true,
		Delay:     time.Duration(phase*200) * time.Millisecond,
	})
}

func skeletonBar(c *ui.Context, w, h, radius float32, phase float32) ui.Element {
	t := tokensOf(c)
	box := ui.Box(c).Width(w).Height(h).Radius(radius).
		Background(t.BgSubtle).
		AccessHidden(true)
	return box.Opacity(skeletonOpacity(c, box, phase))
}

func (a *App) taskListSkeleton(c *ui.Context) {
	widths := []struct{ title, meta float32 }{
		{180, 96},
		{230, 120},
		{156, 84},
		{210, 110},
		{168, 90},
		{196, 102},
	}
	ui.Column(c.Key("task-list-skeleton")).Label("正在加载任务").Grow(1).Padding(8, 12).Gap(4).Children(func() {
		for i, w := range widths {
			phase := float32(i) * 0.45
			ui.Row(c.Key(i)).Height(taskSingleRowHeight).FillWidth().Padding(0, 10).Gap(10).AlignItems(ui.Center).Children(func() {
				skeletonBar(c, 16, 16, 5, phase)
				ui.Column(c).Grow(1).MinWidth(0).Gap(6).Justify(ui.Center).Children(func() {
					skeletonBar(c, w.title, 12, 4, phase+0.2)
					skeletonBar(c, w.meta, 9, 3, phase+0.4)
				})
			})
		}
	})
}

func (a *App) calendarSkeletonBanner(c *ui.Context) {
	t := tokensOf(c)
	ui.Row(c.Key("calendar-skeleton-banner")).Label("正在同步日历视图…").Height(28).FillWidth().Padding(0, 16).Gap(8).
		AlignItems(ui.Center).Background(t.BgSubtle.Alpha(0.75)).
		BorderWidth(0, 0, 1, 0).BorderColor(t.BorderSubtle).Children(func() {
		skeletonBar(c, 14, 14, 4, 0)
		skeletonBar(c, 140, 10, 4, 0.3)
		ui.Spacer(c)
		skeletonBar(c, 64, 10, 4, 0.6)
	})
}
