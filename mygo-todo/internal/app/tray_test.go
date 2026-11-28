package app

import (
	"bytes"
	"encoding/json"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
	"todo-native/internal/storage"
)

func TestTrayIconForOS(t *testing.T) {
	macBytes, macTemplate := trayIconForOS("darwin")
	if !macTemplate {
		t.Fatal("macOS tray icon must be a template image")
	}
	macImg, err := png.Decode(bytes.NewReader(macBytes))
	if err != nil {
		t.Fatalf("macOS tray PNG decode failed: %v", err)
	}
	if macImg.Bounds().Dx() != 36 || macImg.Bounds().Dy() != 36 {
		t.Fatalf("unexpected macOS tray icon size: %v", macImg.Bounds())
	}

	winBytes, winTemplate := trayIconForOS("windows")
	if winTemplate {
		t.Fatal("Windows tray icon must be a colored non-template image")
	}
	winImg, err := png.Decode(bytes.NewReader(winBytes))
	if err != nil {
		t.Fatalf("Windows tray PNG decode failed: %v", err)
	}
	if winImg.Bounds().Dx() != 32 || winImg.Bounds().Dy() != 32 {
		t.Fatalf("unexpected Windows tray icon size: %v", winImg.Bounds())
	}

	var hasBrandBlue, hasCheckWhite bool
	for y := 0; y < winImg.Bounds().Dy(); y++ {
		for x := 0; x < winImg.Bounds().Dx(); x++ {
			c := color.NRGBAModel.Convert(winImg.At(x, y)).(color.NRGBA)
			if c.A < 200 {
				continue
			}
			if c.B > 200 && c.R < 80 {
				hasBrandBlue = true
			}
			if c.R > 240 && c.G > 240 && c.B > 240 {
				hasCheckWhite = true
			}
		}
	}
	if !hasBrandBlue || !hasCheckWhite {
		t.Fatalf("Windows tray icon missing brand blue (%v) or white checkmark (%v)", hasBrandBlue, hasCheckWhite)
	}
}

func TestTrayContextMenuPolicyAndItems(t *testing.T) {
	if !usesTrayContextMenu("windows") {
		t.Fatal("Windows tray must use native context menu on right-click")
	}
	if !usesTrayContextMenu("linux") {
		t.Fatal("Linux tray must use native context menu")
	}
	if usesTrayContextMenu("darwin") {
		t.Fatal("macOS tray should keep menu nil so clicking toggles the menu bar flyout")
	}

	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	items := a.trayMenuItems()
	if len(items) != 4 {
		t.Fatalf("expected 4 tray menu entries (show, flyout, sep, quit), got %d", len(items))
	}
	if items[0].Label != "显示 Todo" || items[0].Click == nil {
		t.Fatalf("unexpected first tray menu item: %+v", items[0])
	}
	if items[1].Label != "快捷任务面板" || items[1].Click == nil {
		t.Fatalf("unexpected second tray menu item: %+v", items[1])
	}
	if items[2].Type != mygo.MenuItemSeparator {
		t.Fatalf("expected separator at index 2, got %+v", items[2])
	}
	if items[3].Label != "退出 Todo" || items[3].Click == nil {
		t.Fatalf("unexpected quit tray menu item: %+v", items[3])
	}
}

func TestTrayFlyoutHasNoHoverTooltips(t *testing.T) {
	src, err := os.ReadFile("tray.go")
	if err != nil {
		t.Fatalf("read tray.go: %v", err)
	}
	if strings.Contains(string(src), ".Tooltip(") {
		t.Fatal("tray.go must not attach dark UI .Tooltip(...) hover popups inside the menu bar popover")
	}

	// Ensure accessible labels remain intact when rendering trayFlyoutView.
	a := New(storage.Store{Dir: t.TempDir()})
	defer a.Close()
	a.client, _ = api.New(api.DefaultServer, "")
	a.session.User = api.User{ID: 1, Timezone: "Asia/Shanghai", DefaultTaskStartTime: "09:00"}
	now := time.Now().In(a.location())
	a.adoptCache(storage.Cache{
		Server: api.DefaultServer,
		UserID: 1,
		Tasks:  []api.Task{{ID: 1, Title: "检查托盘悬浮提示", Status: "pending", StartTime: &now}},
	})
	a.trayQuickTitle = "新任务"
	tt := ui.NewTester(a.trayFlyoutView, 328, 420)
	tt.Frame()
	for _, label := range []string{"刷新菜单栏任务", "打开 Todo 主窗口", "菜单栏添加任务", "菜单栏打开 检查托盘悬浮提示", "切换顶部状态栏显示模式"} {
		if _, ok := tt.AccessByRole(ui.RoleButton, label); !ok {
			t.Fatalf("missing expected accessible button %q in tray flyout", label)
		}
	}
}

func TestWindowsInstallerPackagingConfig(t *testing.T) {
	root := filepath.Join("..", "..")
	raw, err := os.ReadFile(filepath.Join(root, "mygo.json"))
	if err != nil {
		t.Fatalf("read mygo.json: %v", err)
	}
	var cfg struct {
		Name      string `json:"name"`
		Slug      string `json:"slug"`
		Publisher string `json:"publisher"`
		Windows   struct {
			DisplayName      string `json:"displayName"`
			InstallDirName   string `json:"installDirName"`
			InstallerInclude string `json:"installerInclude"`
		} `json:"windows"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		t.Fatalf("parse mygo.json: %v", err)
	}
	if cfg.Publisher == "" {
		t.Fatal("mygo.json should define publisher for Windows Settings > Apps metadata")
	}
	if cfg.Windows.DisplayName == "" || cfg.Windows.InstallDirName == "" {
		t.Fatalf("mygo.json missing windows displayName/installDirName: %+v", cfg.Windows)
	}
	if cfg.Windows.InstallerInclude == "" {
		t.Fatal("mygo.json missing windows.installerInclude")
	}
	nshBytes, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(cfg.Windows.InstallerInclude)))
	if err != nil {
		t.Fatalf("read installerInclude %q: %v", cfg.Windows.InstallerInclude, err)
	}
	nsh := string(nshBytes)
	if !strings.Contains(nsh, `MUI_LANGUAGE "SimpChinese"`) || !strings.Contains(nsh, "MYGO_DESKTOP_SHORTCUT") {
		t.Fatalf("installer.nsh missing Simplified Chinese language setup:\n%s", nsh)
	}
}
