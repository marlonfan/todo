package app

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/egoist/mygo"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

type caldavSelection struct {
	Choice   api.CaldavChoice
	Selected bool
}
type caldavDraft struct {
	ID                                int64
	Name, BaseURL, Username, Password string
	Active                            bool
	Choices                           []caldavSelection
	// Discovery results belong to this exact connection, not a changed server.
	DiscoveredURL, DiscoveredUsername string
}

func draftCaldav(source api.CaldavSource) caldavDraft {
	d := caldavDraft{ID: source.ID, Name: source.Name, BaseURL: source.BaseURL, Username: source.Username, Active: source.IsActive, DiscoveredURL: strings.TrimSpace(source.BaseURL), DiscoveredUsername: strings.TrimSpace(source.Username)}
	for _, cal := range source.Calendars {
		d.Choices = append(d.Choices, caldavSelection{Choice: api.CaldavChoice{CalendarURL: cal.CalendarURL, DisplayName: cal.DisplayName, Color: cal.Color}, Selected: cal.IsSelected})
	}
	return d
}
func (d caldavDraft) connection() (api.CaldavDiscover, error) {
	r := api.CaldavDiscover{SourceID: d.ID, BaseURL: strings.TrimSpace(d.BaseURL), Username: strings.TrimSpace(d.Username), Password: d.Password}
	u, err := url.Parse(r.BaseURL)
	if err != nil || u == nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil || u.Fragment != "" {
		return r, errors.New("请输入完整的 http:// 或 https:// CalDAV 地址，账号和密码请填写在各自输入框中")
	}
	if r.Username == "" {
		return r, errors.New("请输入 CalDAV 用户名")
	}
	if d.ID == 0 && strings.TrimSpace(r.Password) == "" {
		return r, errors.New("新来源需要填写 CalDAV 密码或应用专用密码")
	}
	if utf8.RuneCountInString(r.BaseURL) > 500 || utf8.RuneCountInString(r.Username) > 255 || utf8.RuneCountInString(r.Password) > 500 {
		return r, errors.New("CalDAV 地址、用户名或密码过长")
	}
	return r, nil
}
func (d caldavDraft) payload() (api.CaldavUpsert, error) {
	r, err := d.connection()
	p := api.CaldavUpsert{Name: strings.TrimSpace(d.Name), BaseURL: r.BaseURL, Username: r.Username, Password: r.Password, IsActive: d.Active}
	if err != nil {
		return p, err
	}
	if p.Name == "" || utf8.RuneCountInString(p.Name) > 120 {
		return p, errors.New("来源名称应为 1–120 个字符")
	}
	if r.BaseURL != d.DiscoveredURL || r.Username != d.DiscoveredUsername {
		return p, errors.New("连接地址或用户名已更改，请重新发现日历后保存")
	}
	for _, choice := range d.Choices {
		if choice.Selected {
			p.Calendars = append(p.Calendars, choice.Choice)
		}
	}
	if len(p.Calendars) == 0 {
		return p, errors.New("请至少选择一个日历")
	}
	return p, nil
}
func (d *caldavDraft) discovered(choices []api.CaldavChoice, request api.CaldavDiscover) {
	selected := make(map[string]bool)
	for _, c := range d.Choices {
		selected[c.Choice.CalendarURL] = c.Selected
	}
	// An explicit deselect-all must remain deselected after rediscovery.
	first := len(d.Choices) == 0 && d.ID == 0
	same := d.DiscoveredURL == request.BaseURL && d.DiscoveredUsername == request.Username
	d.Choices = nil
	seen := make(map[string]bool)
	for _, choice := range choices {
		if choice.CalendarURL == "" || seen[choice.CalendarURL] {
			continue
		}
		seen[choice.CalendarURL] = true
		d.Choices = append(d.Choices, caldavSelection{Choice: choice, Selected: first || (same && selected[choice.CalendarURL])})
	}
	d.DiscoveredURL, d.DiscoveredUsername = request.BaseURL, request.Username
}
func (a *App) loadCaldav() {
	if a.client == nil || a.busy || a.win == nil {
		return
	}
	client := a.client
	a.runScoped("caldav.load", func(ctx context.Context) (func(), error) {
		sources, err := client.CaldavSources(ctx)
		if err != nil {
			return nil, err
		}
		subscription, subErr := client.CalendarSubscription(ctx)
		return func() {
			a.caldavSources, a.caldavLoaded = sources, true
			a.calendarSubscription, a.subscriptionFailure = subscription, ""
			if subErr != nil {
				a.calendarSubscription = nil
				a.subscriptionFailure = subErr.Error()
			}
		}, nil
	})
}
func (a *App) editCaldav(source api.CaldavSource) {
	if a.busy {
		return
	}
	a.caldavDraft = draftCaldav(source)
	if source.ID == 0 {
		a.caldavDraft.Active = true
	}
	a.caldavEditing, a.failure = true, ""
}
func (a *App) discoverCaldav() {
	if a.busy || a.client == nil {
		return
	}
	r, err := a.caldavDraft.connection()
	if err != nil {
		a.failure = err.Error()
		return
	}
	client := a.client
	a.runScoped("caldav.discover", func(ctx context.Context) (func(), error) {
		choices, err := client.DiscoverCaldav(ctx, r)
		if err != nil {
			return nil, err
		}
		if len(choices) == 0 {
			return nil, errors.New("没有发现可用日历，请检查地址和访问权限")
		}
		return func() { a.caldavDraft.discovered(choices, r) }, nil
	})
}
func (a *App) saveCaldav() {
	if a.busy || a.client == nil {
		return
	}
	payload, err := a.caldavDraft.payload()
	if err != nil {
		a.failure = err.Error()
		return
	}
	method, path := "POST", "/caldav/sources"
	if a.caldavDraft.ID != 0 {
		method, path = "PUT", fmt.Sprintf("/caldav/sources/%d", a.caldavDraft.ID)
	}
	a.writeCaldav(method, path, payload)
}

// Remove stale external events without touching task outbox IDs or recurrence.
func invalidateExternalCalendars(state storage.Cache) storage.Cache {
	state = syncer.Clone(state)
	if state.Calendar != nil {
		state.Calendar.Events = slices.DeleteFunc(state.Calendar.Events, func(e api.CalendarEvent) bool { return e.ExtendedProps.ReadOnly })
		state.Calendar.SavedAt = time.Time{}
	}
	state.ReminderEvents = slices.DeleteFunc(state.ReminderEvents, func(e api.CalendarEvent) bool { return e.ExtendedProps.ReadOnly })
	return state
}
func (a *App) writeCaldav(method, path string, payload any) {
	if a.busy || a.client == nil {
		return
	}
	if a.cacheError != "" {
		a.failure = a.cacheError
		return
	}
	client, state := a.client, invalidateExternalCalendars(a.cache)
	deletedID := int64(0)
	if a.deleteCaldav != nil {
		deletedID = a.deleteCaldav.ID
	}
	a.runScoped("caldav.write", func(ctx context.Context) (func(), error) {
		var source api.CaldavSource
		if err := client.Do(ctx, method, path, payload, &source, 0); err != nil {
			return nil, err
		}
		saveErr := a.store.SaveCache(state)
		// The remote mutation is already confirmed. Close the editor even when
		// local cache persistence fails, so retry cannot duplicate a new source.
		return func() {
			a.adoptCache(state)
			a.caldavEditing, a.deleteCaldav = false, nil
			a.caldavDraft = caldavDraft{}
			if method == "DELETE" {
				a.caldavSources = slices.DeleteFunc(a.caldavSources, func(s api.CaldavSource) bool { return s.ID == deletedID })
				a.caldavNotice = "来源已删除，外部缓存日程已清除。"
			} else {
				a.caldavSources = slices.DeleteFunc(a.caldavSources, func(s api.CaldavSource) bool { return s.ID == source.ID })
				a.caldavSources = append(a.caldavSources, source)
				a.caldavNotice = "来源已保存。启用的来源会在服务端后台同步，可稍后刷新查看结果。"
			}
			if saveErr != nil {
				a.failure = "来源修改已在服务器完成，但无法更新本机日历缓存，请刷新重试：" + saveErr.Error()
				return
			}
			a.refresh()
		}, nil
	})
}
func (a *App) syncCaldav(source api.CaldavSource) {
	if a.busy || a.client == nil || !source.IsActive {
		return
	}
	client := a.client
	a.runScoped("caldav.sync", func(ctx context.Context) (func(), error) {
		err := client.Do(ctx, "POST", fmt.Sprintf("/caldav/sources/%d/sync", source.ID), nil, nil, 0)
		return func() {
			a.caldavNotice = "已提交同步请求；服务端后台执行，稍后刷新查看同步时间或错误。"
			a.loadCaldav()
		}, err
	})
}

func saveCalendarFile(path string, data []byte) error {
	// Preserve the exact path whose overwrite the system picker confirmed.
	f, err := os.CreateTemp(filepath.Dir(path), ".todo-calendar-*.ics")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), path)
}
func (a *App) exportCalendar() {
	if a.client == nil || a.busy || a.calendarSubscription == nil {
		return
	}
	client, feed, win := a.client, a.calendarSubscription.ICSURL, a.win
	a.runScoped("caldav.export", func(ctx context.Context) (func(), error) {
		path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{Parent: win, Title: "导出 Todo 日历", DefaultPath: "Todo.ics", Filters: []mygo.FileFilter{{Name: "ICS 日历", Extensions: []string{"ics"}}}})
		if err != nil {
			return nil, fmt.Errorf("无法选择导出文件：%w", err)
		}
		if path == "" {
			return nil, nil
		}
		data, err := client.ExportCalendar(ctx, feed)
		if err != nil {
			return nil, err
		}
		if err := saveCalendarFile(path, data); err != nil {
			return nil, fmt.Errorf("保存日历文件失败：%w", err)
		}
		return func() { a.caldavNotice = "ICS 日历已导出。" }, nil
	})
}
