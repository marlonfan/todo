package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"todo-native/internal/api"
)

type taskCenter struct {
	Task                                           api.Task
	Tab                                            int
	Notifications                                  []api.Notification
	Activities                                     []api.TaskActivity
	NotificationError, ActivityError, SettingError string
	Loaded                                         bool
	ActivityLimit                                  int
	Editing                                        bool
	EditID, DeleteID                               int64
	At                                             time.Time
	Delivery                                       string
	Config                                         notifyDraft
	OperationID                                    string
	OperationBody                                  []byte
}

func (a *App) openTaskCenter(task api.Task) {
	if a.busy || task.ID <= 0 || task.ReadOnly {
		return
	}
	a.taskCenter = &taskCenter{Task: task, ActivityLimit: 200}
	a.loadTaskCenter()
}
func (a *App) loadTaskCenter() {
	if a.busy || a.client == nil || a.taskCenter == nil || a.win == nil {
		return
	}
	client, id, limit := a.client, a.taskCenter.Task.ID, a.taskCenter.ActivityLimit
	a.runScoped("taskcenter.load", func(ctx context.Context) (func(), error) {
		notifications, ne := client.TaskNotifications(ctx, id)
		activities, ae := client.TaskActivities(ctx, id, limit)
		settings, se := client.NotifySettings(ctx)
		channels, ce := client.NotifyChannels(ctx)
		return func() {
			p := a.taskCenter
			if p == nil || p.Task.ID != id {
				return
			}
			p.Loaded = true
			p.NotificationError, p.ActivityError, p.SettingError = "", "", ""
			if ne == nil {
				p.Notifications = notifications
			} else {
				p.NotificationError = ne.Error()
			}
			if ae == nil {
				p.Activities = activities
			} else {
				p.ActivityError = ae.Error()
			}
			if se == nil {
				a.notifySettings = settings
			} else {
				p.SettingError = se.Error()
			}
			if ce == nil {
				a.notifyChannels = channels
			} else {
				p.SettingError = ce.Error()
			}
		}, nil
	})
}
func (a *App) newManualReminder() {
	p := a.taskCenter
	if p == nil || a.busy {
		return
	}
	p.Editing, p.EditID, p.DeleteID = true, 0, 0
	p.At = time.Now().In(a.location()).Add(time.Hour).Truncate(time.Minute)
	p.Delivery, p.Config = "使用默认渠道", newNotifyDraft()
	if choices := a.notifyChoices(); len(choices) > 0 {
		p.Config.Channel = choices[0]
	}
	p.OperationID, p.OperationBody = "", nil
}
func (p *taskCenter) request(now time.Time, available []string) (api.NotificationRequest, error) {
	r := api.NotificationRequest{NotifyAt: p.At}
	if !r.NotifyAt.After(now) {
		return r, errors.New("提醒时间应晚于当前时间")
	}
	if p.EditID == 0 && p.Delivery == "指定配置" {
		config, err := p.Config.payload()
		if err != nil {
			return r, err
		}
		if !slices.Contains(available, config.Channel) {
			return r, errors.New("服务器未启用此通知方式")
		}
		r.Channel, r.Config = config.Channel, config.Config
	} else if p.EditID == 0 && p.Delivery != "使用默认渠道" {
		return r, errors.New("请选择提醒投递方式")
	}
	return r, nil
}
func (p *taskCenter) operation(body api.NotificationRequest) (string, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	if p.OperationID == "" || !bytes.Equal(data, p.OperationBody) {
		p.OperationID, err = api.NewOperationID()
		if err != nil {
			return "", err
		}
		p.OperationBody = data
	}
	return p.OperationID, nil
}
func (a *App) saveManualReminder() {
	p := a.taskCenter
	if p == nil || a.busy || a.client == nil {
		return
	}
	body, err := p.request(time.Now(), a.notifyChannels)
	if err != nil {
		a.failure = err.Error()
		return
	}
	if p.EditID == 0 && p.Delivery == "使用默认渠道" && !slices.ContainsFunc(a.notifySettings, func(s api.NotifySetting) bool { return s.IsDefault && s.Configured }) {
		a.failure = "请先在通知渠道页面配置默认渠道，或选择指定配置"
		return
	}
	method, path := "POST", fmt.Sprintf("/tasks/%d/notifications", p.Task.ID)
	opID, err := p.operation(body)
	if err != nil {
		a.failure = err.Error()
		return
	}
	if p.EditID != 0 {
		method, path = "PATCH", fmt.Sprintf("%s/%d", path, p.EditID)
	}
	client, id := a.client, p.Task.ID
	a.runScoped("taskcenter.reminder", func(ctx context.Context) (func(), error) {
		var saved api.Notification
		if err := client.DoOperation(ctx, method, path, body, &saved, 0, opID); err != nil {
			return nil, err
		}
		return func() {
			if a.taskCenter == nil || a.taskCenter.Task.ID != id {
				return
			}
			panel := a.taskCenter
			panel.Notifications = slices.DeleteFunc(panel.Notifications, func(n api.Notification) bool { return n.ID == saved.ID })
			panel.Notifications = append([]api.Notification{saved}, panel.Notifications...)
			panel.Editing, panel.Config, panel.OperationBody, panel.OperationID = false, notifyDraft{}, nil, ""
			a.message = "已保存服务端提醒"
			a.loadTaskCenter()
		}, nil
	})
}
func (a *App) deleteManualReminder(id int64) {
	if a.taskCenter == nil {
		return
	}
	taskID := a.taskCenter.Task.ID
	a.notifyAction("DELETE", fmt.Sprintf("/tasks/%d/notifications/%d", taskID, id), nil, "已删除手动提醒", func() {
		if a.taskCenter != nil && a.taskCenter.Task.ID == taskID {
			a.taskCenter.Notifications = slices.DeleteFunc(a.taskCenter.Notifications, func(n api.Notification) bool { return n.ID == id })
			a.taskCenter.DeleteID = 0
			a.loadTaskCenter()
		}
	})
}
