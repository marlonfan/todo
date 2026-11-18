package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/lobehub/lobe-mygo/pkg/action"
	"github.com/lobehub/lobe-mygo/pkg/field"
	"github.com/lobehub/lobe-mygo/pkg/theme"
)

// RecurrenceDraft keeps readable calendar terms separate from API tokens.
type RecurrenceDraft struct {
	Frequency, Interval, Count, Weekdays, Dates, Months, LunarMonth, LunarDay string
	LunarLeap                                                                 bool
	Timezone                                                                  string
	ExRules                                                                   json.RawMessage
}

type recurrenceRule struct {
	Freq       string          `json:"freq"`
	Timezone   string          `json:"timezone,omitempty"`
	ExRules    json.RawMessage `json:"exrules,omitempty"`
	Interval   int             `json:"interval,omitempty"`
	ByDay      []string        `json:"byday,omitempty"`
	ByDate     []int           `json:"bydate,omitempty"`
	ByMonth    []int           `json:"bymonth,omitempty"`
	Count      int             `json:"count,omitempty"`
	LunarMonth int             `json:"lunar_month,omitempty"`
	LunarDay   int             `json:"lunar_day,omitempty"`
	LunarLeap  bool            `json:"lunar_is_leap_month,omitempty"`
}

var weekdays = []string{"周一", "周二", "周三", "周四", "周五", "周六", "周日"}
var shortWeekdays = []string{"一", "二", "三", "四", "五", "六", "日"}
var weekdayTokens = []string{"MO", "TU", "WE", "TH", "FR", "SA", "SU"}

// recurrenceSummary returns a natural human-readable summary for the repeat
// chip (instead of exposing internal state strings like "保留原有重复规则").
func recurrenceSummary(d *Draft) string {
	if d.Repeat == "" || d.Repeat == "不重复" {
		return "重复"
	}
	freq := d.Repeat
	rule := d.Rule
	if freq == "保留原有重复规则" {
		if rule.Frequency != "" {
			freq = rule.Frequency
		} else {
			return "已设重复"
		}
	}
	interval, _ := strconv.Atoi(strings.TrimSpace(rule.Interval))
	if interval <= 1 {
		switch freq {
		case "每天":
			if rule.Weekdays != "" {
				return "每天 · " + rule.Weekdays
			}
			return "每天"
		case "每周":
			if rule.Weekdays != "" {
				return "每周 · " + strings.ReplaceAll(rule.Weekdays, "周", "")
			}
			return "每周"
		case "每月":
			if rule.Dates != "" {
				return "每月 " + rule.Dates + " 日"
			}
			if rule.Weekdays != "" {
				return "每月 · " + rule.Weekdays
			}
			return "每月"
		case "每年":
			if rule.Months != "" {
				return "每年 " + rule.Months + " 月"
			}
			return "每年"
		case "农历每年":
			leap := ""
			if rule.LunarLeap {
				leap = "闰"
			}
			return fmt.Sprintf("农历%s%s月%s日", leap, rule.LunarMonth, rule.LunarDay)
		}
		return freq
	}
	unit := map[string]string{"每天": "天", "每周": "周", "每月": "个月", "每年": "年", "农历每年": "年（农历）"}[freq]
	if unit == "" {
		return freq
	}
	base := fmt.Sprintf("每 %d %s", interval, unit)
	if freq == "每周" && rule.Weekdays != "" {
		base += " · " + strings.ReplaceAll(rule.Weekdays, "周", "")
	}
	return base
}

func recurrenceDraft(raw json.RawMessage) RecurrenceDraft {
	d := RecurrenceDraft{Interval: "1", Count: "0", LunarMonth: "1", LunarDay: "1"}
	var r recurrenceRule
	if json.Unmarshal(raw, &r) != nil {
		return d
	}
	for label, freq := range frequencies {
		if r.Freq == freq || (freq == "lunar_yearly" && r.Freq == "lunar") {
			d.Frequency = label
		}
	}
	if r.Interval > 0 {
		d.Interval = strconv.Itoa(r.Interval)
	}
	d.Count = strconv.Itoa(r.Count)
	var days []string
	for _, token := range r.ByDay {
		found := false
		for i, code := range weekdayTokens {
			if strings.HasSuffix(token, code) {
				prefix := strings.TrimSuffix(token, code)
				label := weekdays[i]
				if prefix != "" {
					n, err := strconv.Atoi(prefix)
					if err != nil || n == 0 || n < -9 || n > 9 {
						d.Frequency = ""
						return d
					}
					if n < 0 {
						label = fmt.Sprintf("最后%d个%s", -n, label)
					} else {
						label = fmt.Sprintf("第%d个%s", n, label)
					}
				}
				days = append(days, label)
				found = true
				break
			}
		}
		if !found {
			d.Frequency = ""
			return d
		}
	}
	d.Weekdays = strings.Join(days, "，")
	d.Dates, d.Months = joinNumbers(r.ByDate), joinNumbers(r.ByMonth)
	if r.LunarMonth > 0 {
		d.LunarMonth = strconv.Itoa(r.LunarMonth)
	}
	if r.LunarDay > 0 {
		d.LunarDay = strconv.Itoa(r.LunarDay)
	}
	d.LunarLeap = r.LunarLeap
	d.Timezone = strings.TrimSpace(r.Timezone)
	if len(r.ExRules) > 0 && string(r.ExRules) != "null" {
		d.ExRules = append(json.RawMessage(nil), r.ExRules...)
	}
	// A future server field must not be silently dropped by this editor.
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(raw, &fields)
	for key := range fields {
		switch key {
		case "freq", "timezone", "exrules", "interval", "byday", "bydate", "bymonth", "count", "lunar_month", "lunar_day", "lunar_is_leap_month":
		default:
			d.Frequency = ""
		}
	}
	return d
}

func joinNumbers(numbers []int) string {
	values := make([]string, len(numbers))
	for i, n := range numbers {
		values[i] = strconv.Itoa(n)
	}
	return strings.Join(values, "，")
}
func splitValues(raw string) []string {
	raw = strings.NewReplacer("，", ",", "、", ",", ";", ",", "；", ",").Replace(raw)
	var result []string
	for _, v := range strings.Split(raw, ",") {
		if v = strings.TrimSpace(v); v != "" {
			result = append(result, v)
		}
	}
	return result
}
func repeatNumber(raw, label string, min, max int) (int, error) {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n < min || n > max {
		return 0, fmt.Errorf("%s应为 %d–%d 的整数", label, min, max)
	}
	return n, nil
}
func repeatNumbers(raw, label string, min, max int) ([]int, error) {
	var result []int
	seen := map[int]bool{}
	for _, v := range splitValues(raw) {
		n, err := repeatNumber(v, label, min, max)
		if err != nil {
			return nil, err
		}
		if !seen[n] {
			result = append(result, n)
			seen[n] = true
		}
	}
	return result, nil
}
func repeatWeekdays(raw string) ([]string, error) {
	var result []string
	seen := map[string]bool{}
	for _, v := range splitValues(raw) {
		token := ""
		for i, label := range weekdays {
			if !strings.HasSuffix(v, label) {
				continue
			}
			prefix := strings.TrimSuffix(v, label)
			ordinal := ""
			if prefix != "" {
				sign := 1
				if strings.HasPrefix(prefix, "最后") {
					sign = -1
					prefix = strings.TrimPrefix(prefix, "最后")
				} else if strings.HasPrefix(prefix, "第") {
					prefix = strings.TrimPrefix(prefix, "第")
				} else {
					break
				}
				if !strings.HasSuffix(prefix, "个") {
					break
				}
				n, err := repeatNumber(strings.TrimSuffix(prefix, "个"), "星期序号", 1, 9)
				if err != nil {
					break
				}
				ordinal = strconv.Itoa(sign * n)
			}
			token = ordinal + weekdayTokens[i]
			break
		}
		if token == "" {
			return nil, errors.New("星期请填写周一至周日；按月可填写第2个周一、最后1个周五，以逗号分隔")
		}
		if !seen[token] {
			result = append(result, token)
			seen[token] = true
		}
	}
	return result, nil
}

func (d RecurrenceDraft) rule(repeat string) (recurrenceRule, error) {
	r := recurrenceRule{
		Freq:     frequencies[repeat],
		Timezone: strings.TrimSpace(d.Timezone),
		ExRules:  d.ExRules,
	}
	if r.Freq == "" {
		return r, errors.New("请选择有效的重复周期")
	}
	var err error
	if r.Interval, err = repeatNumber(d.Interval, "重复间隔", 1, 10000); err != nil {
		return r, err
	}
	if r.Count, err = repeatNumber(d.Count, "重复次数", 0, 1000000); err != nil {
		return r, err
	}
	if r.Freq == "lunar_yearly" {
		if r.LunarMonth, err = repeatNumber(d.LunarMonth, "农历月份", 1, 12); err != nil {
			return r, err
		}
		if r.LunarDay, err = repeatNumber(d.LunarDay, "农历日期", 1, 30); err != nil {
			return r, err
		}
		r.LunarLeap = d.LunarLeap
		return r, nil
	}
	if r.ByDay, err = repeatWeekdays(d.Weekdays); err != nil {
		return r, err
	}
	if r.Freq == "daily" || r.Freq == "weekly" {
		for _, day := range r.ByDay {
			if len(day) != 2 {
				return r, errors.New("每天或每周重复请选择周一至周日，不使用第几个星期")
			}
		}
	}
	if r.ByDate, err = repeatNumbers(d.Dates, "月内日期", 1, 31); err != nil {
		return r, err
	}
	if r.ByMonth, err = repeatNumbers(d.Months, "月份", 1, 12); err != nil {
		return r, err
	}
	return r, nil
}

func (d *RecurrenceDraft) toggleWeekday(idx int) {
	if idx < 0 || idx >= len(weekdays) {
		return
	}
	target := weekdays[idx]
	parts := splitValues(d.Weekdays)
	// Preserve any ordinal tokens (like 第2个周一) while toggling plain weekdays cleanly.
	var plainSelected []int
	var ordinals []string
	for _, p := range parts {
		if pos := slices.Index(weekdays, p); pos >= 0 {
			if !slices.Contains(plainSelected, pos) {
				plainSelected = append(plainSelected, pos)
			}
		} else {
			ordinals = append(ordinals, p)
		}
	}
	pos := slices.Index(weekdays, target)
	if existing := slices.Index(plainSelected, pos); existing >= 0 {
		plainSelected = slices.Delete(plainSelected, existing, existing+1)
	} else {
		plainSelected = append(plainSelected, pos)
	}
	sort.Ints(plainSelected)
	var out []string
	for _, i := range plainSelected {
		out = append(out, weekdays[i])
	}
	out = append(out, ordinals...)
	d.Weekdays = strings.Join(out, "，")
}

func (a *App) recurrenceWeekdayChoices(c *ui.Context) {
	t := tokensOf(c)
	d := &a.draft.Rule
	parts := splitValues(d.Weekdays)
	selected := map[int]bool{}
	for _, p := range parts {
		if idx := slices.Index(weekdays, p); idx >= 0 {
			selected[idx] = true
		}
	}
	ui.Column(c.Key("repeat-weekday-pills")).Gap(6).Children(func() {
		ui.Row(c).Gap(4).Children(func() {
			for i, short := range shortWeekdays {
				idx := i
				active := selected[idx]
				pill := ui.ButtonBase(c.Key("wd-"+weekdays[idx])).Label("切换重复"+weekdays[idx]).Tooltip(weekdays[idx]).
					Size(34, 28).Radius(6).Center().Cursor(ui.CursorPointer)
				fg := t.TextReadable
				if active {
					pill.Background(t.Accent)
					fg = t.TextOnAccent
				} else {
					pill.Background(t.BgSubtle)
					if pill.Hovered() {
						pill.Background(t.BgHover)
						fg = t.TextPrimary
					}
				}
				pill.OnClick(func() {
					d.toggleWeekday(idx)
					alignDraftStartToRecurrence(&a.draft)
				}).Children(func() {
					ui.Text(c, short).FontSize(12).FontWeight(600).TextColor(fg)
				})
			}
		})
		ui.Row(c).Gap(6).Wrap().Children(func() {
			appActionButton(c, "工作日", action.ButtonProps{Size: theme.Small}).OnClick(func() {
				d.Weekdays = "周一，周二，周三，周四，周五"
				alignDraftStartToRecurrence(&a.draft)
			})
			appActionButton(c, "周末", action.ButtonProps{Size: theme.Small}).OnClick(func() {
				d.Weekdays = "周六，周日"
				alignDraftStartToRecurrence(&a.draft)
			})
			if d.Weekdays != "" {
				appActionButton(c, "清除星期限制", action.ButtonProps{Variant: action.Text, Size: theme.Small}).OnClick(func() { d.Weekdays = "" })
			}
		})
	})
}

func (a *App) recurrenceFields(c *ui.Context) {
	d := &a.draft
	if d.Repeat == "不重复" {
		return
	}
	if d.Repeat == "保留原有重复规则" {
		ui.Text(c, "当前规则："+recurrenceSummary(d)).FontSize(12).FontWeight(500)
		ui.Text(c, "保存其他属性时会完整保留已有重复规则。").FontSize(12).TextColor(c.Theme().TextMuted)
		if d.Rule.Frequency != "" {
			appActionButton(c, "编辑重复规则", action.ButtonProps{Size: theme.Small}).AlignSelf(ui.Start).OnClick(func() { d.Repeat = d.Rule.Frequency })
		}
	} else {
		ui.Row(c).Gap(10).Children(func() {
			ui.Field(c, "重复间隔", func() { appFieldInput(c.Key("repeat-interval"), &d.Rule.Interval, field.InputProps{}) }).Description("每隔 N 周期").Grow(1)
			ui.Field(c, "重复次数", func() { appFieldInput(c.Key("repeat-count"), &d.Rule.Count, field.InputProps{}) }).Description("0 为不限").Grow(1)
		})
		if d.Repeat == "农历每年" {
			ui.Row(c).Gap(10).Children(func() {
				ui.Field(c, "农历月份", func() { appFieldInput(c, &d.Rule.LunarMonth, field.InputProps{}) }).Description("1–12").Grow(1)
				ui.Field(c, "农历日期", func() { appFieldInput(c, &d.Rule.LunarDay, field.InputProps{}) }).Description("1–30").Grow(1)
			})
			ui.Checkbox(c, &d.Rule.LunarLeap, "优先使用闰月")
			ui.Text(c, "按北京时间计算农历；无对应闰月时使用普通月，月底自动取最后一天。").FontSize(11).TextColor(c.Theme().TextMuted)
		} else {
			ui.Text(c, "重复星期").FontSize(12).FontWeight(500)
			a.recurrenceWeekdayChoices(c)
			if d.Repeat == "每月" || d.Repeat == "每年" || strings.Contains(d.Rule.Weekdays, "个") {
				ui.Field(c, "高级星期规则", func() {
					appFieldInput(c.Key("repeat-weekdays"), &d.Rule.Weekdays, field.InputProps{Placeholder: "如：第2个周一，最后1个周五"})
				})
			}
			ui.Row(c).Gap(10).Children(func() {
				ui.Field(c, "月内日期", func() {
					appFieldInput(c.Key("repeat-dates"), &d.Rule.Dates, field.InputProps{Placeholder: "1，15，31"})
				}).Description("1–31，留空不限").Grow(1)
				ui.Field(c, "限定月份", func() {
					appFieldInput(c.Key("repeat-months"), &d.Rule.Months, field.InputProps{Placeholder: "1，6，12"})
				}).Description("1–12，留空不限").Grow(1)
			})
			a.recurrenceMonthChoices(c)
		}
	}
	dateRow(c, "重复结束日期", &d.HasRepeatEnd, &d.RepeatEnd, false)
	ui.Text(c, "次数与结束日期可同时设置，以先到的条件为准。").FontSize(11).TextColor(c.Theme().TextMuted)
}

func (d *RecurrenceDraft) toggleMonth(month int) {
	months, err := repeatNumbers(d.Months, "月份", 1, 12)
	if err != nil || month < 1 || month > 12 {
		return
	}
	found := false
	for i, value := range months {
		if value == month {
			months = append(months[:i], months[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		months = append(months, month)
	}
	sort.Ints(months)
	d.Months = joinNumbers(months)
}

func (a *App) recurrenceMonthChoices(c *ui.Context) {
	t := tokensOf(c)
	d := &a.draft.Rule
	months, err := repeatNumbers(d.Months, "月份", 1, 12)
	selected := map[int]bool{}
	for _, month := range months {
		selected[month] = true
	}
	ui.Column(c.Key("repeat-month-choices")).Gap(4).Children(func() {
		for row := 0; row < 2; row++ {
			ui.Row(c.Key(row)).Gap(4).Children(func() {
				for month := row*6 + 1; month <= row*6+6; month++ {
					m := month
					active := selected[m]
					btn := ui.ButtonBase(c.Key(m)).Width(42).Height(26).Radius(5).Center().
						Label(fmt.Sprintf("切换限定月份 %d月", m)).Disabled(err != nil).Cursor(ui.CursorPointer)
					fg := t.TextReadable
					if active {
						btn.Background(t.Accent)
						fg = t.TextOnAccent
					} else {
						btn.Background(t.BgSubtle)
						if btn.Hovered() {
							btn.Background(t.BgHover)
							fg = t.TextPrimary
						}
					}
					btn.OnClick(func() { d.toggleMonth(m) }).Children(func() {
						ui.Text(c, fmt.Sprintf("%d月", m)).FontSize(11).FontWeight(500).TextColor(fg)
					})
				}
			})
		}
		if err != nil {
			ui.Text(c, "请先将限定月份修正为 1–12，再使用月份按钮。").FontSize(11).TextColor(t.Danger)
		} else if len(months) == 0 {
			ui.Text(c, "所有月份 · 点击可限定月份").FontSize(11).TextColor(t.TextSecondary)
		} else {
			ui.Text(c, "仅在 "+d.Months+" 月重复").FontSize(11).TextColor(t.Accent)
		}
	})
}
