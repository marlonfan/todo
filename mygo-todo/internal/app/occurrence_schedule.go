package app

import (
	"errors"
	"fmt"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
)

type occurrenceScheduleDraft struct {
	Start, End     time.Time
	HasEnd, AllDay bool
}

func (a *App) editOccurrenceSchedule() {
	t := a.selectedOccurrence
	if t == nil || t.ReadOnly || t.StartTime == nil {
		return
	}
	d := &occurrenceScheduleDraft{Start: t.StartTime.In(a.location()), End: t.StartTime.In(a.location()).Add(time.Hour), AllDay: t.AllDay}
	if t.EndTime != nil {
		d.End, d.HasEnd = t.EndTime.In(a.location()), true
	}
	a.occurrenceSchedule = d
	base := *d
	a.occurrenceScheduleBase = &base
	a.failure = ""
}

func occurrenceSchedulePayload(t api.Task, d occurrenceScheduleDraft) (map[string]any, error) {
	scope, err := taskStatusPayload(t, t.Status)
	if err != nil {
		return nil, err
	}
	if !t.Recurring() || t.InstanceID == "" || d.Start.IsZero() {
		return nil, errors.New("请选择有效的重复实例与开始时间")
	}
	if _, err := time.Parse("2006-01-02", t.OccurrenceDate); err != nil {
		return nil, errors.New("无法读取原始实例日期")
	}
	if d.HasEnd && !d.End.After(d.Start) {
		return nil, errors.New("结束时间应晚于开始时间")
	}
	body := map[string]any{"instance_id": scope["instance_id"], "occurrence_date": scope["occurrence_date"], "start_time": d.Start, "end_time": nil, "all_day": d.AllDay}
	if d.HasEnd {
		body["end_time"] = d.End
	}
	return body, nil
}

func (a *App) saveOccurrenceSchedule(reset bool) {
	if a.selectedOccurrence == nil || a.occurrenceSchedule == nil || a.busy {
		return
	}
	task, d := *a.selectedOccurrence, *a.occurrenceSchedule
	if reset {
		var series *api.Task
		for i := range a.tasks {
			if a.tasks[i].ID == task.ID {
				series = &a.tasks[i]
				break
			}
		}
		if series == nil || series.StartTime == nil {
			a.failure = "缺少系列起点，请联网刷新后重试"
			return
		}
		date, err := time.Parse("2006-01-02", task.OccurrenceDate)
		if err != nil {
			a.failure = "无法读取原始实例日期"
			return
		}
		anchor := series.StartTime.In(a.location())
		d.Start = time.Date(date.Year(), date.Month(), date.Day(), anchor.Hour(), anchor.Minute(), anchor.Second(), anchor.Nanosecond(), a.location())
		d.AllDay, d.HasEnd = series.AllDay, series.EndTime != nil
		if d.HasEnd {
			d.End = d.Start.Add(series.EndTime.Sub(*series.StartTime))
		}
	}
	body, err := occurrenceSchedulePayload(task, d)
	if err != nil {
		a.failure = err.Error()
		return
	}
	if reset {
		body["reset_schedule"] = true
	}
	a.mutate("PATCH", fmt.Sprintf("/tasks/%d/occurrences/schedule", task.ID), body, task.Revision, func() {
		startCopy := d.Start
		task.StartTime = &startCopy
		task.AllDay = d.AllDay
		if d.HasEnd {
			endCopy := d.End
			task.EndTime = &endCopy
		} else {
			task.EndTime = nil
		}
		a.selectedOccurrence = &task
		a.occurrenceSchedule = nil
		a.occurrenceScheduleBase = nil
		a.failure = ""
	})
}

func (a *App) occurrenceScheduleFields(c *ui.Context) {
	d := a.occurrenceSchedule
	_, height := c.Size()
	ui.Scroll(c.Key("occurrence-schedule-fields")).MaxHeight(max(150, height-290)).Gap(10).Disabled(a.busy).Children(func() {
		ui.Row(c).AlignItems(ui.Center).Gap(8).Children(func() {
			ui.Text(c, "调整本次实例时间").FontSize(13).FontWeight(600).Grow(1)
			ui.Text(c, "原始实例日期："+a.selectedOccurrence.OccurrenceDate).FontSize(11).TextColor(c.Theme().TextMuted)
		})
		ui.Checkbox(c, &d.AllDay, "本次全天")
		ui.Row(c).Gap(8).Wrap().AlignItems(ui.Center).Children(func() {
			ui.Text(c, "本次开始").FontSize(12).TextColor(c.Theme().TextMuted).Width(60)
			appDatePickerField(c, &d.Start, "本次开始日期", func() {
				if d.HasEnd && !d.End.After(d.Start) {
					d.End = d.Start.Add(time.Hour)
				}
			})
			if !d.AllDay {
				ui.TimeInput(c, &d.Start).Label("本次开始时刻").OnChange(func() {
					if d.HasEnd && !d.End.After(d.Start) {
						d.End = d.Start.Add(time.Hour)
					}
				})
			}
		})
		dateRow(c, "本次结束", &d.HasEnd, &d.End, !d.AllDay)
		ui.Text(c, "仅修改本次显示时间，后续重复规则与系列起点保持不变。").FontSize(11).TextColor(c.Theme().TextMuted)
	})
}
