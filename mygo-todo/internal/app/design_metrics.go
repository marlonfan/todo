package app

import (
	"runtime"

	"github.com/egoist/mygo/ui"
)

// All dimensions are MyGo logical units, independent of backing/Retina scale.
// The system font is inherited through applyAppTheme; no bundled font is used.
const (
	fontTitle              = 18
	fontTask               = 13
	fontBody               = 13
	fontProperty           = 12
	fontAux                = 11
	fontWeightRegular      = 400
	fontWeightMedium       = 500
	fontWeightSemibold     = 600
	spaceUnit              = 4
	sidebarDefaultWidth    = 248
	taskListDefaultWidth   = 360
	detailPropertiesWidth  = 224
	toolbarHeight          = 50
	navigationRowHeight    = 34
	taskSingleRowHeight    = 52
	taskMetaRowHeight      = 52
	taskRowTitleLineHeight = 18
	taskRowTitleMaxLines   = 2
	controlHeight          = 30
	controlRadius          = 6
	popoverRadius          = 8
	dialogRadius           = 10

	windowTitleBarHeight  = 40
	trafficLightInsetX    = 14
	trafficLightInsetY    = 14
	windowBackgroundColor = "light-dark(#F5F3EE, #181715)"
	sidebarTitleBarMinH   = 38
	sidebarCompactTopDrag = 10
	loginTitleBarMinH     = 36
	emptyDetailTopDragMin = 24
	sidebarBreakpoint     = 1180
	splitDetailBreakpoint = 1050
)

// titleBarChromeMetrics holds platform-neutral toolbar dimensions derived from
// ui.Context.TitleBar() and which window edges the toolbar currently touches.
type titleBarChromeMetrics struct {
	ToolbarHeight float32
	PadLeft       float32
	PadRight      float32
}

// toolbarChromeMetrics computes the toolbar height and horizontal padding so
// native window controls (macOS traffic lights, Windows caption buttons, or
// Linux desktop buttons on either side) never overlap toolbar controls.
func toolbarChromeMetrics(bar ui.TitleBar, basePadX float32, touchesLeftEdge, touchesRightEdge bool) titleBarChromeMetrics {
	padLeft := basePadX
	if touchesLeftEdge && bar.Left > 0 {
		padLeft = bar.Left + basePadX
	}
	padRight := basePadX
	if touchesRightEdge && bar.Right > 0 {
		padRight = bar.Right + basePadX
	}
	return titleBarChromeMetrics{
		ToolbarHeight: max(float32(toolbarHeight), bar.Height),
		PadLeft:       padLeft,
		PadRight:      padRight,
	}
}

// sidebarTitleBarMetrics returns the top drag-strip height and whether it
// should drag the window. Docked sidebars reserve full traffic-light clearance
// when bar.Left > 0 and stay compact (10px) when bar.Left == 0 (Windows,
// fullscreen, or right-aligned controls); modal navigation drawers reserve none.
func sidebarTitleBarMetrics(bar ui.TitleBar, inDrawer bool) (height float32, draggable bool) {
	if inDrawer {
		return 0, false
	}
	if bar.Left > 0 {
		return max(bar.Height, float32(sidebarTitleBarMinH)), true
	}
	return float32(sidebarCompactTopDrag), true
}

func loginTitleBarHeight(bar ui.TitleBar) float32 {
	return max(bar.Height, float32(loginTitleBarMinH))
}

func emptyDetailTitleBarHeight(bar ui.TitleBar) float32 {
	return max(bar.Height, float32(emptyDetailTopDragMin))
}

// rightDetailPaneVisible reports whether the right-hand detail pane (either the
// persistent task-workspace split pane or the side drawer on other pages)
// currently occupies the top-right corner of the window and owns bar.Right.
func (a *App) rightDetailPaneVisible(windowWidth float32) bool {
	if windowWidth < splitDetailBreakpoint {
		return false
	}
	if isTaskWorkspacePage(a.page) {
		return true
	}
	return a.editing || a.selectedOccurrence != nil
}

func (a *App) windowToolbarMetrics(c *ui.Context, basePadX float32) titleBarChromeMetrics {
	windowWidth, _ := c.Size()
	return toolbarChromeMetrics(c.TitleBar(), basePadX, windowWidth < sidebarBreakpoint, !a.rightDetailPaneVisible(windowWidth))
}

func shortcutHint(key string) string {
	if runtime.GOOS == "darwin" {
		return "⌘" + key
	}
	return "Ctrl+" + key
}
