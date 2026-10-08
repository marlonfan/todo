package service

import (
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestRebuildAndExportRespectTaskReminderPolicies(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		for _, policy := range []models.TaskReminderPolicy{models.TaskReminderInherit, models.TaskReminderNone, models.TaskReminderOffset} {
			t.Run(string(policy)+time.Duration(map[bool]int{false: 0, true: 1}[enabled]).String(), func(t *testing.T) {
				ns, ts, _, nr, uid, _ := newNotifyRolloverTestServices(t)
				user, err := ns.userRepo.GetByID(uid)
				if err != nil {
					t.Fatal(err)
				}
				user.DefaultReminderEnabled = enabled
				if err = ns.userRepo.Update(user); err != nil {
					t.Fatal(err)
				}
				start := time.Now().UTC().Add(24 * time.Hour)
				minutes := 30
				req := &models.CreateTaskRequest{Title: "policy", StartTime: &start, ReminderPolicy: policy}
				if policy == models.TaskReminderOffset {
					req.ReminderMinutesBefore = &minutes
				}
				task, err := ts.Create(uid, req)
				if err != nil {
					t.Fatal(err)
				}
				if err = ns.ReconcileUserReminders(uid); err != nil {
					t.Fatal(err)
				}
				rows, err := nr.GetByTask(task.ID)
				if err != nil {
					t.Fatal(err)
				}
				expectedEnabled := policy == models.TaskReminderOffset || (enabled && policy == models.TaskReminderInherit)
				trigger, set := defaultCalendarAlarmTrigger(task, user)
				if set != expectedEnabled {
					t.Fatalf("ICS enabled=%v want %v", set, expectedEnabled)
				}
				if !expectedEnabled {
					if len(rows) != 0 {
						t.Fatal("disabled task has reminders")
					}
					return
				}
				expectedMinutes := 5
				if policy == models.TaskReminderOffset {
					expectedMinutes = 30
				}
				if len(rows) != 1 || !rows[0].NotifyAt.Equal(start.Add(-time.Duration(expectedMinutes)*time.Minute)) {
					t.Fatal("rebuild changed offset")
				}
				if trigger != formatICalDurationMinutes(-expectedMinutes) {
					t.Fatal("export changed offset")
				}
			})
		}
	}
}
