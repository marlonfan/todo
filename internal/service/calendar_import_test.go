package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"gorm.io/gorm"
	"todo-app/internal/models"
)

func importCalendarDocument(events ...string) []byte {
	return []byte("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + strings.Join(events, "\r\n") + "\r\nEND:VCALENDAR\r\n")
}

func importCalendarEvent(uid, properties string) string {
	return "BEGIN:VEVENT\r\nUID:" + uid + "\r\n" + strings.ReplaceAll(properties, "\n", "\r\n") + "\r\nEND:VEVENT"
}

func TestCalendarImportDSTDetachedRoundtripReplacementAndCompletion(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	user, _ := s.userRepo.GetByID(userID)
	user.Timezone = "America/New_York"
	if err := s.userRepo.Update(user); err != nil {
		t.Fatal(err)
	}
	export := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("dst-import@example", "SUMMARY:系列\nDESCRIPTION:系列说明\nDTSTART;TZID=America/New_York:20260307T090000\nDTEND;TZID=America/New_York:20260307T100000\nRRULE:FREQ=DAILY;COUNT=4")
	initial, created, err := export.UpsertObject(userID, "dst-import.ics", importCalendarDocument(master))
	if err != nil || !created {
		t.Fatal(created, err)
	}
	completedDate := time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC)
	completedAt := completedDate.Add(15 * time.Hour)
	if err := repo.UpsertTaskOccurrence(&models.TaskOccurrence{UserID: userID, TaskID: initial.Task.ID, OccurrenceDate: completedDate, Status: models.TaskStatusCompleted, CompletedAt: &completedAt}); err != nil {
		t.Fatal(err)
	}
	moved := importCalendarEvent(initial.UID, "SUMMARY:系列\nRECURRENCE-ID;TZID=America/New_York:20260308T090000\nDTSTART;VALUE=DATE:20260320\nDTEND;VALUE=DATE:20260322\nDESCRIPTION:仅本次\\n第二行\nSTATUS:CONFIRMED")
	cancelled := importCalendarEvent(initial.UID, "RECURRENCE-ID:20260309T130000Z\nSTATUS:CANCELLED")
	object, created, err := export.UpsertObject(userID, initial.Href, importCalendarDocument(moved, master, cancelled))
	if err != nil || created {
		t.Fatal(created, err)
	}
	rows, err := repo.ListTaskOccurrences(userID, initial.Task.ID)
	if err != nil || len(rows) != 3 {
		t.Fatal(rows, err)
	}
	if !rows[0].ScheduleOverride || !rows[0].AllDay || rows[0].Description != "仅本次\n第二行" || rows[0].StartTime.In(loadLocationOrUTC(user.Timezone)).Format("2006-01-02") != "2026-03-20" {
		t.Fatal(rows[0])
	}
	if rows[1].Status != models.TaskStatusCancelled || rows[1].DeletedAt == nil || rows[2].Status != models.TaskStatusCompleted || !rows[2].CompletedAt.Equal(completedAt) {
		t.Fatal(rows)
	}
	if object.Task.Title != "系列" || object.Task.Description != "系列说明" || object.Task.StartTime.In(loadLocationOrUTC(user.Timezone)).Hour() != 9 || object.Task.Status != models.TaskStatusPending {
		t.Fatal(object.Task)
	}
	for _, want := range []string{"RECURRENCE-ID;TZID=America/New_York:20260308T090000", "DTEND;VALUE=DATE:20260322", "X-TODO-STATUS:completed"} {
		if !strings.Contains(object.Data, want) {
			t.Fatal("missing", want, object.Data)
		}
	}
	if roundtrip, _, err := export.UpsertObject(userID, object.Href, []byte(object.Data)); err != nil || strings.Count(roundtrip.Data, "RECURRENCE-ID") != 3 {
		t.Fatal(roundtrip, err)
	}
	reset, _, err := export.UpsertObject(userID, object.Href, importCalendarDocument(master))
	rows, _ = repo.ListTaskOccurrences(userID, initial.Task.ID)
	if err != nil || len(rows) != 1 || rows[0].Status != models.TaskStatusCompleted || rows[0].ScheduleOverride || strings.Contains(reset.Data, "20260320") {
		t.Fatal(rows, err)
	}
	// Explicitly restore completion when requested through the Todo extension.
	reopen := importCalendarEvent(initial.UID, "RECURRENCE-ID;TZID=America/New_York:20260310T090000\nDTSTART;TZID=America/New_York:20260310T090000\nDTEND;TZID=America/New_York:20260310T100000\nSTATUS:CONFIRMED\nX-TODO-STATUS:pending")
	if _, _, err := export.UpsertObject(userID, object.Href, importCalendarDocument(master, reopen)); err != nil {
		t.Fatal(err)
	}
	rows, _ = repo.ListTaskOccurrences(userID, initial.Task.ID)
	if len(rows) != 0 {
		t.Fatal("reopen did not restore default occurrence", rows)
	}
}

func TestCalendarImportAllDayEXDATEConditionalWriteAndTimedOverride(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("all-day@example", "SUMMARY:系列\nDTSTART;VALUE=DATE:20260620\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE;VALUE=DATE:20260621,20260622")
	detached := importCalendarEvent("all-day@example", "RECURRENCE-ID;VALUE=DATE:20260620\nDTSTART:20260602T110000Z\nDTEND:20260602T120000Z")
	data := importCalendarDocument(master, detached)
	object, created, err := export.UpsertObjectConditional(userID, "all-day.ics", data, "", "*")
	if err != nil || !created {
		t.Fatal(created, err)
	}
	if _, _, err := export.UpsertObjectConditional(userID, "duplicate-uid.ics", data, "", "*"); err == nil {
		t.Fatal("create-only request renamed another resource with the same UID")
	}
	rows, _ := repo.ListTaskOccurrences(userID, object.Task.ID)
	if len(rows) != 3 || !rows[0].ScheduleOverride || rows[0].AllDay || rows[1].Status != models.TaskStatusCancelled || rows[2].Status != models.TaskStatusCancelled {
		t.Fatal(rows)
	}
	for _, condition := range []struct{ match, none string }{{"", "*"}, {"\"stale\"", ""}, {"W/" + object.ETag, ""}, {"", "W/" + object.ETag}} {
		if _, _, err := export.UpsertObjectConditional(userID, object.Href, data, condition.match, condition.none); !errors.Is(err, ErrCalendarPrecondition) {
			t.Fatal(condition, err)
		}
	}
	updated, created, err := export.UpsertObjectConditional(userID, object.Href, data, "\"old\", "+object.ETag, "")
	if err != nil || created || updated.ETag == object.ETag {
		t.Fatal(created, err)
	}
	if _, _, err := export.UpsertObjectConditional(userID, object.Href, data, "*", ""); err != nil {
		t.Fatal(err)
	}
}

func TestCalendarImportDurationMasterDetachedAndAllDayDST(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	user, _ := s.userRepo.GetByID(userID)
	user.Timezone = "America/New_York"
	if err := s.userRepo.Update(user); err != nil {
		t.Fatal(err)
	}
	export := NewCalendarExportService(s, s.userRepo, "test")

	master := importCalendarEvent("duration@example", "SUMMARY:有时长的系列\nDTSTART;TZID=America/New_York:20260307T090000\nDURATION:PT1H30M\nRRULE:FREQ=DAILY;COUNT=3")
	object, created, err := export.UpsertObject(userID, "duration.ics", importCalendarDocument(master))
	if err != nil || !created || object.Task.EndTime == nil || object.Task.EndTime.Sub(*object.Task.StartTime) != 90*time.Minute {
		t.Fatal(created, err, object.Task)
	}
	if !strings.Contains(object.Data, "DTEND;TZID=America/New_York:20260307T103000") {
		t.Fatal("timed DURATION was not exported as DTEND", object.Data)
	}
	detached := importCalendarEvent(object.UID, "RECURRENCE-ID;TZID=America/New_York:20260308T090000\nDTSTART;TZID=America/New_York:20260308T110000\nDURATION:PT90M")
	updated, _, err := export.UpsertObject(userID, object.Href, importCalendarDocument(master, detached))
	if err != nil {
		t.Fatal(err)
	}
	rows, err := repo.ListTaskOccurrences(userID, object.Task.ID)
	if err != nil || len(rows) != 1 || !rows[0].ScheduleOverride || rows[0].EndTime == nil || rows[0].EndTime.Sub(*rows[0].StartTime) != 90*time.Minute {
		t.Fatal(rows, err)
	}
	// Export is intentionally normalized to DTEND; the detached end retains
	// the 90-minute span after a DURATION import.
	if !strings.Contains(updated.Data, "20260308T163000Z") {
		t.Fatal("detached DURATION was not exported as DTEND", updated.Data)
	}

	allDay := importCalendarEvent("all-day-duration@example", "SUMMARY:跨夏令时\nDTSTART;VALUE=DATE:20260307\nDURATION:P2D\nRRULE:FREQ=DAILY;COUNT=2")
	allDayObject, _, err := export.UpsertObject(userID, "all-day-duration.ics", importCalendarDocument(allDay))
	if err != nil || allDayObject.Task.EndTime == nil {
		t.Fatal(err, allDayObject)
	}
	loc := loadLocationOrUTC(user.Timezone)
	if got := allDayObject.Task.EndTime.In(loc).Format("2006-01-02"); got != "2026-03-09" {
		t.Fatalf("all-day DURATION ended on %s, want 2026-03-09", got)
	}
	if !strings.Contains(allDayObject.Data, "DTEND;VALUE=DATE:20260309") {
		t.Fatal("all-day DURATION was not exported as exclusive DTEND", allDayObject.Data)
	}
	occurrenceStart, occurrenceEnd := deriveOccurrenceRangeFromTask(allDayObject.Task, time.Date(2026, 3, 8, 0, 0, 0, 0, time.UTC), user.Timezone)
	if occurrenceStart == nil || occurrenceEnd == nil || occurrenceEnd.In(loc).Format("2006-01-02") != "2026-03-10" {
		t.Fatal(occurrenceStart, occurrenceEnd)
	}
}

func TestCalendarImportBoundedEXRuleMaterializesExdates(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("exrule@example", "SUMMARY:排除规则系列\nDTSTART:20260620T090000Z\nDTEND:20260620T100000Z\nRRULE:FREQ=DAILY;COUNT=5\nEXRULE:FREQ=DAILY;COUNT=2")
	object, created, err := export.UpsertObject(userID, "exrule.ics", importCalendarDocument(master))
	if err != nil || !created {
		t.Fatal(created, err)
	}
	rows, err := repo.ListTaskOccurrences(userID, object.Task.ID)
	if err != nil || len(rows) != 2 {
		t.Fatal(rows, err)
	}
	for i, row := range rows {
		wantDate := time.Date(2026, 6, 20+i, 0, 0, 0, 0, time.UTC)
		if !row.OccurrenceDate.Equal(wantDate) || row.Status != models.TaskStatusCancelled || row.DeletedAt == nil {
			t.Fatalf("row %d = %+v", i, row)
		}
	}
	if strings.Contains(object.Data, "EXRULE:") || !strings.Contains(object.Data, "RECURRENCE-ID:20260620T090000Z") {
		t.Fatal("bounded EXRULE was not normalized to detached exclusions", object.Data)
	}
	if _, _, err := export.UpsertObject(userID, object.Href, []byte(object.Data)); err != nil {
		t.Fatal("normalized EXRULE object could not roundtrip:", err)
	}

	allDay := importCalendarEvent("exrule-all-day@example", "SUMMARY:全天排除\nDTSTART;VALUE=DATE:20260620\nRRULE:FREQ=DAILY;COUNT=4\nEXRULE:FREQ=DAILY;UNTIL=20260621")
	allDayObject, _, err := export.UpsertObject(userID, "exrule-all-day.ics", importCalendarDocument(allDay))
	if err != nil {
		t.Fatal(err)
	}
	allDayRows, err := repo.ListTaskOccurrences(userID, allDayObject.Task.ID)
	if err != nil || len(allDayRows) != 2 {
		t.Fatal(allDayRows, err)
	}

	for name, data := range map[string][]byte{
		"detached EXRULE": importCalendarDocument(master, importCalendarEvent("exrule@example", "RECURRENCE-ID:20260622T090000Z\nDTSTART:20260622T110000Z\nEXRULE:FREQ=DAILY;COUNT=1")),
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := export.UpsertObject(userID, name+".ics", data); err == nil {
				t.Fatal("invalid EXRULE accepted")
			}
		})
	}
}

func TestCalendarImportUnboundedEXRulePreservesPattern(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("unbounded-exrule@example", "SUMMARY:周末排除\nDTSTART:20260620T090000Z\nDTEND:20260620T100000Z\nRRULE:FREQ=DAILY;COUNT=8\nEXRULE:FREQ=WEEKLY;BYDAY=SA,SU")
	object, created, err := export.UpsertObject(userID, "unbounded-exrule.ics", importCalendarDocument(master))
	if err != nil || !created {
		t.Fatalf("unbounded EXRULE import: created=%v err=%v", created, err)
	}
	task, err := repo.GetByID(object.Task.ID)
	if err != nil || task.RecurrenceRule == nil || len(task.RecurrenceRule.ExRules) != 1 {
		t.Fatalf("stored EXRULE = %#v err=%v", task.RecurrenceRule, err)
	}
	start := time.Date(2026, 6, 19, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 6, 29, 0, 0, 0, 0, time.UTC)
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		t.Fatal(err)
	}
	values := buildTaskOccurrenceStarts(task, start, end, user.Timezone)
	if len(values) != 5 {
		t.Fatalf("expanded unbounded EXRULE = %v, want 5 weekday instances", values)
	}
	for _, value := range values {
		if value.In(time.UTC).Weekday() == time.Saturday || value.In(time.UTC).Weekday() == time.Sunday {
			t.Fatalf("excluded weekend remained: %v", value)
		}
	}
	if !strings.Contains(object.Data, "EXRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU") {
		t.Fatalf("unbounded EXRULE was not exported: %s", object.Data)
	}
}

func TestCalendarImportInvalidResourceRollsBackMasterAndInstances(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("validation@example", "SUMMARY:系列\nDTSTART:20260620T090000Z\nDTEND:20260620T100000Z\nRRULE:FREQ=DAILY;COUNT=3")
	object, _, err := export.UpsertObject(userID, "validation.ics", importCalendarDocument(master))
	if err != nil {
		t.Fatal(err)
	}
	child := importCalendarEvent(object.UID, "RECURRENCE-ID:20260621T090000Z\nDTSTART:20260625T110000Z\nDESCRIPTION:valid")
	changedMaster := strings.Replace(master, "SUMMARY:系列", "SUMMARY:不应采用", 1)
	for name, data := range map[string][]byte{
		"resource UID changed":            importCalendarDocument(strings.Replace(master, object.UID, "replacement@example", 1)),
		"invalid month zero":              importCalendarDocument(strings.Replace(master, "COUNT=3", "COUNT=3;BYMONTH=0", 1)),
		"invalid month thirteen":          importCalendarDocument(strings.Replace(master, "COUNT=3", "COUNT=3;BYMONTH=6,13", 1)),
		"invalid month text":              importCalendarDocument(strings.Replace(master, "COUNT=3", "COUNT=3;BYMONTH=June", 1)),
		"invalid empty month":             importCalendarDocument(strings.Replace(master, "COUNT=3", "COUNT=3;BYMONTH=6,", 1)),
		"missing master":                  importCalendarDocument(child),
		"two masters":                     importCalendarDocument(master, master),
		"mixed UID":                       importCalendarDocument(master, strings.Replace(child, object.UID, "other@example", 1)),
		"wrong original time":             importCalendarDocument(changedMaster, strings.Replace(child, "RECURRENCE-ID:20260621T090000Z", "RECURRENCE-ID:20260621T100000Z", 1)),
		"outside count":                   importCalendarDocument(changedMaster, strings.Replace(child, "RECURRENCE-ID:20260621T090000Z", "RECURRENCE-ID:20260624T090000Z", 1)),
		"identity type mismatch":          importCalendarDocument(changedMaster, strings.Replace(child, "RECURRENCE-ID:20260621T090000Z", "RECURRENCE-ID;VALUE=DATE:20260621", 1)),
		"range":                           importCalendarDocument(master, strings.Replace(child, "RECURRENCE-ID:", "RECURRENCE-ID;RANGE=THISANDFUTURE:", 1)),
		"duplicate identity":              importCalendarDocument(master, child, child),
		"malformed envelope":              append(importCalendarDocument(master), []byte("BEGIN:VEVENT")...),
		"unclosed component":              []byte(strings.Replace(string(importCalendarDocument(master, child)), "END:VEVENT", "", 1)),
		"unknown timezone":                importCalendarDocument(strings.Replace(master, "DTSTART:20260620T090000Z", "DTSTART;TZID=Unknown/Zone:20260620T090000", 1)),
		"unsupported recurrence":          importCalendarDocument(strings.Replace(master, "FREQ=DAILY;COUNT=3", "FREQ=HOURLY;COUNT=3", 1)),
		"invalid rule count":              importCalendarDocument(strings.Replace(master, "COUNT=3", "COUNT=zero", 1)),
		"unsupported recurrence property": importCalendarDocument(strings.Replace(master, "COUNT=3", "COUNT=3;BYHOUR=9", 1)),
		"unsupported duration":            importCalendarDocument(strings.Replace(master, "DTEND:20260620T100000Z", "DURATION:P1M", 1)),
		"reversed range":                  importCalendarDocument(master, strings.Replace(child, "DESCRIPTION:valid", "DTEND:20260625T100000Z", 1)),
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := export.UpsertObjectConditional(userID, object.Href, data, object.ETag, ""); err == nil {
				t.Fatal("invalid resource accepted")
			}
			after, err := export.GetObject(userID, object.Href)
			rows, _ := repo.ListTaskOccurrences(userID, object.Task.ID)
			if err != nil || after.ETag != object.ETag || len(rows) != 0 {
				t.Fatal("rejected PUT partially committed", rows, err)
			}
		})
	}
	// A database failure after the master update must roll back its revision,
	// sync journal and metadata as well as any instance writes.
	if err := repo.WithTransaction(func(tx *gorm.DB) error {
		return tx.Callback().Create().Before("gorm:create").Register("fail_dav_instance", func(tx *gorm.DB) {
			if tx.Statement.Table == "task_occurrences" {
				tx.AddError(errors.New("injected occurrence persistence failure"))
			}
		})
	}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := export.UpsertObject(userID, object.Href, importCalendarDocument(changedMaster, child)); err == nil {
		t.Fatal("injected failure accepted")
	}
	if after, err := export.GetObject(userID, object.Href); err != nil || after.ETag != object.ETag {
		t.Fatal("storage failure changed master", err)
	}
	if _, _, err := export.UpsertObject(userID, "new-validation.ics", importCalendarDocument(strings.ReplaceAll(changedMaster, object.UID, "new@example"), strings.ReplaceAll(child, object.UID, "new@example"))); err == nil {
		t.Fatal("new resource partially committed")
	}
	if _, err := repo.GetByCalDAVRef(userID, "new@example", "new-validation.ics"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatal("failed creation left task behind", err)
	}
}

func TestCalendarImportPreservesSeriesTimezoneAcrossAccountTimezone(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	data := importCalendarDocument(importCalendarEvent("series-zone@example", "SUMMARY:纽约系列\nDTSTART;TZID=America/New_York:20260620T090000\nDTEND;TZID=America/New_York:20260620T100000\nRRULE:FREQ=DAILY;COUNT=2"))
	object, created, err := export.UpsertObject(userID, "series-zone.ics", data)
	if err != nil || !created {
		t.Fatalf("import series timezone: created=%v err=%v", created, err)
	}
	task, err := repo.GetByID(object.Task.ID)
	if err != nil || task.RecurrenceRule == nil || task.RecurrenceRule.Timezone != "America/New_York" {
		t.Fatalf("stored series timezone = %#v err=%v", task.RecurrenceRule, err)
	}
	instances, err := s.ExpandRecurringTasks(userID, time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC), time.Date(2026, 6, 22, 0, 0, 0, 0, time.UTC))
	if err != nil || len(instances) == 0 || instances[0].StartTime.Format(time.RFC3339) != "2026-06-20T13:00:00Z" {
		t.Fatalf("expanded series timezone: instances=%#v err=%v", instances, err)
	}
	if !strings.Contains(object.Data, "DTSTART;TZID=America/New_York:20260620T090000") || !strings.Contains(object.Data, "BEGIN:VTIMEZONE") || !strings.Contains(object.Data, "TZID:America/New_York") {
		t.Fatalf("export lost series timezone: %s", object.Data)
	}
}

func TestCalendarImportDetachedTitleRoundtrip(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("title@example", "SUMMARY:系列标题\nDTSTART:20260620T090000Z\nDTEND:20260620T100000Z\nRRULE:FREQ=DAILY;COUNT=3")
	child := importCalendarEvent("title@example", "SUMMARY:本次独立标题\nRECURRENCE-ID:20260621T090000Z\nDTSTART:20260621T110000Z\nDTEND:20260621T120000Z")
	object, created, err := export.UpsertObject(userID, "title.ics", importCalendarDocument(master, child))
	if err != nil || !created {
		t.Fatal(created, err)
	}
	rows, err := repo.ListTaskOccurrences(userID, object.Task.ID)
	if err != nil || len(rows) != 1 || rows[0].Title != "本次独立标题" {
		t.Fatal(rows, err)
	}
	if !strings.Contains(object.Data, "SUMMARY:本次独立标题") {
		t.Fatal("detached title was not exported", object.Data)
	}
	if _, _, err := export.UpsertObject(userID, object.Href, []byte(object.Data)); err != nil {
		t.Fatal("detached title did not roundtrip:", err)
	}
	rows, err = repo.ListTaskOccurrences(userID, object.Task.ID)
	if err != nil || len(rows) != 1 || rows[0].Title != "本次独立标题" {
		t.Fatal(rows, err)
	}
}

func TestCalendarImportReordersAndRestoresAutomaticReminder(t *testing.T) {
	s, repo, notifications, userID := newTestTaskServiceWithReminder(t)
	export := NewCalendarExportService(s, s.userRepo, "test")
	start := time.Now().UTC().AddDate(0, 0, 5).Truncate(time.Second)
	end := start.Add(time.Hour)
	task, err := s.Create(userID, &models.CreateTaskRequest{Title: "系列", StartTime: &start, EndTime: &end, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 3}})
	if err != nil {
		t.Fatal(err)
	}
	assertSinglePendingAutoReminder(t, notifications, task.ID, start.Add(-5*time.Minute))
	initial, err := export.GetObject(userID, taskCalDAVHref(task))
	if err != nil {
		t.Fatal(err)
	}
	moved := time.Now().UTC().Add(2 * time.Hour).Truncate(time.Second)
	child := importCalendarEvent(initial.UID, "RECURRENCE-ID:"+start.AddDate(0, 0, 1).Format("20060102T150405Z")+"\nDTSTART:"+moved.Format("20060102T150405Z"))
	components := extractCalendarComponents(initial.Data)
	if _, _, err := export.UpsertObject(userID, initial.Href, importCalendarDocument(components[0], child)); err != nil {
		t.Fatal(err)
	}
	assertSinglePendingAutoReminder(t, notifications, task.ID, moved.Add(-5*time.Minute))
	rows, _ := repo.ListTaskOccurrences(userID, task.ID)
	if len(rows) != 1 || !rows[0].ScheduleOverride {
		t.Fatal(rows)
	}
	if _, _, err := export.UpsertObject(userID, initial.Href, []byte(initial.Data)); err != nil {
		t.Fatal(err)
	}
	assertSinglePendingAutoReminder(t, notifications, task.ID, start.Add(-5*time.Minute))
}
