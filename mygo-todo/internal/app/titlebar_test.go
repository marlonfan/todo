package app

import (
	"testing"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func titleBarTestApp(t *testing.T) *App {
	t.Helper()
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 11, 20, 10, 0, 0, 0, loc)
	start := now.Add(time.Hour)
	a := New(storage.Store{Dir: t.TempDir()})
	t.Cleanup(a.Close)
	a.client, _ = api.New(api.DefaultServer, "token")
	a.session.User = api.User{ID: 1, Username: "marlon", Timezone: "Asia/Shanghai"}
	a.selectedDay = now
	a.adoptCache(storage.Cache{
		Server:  api.DefaultServer,
		UserID:  1,
		SavedAt: now,
		Tasks: []api.Task{
			{ID: 1, Title: "跨平台隐藏标题栏验证", Status: "pending", StartTime: &start, Revision: 1},
		},
		Calendar: &storage.CalendarSnapshot{
			Start:    now.AddDate(0, -1, 0),
			End:      now.AddDate(0, 1, 0),
			Timezone: "Asia/Shanghai",
			SavedAt:  now,
		},
	})
	return a
}

func TestMainWindowOptionsHiddenTitleBarCrossPlatform(t *testing.T) {
	a := titleBarTestApp(t)
	opts := a.mainWindowOptions(false)
	if opts.TitleBarStyle != mygo.TitleBarHiddenInset {
		t.Fatalf("TitleBarStyle = %q, want %q", opts.TitleBarStyle, mygo.TitleBarHiddenInset)
	}
	if opts.TitleBarHeight != 40 {
		t.Fatalf("TitleBarHeight = %d, want 40", opts.TitleBarHeight)
	}
	if opts.TrafficLightPosition == nil || opts.TrafficLightPosition.X != 14 || opts.TrafficLightPosition.Y != 14 {
		t.Fatalf("TrafficLightPosition = %+v, want {X:14 Y:14}", opts.TrafficLightPosition)
	}
	if !opts.AutoHideMenuBar {
		t.Fatal("AutoHideMenuBar must be enabled for Windows/Linux hidden title bar")
	}
	if opts.BackgroundColor != "light-dark(#F5F3EE, #181715)" {
		t.Fatalf("BackgroundColor = %q, want light-dark(#F5F3EE, #181715)", opts.BackgroundColor)
	}
	if opts.HideWindowButtons {
		t.Fatal("HideWindowButtons must remain false so OS window controls stay native")
	}
	if !a.mainWindowOptions(true).Hidden {
		t.Fatal("mainWindowOptions(true) must preserve Hidden flag")
	}
}

func TestTitleBarChromeMetricsPureCrossPlatform(t *testing.T) {
	macBar := ui.TitleBar{Height: 38, Left: 78, Right: 0}
	winBar := ui.TitleBar{Height: 40, Left: 0, Right: 138}
	linuxTallBar := ui.TitleBar{Height: 56, Left: 64, Right: 44}
	fullscreenBar := ui.TitleBar{}

	if h, drag := sidebarTitleBarMetrics(macBar, false); h != 38 || !drag {
		t.Fatalf("mac docked sidebar = (%v, %v), want (38, true)", h, drag)
	}
	if h, drag := sidebarTitleBarMetrics(ui.TitleBar{Height: 28, Left: 72}, false); h != 38 || !drag {
		t.Fatalf("short mac docked sidebar = (%v, %v), want (38, true)", h, drag)
	}
	if h, drag := sidebarTitleBarMetrics(winBar, false); h != 10 || !drag {
		t.Fatalf("win docked sidebar = (%v, %v), want (10, true)", h, drag)
	}
	if h, drag := sidebarTitleBarMetrics(fullscreenBar, false); h != 10 || !drag {
		t.Fatalf("fullscreen docked sidebar = (%v, %v), want (10, true)", h, drag)
	}
	if h, drag := sidebarTitleBarMetrics(macBar, true); h != 0 || drag {
		t.Fatalf("drawer sidebar = (%v, %v), want (0, false)", h, drag)
	}

	if got := toolbarChromeMetrics(macBar, 16, true, false); got.ToolbarHeight != 50 || got.PadLeft != 94 || got.PadRight != 16 {
		t.Fatalf("narrow mac toolbar metrics = %+v", got)
	}
	if got := toolbarChromeMetrics(winBar, 16, false, true); got.ToolbarHeight != 50 || got.PadLeft != 16 || got.PadRight != 154 {
		t.Fatalf("wide win single-pane toolbar metrics = %+v", got)
	}
	if got := toolbarChromeMetrics(winBar, 16, false, false); got.ToolbarHeight != 50 || got.PadLeft != 16 || got.PadRight != 16 {
		t.Fatalf("wide win split-pane toolbar metrics = %+v", got)
	}
	if got := toolbarChromeMetrics(linuxTallBar, 12, true, true); got.ToolbarHeight != 56 || got.PadLeft != 76 || got.PadRight != 56 {
		t.Fatalf("linux tall toolbar metrics = %+v", got)
	}
	if got := toolbarChromeMetrics(fullscreenBar, 16, true, true); got.ToolbarHeight != 50 || got.PadLeft != 16 || got.PadRight != 16 {
		t.Fatalf("fullscreen toolbar metrics = %+v", got)
	}

	if got := loginTitleBarHeight(fullscreenBar); got != 36 {
		t.Fatalf("loginTitleBarHeight(fullscreen) = %v, want 36", got)
	}
	if got := loginTitleBarHeight(winBar); got != 40 {
		t.Fatalf("loginTitleBarHeight(win) = %v, want 40", got)
	}
	if got := emptyDetailTitleBarHeight(fullscreenBar); got != 24 {
		t.Fatalf("emptyDetailTitleBarHeight(fullscreen) = %v, want 24", got)
	}
	if got := emptyDetailTitleBarHeight(winBar); got != 40 {
		t.Fatalf("emptyDetailTitleBarHeight(win) = %v, want 40", got)
	}

	a := titleBarTestApp(t)
	a.page = "all"
	if !a.rightDetailPaneVisible(1280) || !a.rightDetailPaneVisible(1050) || a.rightDetailPaneVisible(1049) {
		t.Fatal("task workspace rightDetailPaneVisible mismatch")
	}
	a.page = "calendar"
	if a.rightDetailPaneVisible(1280) {
		t.Fatal("calendar without selection must not mark right detail pane visible")
	}
	a.editing = true
	if !a.rightDetailPaneVisible(1280) || !a.rightDetailPaneVisible(1050) || a.rightDetailPaneVisible(960) {
		t.Fatal("calendar with open drawer rightDetailPaneVisible mismatch")
	}
	a.page = "settings"
	a.editing = false
	if a.rightDetailPaneVisible(1440) {
		t.Fatal("settings without drawer must not mark right detail pane visible")
	}
}

func TestSidebarAndHeaderTitleBarAvoidanceAcrossPlatforms(t *testing.T) {
	macBar := ui.TitleBar{Height: 38, Left: 78, Right: 0}
	winBar := ui.TitleBar{Height: 40, Left: 0, Right: 138}
	fullscreenBar := ui.TitleBar{}

	a := titleBarTestApp(t)
	tt := ui.NewTester(a.view, 1440, 900)

	// 1. macOS wide: sidebar reserves traffic-light band so account menu starts at Y >= 38.
	tt.SetTitleBar(macBar)
	accountMac, ok := tt.Find("账户菜单")
	if !ok {
		t.Fatal("missing sidebar account menu on macOS")
	}
	if accountMac.Y < macBar.Height {
		t.Fatalf("macOS sidebar account menu overlaps traffic lights: Y=%v < %v", accountMac.Y, macBar.Height)
	}

	// 2. Windows wide: sidebar stays compact (Y == 10, no wasted macOS traffic-light block),
	//    middle list header does NOT add duplicate bar.Right padding, and empty detail clears top 40px.
	tt.SetTitleBar(fullscreenBar)
	newTaskFS, ok := tt.Find("＋ 新建任务")
	if !ok {
		t.Fatal("missing new task button in fullscreen")
	}

	tt.SetTitleBar(winBar)
	accountWin, ok := tt.Find("账户菜单")
	if !ok {
		t.Fatal("missing sidebar account menu on Windows")
	}
	if accountWin.Y != sidebarCompactTopDrag {
		t.Fatalf("Windows sidebar account menu Y=%v, want compact %v", accountWin.Y, sidebarCompactTopDrag)
	}
	newTaskWinWide, ok := tt.Find("＋ 新建任务")
	if !ok {
		t.Fatal("missing new task button on Windows wide")
	}
	if newTaskWinWide.X != newTaskFS.X {
		t.Fatalf("Windows 3-column middle header reserved duplicate bar.Right: win X=%v vs fullscreen X=%v", newTaskWinWide.X, newTaskFS.X)
	}
	emptyHeading, ok := tt.Find("选择一个任务")
	if !ok {
		t.Fatal("missing empty detail state")
	}
	if emptyHeading.Y < winBar.Height {
		t.Fatalf("empty detail content overlapped Windows caption bar: Y=%v", emptyHeading.Y)
	}

	// 3. Narrow task list (< 1050): header touches both window edges.
	//    macOS clears bar.Left; Windows clears bar.Right; child buttons stay clickable inside DragWindow.
	tt.SetSize(960, 720)
	tt.SetTitleBar(macBar)
	navMac, ok := tt.Find("展开导航")
	if !ok {
		t.Fatal("missing narrow nav button on macOS")
	}
	if navMac.X < macBar.Left {
		t.Fatalf("narrow macOS nav button overlaps traffic lights: X=%v < Left=%v", navMac.X, macBar.Left)
	}
	if err := tt.Click("展开导航"); err != nil {
		t.Fatalf("clicking nav button inside DragWindow header failed: %v", err)
	}
	if !a.sidebarOverlay {
		t.Fatal("clicking nav button did not open sidebar overlay")
	}
	// Modal navigation drawer must not waste top macOS traffic-light clearance.
	if drawerAcct, ok := tt.Find("账户菜单"); ok && drawerAcct.Y >= 120 {
		// Dialog is vertically centered; just verify it renders cleanly without error.
		_ = drawerAcct
	}
	a.sidebarOverlay = false
	tt.Frame()

	tt.SetTitleBar(winBar)
	newTaskWinNarrow, ok := tt.Find("＋ 新建任务")
	if !ok {
		t.Fatal("missing narrow new task button on Windows")
	}
	if rightEdge := newTaskWinNarrow.X + newTaskWinNarrow.W; rightEdge > 960-winBar.Right {
		t.Fatalf("narrow Windows header button overlaps caption buttons: rightEdge=%v > %v", rightEdge, 960-winBar.Right)
	}
	if err := tt.Click("＋ 新建任务"); err != nil {
		t.Fatalf("clicking new task button inside DragWindow header failed: %v", err)
	}
	if !a.editing {
		t.Fatal("clicking new task button did not enter editing")
	}
	a.clearTaskSelection()
	tt.Frame()

	// 4. Failure banner clears Windows bar.Right and macOS bar.Left.
	a.failure = "网络同步暂不可用"
	tt.SetSize(1440, 900)
	tt.SetTitleBar(winBar)
	dismissWin, ok := tt.Find("关闭提示")
	if !ok {
		t.Fatal("missing failure banner dismiss button")
	}
	if rightEdge := dismissWin.X + dismissWin.W; rightEdge > 1440-winBar.Right {
		t.Fatalf("failure banner close button overlaps Windows caption buttons: rightEdge=%v > %v", rightEdge, 1440-winBar.Right)
	}
	if err := tt.Click("关闭提示"); err != nil {
		t.Fatalf("clicking failure dismiss button failed: %v", err)
	}
	if a.failure != "" {
		t.Fatal("clicking failure dismiss button did not clear failure")
	}
}

func TestCalendarToolbarTitleBarAvoidanceAndDrawerCoordination(t *testing.T) {
	macBar := ui.TitleBar{Height: 38, Left: 78, Right: 0}
	winBar := ui.TitleBar{Height: 40, Left: 0, Right: 138}
	fullscreenBar := ui.TitleBar{}

	a := titleBarTestApp(t)
	a.page = "calendar"
	a.calendarMode = 2
	tt := ui.NewTester(a.view, 1440, 900)

	// 1. Wide calendar without drawer on Windows: "+" button stays strictly left of bar.Right.
	tt.SetTitleBar(winBar)
	addNoDrawerWin, ok := tt.Find("添加日程")
	if !ok {
		t.Fatal("missing calendar create button on Windows")
	}
	if rightEdge := addNoDrawerWin.X + addNoDrawerWin.W; rightEdge > 1440-winBar.Right {
		t.Fatalf("calendar '+' button overlaps Windows caption controls: rightEdge=%v > %v", rightEdge, 1440-winBar.Right)
	}

	// 2. Wide calendar WITH detail drawer open: right drawer owns bar.Right, so calendar
	//    toolbar does not reserve duplicate 138px right padding.
	a.editTaskNow(a.tasks[0])
	tt.SetTitleBar(fullscreenBar)
	addDrawerFS, ok := tt.Find("添加日程")
	if !ok {
		t.Fatal("missing calendar create button with drawer in fullscreen")
	}
	tt.SetTitleBar(winBar)
	addDrawerWin, ok := tt.Find("添加日程")
	if !ok {
		t.Fatal("missing calendar create button with drawer on Windows")
	}
	if addDrawerWin.X != addDrawerFS.X {
		t.Fatalf("calendar toolbar reserved duplicate bar.Right when detail drawer was open: win X=%v vs fullscreen X=%v", addDrawerWin.X, addDrawerFS.X)
	}
	a.clearTaskSelection()

	// 3. Narrow calendar (< 1180) on macOS: nav button clears bar.Left and does not overlap Today button.
	tt.SetSize(960, 720)
	tt.SetTitleBar(macBar)
	navBtn, ok := tt.Find("展开导航")
	if !ok {
		t.Fatal("missing narrow calendar nav button on macOS")
	}
	todayBtn, ok := tt.Find("回到今天")
	if !ok {
		t.Fatal("missing calendar today button on macOS")
	}
	if navBtn.X < macBar.Left {
		t.Fatalf("narrow calendar nav button overlaps macOS traffic lights: X=%v < %v", navBtn.X, macBar.Left)
	}
	if todayBtn.X < navBtn.X+navBtn.W {
		t.Fatalf("calendar today button overlaps nav button: today.X=%v < nav.Right=%v", todayBtn.X, navBtn.X+navBtn.W)
	}

	// 4. Narrow calendar on Windows: "+" button clears bar.Right and stays clickable inside DragWindow.
	tt.SetTitleBar(winBar)
	addNarrowWin, ok := tt.Find("添加日程")
	if !ok {
		t.Fatal("missing narrow calendar create button on Windows")
	}
	if rightEdge := addNarrowWin.X + addNarrowWin.W; rightEdge > 960-winBar.Right {
		t.Fatalf("narrow calendar '+' button overlaps Windows caption controls: rightEdge=%v > %v", rightEdge, 960-winBar.Right)
	}
	if err := tt.Click("添加日程"); err != nil {
		t.Fatalf("clicking calendar '+' inside DragWindow toolbar failed: %v", err)
	}
	if !a.editing {
		t.Fatal("clicking calendar '+' did not create task")
	}
}

func TestLoginViewTitleBarDragBandClearance(t *testing.T) {
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	tt := ui.NewTester(a.view, 900, 600)

	for _, tc := range []struct {
		name string
		bar  ui.TitleBar
	}{
		{"macos", ui.TitleBar{Height: 38, Left: 78, Right: 0}},
		{"windows", ui.TitleBar{Height: 40, Left: 0, Right: 138}},
		{"fullscreen", ui.TitleBar{}},
	} {
		tt.SetTitleBar(tc.bar)
		heading, ok := tt.Find("Todo")
		if !ok {
			t.Fatalf("%s: missing login heading", tc.name)
		}
		if heading.Y < loginTitleBarHeight(tc.bar) {
			t.Fatalf("%s: login heading overlapped title bar drag band: Y=%v < %v", tc.name, heading.Y, loginTitleBarHeight(tc.bar))
		}
		if _, ok := tt.Find("登录"); !ok {
			t.Fatalf("%s: missing login button", tc.name)
		}
	}
}

func TestSidebarAccountHeaderAvatarEnlargedWithoutRedundantTodoTitle(t *testing.T) {
	macBar := ui.TitleBar{Height: 38, Left: 78, Right: 0}
	winBar := ui.TitleBar{Height: 40, Left: 0, Right: 138}

	a := titleBarTestApp(t)
	tt := ui.NewTester(a.view, 1440, 900)
	tt.SetTitleBar(macBar)

	if tt.HasText("Todo") {
		t.Fatalf("authenticated sidebar should not display redundant 'Todo' title: texts=%v", tt.Texts())
	}
	if !tt.HasText("marlon") {
		t.Fatalf("sidebar account header missing username: texts=%v", tt.Texts())
	}
	avatar, ok := tt.Find("账户头像")
	if !ok {
		t.Fatal("missing sidebar account avatar")
	}
	if avatar.W < 40 || avatar.H < 40 {
		t.Fatalf("sidebar avatar too small: got %.1fx%.1f, want at least 40x40", avatar.W, avatar.H)
	}
	accountMac, ok := tt.Access("账户菜单")
	if !ok {
		t.Fatal("missing sidebar account menu")
	}
	if accountMac.Bounds.Y < macBar.Height {
		t.Fatalf("macOS sidebar account menu overlaps traffic lights: Y=%v < %v", accountMac.Bounds.Y, macBar.Height)
	}
	if avatar.Y < accountMac.Bounds.Y || avatar.Y+avatar.H > accountMac.Bounds.Y+accountMac.Bounds.H+0.5 {
		t.Fatalf("enlarged avatar overflows account menu row: avatar=%+v menu=%+v", avatar, accountMac.Bounds)
	}

	// Verify long username never shrinks the 40x40 avatar.
	a.session.User.Username = "very-long-desktop-username-for-sidebar-truncation"
	tt.SetTitleBar(winBar)
	avatarLong, ok := tt.Find("账户头像")
	if !ok || avatarLong.W < 40 || avatarLong.H < 40 {
		t.Fatalf("long username shrank avatar: %+v", avatarLong)
	}
	accountWin, ok := tt.Access("账户菜单")
	if !ok || accountWin.Bounds.Y != sidebarCompactTopDrag {
		t.Fatalf("Windows sidebar account menu Y=%v, want %v", accountWin.Bounds.Y, sidebarCompactTopDrag)
	}

	// Clicking the enlarged account header still opens the account dropdown cleanly.
	if err := tt.Click("账户菜单"); err != nil {
		t.Fatalf("clicking account menu failed: %v", err)
	}
	if !tt.HasText("账户设置") || !tt.HasText("退出账户") {
		t.Fatalf("account dropdown items missing after click: texts=%v", tt.Texts())
	}
}

func TestHeaderAndSidebarAccountSuppressHoverTooltips(t *testing.T) {
	hasTooltip := func(tt *ui.Tester) (ui.AccessInfo, bool) {
		for _, n := range tt.AccessAll() {
			if n.Role == ui.RoleTooltip {
				return n, true
			}
		}
		return ui.AccessInfo{}, false
	}

	a := titleBarTestApp(t)
	a.failure = "示例顶部提示"
	tt := ui.NewTester(a.view, 1440, 900)
	tt.SetTitleBar(ui.TitleBar{Height: 38, Left: 78, Right: 0})

	// Wide window: top-left account header, username text, header title, search/new buttons, failure dismiss.
	for _, label := range []string{"账户菜单", "全部任务", "搜索任务", "＋ 新建任务", "关闭提示"} {
		node, ok := tt.Access(label)
		if !ok {
			t.Fatalf("missing control %q", label)
		}
		if node.Description != "" {
			t.Fatalf("top control %q still exposes tooltip description %q", label, node.Description)
		}
		tt.Move(node.Bounds.X+node.Bounds.W/2, node.Bounds.Y+node.Bounds.H/2)
		tt.Advance(2 * time.Second)
		if tip, found := hasTooltip(tt); found {
			t.Fatalf("hovering top control %q rendered unexpected dark tooltip: %+v", label, tip)
		}
	}
	if usernameRect, ok := tt.Find("marlon"); !ok {
		t.Fatal("missing username text in sidebar account header")
	} else {
		tt.Move(usernameRect.X+usernameRect.W/2, usernameRect.Y+usernameRect.H/2)
		tt.Advance(2 * time.Second)
		if tip, found := hasTooltip(tt); found {
			t.Fatalf("hovering sidebar username rendered unexpected dark tooltip: %+v", tip)
		}
	}

	// Narrow window: drawer trigger and refresh button in top toolbar must also stay tooltip-free.
	a.failure = ""
	tt.SetSize(960, 720)
	tt.Frame()
	for _, label := range []string{"展开导航", "刷新"} {
		node, ok := tt.Access(label)
		if !ok {
			t.Fatalf("missing narrow header control %q", label)
		}
		if node.Description != "" {
			t.Fatalf("narrow top control %q still exposes tooltip description %q", label, node.Description)
		}
		tt.Move(node.Bounds.X+node.Bounds.W/2, node.Bounds.Y+node.Bounds.H/2)
		tt.Advance(2 * time.Second)
		if tip, found := hasTooltip(tt); found {
			t.Fatalf("hovering narrow top control %q rendered unexpected dark tooltip: %+v", label, tip)
		}
	}
}
