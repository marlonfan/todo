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
	} else if a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) {
		ui.Column(c).Grow(1).MinHeight(0).MinWidth(0).Children(func() { a.taskDetailPanel(c, true) })
	} else {
		main()
	}
}

// detailDrawerWorkspace renders full-canvas pages (such as Calendar) alongside
// a responsive right-hand inspector drawer inside a horizontal flex row so the
// calendar grid and top view switcher resize gracefully without ever clipping.
func (a *App) detailDrawerWorkspace(c *ui.Context, main func()) {
	width, _ := c.Size()
	windowWidth := width
	if width >= 1180 {
		width -= a.sidebarWidth + 1
	}
	if width >= 1050 || windowWidth >= 1180 {
		t := tokensOf(c)
		drawerWidth := min(float32(440), max(float32(detailMinWidth), width*0.36))
		drawerRow := ui.Row(c.Key("drawer-workspace")).Grow(1).Fill().MinHeight(0).MinWidth(0)
		if (a.editing || a.selectedOccurrence != nil) && a.taskMetaOpen == "" {
			drawerRow.OnShortcut(0, ui.KeyEscape, func() { a.requestTaskTransition(func() {}) })
		}
		drawerRow.Children(func() {
			ui.Column(c.Key("drawer-main-canvas")).Grow(1).FillHeight().MinHeight(0).MinWidth(0).Children(main)
			if a.editing || a.selectedOccurrence != nil {
				drawer := ui.Column(c.Key("detail-side-drawer")).Label("详情侧边抽屉").
					Width(drawerWidth).FillHeight().MinHeight(0).Shrink(0).
					Background(t.BgApp).BorderWidth(0, 0, 0, 1).BorderColor(t.BorderDefault)
				if c.Theme().Dark {
					drawer.Shadow(-6, 0, 20, 0, ui.RGBA(0, 0, 0, 0.28))
				} else {
					drawer.Shadow(-4, 0, 16, 0, ui.RGBA(28, 25, 23, 0.05))
				}
				if a.taskMetaOpen == "" && drawer.OverlayShortcut(0, ui.KeyEscape) {
					a.requestTaskTransition(func() {})
				}
				drawer.Children(func() {
					a.taskDetailPanel(c, false)
				})
			}
		})
	} else if a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) {
		col := ui.Column(c).Grow(1).MinHeight(0).MinWidth(0)
		if a.taskMetaOpen == "" {
			col.OnShortcut(0, ui.KeyEscape, func() { a.requestTaskTransition(func() {}) })
		}
		col.Children(func() { a.taskDetailPanel(c, true) })
	} else {
		main()
	}
}
