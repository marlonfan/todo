package app

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"todo-native/internal/api"
)

var channelNames = map[string]string{"telegram": "Telegram", "ntfy": "ntfy", "webhook": "Webhook"}

// Test outcomes are local viewing state, never channel credentials or a claim
// that a person's device received a notification.
type notifyTestResult struct {
	At      time.Time
	Failure string
}

func channelName(channel string) string {
	if name := channelNames[channel]; name != "" {
		return name
	}
	return channel
}

type notifyDraft struct {
	Channel, BotToken, ChatID, ServerURL, Topic, Priority, Token, URL, Method string
	Default                                                                   bool
}

func newNotifyDraft() notifyDraft {
	return notifyDraft{Channel: "Webhook", ServerURL: "https://ntfy.sh", Priority: "3", Method: "POST"}
}
func notifyURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u == nil || u.Hostname() == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil || u.Fragment != "" {
		return errors.New("请输入完整的 http:// 或 https:// 地址，凭据请填写在专用字段中")
	}
	return nil
}
func (d notifyDraft) payload() (api.NotifySettingRequest, error) {
	p := api.NotifySettingRequest{Config: map[string]string{}, IsDefault: d.Default}
	for code, name := range channelNames {
		if d.Channel == name {
			p.Channel = code
		}
	}
	switch p.Channel {
	case "telegram":
		if strings.TrimSpace(d.BotToken) == "" || strings.TrimSpace(d.ChatID) == "" {
			return p, errors.New("请填写 Telegram Bot Token 和 Chat ID")
		}
		p.Config = map[string]string{"bot_token": strings.TrimSpace(d.BotToken), "chat_id": strings.TrimSpace(d.ChatID)}
	case "ntfy":
		if err := notifyURL(strings.TrimSpace(d.ServerURL)); err != nil {
			return p, err
		}
		if strings.TrimSpace(d.Topic) == "" {
			return p, errors.New("请填写 ntfy 主题")
		}
		if _, err := repeatNumber(d.Priority, "ntfy 优先级", 1, 5); err != nil {
			return p, err
		}
		p.Config = map[string]string{"server_url": strings.TrimRight(strings.TrimSpace(d.ServerURL), "/"), "topic": strings.TrimSpace(d.Topic), "priority": strings.TrimSpace(d.Priority), "token": strings.TrimSpace(d.Token)}
	case "webhook":
		if err := notifyURL(strings.TrimSpace(d.URL)); err != nil {
			return p, err
		}
		if d.Method != "POST" && d.Method != "PUT" {
			return p, errors.New("Webhook 请求方式应为 POST 或 PUT")
		}
		p.Config = map[string]string{"url": strings.TrimSpace(d.URL), "method": d.Method}
	default:
		return p, errors.New("请选择支持的通知方式")
	}
	return p, nil
}
func (a *App) notifyChoices() []string {
	var result []string
	for _, code := range []string{"webhook", "ntfy", "telegram"} {
		if slices.Contains(a.notifyChannels, code) {
			result = append(result, channelName(code))
		}
	}
	return result
}
func (a *App) loadNotify() {
	if a.client == nil || a.busy || a.win == nil {
		return
	}
	client := a.client
	a.runScoped("notify.load", func(ctx context.Context) (func(), error) {
		channels, err := client.NotifyChannels(ctx)
		if err != nil {
			return nil, err
		}
		settings, err := client.NotifySettings(ctx)
		if err != nil {
			return nil, err
		}
		return func() { a.notifyChannels, a.notifySettings, a.notifyLoaded = channels, settings, true }, nil
	})
}
func (a *App) saveNotify() {
	if a.busy || a.client == nil {
		return
	}
	p, err := a.notifyDraft.payload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	if !slices.Contains(a.notifyChannels, p.Channel) {
		a.failure = "服务器未启用此通知方式，请刷新渠道列表"
		return
	}
	client := a.client
	a.runScoped("notify.save", func(ctx context.Context) (func(), error) {
		var saved api.NotifySetting
		if err := client.Do(ctx, "POST", "/notify/settings", p, &saved, 0); err != nil {
			var connection *api.ConnectionError
			if errors.As(err, &connection) {
				return nil, errors.New("渠道保存结果未确认，请关闭编辑并刷新渠道列表后再试")
			}
			return nil, err
		}
		return func() {
			if saved.IsDefault {
				for i := range a.notifySettings {
					a.notifySettings[i].IsDefault = false
				}
			}
			a.notifySettings = append(a.notifySettings, saved)
			a.notifyEditing, a.notifyDraft = false, notifyDraft{}
			a.notifyDraftResult = nil
			a.message = "已保存通知渠道"
			a.loadNotify()
		}, nil
	})
}
func (a *App) notifyAction(method, path string, body any, success string, after func()) {
	if a.busy || a.client == nil {
		return
	}
	client := a.client
	a.runScoped("notify.action", func(ctx context.Context) (func(), error) {
		if err := client.Do(ctx, method, path, body, nil, 0); err != nil {
			return nil, err
		}
		return func() {
			if after != nil {
				after()
			}
			a.message = success
		}, nil
	})
}
func (a *App) testNotify(id int64) {
	a.testNotifyRequest(id, map[string]int64{"setting_id": id})
}
func (a *App) testNotifyDraft() {
	if a.busy {
		return
	}
	p, err := a.notifyDraft.payload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	if !slices.Contains(a.notifyChannels, p.Channel) {
		a.failure = "服务器未启用此通知方式，请刷新渠道列表"
		return
	}
	a.testNotifyRequest(0, map[string]any{"channel": p.Channel, "config": p.Config})
}
func (a *App) testNotifyRequest(id int64, body any) {
	if a.busy || a.client == nil {
		return
	}
	client := a.client
	a.runScoped("notify.test", func(ctx context.Context) (func(), error) {
		err := client.Do(ctx, "POST", "/notify/test", body, nil, 0)
		result := notifyTestResult{At: time.Now()}
		if err != nil {
			result.Failure = err.Error()
		}
		return func() {
			if id == 0 {
				if !a.notifyEditing {
					return
				}
				a.notifyDraftResult = &result
			} else {
				if a.notifyTestResults == nil {
					a.notifyTestResults = map[int64]notifyTestResult{}
				}
				a.notifyTestResults[id] = result
			}
			if result.Failure == "" {
				a.message = "服务端已发送渠道测试通知"
			}
		}, nil
	})
}
func settingTitle(s api.NotifySetting) string {
	return fmt.Sprintf("%s · #%d", channelName(s.Channel), s.ID)
}
