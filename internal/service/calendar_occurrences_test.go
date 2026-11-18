package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"todo-app/internal/models"
	"unicode/utf8"
)

func saveCalendarFixture(t *testing.T, name, data string) {
	t.Helper()
	if dir := os.Getenv("TODO_CALENDAR_TEST_ARTIFACTS"); dir != "" {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
	}
}

func TestCalendarOccurrenceExportDSTIdentityResetAndFeed(t *testing.T) {
	s, repo, uid := newTestTaskService(t)
	user, _ := s.userRepo.GetByID(uid)
	user.Timezone = "America/New_York"
	if err := s.userRepo.Update(user); err != nil {
		t.Fatal(err)
	}
	loc := loadLocationOrUTC(user.Timezone)
	start := time.Date(2026, 3, 7, 9, 0, 0, 0, loc)
	end := start.Add(time.Hour)
	task, err := s.Create(uid, &models.CreateTaskRequest{Title: "跨夏令时系列", Description: strings.Repeat("系列描述", 30), StartTime: &start, EndTime: &end, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 3}})
	if err != nil {
		t.Fatal(err)
	}
	export := NewCalendarExportService(s, s.userRepo, "test")
	name := taskCalDAVHref(task)
	before, err := export.GetObject(uid, name)
	if err != nil {
		t.Fatal(err)
	}
	moved := time.Date(2026, 3, 20, 14, 0, 0, 0, loc)
	if _, err := s.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: "2026-03-08", StartTime: &moved, AllDay: true}, nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Update(uid, task.ID, &models.UpdateTaskRequest{InstanceID: buildOccurrenceInstanceID(task.ID, time.Date(2026, 3, 8, 0, 0, 0, 0, time.UTC)), Description: "改期后的本次笔记"}, map[string]bool{"description": true}, nil, nil); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpsertTaskOccurrence(&models.TaskOccurrence{UserID: uid, TaskID: task.ID, OccurrenceDate: time.Date(2026, 3, 9, 0, 0, 0, 0, time.UTC), Status: models.TaskStatusCompleted}); err != nil {
		t.Fatal(err)
	}
	object, err := export.GetObject(uid, name)
	if err != nil {
		t.Fatal(err)
	}
	data := strings.Join(unfoldICalLines(object.Data), "\r\n")
	for _, want := range []string{"DTSTART;TZID=America/New_York:20260307T090000", "RECURRENCE-ID;TZID=America/New_York:20260308T090000", "DTSTART;VALUE=DATE:20260320", "DTEND;VALUE=DATE:20260321", "DESCRIPTION:改期后的本次笔记", "RECURRENCE-ID;TZID=America/New_York:20260309T090000"} {
		if !strings.Contains(data, want) {
			t.Fatalf("missing %q", want)
		}
	}
	if strings.Count(data, "BEGIN:VEVENT") != 3 || strings.Count(data, "UID:"+object.UID+"\r\n") != 3 || before.ETag == object.ETag {
		t.Fatal("missing exceptions, stable identity or changed ETag")
	}
	for _, line := range strings.Split(object.Data, "\r\n") {
		if len(line) > 75 || !utf8.ValidString(line) {
			t.Fatalf("invalid folded line %q", line)
		}
	}
	again, err := export.GetObject(uid, name)
	if err != nil || again.ETag != object.ETag {
		t.Fatal("unstable ETag", err)
	}
	// Foreign and obsolete dates must not leak into the exported series.
	if err := repo.UpsertTaskOccurrence(&models.TaskOccurrence{UserID: uid + 1, TaskID: task.ID, OccurrenceDate: time.Date(2026, 3, 7, 0, 0, 0, 0, time.UTC), Description: "foreign-secret"}); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpsertTaskOccurrence(&models.TaskOccurrence{UserID: uid, TaskID: task.ID, OccurrenceDate: time.Date(2026, 3, 10, 0, 0, 0, 0, time.UTC), Description: "obsolete-secret"}); err != nil {
		t.Fatal(err)
	}
	// A second recurring object uses the same VTIMEZONE in the combined feed.
	if _, err := s.Create(uid, &models.CreateTaskRequest{Title: "第二系列", StartTime: &start, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 1}}); err != nil {
		t.Fatal(err)
	}
	feed, err := export.ExportFeed(uid, start.AddDate(0, 0, -1), moved.AddDate(0, 0, 1))
	if err != nil || strings.Count(feed, "BEGIN:VEVENT") != 4 || strings.Count(feed, "BEGIN:VTIMEZONE") != 1 || strings.Contains(feed, "secret") {
		t.Fatal("feed lost exceptions or leaked rows", err)
	}
	saveCalendarFixture(t, "occurrence-dst.ics", object.Data)
	saveCalendarFixture(t, "occurrence-feed.ics", feed)
	roundtrip, created, err := export.UpsertObject(uid, name, []byte(object.Data))
	if err != nil || created || strings.Count(roundtrip.Data, "RECURRENCE-ID") != 2 || !strings.Contains(roundtrip.Data, "X-TODO-STATUS:completed") {
		t.Fatal("DAV roundtrip lost detached instances or completion", err)
	}
	object = roundtrip
	if _, err := s.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: "2026-03-08", Reset: true}, nil, nil); err != nil {
		t.Fatal(err)
	}
	reset, err := export.GetObject(uid, name)
	if err != nil || reset.ETag == object.ETag {
		t.Fatal(err)
	}
	if strings.Contains(reset.Data, "DTSTART;VALUE=DATE:20260320") || !strings.Contains(reset.Data, "DTSTART:20260308T130000Z") {
		t.Fatal("reset did not restore DST-adjusted start")
	}
	saveCalendarFixture(t, "occurrence-reset.ics", reset.Data)
}

func TestCalendarOccurrenceAllDayIdentityAndMovedInQuery(t *testing.T) {
	s, _, uid := newTestTaskService(t)
	start := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	task, err := s.Create(uid, &models.CreateTaskRequest{Title: "全天改定时", StartTime: &start, AllDay: true, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 1}})
	if err != nil {
		t.Fatal(err)
	}
	moved := time.Date(2026, 6, 2, 11, 0, 0, 0, time.UTC)
	if _, err := s.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: "2026-06-20", StartTime: &moved}, nil, nil); err != nil {
		t.Fatal(err)
	}
	export := NewCalendarExportService(s, s.userRepo, "test")
	objects, err := export.ListObjects(uid, moved.Add(-time.Hour), moved.Add(time.Hour), false)
	if err != nil || len(objects) != 1 {
		t.Fatal("query missed moved-in series", objects, err)
	}
	if !strings.Contains(objects[0].Data, "RECURRENCE-ID;VALUE=DATE:20260620") || !strings.Contains(objects[0].Data, "DTSTART:20260602T110000Z") {
		t.Fatal(objects[0].Data)
	}
	saveCalendarFixture(t, "occurrence-all-day.ics", objects[0].Data)
	if _, err := s.UpdateStatus(uid, task.ID, models.TaskStatusSkipped, "", "2026-06-20", nil, nil); err != nil {
		t.Fatal(err)
	}
	object, err := export.GetObject(uid, taskCalDAVHref(task))
	if err != nil || !strings.Contains(object.Data, "STATUS:CANCELLED") || strings.Count(object.Data, "BEGIN:VEVENT") != 2 {
		t.Fatal(object, err)
	}
	saveCalendarFixture(t, "occurrence-cancelled.ics", object.Data)
}

func TestCalendarTimezoneFutureRulesAndOffsets(t *testing.T) {
	for _, name := range []string{"America/New_York", "Europe/Berlin", "Australia/Lord_Howe", "Asia/Shanghai", "Africa/Casablanca"} {
		loc := loadLocationOrUTC(name)
		zone := calendarTimezoneComponent(loc)
		if !strings.Contains(zone, "TZID:"+name) {
			t.Fatal(name)
		}
		if name == "America/New_York" && (!strings.Contains(zone, "BYMONTH=3;BYDAY=2SU") || !strings.Contains(zone, "BYMONTH=11;BYDAY=1SU")) {
			t.Fatal("missing future DST rules")
		}
		export := &CalendarExportService{}
		saveCalendarFixture(t, strings.ReplaceAll(name, "/", "-")+".ics", export.wrapCalendar("timezone", []string{zone}))
	}
	for seconds, want := range map[int]string{19800: "+0530", -17762: "-045602", 0: "+0000"} {
		if got := calendarUTCOffset(seconds); got != want {
			t.Fatal(got, want)
		}
	}
}
