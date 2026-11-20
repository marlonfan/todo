package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"

	"github.com/egoist/mygo/ui/markdown/parser"
	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

var calendarModes = []string{"日", "周", "月", "日程"}
var calendarFilters = []string{"全部", "任务", "外部"}

func filterCalendarEvents(events []api.CalendarEvent, filter int) []api.CalendarEvent {
	if filter <= 0 {
		return events
	}
	result := make([]api.CalendarEvent, 0, len(events))
	for _, event := range events {
		external := event.ExtendedProps.ReadOnly || event.ExtendedProps.Source == "caldav"
		if (filter == 1 && !external) || (filter == 2 && external) {
			result = append(result, event)
		}
	}
	return result
}

func dayStart(day time.Time) time.Time {
	return time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
}
func weekStart(day time.Time) time.Time {
	return dayStart(day).AddDate(0, 0, -(int(day.Weekday())+6)%7)
}
func calendarRange(day time.Time, mode int) (time.Time, time.Time) {
	start := dayStart(day)
	switch mode {
	case 1:
		start = weekStart(day)
		return start, start.AddDate(0, 0, 7)
	case 2:
		start = weekStart(time.Date(day.Year(), day.Month(), 1, 0, 0, 0, 0, day.Location()))
		return start, start.AddDate(0, 0, 42)
	default:
		return start, start.AddDate(0, 0, 1)
	}
}
func calendarShift(day time.Time, mode, delta int) time.Time {
	switch mode {
	case 1:
		return day.AddDate(0, 0, 7*delta)
	case 2:
		month := time.Date(day.Year(), day.Month(), 1, day.Hour(), day.Minute(), 0, 0, day.Location()).AddDate(0, delta, 0)
		last := time.Date(month.Year(), month.Month()+1, 0, 0, 0, 0, 0, month.Location()).Day()
		return month.AddDate(0, 0, min(day.Day(), last)-1)
	default:
		return day.AddDate(0, 0, delta)
	}
}
func eventDate(raw string, loc *time.Location) (time.Time, error) {
	for _, format := range []string{time.RFC3339Nano, "2006-01-02"} {
		if value, err := time.ParseInLocation(format, raw, loc); err == nil {
			return value.In(loc), nil
		}
	}
	return time.Time{}, errors.New("无法读取日程日期")
}
func eventBounds(event api.CalendarEvent, loc *time.Location) (time.Time, time.Time, error) {
	start, err := eventDate(event.Start, loc)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end, err := eventDate(event.End, loc)
	if err != nil || !end.After(start) {
		if event.AllDay {
			end = dayStart(start).AddDate(0, 0, 1)
		} else {
			end = start.Add(30 * time.Minute)
		}
	}
	return start, end, nil
}
func eventsForDay(events []api.CalendarEvent, day time.Time) []api.CalendarEvent {
	start, end := dayStart(day), dayStart(day).AddDate(0, 0, 1)
	var result []api.CalendarEvent
	for _, e := range events {
		s, f, err := eventBounds(e, day.Location())
		if err == nil && s.Before(end) && f.After(start) {
			result = append(result, e)
		}
	}
	slices.SortStableFunc(result, func(a, b api.CalendarEvent) int {
		if a.AllDay != b.AllDay {
			if a.AllDay {
				return -1
			}
			return 1
		}
		av, _ := eventDate(a.Start, day.Location())
		bv, _ := eventDate(b.Start, day.Location())
		if n := av.Compare(bv); n != 0 {
			return n
		}
		return strings.Compare(a.ID, b.ID)
	})
	return result
}
func activeEvent(event api.CalendarEvent) bool {
	return event.ExtendedProps.Status != "cancelled" && event.ExtendedProps.Status != "skipped"
}
func eventKey(e api.CalendarEvent) string {
	if e.ExtendedProps.InstanceID != "" {
		return fmt.Sprintf("%d/%s", e.ExtendedProps.TaskID, e.ExtendedProps.InstanceID)
	}
	return fmt.Sprintf("%s/%s/%d", e.ExtendedProps.Source, e.ID, e.ExtendedProps.TaskID)
}

// Ordinary tasks are reconstructed from optimistic local state. Only server-
// expanded recurrence and external calendars rely on cached event payloads.
func projectedCalendar(state storage.Cache) []api.CalendarEvent {
	view := syncer.View(state)
	tasks := make(map[int64]api.Task)
	dirty := make(map[int64]bool)
	statuses := make(map[string]string)
	for _, task := range view.Tasks {
		tasks[task.ID] = task
	}
	for _, op := range state.Outbox {
		var scope struct {
			InstanceID string `json:"instance_id"`
		}
		_ = json.Unmarshal(op.Body, &scope)
		if op.Method == "PUT" && scope.InstanceID == "" && syncer.TaskScheduleChanged(op) {
			dirty[op.TaskID] = true
		}
		if op.Suffix == "/status" {
			var fields struct {
				InstanceID string
				Status     string
			}
			var payload map[string]json.RawMessage
			_ = json.Unmarshal(op.Body, &payload)
			_ = json.Unmarshal(payload["instance_id"], &fields.InstanceID)
			_ = json.Unmarshal(payload["status"], &fields.Status)
			if fields.InstanceID != "" {
				statuses[fmt.Sprintf("%d/%s", op.TaskID, fields.InstanceID)] = fields.Status
			}
		}
	}
	merged := make(map[string]api.CalendarEvent)
	add := func(events []api.CalendarEvent, revisions map[int64]int64) {
		for _, event := range events {
			props := event.ExtendedProps
			if !props.ReadOnly {
				task, exists := tasks[props.TaskID]
				if !exists || !task.Recurring() || task.Status != "pending" || dirty[task.ID] || props.InstanceID == "" {
					continue
				}
				if revisions != nil && revisions[task.ID] != task.Revision {
					continue
				}
			}
			merged[eventKey(event)] = event
		}
	}
	if state.Calendar != nil && state.Calendar.SavedAt.After(state.SavedAt) {
		add(view.ReminderEvents, nil)
		addCalendarSnapshot(view.Calendar, add)
	} else {
		addCalendarSnapshot(view.Calendar, add)
		add(view.ReminderEvents, nil)
	}
	// Older cache files can still supply one next occurrence per series.
	for _, o := range view.Next {
		task, ok := tasks[o.TaskID]
		key := fmt.Sprintf("%d/%s", o.TaskID, o.InstanceID)
		if !ok || !task.Recurring() || dirty[task.ID] || task.Status != "pending" || o.InstanceID == "" {
			continue
		}
		if _, exists := merged[key]; exists {
			continue
		}
		e := api.CalendarEvent{ID: o.InstanceID, Title: o.Title, Start: o.StartTime.Format(time.RFC3339Nano), AllDay: o.AllDay}
		if o.EndTime != nil {
			e.End = o.EndTime.Format(time.RFC3339Nano)
		}
		e.ExtendedProps.TaskID, e.ExtendedProps.InstanceID, e.ExtendedProps.IsRecurring = o.TaskID, o.InstanceID, true
		e.ExtendedProps.Description, e.ExtendedProps.Status, e.ExtendedProps.Priority = o.Description, o.Status, o.Priority
		merged[key] = e
	}
	var result []api.CalendarEvent
	for _, event := range merged {
		if status, exists := statuses[eventKey(event)]; exists {
			event.ExtendedProps.Status = status
		}
		if activeEvent(event) {
			result = append(result, event)
		}
	}
	for _, task := range view.Tasks {
		if task.Recurring() || task.Status == "cancelled" || task.Status == "skipped" || task.ReadOnly {
			continue
		}
		start := task.StartTime
		allDay := task.AllDay
		if start == nil {
			start = task.DueDate
			allDay = true
		}
		if start == nil {
			continue
		}
		e := api.CalendarEvent{ID: fmt.Sprint(task.ID), Title: task.Title, Start: start.Format(time.RFC3339Nano), AllDay: allDay}
		if task.StartTime != nil && task.EndTime != nil {
			e.End = task.EndTime.Format(time.RFC3339Nano)
		}
		e.ExtendedProps.TaskID, e.ExtendedProps.Description, e.ExtendedProps.Priority, e.ExtendedProps.Status = task.ID, task.Description, task.Priority, task.Status
		result = append(result, e)
	}
	slices.SortFunc(result, func(a, b api.CalendarEvent) int { return strings.Compare(eventKey(a), eventKey(b)) })
	return result
}
func addCalendarSnapshot(snapshot *storage.CalendarSnapshot, add func([]api.CalendarEvent, map[int64]int64)) {
	if snapshot != nil {
		add(snapshot.Events, snapshot.SeriesRevisions)
	}
}
func calendarCovered(state storage.Cache, start, end time.Time, zone string) bool {
	s := state.Calendar
	if s == nil || s.Timezone != zone || s.Start.After(start) || s.End.Before(end) || s.SavedAt.Before(state.SavedAt) {
		return false
	}
	for _, task := range state.Tasks {
		if task.Recurring() && s.SeriesRevisions[task.ID] != task.Revision {
			return false
		}
	}
	return true
}
func (a *App) loadCalendar() {
	if a.client == nil || a.busy || a.calendarLoading || a.win == nil || a.cacheError != "" {
		return
	}
	start, end := calendarRange(a.selectedDay.In(a.location()), a.calendarMode)
	if calendarCovered(a.cache, start, end, a.location().String()) {
		return
	}
	client, state, zone := a.client, syncer.Clone(a.cache), a.location().String()
	epoch, ctx, win := a.epoch, a.ctx, a.win
	a.calendarLoading = true
	go func() {
		reqCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()
		events, err := client.Calendar(reqCtx, start, end)
		if err == nil {
			revisions := make(map[int64]int64)
			for _, task := range state.Tasks {
				if task.Recurring() {
					revisions[task.ID] = task.Revision
				}
			}
			state.Calendar = &storage.CalendarSnapshot{Start: start, End: end, Timezone: zone, SavedAt: time.Now(), Events: events, SeriesRevisions: revisions}
			if saveErr := a.store.SaveCache(state); saveErr != nil {
				err = fmt.Errorf("无法保存日历缓存：%w", saveErr)
			}
		}
		if ctx.Err() != nil || win == nil || win.IsDestroyed() {
			return
		}
		win.Update(func() {
			if epoch != a.epoch {
				return
			}
			a.calendarLoading = false
			if err != nil {
				a.failure = err.Error()
				return
			}
			// Preserve any newer local task edits made while calendar was loading.
			live := syncer.Clone(a.cache)
			live.Calendar = state.Calendar
			if live.Calendar != nil && live.Calendar.SavedAt.Before(live.SavedAt) {
				live.Calendar.SavedAt = time.Now()
			}
			_ = a.store.SaveCache(live)
			a.adoptCache(live)
		})
	}()
}
func (a *App) setCalendarMode(mode int) {
	a.calendarMode = mode
	a.focusCalendarWorkingHours()
	if a.preferencesError == "" {
		prefs := a.preferences
		prefs.CalendarView = calendarModes[mode]
		if err := a.store.SavePreferences(prefs); err != nil {
			a.failure = "无法保存日历视图偏好：" + err.Error()
		} else {
			a.preferences = prefs
		}
	}
	a.loadCalendar()
}

func (a *App) focusCalendarWorkingHours() {
	if a.calendarMode < 2 {
		a.calendarScroll.Y = 7 * float32(a.calendarZoom)
	}
}
func (a *App) calendarTask(event api.CalendarEvent) (api.Task, error) {
	props := event.ExtendedProps
	if props.ReadOnly {
		return api.Task{}, errors.New("外部日历为只读")
	}
	for _, task := range a.tasks {
		if task.ID != props.TaskID {
			continue
		}
		if task.ReadOnly {
			return api.Task{}, errors.New("此任务为只读")
		}
		if !task.Recurring() {
			return task, nil
		}
		datePart, valid := strings.CutPrefix(props.InstanceID, fmt.Sprintf("%d_", task.ID))
		date, err := time.Parse("20060102", datePart)
		if !valid || err != nil {
			return api.Task{}, errors.New("日程缺少有效的重复实例编号，请刷新后再试")
		}
		start, err := eventDate(event.Start, a.location())
		if err != nil {
			return api.Task{}, err
		}
		task.StartTime, task.DueDate, task.EndTime = &start, nil, nil
		if end, err := eventDate(event.End, a.location()); err == nil && end.After(start) {
			task.EndTime = &end
		}
		task.Title, task.Description, task.AllDay = event.Title, props.Description, event.AllDay
		task.InstanceID, task.OccurrenceDate = props.InstanceID, date.Format("2006-01-02")
		if props.Status != "" {
			task.Status = props.Status
		}
		task.Priority = props.Priority
		return task, nil
	}
	return api.Task{}, errors.New("本地尚无此任务，请刷新任务列表后再试")
}
func (a *App) openCalendarEvent(event api.CalendarEvent) {
	if a.busy {
		return
	}
	if event.ExtendedProps.ReadOnly {
		a.calendarDetail = &event
		return
	}
	task, err := a.calendarTask(event)
	if err != nil {
		a.failure = err.Error()
		return
	}
	a.openTask(task)
}
func (a *App) newCalendarTask(day time.Time, hour int) {
	a.requestTaskTransition(func() {
		a.newTaskNow()
		a.draft.Start = time.Date(day.Year(), day.Month(), day.Day(), hour, 0, 0, 0, a.location())
		a.draft.End = a.draft.Start.Add(time.Hour)
		a.draft.HasStart = true
		a.rememberTaskDraft()
	})
}

type calendarSegment struct {
	Event       api.CalendarEvent
	From, To    float64
	Lane, Lanes int
}

func timelineSegments(events []api.CalendarEvent, day time.Time) []calendarSegment {
	var result []calendarSegment
	start, end := dayStart(day), dayStart(day).AddDate(0, 0, 1)
	for _, event := range eventsForDay(events, day) {
		if event.AllDay {
			continue
		}
		s, e, err := eventBounds(event, day.Location())
		if err != nil {
			continue
		}
		s = s.In(day.Location())
		e = e.In(day.Location())
		from, to := float64(s.Hour()*60+s.Minute()), float64(e.Hour()*60+e.Minute())
		if s.Before(start) {
			from = 0
		}
		if !e.Before(end) {
			to = 1440
		}
		if to <= from {
			to = math.Min(1440, from+e.Sub(s).Minutes())
		}
		// Reserve enough visual room for a readable button, also for short events.
		to = math.Min(1440, math.Max(to, from+30))
		if to-from < 30 {
			from = math.Max(0, to-30)
		}
		result = append(result, calendarSegment{Event: event, From: from, To: to})
	}
	slices.SortStableFunc(result, func(a, b calendarSegment) int {
		if a.From < b.From {
			return -1
		}
		if a.From > b.From {
			return 1
		}
		if a.To > b.To {
			return -1
		}
		if a.To < b.To {
			return 1
		}
		return strings.Compare(eventKey(a.Event), eventKey(b.Event))
	})
	for group := 0; group < len(result); {
		tail := group
		reach := result[group].To
		for tail+1 < len(result) && result[tail+1].From < reach {
			tail++
			reach = math.Max(reach, result[tail].To)
		}
		var laneEnds []float64
		for i := group; i <= tail; i++ {
			lane := 0
			for lane < len(laneEnds) && laneEnds[lane] > result[i].From {
				lane++
			}
			if lane == len(laneEnds) {
				laneEnds = append(laneEnds, result[i].To)
			} else {
				laneEnds[lane] = result[i].To
			}
			result[i].Lane = lane
		}
		for i := group; i <= tail; i++ {
			result[i].Lanes = len(laneEnds)
		}
		group = tail + 1
	}
	return result
}

type allDaySpan struct {
	Event          api.CalendarEvent
	StartCol       int
	Span           int
	Lane           int
	ContinuesLeft  bool
	ContinuesRight bool
	AnchorDay      time.Time
	EndDay         time.Time
}

// allDaySpansForRange packs all-day events overlapping [rowStart, rowStart+cols)
// into non-overlapping horizontal lanes so multi-day banners render as continuous
// ribbons across columns in both Month and Week views.
func allDaySpansForRange(events []api.CalendarEvent, rowStart time.Time, cols int) ([]allDaySpan, int) {
	if cols <= 0 {
		return nil, 0
	}
	base := dayStart(rowStart)
	loc := base.Location()
	var spans []allDaySpan
	for _, ev := range events {
		if !ev.AllDay {
			continue
		}
		s, e, err := eventBounds(ev, loc)
		if err != nil {
			continue
		}
		evStart := dayStart(s)
		evEnd := dayStart(e)
		if !e.Equal(evEnd) || !evEnd.After(evStart) {
			evEnd = evEnd.AddDate(0, 0, 1)
		}
		startCol := civilDays(evStart, base)
		endCol := civilDays(evEnd, base)
		if endCol <= 0 || startCol >= cols {
			continue
		}
		clampedStart := max(0, startCol)
		clampedEnd := min(cols, endCol)
		if clampedEnd <= clampedStart {
			continue
		}
		spans = append(spans, allDaySpan{
			Event:          ev,
			StartCol:       clampedStart,
			Span:           clampedEnd - clampedStart,
			ContinuesLeft:  startCol < 0,
			ContinuesRight: endCol > cols,
			AnchorDay:      base.AddDate(0, 0, clampedStart),
			EndDay:         base.AddDate(0, 0, clampedEnd-1),
		})
	}
	slices.SortStableFunc(spans, func(a, b allDaySpan) int {
		if a.StartCol != b.StartCol {
			return a.StartCol - b.StartCol
		}
		if a.Span != b.Span {
			return b.Span - a.Span
		}
		return strings.Compare(eventKey(a.Event), eventKey(b.Event))
	})
	var laneEnds []int
	for i := range spans {
		lane := 0
		for lane < len(laneEnds) && laneEnds[lane] > spans[i].StartCol {
			lane++
		}
		endCol := spans[i].StartCol + spans[i].Span
		if lane == len(laneEnds) {
			laneEnds = append(laneEnds, endCol)
		} else {
			laneEnds[lane] = endCol
		}
		spans[i].Lane = lane
	}
	return spans, len(laneEnds)
}

func timedEventsForDay(events []api.CalendarEvent, day time.Time) []api.CalendarEvent {
	all := eventsForDay(events, day)
	var result []api.CalendarEvent
	for _, ev := range all {
		if !ev.AllDay {
			result = append(result, ev)
		}
	}
	return result
}

// multiDayEventInfo returns 1-based day position and inclusive date bounds for
// multi-day all-day events so Agenda view distinguishes each day clearly.
func multiDayEventInfo(event api.CalendarEvent, day time.Time) (dayIndex, totalDays int, startDay, endDay time.Time, ok bool) {
	if !event.AllDay {
		return 0, 0, time.Time{}, time.Time{}, false
	}
	s, e, err := eventBounds(event, day.Location())
	if err != nil {
		return 0, 0, time.Time{}, time.Time{}, false
	}
	startDay = dayStart(s)
	endExclusive := dayStart(e)
	if !e.Equal(endExclusive) || !endExclusive.After(startDay) {
		endExclusive = endExclusive.AddDate(0, 0, 1)
	}
	totalDays = civilDays(endExclusive, startDay)
	if totalDays < 2 {
		return 0, 0, time.Time{}, time.Time{}, false
	}
	endDay = endExclusive.AddDate(0, 0, -1)
	dayIndex = civilDays(dayStart(day), startDay) + 1
	dayIndex = min(totalDays, max(1, dayIndex))
	return dayIndex, totalDays, startDay, endDay, true
}

// agendaSummaryText produces a clean single-line summary from Markdown for the
// Agenda view without concatenating headings, checklists, and table cells with
// noisy " · " separators. Plain single-paragraph descriptions keep identical
// plain text so single-line truncation works without altering source data.
func agendaSummaryText(src string) string {
	src = strings.TrimSpace(src)
	if src == "" {
		return ""
	}
	d := parser.New(parser.Default)
	d.Set(src)

	var firstBody, firstFallback string
	var walk func(parent int, insideList bool)
	walk = func(parent int, insideList bool) {
		for idx := range d.Children(parent) {
			if firstBody != "" {
				return
			}
			b := d.Block(idx)
			switch b.Kind {
			case parser.Table:
				continue
			case parser.Paragraph:
				txt := strings.TrimSpace(parser.PlainText(d.Inlines(idx)))
				if txt == "" {
					continue
				}
				if !insideList {
					firstBody = txt
					return
				}
				if firstFallback == "" {
					firstFallback = txt
				}
			case parser.Heading:
				txt := strings.TrimSpace(parser.PlainText(d.Inlines(idx)))
				if txt != "" && firstFallback == "" {
					firstFallback = txt
				}
			case parser.CodeBlock:
				if firstFallback == "" {
					if txt := strings.TrimSpace(d.Lines(idx)); txt != "" {
						first, _, _ := strings.Cut(txt, "\n")
						firstFallback = strings.TrimSpace(first)
					}
				}
			case parser.List, parser.Item:
				walk(idx, true)
			default:
				walk(idx, insideList)
			}
		}
	}
	walk(0, false)

	if firstBody != "" {
		return firstBody
	}
	return firstFallback
}

func (a *App) calendarEventSelected(event api.CalendarEvent) bool {
	if event.ExtendedProps.ReadOnly {
		return a.calendarDetail != nil && eventKey(*a.calendarDetail) == eventKey(event)
	}
	if a.selectedOccurrence != nil {
		return a.selectedOccurrence.ID == event.ExtendedProps.TaskID &&
			a.selectedOccurrence.InstanceID != "" &&
			a.selectedOccurrence.InstanceID == event.ExtendedProps.InstanceID
	}
	return a.editing && a.draft.Task.ID != 0 && a.draft.Task.ID == event.ExtendedProps.TaskID
}
