package service

import (
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"todo-app/internal/models"
)

var ErrCalendarPrecondition = errors.New("calendar object precondition failed")

type parsedCalendarResource struct {
	Master     *parsedICalendarObject
	Exceptions []*parsedICalendarObject
}

// A PUT replaces one complete resource: one master and detached instances with
// the same UID. Validate the entire document before entering the write path.
func parseICalendarResource(data []byte, loc *time.Location) (*parsedCalendarResource, error) {
	if loc == nil {
		loc = time.UTC
	}
	if len(data) > 4<<20 {
		return nil, errors.New("calendar object exceeds 4 MB")
	}
	stack := []string{}
	calendars := 0
	for _, line := range unfoldICalLines(string(data)) {
		upper := strings.ToUpper(strings.TrimSpace(line))
		if strings.HasPrefix(upper, "BEGIN:") {
			name := strings.TrimPrefix(upper, "BEGIN:")
			if len(stack) == 0 {
				if name != "VCALENDAR" || calendars != 0 {
					return nil, errors.New("one VCALENDAR is required")
				}
				calendars++
			} else if len(stack) == 1 && name != "VEVENT" && name != "VTODO" && name != "VTIMEZONE" {
				return nil, errors.New("unsupported calendar component")
			} else if len(stack) > 1 {
				parent := stack[len(stack)-1]
				if !((parent == "VEVENT" || parent == "VTODO") && name == "VALARM") && !(parent == "VTIMEZONE" && (name == "STANDARD" || name == "DAYLIGHT")) {
					return nil, errors.New("unsupported nested calendar component")
				}
			}
			stack = append(stack, name)
		} else if strings.HasPrefix(upper, "END:") {
			if len(stack) == 0 || stack[len(stack)-1] != strings.TrimPrefix(upper, "END:") {
				return nil, errors.New("unbalanced calendar component")
			}
			stack = stack[:len(stack)-1]
		} else if len(stack) == 0 {
			return nil, errors.New("calendar data outside VCALENDAR")
		}
	}
	if calendars != 1 || len(stack) != 0 {
		return nil, errors.New("incomplete VCALENDAR")
	}
	resource := &parsedCalendarResource{}
	for _, component := range extractCalendarComponents(string(data)) {
		if strings.HasPrefix(strings.ToUpper(component), "BEGIN:VTIMEZONE") {
			continue
		}
		event, err := parseICalendarComponent([]byte(component), loc)
		if err != nil {
			return nil, err
		}
		for _, name := range []string{"UID", "SUMMARY", "DESCRIPTION", "DTSTART", "DTEND", "DUE", "DURATION", "STATUS", "RRULE", "RECURRENCE-ID", "X-TODO-STATUS", "X-TODO-LUNAR-RULE"} {
			if len(event.Properties[name]) > 1 {
				return nil, fmt.Errorf("duplicate %s", name)
			}
		}
		if len(event.Properties["RDATE"]) > 0 {
			if !isLunarYearlyRule(event.RecurrenceRule) || event.Component != "VEVENT" || event.Properties["RECURRENCE-ID"] != nil {
				return nil, errors.New("RDATE writes require Todo lunar metadata on the master")
			}
			if err := validateLunarRDates(event.Properties["RDATE"], event.AllDay, loc); err != nil {
				return nil, err
			}
		}
		if utf8.RuneCountInString(event.Summary) > 200 || len(event.UID) > 255 {
			return nil, errors.New("calendar title or UID is too long")
		}
		if err := validateCalendarRRule(firstICalValue(event.Properties, "RRULE"), loc); err != nil {
			return nil, err
		}
		if identity := firstICalProp(event.Properties, "RECURRENCE-ID"); identity != nil {
			if identity.Params["RANGE"] != "" {
				return nil, errors.New("RECURRENCE-ID RANGE is not supported")
			}
			if event.Component != "VEVENT" || event.RecurrenceRule != nil || len(event.Properties["EXDATE"]) > 0 {
				return nil, errors.New("invalid detached VEVENT")
			}
			resource.Exceptions = append(resource.Exceptions, event)
		} else {
			if resource.Master != nil {
				return nil, errors.New("calendar resource must contain a single master")
			}
			resource.Master = event
		}
	}
	master := resource.Master
	if master == nil {
		return nil, errors.New("calendar resource requires a master")
	}
	exclusionLoc := loc
	if master.RecurrenceRule != nil && strings.TrimSpace(master.RecurrenceRule.Timezone) != "" {
		exclusionLoc = loadLocationOrUTC(master.RecurrenceRule.Timezone)
	}
	if err := materializeCalendarExRules(master, exclusionLoc); err != nil {
		return nil, err
	}
	for _, event := range resource.Exceptions {
		if len(event.Properties["EXRULE"]) > 0 {
			return nil, errors.New("EXRULE is only supported on the recurring master")
		}
	}
	if isLunarYearlyRule(master.RecurrenceRule) {
		if err := validateLunarRDateSet(master, loc); err != nil {
			return nil, err
		}
	}
	if master.Component == "VEVENT" && master.StartTime == nil {
		return nil, errors.New("master VEVENT requires DTSTART")
	}
	if master.RecurrenceRule != nil {
		if master.Component != "VEVENT" || master.StartTime == nil {
			return nil, errors.New("recurrence requires a VEVENT with DTSTART")
		}
		if start := firstICalProp(master.Properties, "DTSTART"); start != nil && !master.AllDay {
			zone := strings.TrimSpace(start.Params["TZID"])
			if zone != "" {
				if _, err := time.LoadLocation(zone); err != nil {
					return nil, fmt.Errorf("unsupported recurring timezone %q", zone)
				}
			}
		}
	}
	if (len(resource.Exceptions) > 0 || len(master.Properties["EXDATE"]) > 0) && (master.Component != "VEVENT" || master.RecurrenceRule == nil || master.StartTime == nil) {
		return nil, errors.New("exceptions require a recurring VEVENT master")
	}
	if len(resource.Exceptions) > 1024 {
		return nil, errors.New("too many detached instances")
	}
	for _, event := range resource.Exceptions {
		if master.UID == "" || event.UID != master.UID {
			return nil, errors.New("detached instance UID must match master")
		}
	}
	return resource, nil
}

// materializeCalendarExRules converts bounded EXRULE values into EXDATEs.
// Todo stores recurrence exclusions as occurrence rows, so this preserves the
// exact excluded instances without adding a second recurrence expression to
// the task model. Unbounded EXRULEs are rejected instead of silently truncating
// them to the export window.
func materializeCalendarExRules(master *parsedICalendarObject, loc *time.Location) error {
	if master == nil || len(master.Properties["EXRULE"]) == 0 {
		return nil
	}
	if master.Component != "VEVENT" || master.StartTime == nil || master.RecurrenceRule == nil || isLunarYearlyRule(master.RecurrenceRule) {
		return errors.New("EXRULE requires a recurring Gregorian VEVENT master")
	}
	if loc == nil {
		loc = time.UTC
	}
	existing := make(map[string]struct{})
	for _, property := range master.Properties["EXDATE"] {
		for _, raw := range strings.Split(property.Value, ",") {
			copy := property
			copy.Value = strings.TrimSpace(raw)
			value, _, err := parseICalTime(&copy, loc)
			if err == nil && value != nil {
				existing[calendarExclusionKey(*value, master.AllDay, loc)] = struct{}{}
			}
		}
	}
	for _, eventRule := range master.Properties["EXRULE"] {
		raw := strings.TrimSpace(eventRule.Value)
		if err := validateCalendarRRule(raw, loc); err != nil {
			return fmt.Errorf("invalid EXRULE: %w", err)
		}
		exRule, exUntil := parseICalRRule(raw, loc)
		if exRule == nil {
			return errors.New("invalid EXRULE")
		}
		if exUntil == nil && exRule.Count <= 0 {
			if zone := strings.TrimSpace(eventRule.Params["TZID"]); zone != "" {
				if _, err := time.LoadLocation(zone); err != nil {
					return fmt.Errorf("unsupported EXRULE timezone %q", zone)
				}
				exRule.Timezone = zone
			}
			master.RecurrenceRule.ExRules = append(master.RecurrenceRule.ExRules, *exRule)
			continue
		}
		if exRule.Count > 1024 {
			return errors.New("EXRULE produces too many exclusions")
		}
		rangeStart := master.StartTime.Add(-time.Second)
		rangeEnd, rangeErr := calendarExRuleRangeEnd(*master.StartTime, exRule, exUntil, master.AllDay, loc)
		if rangeErr != nil {
			return rangeErr
		}
		if !rangeEnd.After(rangeStart) {
			continue
		}
		base := buildGregorianOccurrenceStarts(*master.StartTime, master.RecurrenceEndDate, master.RecurrenceRule, rangeStart, rangeEnd, loc.String())
		if len(base) == 0 {
			continue
		}
		baseByKey := make(map[string]time.Time, len(base))
		for _, value := range base {
			baseByKey[calendarExclusionKey(value, master.AllDay, loc)] = value
		}
		excluded := buildGregorianOccurrenceStarts(*master.StartTime, exUntil, exRule, rangeStart, rangeEnd, loc.String())
		values := make([]time.Time, 0, len(excluded))
		seen := make(map[string]struct{}, len(excluded))
		for _, value := range excluded {
			key := calendarExclusionKey(value, master.AllDay, loc)
			if _, alreadyExcluded := existing[key]; alreadyExcluded {
				continue
			}
			canonical, ok := baseByKey[key]
			if !ok {
				continue
			}
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			existing[key] = struct{}{}
			values = append(values, canonical)
		}
		if len(values) == 0 {
			continue
		}
		property := icalProp{Name: "EXDATE", Params: map[string]string{}}
		formatted := make([]string, 0, len(values))
		if master.AllDay {
			property.Params["VALUE"] = "DATE"
			for _, value := range values {
				formatted = append(formatted, value.In(loc).Format("20060102"))
			}
		} else if loc != time.UTC {
			property.Params["TZID"] = loc.String()
			for _, value := range values {
				formatted = append(formatted, value.In(loc).Format("20060102T150405"))
			}
		} else {
			for _, value := range values {
				formatted = append(formatted, value.UTC().Format("20060102T150405Z"))
			}
		}
		property.Value = strings.Join(formatted, ",")
		master.Properties["EXDATE"] = append(master.Properties["EXDATE"], property)
	}
	delete(master.Properties, "EXRULE")
	return nil
}

func calendarExRuleRangeEnd(anchor time.Time, rule *models.RecurrenceRule, until *time.Time, allDay bool, loc *time.Location) (time.Time, error) {
	if until != nil {
		if allDay {
			return until.In(loc).AddDate(0, 0, 1).UTC(), nil
		}
		return until.UTC().Add(time.Second), nil
	}
	count := rule.Count
	interval := rule.Interval
	if interval < 1 {
		interval = 1
	}
	if count < 1 {
		return anchor, nil
	}
	if interval > 100000 {
		return time.Time{}, errors.New("EXRULE interval is too large")
	}
	switch strings.ToLower(rule.Freq) {
	case "daily":
		return anchor.AddDate(0, 0, (count+1)*interval+1), nil
	case "weekly":
		return anchor.AddDate(0, 0, ((count+1)*interval+1)*7), nil
	case "monthly":
		return anchor.AddDate(0, (count+1)*interval+1, 0), nil
	case "yearly":
		return anchor.AddDate((count+1)*interval+1, 0, 0), nil
	default:
		return anchor, nil
	}
}

func calendarExclusionKey(value time.Time, allDay bool, loc *time.Location) string {
	if allDay {
		return value.In(loc).Format("2006-01-02")
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func validateLunarRDateSet(master *parsedICalendarObject, loc *time.Location) error {
	if master == nil || master.StartTime == nil || !isLunarYearlyRule(master.RecurrenceRule) {
		return errors.New("lunar metadata requires a recurring DTSTART")
	}
	if loc == nil {
		loc = time.UTC
	}
	values := make(map[string]struct{})
	for _, property := range master.Properties["RDATE"] {
		for _, raw := range strings.Split(property.Value, ",") {
			copy := property
			copy.Value = strings.TrimSpace(raw)
			parsed, _, err := parseICalTime(&copy, loc)
			if err != nil || parsed == nil {
				return errors.New("invalid lunar RDATE")
			}
			key := parsed.UTC().Format(time.RFC3339Nano)
			if master.AllDay {
				key = parsed.In(loc).Format("2006-01-02")
			}
			if _, exists := values[key]; exists {
				return errors.New("duplicate lunar RDATE")
			}
			values[key] = struct{}{}
		}
	}
	task := &models.Task{StartTime: master.StartTime, AllDay: master.AllDay, RecurrenceRule: master.RecurrenceRule, RecurrenceEndDate: master.RecurrenceEndDate}
	expected := lunarCalendarRDates(task, &models.User{Timezone: loc.String()})
	if len(values) != len(expected) {
		return errors.New("lunar RDATE set does not match Todo recurrence")
	}
	for _, value := range expected {
		key := value.UTC().Format(time.RFC3339Nano)
		if master.AllDay {
			key = value.In(loc).Format("2006-01-02")
		}
		if _, ok := values[key]; !ok {
			return errors.New("lunar RDATE set does not match Todo recurrence")
		}
	}
	return nil
}

func validateLunarRDates(properties []icalProp, allDay bool, loc *time.Location) error {
	count := 0
	for _, property := range properties {
		if strings.TrimSpace(property.Value) == "" {
			return errors.New("lunar RDATE cannot be empty")
		}
		for _, raw := range strings.Split(property.Value, ",") {
			raw = strings.TrimSpace(raw)
			if raw == "" {
				return errors.New("lunar RDATE contains an empty value")
			}
			valueType := strings.ToUpper(property.Params["VALUE"])
			if allDay && valueType != "DATE" {
				return errors.New("lunar all-day RDATE must use VALUE=DATE")
			}
			if !allDay && valueType == "DATE" {
				return errors.New("lunar timed RDATE cannot use VALUE=DATE")
			}
			copy := property
			copy.Value = raw
			if _, _, err := parseICalTime(&copy, loc); err != nil {
				return errors.New("invalid lunar RDATE")
			}
			count++
			if count > 1024 {
				return errors.New("too many lunar RDATE values")
			}
		}
	}
	return nil
}

func validateCalendarRRule(raw string, loc *time.Location) error {
	if raw == "" {
		return nil
	}
	seen := map[string]bool{}
	for _, part := range strings.Split(raw, ";") {
		key, value, ok := strings.Cut(strings.ToUpper(strings.TrimSpace(part)), "=")
		if !ok || seen[key] || value == "" {
			return errors.New("invalid RRULE")
		}
		seen[key] = true
		switch key {
		case "FREQ":
			if value != "DAILY" && value != "WEEKLY" && value != "MONTHLY" && value != "YEARLY" {
				return errors.New("unsupported RRULE frequency")
			}
		case "INTERVAL", "COUNT":
			if n, err := strconv.Atoi(value); err != nil || n < 1 {
				return errors.New("invalid RRULE number")
			}
		case "BYMONTH", "BYMONTHDAY":
			limit := 31
			if key == "BYMONTH" {
				limit = 12
			}
			for _, v := range strings.Split(value, ",") {
				if n, err := strconv.Atoi(v); err != nil || n < 1 || n > limit {
					return errors.New("unsupported RRULE date")
				}
			}
		case "BYDAY":
			for _, v := range strings.Split(value, ",") {
				if len(v) < 2 || !strings.Contains("|MO|TU|WE|TH|FR|SA|SU|", "|"+v[len(v)-2:]+"|") {
					return errors.New("invalid RRULE weekday")
				}
				if len(v) > 2 {
					if n, err := strconv.Atoi(v[:len(v)-2]); err != nil || n == 0 || n < -5 || n > 5 {
						return errors.New("invalid RRULE weekday ordinal")
					}
				}
			}
		case "UNTIL":
			if _, _, err := parseICalTime(&icalProp{Value: value}, loc); err != nil {
				return errors.New("invalid RRULE UNTIL")
			}
		case "WKST":
			// The recurrence engine currently uses Monday as its week start.
			if value != "MO" {
				return errors.New("only WKST=MO is supported")
			}
		default:
			return fmt.Errorf("unsupported RRULE property %s", key)
		}
	}
	if !seen["FREQ"] {
		return errors.New("RRULE FREQ is required")
	}
	return nil
}

// Preconditions, master edits, instance replacement, activity and reminder
// scheduling share the per-user task transaction. Notify readers after commit.
func (s *CalendarExportService) UpsertObjectConditional(userID int64, objectName string, data []byte, ifMatch, ifNoneMatch string) (*CalendarObject, bool, error) {
	resource, err := parseICalendarResource(data, s.userLocation(userID))
	if err != nil {
		return nil, false, err
	}
	parsed := resource.Master
	objectName = normalizeCalendarObjectName(objectName)
	if parsed.UID == "" {
		parsed.UID = strings.TrimSuffix(objectName, ".ics")
	}
	if strings.TrimSpace(parsed.Summary) == "" {
		parsed.Summary = "Untitled"
	}
	var object *CalendarObject
	created := false
	err = s.taskSvc.withTaskTransaction(userID, func(tasks *TaskService) error {
		scoped := *s
		scoped.taskSvc, scoped.userRepo = tasks, tasks.userRepo
		if ifMatch != "" || ifNoneMatch != "" {
			current, err := scoped.GetObject(userID, objectName)
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			exists := err == nil && current != nil
			if ifMatch != "" && (!exists || !calendarETagMatches(ifMatch, current.ETag, false)) {
				return ErrCalendarPrecondition
			}
			if exists && ifNoneMatch != "" && calendarETagMatches(ifNoneMatch, current.ETag, true) {
				return ErrCalendarPrecondition
			}
		}
		task, err := scoped.findTaskByObjectName(userID, objectName, parsed.UID)
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if _, err := scoped.findExternalTaskByObjectName(userID, objectName); err == nil {
				return errors.New("calendar object is read-only")
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			task, err = scoped.createTaskFromICalendar(userID, parsed)
			created = true
		} else {
			if taskCalDAVHref(task) != objectName {
				return errors.New("calendar UID already belongs to a different resource")
			}
			if taskCalDAVUID(task) != parsed.UID {
				return errors.New("calendar resource UID cannot change")
			}
			// Calendar confirmation cannot erase Todo completion or skipped state.
			preserveCalendarTaskStatus(parsed, task.Status)
			task, err = scoped.updateTaskFromICalendar(userID, task, parsed)
		}
		if err != nil {
			return err
		}
		if task.CalDAVUID != parsed.UID || task.CalDAVHref != objectName {
			task.CalDAVUID, task.CalDAVHref = parsed.UID, objectName
			if err := tasks.taskRepo.Update(task); err != nil {
				return err
			}
		}
		if err := scoped.replaceCalendarInstances(task, resource); err != nil {
			return err
		}
		if err := tasks.syncTaskReminder(userID, task); err != nil {
			return err
		}
		object, err = scoped.taskToObject(task)
		return err
	})
	if err != nil {
		return nil, false, err
	}
	s.taskSvc.notifyTaskChanged(userID)
	return object, created, nil
}

func calendarETagMatches(header, tag string, weak bool) bool {
	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" {
			return true
		}
		if weak {
			candidate = strings.TrimPrefix(candidate, "W/")
		}
		if candidate == tag {
			return true
		}
	}
	return false
}

func preserveCalendarTaskStatus(parsed *parsedICalendarObject, status models.TaskStatus) {
	if firstICalValue(parsed.Properties, "X-TODO-STATUS") != "" {
		return
	}
	if parsed.Component == "VEVENT" && parsed.Status == models.TaskStatusPending && status == models.TaskStatusCompleted {
		parsed.Status = status
	}
	if parsed.Status == models.TaskStatusCancelled && status == models.TaskStatusSkipped {
		parsed.Status = status
	}
}

func calendarIdentityDate(task *models.Task, identity *icalProp, loc *time.Location) (time.Time, error) {
	start, dateOnly, err := parseICalTime(identity, loc)
	if err != nil || start == nil {
		return time.Time{}, errors.New("invalid RECURRENCE-ID or EXDATE")
	}
	if dateOnly != task.AllDay {
		return time.Time{}, errors.New("recurrence identity value type differs from master")
	}
	local := start.In(loc)
	date := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
	if task.RecurrenceRule == nil || !validOccurrenceDate(task, date, loc.String()) {
		return time.Time{}, errors.New("recurrence identity is outside the series")
	}
	baseStart, _ := deriveOccurrenceRangeFromTask(task, date, loc.String())
	if !dateOnly && (baseStart == nil || !baseStart.Equal(*start)) {
		return time.Time{}, errors.New("recurrence identity must name the original time slot")
	}
	return date, nil
}

func (s *CalendarExportService) replaceCalendarInstances(task *models.Task, resource *parsedCalendarResource) error {
	previous, err := s.taskSvc.taskRepo.ListTaskOccurrences(task.UserID, task.ID)
	if err != nil {
		return err
	}
	old := map[string]models.TaskOccurrence{}
	for _, row := range previous {
		old[row.OccurrenceDate.Format("2006-01-02")] = row
	}
	loc := s.userLocation(task.UserID)
	rows := map[string]models.TaskOccurrence{}
	add := func(event *parsedICalendarObject, identity *icalProp) error {
		date, err := calendarIdentityDate(task, identity, loc)
		if err != nil {
			return err
		}
		key := date.Format("2006-01-02")
		if _, exists := rows[key]; exists {
			return errors.New("duplicate recurrence identity")
		}
		baseStart, baseEnd := deriveOccurrenceRangeFromTask(task, date, loc.String())
		row := models.TaskOccurrence{UserID: task.UserID, TaskID: task.ID, OccurrenceDate: date, InstanceID: buildOccurrenceInstanceID(task.ID, date), StartTime: baseStart, EndTime: baseEnd, AllDay: task.AllDay, Status: task.Status}
		if before, ok := old[key]; ok {
			row.ID, row.CreatedAt, row.Status = before.ID, before.CreatedAt, before.Status
			row.CompletedAt, row.DeletedAt = before.CompletedAt, before.DeletedAt
			row.Title = before.Title
			preserveCalendarTaskStatus(event, before.Status)
		}
		row.Status, row.CompletedAt, row.DeletedAt, _ = statusTimestampTransition(row.Status, row.CompletedAt, row.DeletedAt, event.Status, time.Now().UTC())
		row.Description = event.Description
		if _, hasSummary := event.Properties["SUMMARY"]; hasSummary {
			title := strings.TrimSpace(event.Summary)
			// Detached exports include the effective series SUMMARY even when
			// the occurrence inherits its title. Do not turn that roundtrip
			// into an override, but retain any existing explicit title (even
			// one equal to the master).
			if title != task.Title || row.Title != "" {
				row.Title = title
			}
		}
		if event.StartTime == nil {
			if event.Status != models.TaskStatusCancelled && event.Status != models.TaskStatusSkipped {
				return errors.New("detached DTSTART is required")
			}
		} else {
			row.StartTime, row.EndTime, row.AllDay = event.StartTime, event.EndTime, event.AllDay
			// An implicit single-day end is equivalent to the exported DTEND.
			if row.AllDay && row.EndTime != nil && baseEnd == nil && row.EndTime.Equal(row.StartTime.In(loc).AddDate(0, 0, 1)) {
				row.EndTime = nil
			}
		}
		if err := validateTaskTimeRange(row.StartTime, row.EndTime); err != nil {
			return err
		}
		row.ScheduleOverride = row.AllDay != task.AllDay || !sameCalendarTime(row.StartTime, baseStart) || !sameCalendarTime(row.EndTime, baseEnd)
		rows[key] = row
		return nil
	}
	for _, event := range resource.Exceptions {
		if err := add(event, firstICalProp(event.Properties, "RECURRENCE-ID")); err != nil {
			return err
		}
	}
	for _, exclusion := range resource.Master.Properties["EXDATE"] {
		for _, value := range strings.Split(exclusion.Value, ",") {
			identity := exclusion
			identity.Value = value
			if len(rows) >= 1024 {
				return errors.New("too many excluded instances")
			}
			if err := add(&parsedICalendarObject{Component: "VEVENT", Status: models.TaskStatusCancelled}, &identity); err != nil {
				return err
			}
		}
	}
	// Calendar clients cannot represent Todo completion history. Keep completed
	// rows even when they omit them; explicit X-TODO-STATUS:pending can reopen.
	for key, before := range old {
		if _, exists := rows[key]; !exists && before.Status == models.TaskStatusCompleted && validOccurrenceDate(task, before.OccurrenceDate, loc.String()) {
			start, end := deriveOccurrenceRangeFromTask(task, before.OccurrenceDate, loc.String())
			before.StartTime, before.EndTime, before.AllDay = start, end, task.AllDay
			before.ScheduleOverride, before.Description = false, ""
			rows[key] = before
		}
	}
	changes := models.TaskActivityChanges{}
	for key, row := range rows {
		before, existed := old[key]
		if existed && sameCalendarOccurrence(before, row) {
			delete(old, key)
			continue
		}
		start, end := deriveOccurrenceRangeFromTask(task, row.OccurrenceDate, loc.String())
		if taskOccurrenceMatchesSeriesDefault(&row, task, start, end) {
			if err := s.taskSvc.taskRepo.DeleteTaskOccurrence(task.UserID, task.ID, row.OccurrenceDate); err != nil {
				return err
			}
		} else if err := s.taskSvc.taskRepo.UpsertTaskOccurrence(&row); err != nil {
			return err
		}
		appendActivityFieldChange(changes, "caldav_occurrence:"+key, calendarOccurrenceValue(before, existed), calendarOccurrenceValue(row, true))
		delete(old, key)
	}
	for key, before := range old {
		if err := s.taskSvc.taskRepo.DeleteTaskOccurrence(task.UserID, task.ID, before.OccurrenceDate); err != nil {
			return err
		}
		appendActivityFieldChange(changes, "caldav_occurrence:"+key, calendarOccurrenceValue(before, true), nil)
	}
	if len(changes) > 0 && s.taskSvc.taskActivityRepo != nil {
		return s.taskSvc.taskActivityRepo.RecordWithMerge(task.UserID, task.ID, time.Now().UTC(), "caldav", changes, taskActivityMergeWindow)
	}
	return nil
}

func calendarOccurrenceValue(row models.TaskOccurrence, exists bool) any {
	if !exists {
		return nil
	}
	return map[string]any{"title": row.Title, "status": row.Status, "description": row.Description, "start_time": normalizeActivityTime(row.StartTime), "end_time": normalizeActivityTime(row.EndTime), "all_day": row.AllDay, "schedule_override": row.ScheduleOverride}
}

func sameCalendarOccurrence(a, b models.TaskOccurrence) bool {
	return reflect.DeepEqual(calendarOccurrenceValue(a, true), calendarOccurrenceValue(b, true)) && sameCalendarTime(a.CompletedAt, b.CompletedAt) && sameCalendarTime(a.DeletedAt, b.DeletedAt)
}

func sameCalendarTime(a, b *time.Time) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && a.Equal(*b))
}
