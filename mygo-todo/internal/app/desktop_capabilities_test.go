package app

import (
	"strings"
	"testing"
)

func TestDesktopCapabilitySummaryReflectsRuntimeState(t *testing.T) {
	a := &App{}
	got := desktopCapabilitySummary(a)
	if got == "" || !containsAll(got, "托盘 不可用", "系统通知 不可用", "开机启动 不可用") {
		t.Fatalf("summary=%q", got)
	}
	a.trayAvailable, a.notificationsAvailable, a.packaged = true, true, true
	got = desktopCapabilitySummary(a)
	if !containsAll(got, "托盘 可用", "系统通知 可用", "开机启动 可配置") {
		t.Fatalf("summary=%q", got)
	}
}

func containsAll(s string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(s, part) {
			return false
		}
	}
	return true
}
