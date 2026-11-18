package app

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/egoist/mygo/ui"
	"todo-native/internal/api"
)

type calendarDrag struct {
	Event       api.CalendarEvent
	FromDay     time.Time
	Revision    int64
	Resize      bool
	GrabMinutes float64
}

type calendarGrab struct {
	Key     string
	Minutes float64
}

type calendarChange struct {
	Task            api.Task
	Start           time.Time
	End             *time.Time
	AllDay, DueOnly bool
}

func calendarGrabMinutes(event api.CalendarEvent, day time.Time, y, hourHeight float32) float64 {
	start, end, err := eventBounds(event, day.Location())
	if err != nil || hourHeight <= 0 {
		return 0
	}
	clipped := math.Max(0, dayStart(day).Sub(start).Minutes())
	return math.Max(0, math.Min(end.Sub(start).Minutes(), clipped+float64(y/hourHeight)*60))
}

func civilDays(a, b time.Time) int {
	x := time.Date(a.Year(), a.Month(), a.Day(), 0, 0, 0, 0, time.UTC)
	y := time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, time.UTC)
	return int(x.Sub(y) / (24 * time.Hour))
}

// Build a local wall-clock time without silently moving a nonexistent time
// across a DST gap. In an overlap, retain the old offset when possible.
func calendarWallTime(day time.Time, minute int, old time.Time) (time.Time, error) {
	offsetDays := int(math.Floor(float64(minute) / 1440))
	date := dayStart(day).AddDate(0, 0, offsetDays)
	minute -= offsetDays * 1440
	t := time.Date(date.Year(), date.Month(), date.Day(), minute/60, minute%60, old.Second(), old.Nanosecond(), day.Location())
	if t.Year() != date.Year() || t.Month() != date.Month() || t.Day() != date.Day() || t.Hour()*60+t.Minute() != minute {
		return time.Time{}, errors.New("所选时刻因夏令时不存在，请选择其他时刻")
	}
	_, offset := old.Zone()
	for _, delta := range []time.Duration{0, -2 * time.Hour, -time.Hour, -30 * time.Minute, 30 * time.Minute, time.Hour, 2 * time.Hour} {
		candidate := t.Add(delta)
		_, candidateOffset := candidate.Zone()
		if candidateOffset == offset && candidate.Year() == t.Year() && candidate.YearDay() == t.YearDay() && candidate.Hour() == t.Hour() && candidate.Minute() == t.Minute() {
			return candidate, nil
		}
	}
	return t, nil
}

func calendarDragChange(task api.Task, drag calendarDrag, day time.Time, minute int, timeline, allDayTarget bool, step int) (calendarChange, error) {
	if task.ReadOnly || drag.Event.ExtendedProps.ReadOnly {
		return calendarChange{}, errors.New("外部日历为只读")
	}
	if drag.Revision != task.Revision {
		return calendarChange{}, errors.New("日程已更新，请刷新后重新拖动")
	}
	start, displayEnd, err := eventBounds(drag.Event, day.Location())
	if err != nil {
		return calendarChange{}, err
	}
	change := calendarChange{Task: task, Start: start, AllDay: drag.Event.AllDay, DueOnly: !task.Recurring() && task.StartTime == nil && task.DueDate != nil}
	if end, err := eventDate(drag.Event.End, day.Location()); err == nil && end.After(start) {
		change.End = &end
	}
	if step <= 0 {
		step = 15
	}
	if drag.Resize {
		var end time.Time
		if change.AllDay {
			if timeline && !allDayTarget {
				return calendarChange{}, errors.New("请把全天结束手柄拖到最后一天或全天栏")
			}
			end = dayStart(day).AddDate(0, 0, 1)
		} else if timeline {
			if allDayTarget {
				return calendarChange{}, errors.New("请把结束手柄拖到时间轴")
			}
			minute = int(math.Round(float64(minute)/float64(step))) * step
			end, err = calendarWallTime(day, max(0, min(1440, minute)), displayEnd.Truncate(time.Minute))
		} else {
			end, err = calendarWallTime(day, displayEnd.Hour()*60+displayEnd.Minute(), displayEnd)
		}
		if err != nil {
			return calendarChange{}, err
		}
		if !end.After(start) {
			return calendarChange{}, errors.New("结束时间应晚于开始时间，未修改日程")
		}
		change.End, change.DueOnly = &end, false
		return change, nil
	}
	var moved time.Time
	switch {
	case timeline && !allDayTarget:
		minute = int(math.Round((float64(minute)-drag.GrabMinutes)/float64(step))) * step
		moved, err = calendarWallTime(day, min(1440-step, minute), start.Truncate(time.Minute))
		change.AllDay, change.DueOnly = false, false
		if drag.Event.AllDay {
			end := moved.Add(time.Hour)
			change.End = &end
		}
	case allDayTarget:
		moved, change.AllDay = dayStart(day), true
	default:
		target := dayStart(start).AddDate(0, 0, civilDays(day, drag.FromDay))
		moved, err = calendarWallTime(target, start.Hour()*60+start.Minute(), start)
	}
	if err != nil {
		return calendarChange{}, err
	}
	if change.End != nil && !(timeline && !allDayTarget && drag.Event.AllDay) {
		var end time.Time
		if change.AllDay {
			span := civilDays(dayStart(displayEnd), dayStart(start))
			if !drag.Event.AllDay && !displayEnd.Equal(dayStart(displayEnd)) {
				span++
			}
			end = dayStart(moved).AddDate(0, 0, max(1, span))
		} else {
			end = moved.Add(displayEnd.Sub(start))
		}
		change.End = &end
	}
	change.Start = moved
	return change, nil
}

func (change calendarChange) mutation() (string, string, map[string]any, error) {
	if change.Task.Recurring() {
		body, err := occurrenceSchedulePayload(change.Task, occurrenceScheduleDraft{Start: change.Start, HasEnd: change.End != nil, AllDay: change.AllDay, End: valueTime(change.End)})
		return "PATCH", fmt.Sprintf("/tasks/%d/occurrences/schedule", change.Task.ID), body, err
	}
	if change.Start.IsZero() || (change.End != nil && !change.End.After(change.Start)) {
		return "", "", nil, errors.New("日程时间范围无效")
	}
	body := map[string]any{"start_time": change.Start, "end_time": change.End, "all_day": change.AllDay}
	if change.DueOnly {
		body["start_time"], body["end_time"], body["due_date"] = nil, nil, change.Start
	} else if change.Task.StartTime == nil && change.Task.DueDate != nil {
		body["due_date"] = nil
	}
	return "PUT", fmt.Sprintf("/tasks/%d", change.Task.ID), body, nil
}

func valueTime(t *time.Time) time.Time {
	if t != nil {
		return *t
	}
	return time.Time{}
}

func (a *App) applyCalendarDrop(drag calendarDrag, day time.Time, minute int, timeline, allDay bool) {
	if a.busy {
		return
	}
	task, err := a.calendarTask(drag.Event)
	if err != nil {
		a.failure = err.Error()
		return
	}
	change, err := calendarDragChange(task, drag, day, minute, timeline, allDay, taskGranularity(a.session.User))
	if err != nil {
		a.failure = err.Error()
		return
	}
	oldStart, _, _ := eventBounds(drag.Event, a.location())
	oldEnd, _ := eventDate(drag.Event.End, a.location())
	if change.Start.Equal(oldStart) && valueTime(change.End).Equal(oldEnd) && change.AllDay == drag.Event.AllDay {
		return
	}
	method, path, body, err := change.mutation()
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.queueTask(method, path, body, task.Revision, nil)
}

func (a *App) calendarDragSource(e ui.Element, event api.CalendarEvent, day time.Time, resize bool, hourHeight float32) {
	task, err := a.calendarTask(event)
	if err != nil || a.busy {
		return
	}
	key := eventKey(event) + "/" + day.Format("20060102")
	grab := float64(0)
	if !resize && hourHeight > 0 && !event.AllDay {
		if e.PressedInside() && e.Pressed() {
			_, y, _ := e.PointerPosition()
			a.calendarGrab = calendarGrab{Key: key, Minutes: calendarGrabMinutes(event, day, y, hourHeight)}
		}
		if a.calendarGrab.Key == key {
			grab = a.calendarGrab.Minutes
		}
	}
	e.Drag(calendarDrag{Event: event, FromDay: day, Revision: task.Revision, Resize: resize, GrabMinutes: grab}).Cursor(ui.CursorGrab)
	if e.Pressed() || e.Dragging() {
		a.calendarDragging = true
	}
}

func (a *App) calendarDropTarget(c *ui.Context, e ui.Element, day time.Time, timeline, allDay bool, hourHeight float32) {
	if a.busy {
		return
	}
	if _, over := ui.DragOver[calendarDrag](e); over && (!timeline || allDay) {
		// Soft cell wash instead of harsh 2px full-column wireframe borders.
		e.Background(tokensOf(c).Accent.Alpha(0.10))
	}
	if drag, dropped := ui.Drop[calendarDrag](e); dropped {
		minute := 0
		if timeline && !allDay {
			_, y, _ := e.PointerPosition()
			minute = int(math.Round(float64(y/hourHeight) * 60))
		}
		a.applyCalendarDrop(drag, day, minute, timeline, allDay)
	}
}

// Full-duration translucent ghost event block preview during timeline drag/resize.
func (a *App) calendarDropPreview(c *ui.Context, column ui.Element, day time.Time, hourHeight float32) {
	drag, over := ui.DragOver[calendarDrag](column)
	if !over || a.busy {
		return
	}
	_, y, _ := column.PointerPosition()
	task, err := a.calendarTask(drag.Event)
	if err != nil {
		return
	}
	change, err := calendarDragChange(task, drag, day, int(math.Round(float64(y/hourHeight)*60)), true, false, taskGranularity(a.session.User))
	if err != nil {
		return
	}
	t := tokensOf(c)
	accent := a.calendarEventAccent(c, drag.Event)

	startMin := float32(change.Start.Hour()*60 + change.Start.Minute())
	if change.Start.Before(dayStart(day)) {
		startMin = 0
	}
	endTime := change.Start.Add(30 * time.Minute)
	if change.End != nil && change.End.After(change.Start) {
		endTime = *change.End
	}
	endMin := float32(endTime.Hour()*60 + endTime.Minute())
	if !endTime.Before(dayStart(day).AddDate(0, 0, 1)) {
		endMin = 1440
	}
	durMin := max(float32(25), endMin-startMin)

	ui.Column(c.Key("drop-preview")).Absolute().Left(2).Right(3).
		Top(startMin/60*hourHeight).Height(durMin/60*hourHeight).
		Padding(4, 8).Radius(6).
		Background(accent.Alpha(0.18)).Border(1.5, accent).BorderStyle(ui.BorderDashed).
		PassThrough().AccessHidden(true).Children(func() {
		timeLabel := change.Start.Format("15:04") + " – " + endTime.Format("15:04")
		ui.Text(c, timeLabel).FontSize(11).FontFeatures("tnum").FontWeight(700).TextColor(accent).SingleLine()
		if durMin >= 42 {
			ui.Text(c, drag.Event.Title).FontSize(11.5).FontWeight(500).TextColor(t.TextPrimary).SingleLine()
		}
	})
}

func (a *App) calendarResizeHandle(c *ui.Context, event api.CalendarEvent, day time.Time, hourHeight float32, showIndicator ...bool) {
	if _, err := a.calendarTask(event); err != nil || a.busy {
		return
	}
	_, end, err := eventBounds(event, a.location())
	if err != nil || end.After(dayStart(day).AddDate(0, 0, 1)) {
		return
	}
	reveal := len(showIndicator) > 0 && showIndicator[0]
	handle := ui.ButtonBase(c.Key("resize")).Label("调整结束 " + day.Format("2006-01-02") + " " + event.Title).Absolute().Bottom(0)
	if event.AllDay {
		handle.Top(0).Right(0).Width(14).Tooltip("拖到最后一天调整全天结束日期").Children(func() {
			if reveal || handle.Focused() || handle.Dragging() {
				ui.Text(c, "↔").FontSize(10).TextColor(tokensOf(c).TextSecondary)
			}
		})
	} else {
		handle.Left(0).Right(0).Height(8).Tooltip("拖动调整本次结束时间").Children(func() {
			if reveal || handle.Focused() || handle.Dragging() {
				ui.Box(c).Height(2.5).Width(22).Radius(1.5).Background(a.calendarEventAccent(c, event).Alpha(0.75)).AlignSelf(ui.Center)
			}
		})
	}
	a.calendarDragSource(handle, event, day, true, hourHeight)
	if event.AllDay {
		handle.Cursor(ui.CursorResizeEW)
	} else {
		handle.Cursor(ui.CursorResizeNS)
	}
}

func (a *App) calendarCompactEvent(c *ui.Context, event api.CalendarEvent, day time.Time, height float32, hovered ...bool) {
	cardHover := len(hovered) > 0 && hovered[0]
	box := ui.Box(c).Height(height).Shrink(0).MinWidth(0)
	box.Children(func() {
		e := a.calendarEventButton(c.Key("event"), event, day).Fill().Height(height)
		if event.AllDay {
			e.Padding(0, 14, 0, 6)
			a.calendarResizeHandle(c, event, day, 0, cardHover || box.Hovered())
		}
	})
}
