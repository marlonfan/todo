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

func drawerFloatingWidth(workspaceWidth float32) float32 {
	return min(float32(440), max(float32(detailMinWidth), workspaceWidth*0.36))
}

func (a *App) canCloseFloatingDetailOnEscape() bool {
	return (a.editing || a.selectedOccurrence != nil) &&
		a.taskMetaOpen == "" &&
		!a.autosave.composing &&
		!a.richComposing &&
		a.aiPanel == nil &&
		!a.taskDiscardConfirm &&
		a.deleteTask == nil &&
		a.taskCenter == nil &&
		a.calendarDetail == nil &&
		!a.search.Open &&
		!a.sidebarOverlay
}

// detailDrawerWorkspace renders full-canvas pages (such as Calendar) at their
// full natural size and floats the right-hand task inspector drawer as an
// elevated overlay above the canvas so opening/closing it never resizes,
// shifts, or deforms the calendar grid.
func (a *App) detailDrawerWorkspace(c *ui.Context, main func()) {
	width, _ := c.Size()
	windowWidth := width
	if width >= sidebarBreakpoint {
		width -= a.sidebarWidth + 1
	}
	if width >= splitDetailBreakpoint || windowWidth >= sidebarBreakpoint {
		t := tokensOf(c)
		drawerWidth := drawerFloatingWidth(width)
		workspace := ui.Box(c.Key("drawer-workspace")).Grow(1).Fill().MinHeight(0).MinWidth(0)
		workspace.Children(func() {
			ui.Column(c.Key("drawer-main-canvas")).Fill().MinHeight(0).MinWidth(0).Children(main)
			if a.editing || a.selectedOccurrence != nil {
				scrim := ui.RGBA(28, 25, 23, 0.08)
				if c.Theme().Dark {
					scrim = ui.RGBA(0, 0, 0, 0.24)
				}
				ui.Box(c.Key("detail-side-backdrop")).Label("关闭详情抽屉").
					Absolute().Fill().ZIndex(30).
					Background(scrim).
					OnClick(func() { a.requestTaskTransition(func() {}) })

				drawer := ui.Column(c.Key("detail-side-drawer")).Label("详情侧边抽屉").
					Absolute().Top(0).Bottom(0).Right(0).Width(drawerWidth).ZIndex(40).
					MinHeight(0).Background(t.BgApp)
				if c.Theme().Dark {
					drawer.BorderWidth(0, 0, 0, 1).BorderColor(t.BorderPopup).
						Shadow(-4, 0, 12, 0, ui.RGBA(0, 0, 0, 0.36)).
						Shadow(-16, 0, 40, -6, ui.RGBA(0, 0, 0, 0.48))
				} else {
					drawer.BorderWidth(0, 0, 0, 1).BorderColor(t.BorderDefault).
						Shadow(-2, 0, 8, 0, ui.RGBA(28, 25, 23, 0.06)).
						Shadow(-14, 0, 36, -6, ui.RGBA(28, 25, 23, 0.12))
				}
				if a.canCloseFloatingDetailOnEscape() && drawer.OverlayShortcut(0, ui.KeyEscape) {
					a.requestTaskTransition(func() {})
				}
				drawer.Children(func() {
					a.taskDetailPanel(c, false)
				})
			}
		})
	} else if a.taskDetailOpen && (a.editing || a.selectedOccurrence != nil) {
		col := ui.Column(c).Grow(1).MinHeight(0).MinWidth(0)
		if a.canCloseFloatingDetailOnEscape() {
			col.OnShortcut(0, ui.KeyEscape, func() { a.requestTaskTransition(func() {}) })
			if col.OverlayShortcut(0, ui.KeyEscape) {
				a.requestTaskTransition(func() {})
			}
		}
		col.Children(func() { a.taskDetailPanel(c, true) })
	} else {
		main()
	}
}
