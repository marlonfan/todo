package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Only these non-secret preferences may be queued and replayed offline.
type ProfilePreferences map[string]json.RawMessage

var preferenceLabels = []struct{ Key, Label string }{
	{"timezone", "时区"}, {"calendar_default_view", "默认日历视图"},
	{"default_time_granularity", "时间步长"}, {"default_task_start_time", "默认任务开始时间"},
	{"default_noon_time", "午间快捷时间"}, {"default_afternoon_time", "下午快捷时间"}, {"default_evening_time", "晚间快捷时间"},
	{"default_reminder_enabled", "账户默认提前提醒"}, {"default_reminder_minutes", "默认提前分钟数"}, {"default_morning_time", "全天任务早间时间"},
}

func NewProfilePreferences(payload map[string]any) (ProfilePreferences, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	var p ProfilePreferences
	if err = json.Unmarshal(b, &p); err != nil {
		return nil, err
	}
	return p, p.Validate()
}

func (p ProfilePreferences) Validate() error {
	if len(p) == 0 {
		return errors.New("没有需要保存的账户偏好")
	}
	for key, value := range p {
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return errors.New("账户偏好不能使用空值")
		}
		var text string
		var number int
		var enabled bool
		valid := false
		switch key {
		case "timezone":
			if json.Unmarshal(value, &text) == nil && text != "" {
				_, err := time.LoadLocation(text)
				valid = err == nil
			}
		case "calendar_default_view":
			valid = json.Unmarshal(value, &text) == nil && (text == "timeGridDay" || text == "timeGridWeek" || text == "dayGridMonth")
		case "default_time_granularity":
			valid = json.Unmarshal(value, &number) == nil && (number == 5 || number == 10 || number == 15 || number == 30 || number == 60)
		case "default_reminder_minutes":
			valid = json.Unmarshal(value, &number) == nil && number >= 1 && number <= 10080
		case "default_reminder_enabled":
			valid = json.Unmarshal(value, &enabled) == nil
		case "default_task_start_time", "default_morning_time", "default_noon_time", "default_afternoon_time", "default_evening_time":
			if json.Unmarshal(value, &text) == nil && len(text) == 5 {
				_, err := time.Parse("15:04", text)
				valid = err == nil
			}
		default:
			return errors.New("此账户字段不支持离线保存")
		}
		if !valid {
			return errors.New("账户偏好包含无效值，请重新编辑后保存")
		}
	}
	return nil
}

func (p ProfilePreferences) Apply(user User) User {
	b, _ := json.Marshal(p)
	_ = json.Unmarshal(b, &user)
	return user
}

func (p ProfilePreferences) From(user User) ProfilePreferences {
	b, _ := json.Marshal(user)
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(b, &fields)
	out := ProfilePreferences{}
	for key := range p {
		out[key] = fields[key]
	}
	return out
}

func (p ProfilePreferences) Labels() []string {
	var result []string
	for _, field := range preferenceLabels {
		value, ok := p[field.Key]
		if !ok {
			continue
		}
		var shown any
		_ = json.Unmarshal(value, &shown)
		if field.Key == "calendar_default_view" {
			shown = map[string]string{"timeGridDay": "日", "timeGridWeek": "周", "dayGridMonth": "月"}[fmt.Sprint(shown)]
		}
		if field.Key == "default_time_granularity" || field.Key == "default_reminder_minutes" {
			shown = fmt.Sprintf("%v 分钟", shown)
		}
		if v, ok := shown.(bool); ok {
			if v {
				shown = "开启"
			} else {
				shown = "关闭"
			}
		}
		result = append(result, fmt.Sprintf("%s：%v", field.Label, shown))
	}
	return result
}
