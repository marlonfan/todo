package app

import "runtime"

// desktopCapabilitySummary is pure so the settings copy remains testable
// without starting a MyGo backend or a real desktop session.
func desktopCapabilitySummary(a *App) string {
	platform := runtime.GOOS
	if platform == "darwin" {
		platform = "macOS"
	} else if platform == "windows" {
		platform = "Windows"
	} else if platform == "linux" {
		platform = "Linux"
	}
	tray, notifications, startup := "不可用", "不可用", "不可用"
	if a.trayAvailable {
		tray = "可用"
	}
	if a.notificationsAvailable {
		notifications = "可用"
	}
	if a.packaged {
		startup = "可配置"
	}
	return platform + " · 托盘 " + tray + " · 系统通知 " + notifications + " · 开机启动 " + startup
}
