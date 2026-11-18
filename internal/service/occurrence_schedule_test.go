package service

import (
	"errors"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestOccurrenceScheduleMoveClearEndResetAndReplay(t *testing.T) {
	s, repo, uid := newTestTaskService(t)
	start := time.Date(2026, 3, 7, 9, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	task, err := s.Create(uid, &models.CreateTaskRequest{Title: "系列", Description: "系列描述", StartTime: &start, EndTime: &end, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 3}})
	if err != nil {
		t.Fatal(err)
	}
	date := time.Date(2026, 3, 7, 0, 0, 0, 0, time.UTC)
	instance := buildOccurrenceInstanceID(task.ID, date)
	_, err = s.Update(uid, task.ID, &models.UpdateTaskRequest{InstanceID: instance, Description: "本次笔记"}, map[string]bool{"description": true}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	task, _ = s.GetByID(uid, task.ID)
	rev := task.Revision
	moved := start.AddDate(0, 0, 30)
	req := &models.UpdateTaskOccurrenceScheduleRequest{InstanceID: instance, OccurrenceDate: "2026-03-07", StartTime: &moved, AllDay: true}
	mutate := func(scoped *TaskService) (*models.Task, error) {
		return scoped.UpdateOccurrenceSchedule(uid, task.ID, req, &rev, nil)
	}
	result, replayed, err := s.ExecuteMutation(uid, "move-one", "occurrence_schedule", task.ID, "payload", mutate)
	if err != nil || replayed || result.Revision != rev+1 {
		t.Fatal(result, replayed, err)
	}
	result, replayed, err = s.ExecuteMutation(uid, "move-one", "occurrence_schedule", task.ID, "payload", mutate)
	if err != nil || !replayed || result.Revision != rev+1 {
		t.Fatal(result, replayed, err)
	}
	row, _ := repo.GetTaskOccurrence(uid, task.ID, date)
	if !row.ScheduleOverride || row.EndTime != nil || row.Description != "本次笔记" || !row.AllDay {
		t.Fatal(row)
	}
	saved, _ := s.GetByID(uid, task.ID)
	if !saved.StartTime.Equal(start) || !saved.EndTime.Equal(end) || saved.AllDay || saved.Description != "系列描述" {
		t.Fatal(saved)
	}
	old, err := s.ExpandRecurringTasks(uid, start.Add(-time.Hour), start.Add(2*time.Hour))
	if err != nil || len(old) != 0 {
		t.Fatal(old, err)
	}
	shifted, err := s.ExpandRecurringTasks(uid, moved.Add(-time.Hour), moved.Add(2*time.Hour))
	if err != nil || len(shifted) != 1 || shifted[0].InstanceID != instance || shifted[0].EndTime != nil || !shifted[0].OriginalDate.Equal(date) {
		t.Fatal(shifted, err)
	}
	next, err := s.ListNextPendingOccurrences(uid, start.Add(-time.Hour))
	if err != nil || len(next) != 1 || next[0].OriginalDate.Format("2006-01-02") != "2026-03-08" {
		t.Fatal(next, err)
	}
	// Description and status edits must retain an explicit all-day override and nil end.
	_, err = s.Update(uid, task.ID, &models.UpdateTaskRequest{InstanceID: instance, Description: "新笔记"}, map[string]bool{"description": true}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, day := range []string{"2026-03-08", "2026-03-09"} {
		if _, err := s.UpdateStatus(uid, task.ID, models.TaskStatusCompleted, "", day, nil, nil); err != nil {
			t.Fatal(err)
		}
	}
	_, err = s.UpdateStatus(uid, task.ID, models.TaskStatusCompleted, instance, "", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	row, _ = repo.GetTaskOccurrence(uid, task.ID, date)
	if !row.AllDay || row.EndTime != nil || !row.StartTime.Equal(moved) {
		t.Fatal(row)
	}
	_, err = s.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{InstanceID: instance, Reset: true}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	row, _ = repo.GetTaskOccurrence(uid, task.ID, date)
	if row.ScheduleOverride || !row.StartTime.Equal(start) || !row.EndTime.Equal(end) || row.Status != models.TaskStatusCompleted || row.Description != "新笔记" {
		t.Fatal(row)
	}
}

func TestOccurrenceScheduleValidationConflictAndIsolation(t *testing.T) {
	s, _, uid := newTestTaskService(t)
	start := time.Date(2026, 3, 10, 9, 0, 0, 0, time.UTC)
	task, err := s.Create(uid, &models.CreateTaskRequest{Title: "限定两次", StartTime: &start, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 2}})
	if err != nil {
		t.Fatal(err)
	}
	for _, req := range []models.UpdateTaskOccurrenceScheduleRequest{
		{OccurrenceDate: "2026-03-12", StartTime: &start},
		{OccurrenceDate: "2026-03-10", InstanceID: "999_20260310", StartTime: &start},
		{OccurrenceDate: "2026-03-10"},
		{OccurrenceDate: "2026-03-10", StartTime: &start, EndTime: &start},
		{StartTime: &start},
	} {
		if _, err := s.UpdateOccurrenceSchedule(uid, task.ID, &req, nil, nil); err == nil {
			t.Fatal("accepted invalid request", req)
		}
	}
	rev := task.Revision - 1
	_, err = s.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: "2026-03-10", StartTime: &start}, &rev, nil)
	var conflict *RevisionConflictError
	if !errors.As(err, &conflict) {
		t.Fatal(err)
	}
	if _, err = s.UpdateOccurrenceSchedule(uid+1, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: "2026-03-10", StartTime: &start}, nil, nil); err == nil {
		t.Fatal("cross-account write")
	}
	saved, _ := s.GetByID(uid, task.ID)
	if saved.Revision != task.Revision {
		t.Fatal("rejected write touched revision")
	}
}

func TestOccurrenceScheduleMovedBeyondAnchorAndReminderAllDay(t *testing.T) {
	s, repo, notify, uid := newTestTaskServiceWithReminder(t)
	start := time.Now().UTC().AddDate(0, 0, 10).Truncate(24 * time.Hour).Add(12 * time.Hour)
	end := start.Add(time.Hour)
	task, err := s.Create(uid, &models.CreateTaskRequest{Title: "提醒实例", StartTime: &start, EndTime: &end, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 1}})
	if err != nil {
		t.Fatal(err)
	}
	moved := start.AddDate(0, 0, -5)
	_, err = s.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: start.Format("2006-01-02"), StartTime: &moved, AllDay: true}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	expected := time.Date(moved.Year(), moved.Month(), moved.Day(), 9, 0, 0, 0, time.UTC).Add(-5 * time.Minute)
	assertSinglePendingAutoReminder(t, notify, task.ID, expected)
	instance, err := nextPendingReminderInstance(repo, task, time.Now(), "UTC", "09:00")
	if err != nil || instance == nil || !instance.StartTime.Equal(moved) || !instance.AllDay {
		t.Fatal(instance, err)
	}
	shifted, err := s.ExpandRecurringTasks(uid, moved.Add(-time.Hour), moved.Add(time.Hour))
	if err != nil || len(shifted) != 1 {
		t.Fatal(shifted, err)
	}
	next, err := s.ListNextPendingOccurrences(uid, time.Now())
	if err != nil || len(next) != 1 || !next[0].StartTime.Equal(moved) {
		t.Fatal(next, err)
	}
}

func TestOccurrenceScheduleAccountDateAcrossDST(t *testing.T) {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 3, 7, 9, 0, 0, 0, loc)
	end := start.Add(time.Hour)
	task := &models.Task{ID: 1, StartTime: &start, EndTime: &end, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 3}}
	date := time.Date(2026, 3, 8, 0, 0, 0, 0, time.UTC)
	if !validOccurrenceDate(task, date, loc.String()) {
		t.Fatal("DST occurrence rejected")
	}
	base, _ := deriveOccurrenceRangeFromTask(task, date, loc.String())
	if base.In(loc).Hour() != 9 || base.Hour() != 13 {
		t.Fatal(base)
	}
}

// The next start is not necessarily the next reminder when one instance has
// changed between timed and all-day. Both write-time scheduling and periodic
// reconciliation must honor the account's own morning time and timezone.
func TestOccurrenceScheduleReminderOrdersMixedAllDayInstances(t *testing.T) {
	for _, tc := range []struct {
		name, timezone, morning              string
		seriesAllDay, movedAllDay, movedWins bool
		movedHour                            int
	}{
		{"late start has earlier morning reminder", "Asia/Shanghai", "09:00", false, true, true, 23},
		{"custom late morning keeps timed first", "America/New_York", "11:30", false, true, false, 23},
		{"timed override precedes late morning", "Asia/Shanghai", "11:30", true, false, true, 10},
		{"series morning precedes timed override", "America/New_York", "09:00", true, false, false, 10},
	} {
		t.Run(tc.name, func(t *testing.T) {
			notifySvc, svc, repo, notifications, uid, _ := newNotifyRolloverTestServices(t)
			user, err := svc.userRepo.GetByID(uid)
			if err != nil {
				t.Fatal(err)
			}
			user.Timezone, user.DefaultMorningTime = tc.timezone, tc.morning
			if err := svc.userRepo.Update(user); err != nil {
				t.Fatal(err)
			}
			loc := loadLocationOrUTC(tc.timezone)
			day := time.Now().In(loc).AddDate(0, 0, 10)
			start := time.Date(day.Year(), day.Month(), day.Day(), 10, 0, 0, 0, loc)
			if tc.seriesAllDay {
				start = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
			}
			task, err := svc.Create(uid, &models.CreateTaskRequest{Title: "混合提醒", StartTime: &start, AllDay: tc.seriesAllDay, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Count: 2}})
			if err != nil {
				t.Fatal(err)
			}
			original := start.AddDate(0, 0, 1).Format("2006-01-02")
			moved := time.Date(day.Year(), day.Month(), day.Day(), tc.movedHour, 0, 0, 0, loc)
			if _, err := svc.UpdateOccurrenceSchedule(uid, task.ID, &models.UpdateTaskOccurrenceScheduleRequest{OccurrenceDate: original, StartTime: &moved, AllDay: tc.movedAllDay}, nil, nil); err != nil {
				t.Fatal(err)
			}
			wantStart, wantDay := start, start.Format("2006-01-02")
			wantAllDay := tc.seriesAllDay
			if tc.movedWins {
				wantStart, wantDay, wantAllDay = moved, original, tc.movedAllDay
			}
			wantReminder := resolveReminderStartForTask(wantStart, wantAllDay, tc.timezone, tc.morning).Add(-5 * time.Minute)
			instance, err := nextPendingReminderInstance(repo, task, time.Now(), tc.timezone, tc.morning)
			if err != nil || instance == nil || instance.OriginalDate.Format("2006-01-02") != wantDay {
				t.Fatalf("chosen instance = %+v, error = %v; want date %s", instance, err, wantDay)
			}
			assertSinglePendingAutoReminder(t, notifications, task.ID, wantReminder)
			if err := notifySvc.ReconcileUserReminders(uid); err != nil {
				t.Fatal(err)
			}
			assertSinglePendingAutoReminder(t, notifications, task.ID, wantReminder)
		})
	}
}
