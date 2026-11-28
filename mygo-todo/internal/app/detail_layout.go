package app

import "github.com/egoist/mygo/ui"

// Share one split layout across task lists, calendar and other detail entry
// points. Neither list data nor ListState changes when the selection changes.
func (a *App) detailWorkspace(c *ui.Context, main func()) {
	width, _ := c.Size()
	windowWidth := width
	if width >= 1180 {
		width -= a.sidebarWidth + 1
	}
	if width >= 1050 || windowWidth >= 1180 {
		if a.taskWorkspaceWidth != width || a.taskListFitWidth <= 0 {
			a.taskWorkspaceWidth = width
			a.taskListFitWidth = fittedDetailListWidth(width, a.taskListWidth)
		}
		if ui.Split(c.Key("task-workspace"), &a.taskListFitWidth, func() {
			ui.Column(c).Fill().MinHeight(0).MinWidth(0).Background(tokensOf(c).BgList).Children(main)
		}, func() {
			ui.Column(c).Fill().MinHeight(0).MinWidth(0).Children(func() { a.taskDetailPanel(c, false) })
		}).SplitReset(taskListDefaultWidth).Grow(1).MinHeight(0).MinWidth(0).Changed() {
			a.taskListFitWidth = fittedDetailListWidth(width, a.taskListFitWidth)
			a.taskListWidth = a.taskListFitWidth
			a.rememberWorkspaceLayout()
		}
		return
	}
	dir := a.detailNavDir
	if dir == 0 {
		dir = 1
	}
	stage := ui.Box(c.Key("narrow-route-stage")).Grow(1).Fill().MinHeight(0).MinWidth(0).Clip().
		ChildExit(ui.Motion{Opacity: 1, XPercent: -30 * dir})
	stage.Children(func() {
		if a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) {
			ui.Column(c.Key("route-detail")).Absolute().Fill().MinHeight(0).MinWidth(0).
				Transition(motionPush(dir)).
				Children(func() { a.taskDetailPanel(c, true) })
		} else {
			ui.Column(c.Key("route-list")).Absolute().Fill().MinHeight(0).MinWidth(0).
				Background(tokensOf(c).BgList).
				Transition(motionPush(dir)).
				Children(main)
		}
	})
}

// detailDrawerWorkspace renders full-canvas pages (such as Calendar) at 100%
// full width and floats a responsive right-hand inspector drawer over the right
// edge so opening a task detail never narrows or deforms the calendar grid.
func (a *App) detailDrawerWorkspace(c *ui.Context, main func()) {
	width, _ := c.Size()
	windowWidth := width
	if width >= 1180 {
		width -= a.sidebarWidth + 1
	}
	if width >= 1050 || windowWidth >= 1180 {
		t := tokensOf(c)
		drawerWidth := min(float32(440), max(float32(detailMinWidth), width*0.36))
		drawerStage := ui.Box(c.Key("drawer-workspace")).Grow(1).Fill().MinHeight(0).MinWidth(0).Clip()
		if (a.editing || a.selectedOccurrence != nil) && a.taskMetaOpen == "" {
			drawerStage.OnShortcut(0, ui.KeyEscape, func() {
				a.detailNavDir = -1
				a.requestTaskTransition(func() {})
			})
		}
		drawerStage.Children(func() {
			ui.Column(c.Key("drawer-main-canvas")).Fill().MinHeight(0).MinWidth(0).
				Children(main)
			if a.editing || a.selectedOccurrence != nil {
				drawer := ui.Column(c.Key("detail-side-drawer")).Label("详情侧边抽屉").
					Absolute().Top(0).Bottom(0).Right(0).Width(drawerWidth).MinHeight(0).ZIndex(20).
					Background(t.BgApp).BorderWidth(0, 0, 0, 1).BorderColor(t.BorderDefault).
					Transition(motionDrawerRight())
				if c.Theme().Dark {
					drawer.Shadow(-8, 0, 28, -4, ui.RGBA(0, 0, 0, 0.36))
				} else {
					drawer.Shadow(-6, 0, 24, -4, ui.RGBA(28, 25, 23, 0.08))
				}
				if a.taskMetaOpen == "" && drawer.OverlayShortcut(0, ui.KeyEscape) {
					a.detailNavDir = -1
					a.requestTaskTransition(func() {})
				}
				drawer.Children(func() {
					a.taskDetailPanel(c, false)
				})
			}
		})
		return
	}
	dir := a.detailNavDir
	if dir == 0 {
		dir = 1
	}
	stage := ui.Box(c.Key("narrow-drawer-route-stage")).Grow(1).Fill().MinHeight(0).MinWidth(0).Clip().
		ChildExit(ui.Motion{Opacity: 1, XPercent: -30 * dir})
	stage.Children(func() {
		if a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) {
			col := ui.Column(c.Key("route-detail")).Absolute().Fill().MinHeight(0).MinWidth(0).
				Transition(motionPush(dir))
			if a.taskMetaOpen == "" {
				col.OnShortcut(0, ui.KeyEscape, func() {
					a.detailNavDir = -1
					a.requestTaskTransition(func() {})
				})
			}
			col.Children(func() { a.taskDetailPanel(c, true) })
		} else {
			ui.Column(c.Key("route-main")).Absolute().Fill().MinHeight(0).MinWidth(0).
				Transition(motionPush(dir)).
				Children(main)
		}
	})
}
