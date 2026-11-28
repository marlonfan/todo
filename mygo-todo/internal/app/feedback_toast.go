package app

import (
	"errors"
	"net"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/lucide"
	"todo-native/internal/api"
)

func (a *App) pushToast(t ui.Toast) {
	a.pendingToasts = append(a.pendingToasts, t)
	if a.win != nil && !a.win.IsDestroyed() {
		a.win.Invalidate()
	}
}

func (a *App) pushInfoToast(title string) {
	a.pushToast(ui.Toast{
		ID:      "info:" + title,
		Title:   title,
		Type:    "info",
		Timeout: 3500 * time.Millisecond,
	})
}

func (a *App) pushUndoToast(id, title, actionLabel string, onUndo func(), onClose func()) {
	a.pushToast(ui.Toast{
		ID:       id,
		Title:    title,
		Type:     "success",
		Timeout:  5500 * time.Millisecond,
		Action:   actionLabel,
		OnAction: onUndo,
		OnClose:  onClose,
	})
}

func (a *App) pushErrorToast(err error, retry func()) {
	if err == nil {
		return
	}
	title, desc, actionLabel, onAction := a.friendlyError(err, retry)
	t := ui.Toast{
		ID:          "err:" + title,
		Title:       title,
		Description: desc,
		Type:        "error",
		Timeout:     6 * time.Second,
	}
	if actionLabel != "" && onAction != nil {
		t.Action = actionLabel
		t.OnAction = onAction
	}
	a.pushToast(t)
}

func (a *App) friendlyError(err error, retry func()) (title, desc, actionLabel string, onAction func()) {
	if err == nil {
		return "", "", "", nil
	}
	var apiErr *api.Error
	if errors.As(err, &apiErr) {
		switch {
		case apiErr.Status == 401:
			return "登录状态已过期", "请前往同步页面重新验证账户", "去验证", func() { a.changePage("sync") }
		case apiErr.Status == 403:
			return "没有操作权限", "当前账户无权执行该操作", "", nil
		case apiErr.Status == 404:
			return "目标内容不存在", "可能已在其他设备删除或移动", "", nil
		case apiErr.Status == 409:
			return "数据存在版本冲突", "其他设备刚刚修改了这项内容", "查看冲突", func() { a.changePage("sync") }
		case apiErr.Status >= 500:
			return "服务器暂时不可用", "请稍后再试，本机数据不受影响", "重试", retry
		}
	}
	var connErr *api.ConnectionError
	var netErr net.Error
	raw := err.Error()
	lower := strings.ToLower(raw)
	if errors.As(err, &connErr) || errors.As(err, &netErr) ||
		strings.Contains(lower, "connection refused") ||
		strings.Contains(lower, "timeout") ||
		strings.Contains(lower, "eof") ||
		strings.Contains(lower, "no such host") {
		return "网络连接失败", "请检查网络或服务端状态，本地修改已保留", "重试", retry
	}
	if retry != nil {
		return raw, "", "重试", retry
	}
	return raw, "", "", nil
}

func (a *App) flushPendingToasts(c *ui.Context) {
	if len(a.pendingToasts) == 0 {
		return
	}
	queued := a.pendingToasts
	a.pendingToasts = nil
	for _, toast := range queued {
		c.AddToast(toast)
	}
}

func (a *App) toastViewport(c *ui.Context) {
	t := tokensOf(c)
	dark := c.Theme().Dark
	ui.ToastViewportBase(c, func(viewport ui.Element, toasts []ui.Toast) {
		viewport.Padding(0, 16, 20, 16).AlignItems(ui.Center).Gap(8)
		for _, item := range toasts {
			toast := ui.ToastBase(c, item)
			bg := ui.Hex("#262421")
			fg := ui.Hex("#F7F5F0")
			subFg := fg.Alpha(0.76)
			border := ui.RGBA(255, 255, 255, 0.12)
			if dark {
				bg = t.BgElevated
				fg = t.TextPrimary
				subFg = t.TextSecondary
				border = t.BorderPopup
			}
			toast.Root.Row().AlignItems(ui.Center).Gap(10).Padding(10, 14).Radius(10).
				MaxWidth(460).Background(bg).Border(1, border).TextColor(fg).
				Shadow(0, 6, 22, -2, ui.RGBA(0, 0, 0, 0.28)).
				Transition(ui.ElementTransition{
					Duration:     180 * time.Millisecond,
					Ease:         ui.EaseOut,
					ExitDuration: 120 * time.Millisecond,
					ExitEase:     ui.EaseIn,
					Enter:        &ui.Motion{Y: 12},
					Exit:         &ui.Motion{Y: 8},
				})

			icon := lucide.Check()
			iconCol := t.Success
			switch item.Type {
			case "error":
				icon = lucide.CircleAlert()
				iconCol = t.Danger
			case "info":
				icon = lucide.Info()
				iconCol = t.Accent
			}
			toast.Root.Children(func() {
				ui.Icon(c, icon).Size(15, 15).TextColor(iconCol).Shrink(0).AccessHidden(true)
				ui.Column(c).MinWidth(0).Shrink(1).Gap(2).Children(func() {
					ui.Text(c, item.Title).FontSize(12.5).FontWeight(500).TextColor(fg).MaxLines(2)
					if item.Description != "" {
						ui.Text(c, item.Description).FontSize(11).TextColor(subFg).MaxLines(2)
					}
				})
				if item.Action != "" {
					actBtn := toast.ActionButton().Height(26).Padding(0, 10).Radius(6).Center().
						Background(t.Accent.Alpha(0.22)).Cursor(ui.CursorPointer)
					if actBtn.Hovered() {
						actBtn.Background(t.Accent.Alpha(0.32))
					}
					actBtn.Children(func() {
						ui.Text(c, item.Action).FontSize(12).FontWeight(600).TextColor(t.AccentHover).SingleLine()
					})
				}
				closeBtn := toast.CloseButton().Label("关闭通知").Size(22, 22).Radius(5).Center().Cursor(ui.CursorPointer)
				if closeBtn.Hovered() {
					closeBtn.Background(fg.Alpha(0.12))
				}
				closeBtn.Children(func() {
					ui.Icon(c, lucide.X()).Size(12.5, 12.5).TextColor(subFg).AccessHidden(true)
				})
			})
		}
	})
}
