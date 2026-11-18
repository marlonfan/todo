package service

import (
	"strings"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestDefaultCalendarAlarmTrigger(t *testing.T) {
	tests := []struct {
		name    string
		task    *models.Task
		user    *models.User
		want    string
		wantSet bool
	}{
		{
			name: "timed event",
			task: &models.Task{Status: models.TaskStatusPending, StartTime: timePointer(time.Now()), AllDay: false},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 15},
			want: "-PT15M", wantSet: true,
		},
		{
			name: "all day event uses morning reminder time",
			task: &models.Task{Status: models.TaskStatusPending, StartTime: timePointer(time.Now()), AllDay: true},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 5, DefaultMorningTime: "09:00"},
			want: "PT8H55M", wantSet: true,
		},
		{
			name: "disabled",
			task: &models.Task{Status: models.TaskStatusPending, StartTime: timePointer(time.Now())},
			user: &models.User{DefaultReminderEnabled: false, DefaultReminderMinutes: 5},
		},
		{
			name: "completed task",
			task: &models.Task{Status: models.TaskStatusCompleted, StartTime: timePointer(time.Now())},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 5},
		},
		{
			name: "unscheduled task",
			task: &models.Task{Status: models.TaskStatusPending},
			user: &models.User{DefaultReminderEnabled: true, DefaultReminderMinutes: 5},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotSet := defaultCalendarAlarmTrigger(tt.task, tt.user)
			if got != tt.want || gotSet != tt.wantSet {
				t.Fatalf("defaultCalendarAlarmTrigger() = (%q, %v), want (%q, %v)", got, gotSet, tt.want, tt.wantSet)
			}
		})
	}
}

func TestParseICalendarObjectIgnoresAlarmProperties(t *testing.T) {
	data := strings.Join([]string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"BEGIN:VEVENT",
		"UID:alarm-only-description@example",
		"SUMMARY:Calendar event",
		"DTSTART:20260715T010000Z",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		"DESCRIPTION:Alarm description",
		"TRIGGER:-PT5M",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
	}, "\r\n")

	parsed, err := parseICalendarObject([]byte(data), time.UTC)
	if err != nil {
		t.Fatalf("parseICalendarObject() error = %v", err)
	}
	if parsed.Description != "" {
		t.Fatalf("event description = %q, want empty; VALARM properties must be ignored", parsed.Description)
	}
}

func TestCalendarExportUsesRFCBoundaryForms(t *testing.T) {
	loc := loadLocationOrUTC("America/New_York")
	user := &models.User{Timezone: "America/New_York"}
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, loc)
	end := time.Date(2026, 3, 31, 23, 59, 59, 0, loc)
	allDay := &models.Task{
		StartTime:         &start,
		AllDay:            true,
		RecurrenceRule:    &models.RecurrenceRule{Freq: "daily", Count: 20},
		RecurrenceEndDate: &end,
	}
	line := taskRRuleLine(allDay, user)
	if !strings.Contains(line, "COUNT=20") || strings.Contains(line, "UNTIL=") {
		t.Fatalf("count boundary was not selected: %s", line)
	}

	shortEnd := time.Date(2026, 1, 3, 23, 59, 59, 0, loc)
	allDay.RecurrenceEndDate = &shortEnd
	line = taskRRuleLine(allDay, user)
	if !strings.Contains(line, "COUNT=3") || strings.Contains(line, "UNTIL=") {
		t.Fatalf("earlier all-day end did not reduce count: %s", line)
	}

	allDay.RecurrenceRule = &models.RecurrenceRule{Freq: "daily"}
	line = taskRRuleLine(allDay, user)
	if !strings.Contains(line, "UNTIL=20260103") || strings.Contains(line, "T235959Z") {
		t.Fatalf("all-day UNTIL was not a DATE: %s", line)
	}

	timed := *allDay
	timed.AllDay = false
	timed.RecurrenceRule = &models.RecurrenceRule{Freq: "daily"}
	line = taskRRuleLine(&timed, user)
	if !strings.Contains(line, "UNTIL=20260104T045959Z") {
		t.Fatalf("timed UNTIL lost its UTC instant: %s", line)
	}
}

func TestCalendarExportStartOutsideRuleUsesFilteredSeries(t *testing.T) {
	loc := loadLocationOrUTC("America/New_York")
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, loc)
	user := &models.User{Timezone: "America/New_York"}
	task := &models.Task{StartTime: &start, RecurrenceRule: &models.RecurrenceRule{Freq: "monthly", ByMonth: []int{3}, ByDate: []int{1}, Count: 2}}
	line := taskRRuleLine(task, user)
	if !strings.Contains(line, "BYMONTH=3") || !strings.Contains(line, "BYMONTHDAY=1") || !strings.Contains(line, "COUNT=2") {
		t.Fatalf("filtered start rule was not exported: %s", line)
	}
	starts := buildGregorianOccurrenceStarts(start, nil, task.RecurrenceRule, start, time.Date(2028, 1, 1, 0, 0, 0, 0, time.UTC), user.Timezone)
	if len(starts) != 2 || starts[0].In(loc).Format("2006-01-02") != "2026-03-01" {
		t.Fatalf("filtered series expansion = %v", starts)
	}
}

func timePointer(value time.Time) *time.Time {
	return &value
}

func TestLunarCalendarExportUsesFiniteRDatesAndRoundTrips(t *testing.T) {
	s, _, userID := newTestTaskService(t)
	user, _ := s.userRepo.GetByID(userID)
	user.Timezone = "Asia/Shanghai"
	if err := s.userRepo.Update(user); err != nil {
		t.Fatal(err)
	}
	loc := loadLocationOrUTC(user.Timezone)
	start := time.Date(2026, 2, 17, 9, 0, 0, 0, loc)
	task, err := s.Create(userID, &models.CreateTaskRequest{Title: "农历春节系列", StartTime: &start, RecurrenceRule: &models.RecurrenceRule{Freq: "lunar_yearly", Interval: 1, LunarMonth: 1, LunarDay: 1, Count: 3}})
	if err != nil {
		t.Fatal(err)
	}
	export := NewCalendarExportService(s, s.userRepo, "test")
	object, err := export.GetObject(userID, taskCalDAVHref(task))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(object.Data, "FREQ=LUNAR") || !strings.Contains(object.Data, "X-TODO-LUNAR-RULE:") || !strings.Contains(object.Data, "RDATE;TZID=Asia/Shanghai:") {
		t.Fatalf("lunar export is not standard finite RDATE data: %s", object.Data)
	}
	saveCalendarFixture(t, "lunar.ics", object.Data)
	if strings.Count(object.Data, "BEGIN:VEVENT") != 1 {
		t.Fatal("lunar master should remain one resource")
	}
	roundtrip, created, err := export.UpsertObject(userID, taskCalDAVHref(task), []byte(object.Data))
	if err != nil || created {
		t.Fatal("lunar DAV roundtrip failed", created, err)
	}
	if roundtrip.Task.RecurrenceRule == nil || !isLunarYearlyRule(roundtrip.Task.RecurrenceRule) || roundtrip.Task.RecurrenceRule.LunarMonth != 1 || roundtrip.Task.RecurrenceRule.LunarDay != 1 || roundtrip.Task.RecurrenceRule.Count != 3 {
		t.Fatalf("lunar rule was not preserved: %+v", roundtrip.Task.RecurrenceRule)
	}
	tampered := strings.Replace(object.Data, "20270206T090000", "20270207T090000", 1)
	if _, _, err := export.UpsertObject(userID, taskCalDAVHref(task), []byte(tampered)); err == nil {
		t.Fatal("tampered lunar RDATE was accepted")
	}
	allDayStart := time.Date(2026, 2, 17, 0, 0, 0, 0, loc)
	allDay, err := s.Create(userID, &models.CreateTaskRequest{Title: "农历全天系列", StartTime: &allDayStart, AllDay: true, RecurrenceRule: &models.RecurrenceRule{Freq: "lunar_yearly", LunarMonth: 1, LunarDay: 1, Count: 2}})
	if err != nil {
		t.Fatal(err)
	}
	allDayObject, err := export.GetObject(userID, taskCalDAVHref(allDay))
	if err != nil || !strings.Contains(allDayObject.Data, "RDATE;VALUE=DATE:") || strings.Contains(allDayObject.Data, "RDATE;TZID=") {
		t.Fatalf("all-day lunar RDATE used the wrong value type: %v %s", err, allDayObject.Data)
	}
}
