package domain

import (
	"encoding/json"
	"testing"
	"time"

	"nsgo-todo/internal/api"
)

func TestFilterAndSortAndCounts(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2026, 11, 22, 14, 0, 0, 0, loc)
	yesterday := time.Date(2026, 11, 21, 9, 0, 0, 0, loc)
	todayDue := time.Date(2026, 11, 22, 18, 0, 0, 0, loc)
	inThreeDays := time.Date(2026, 11, 25, 10, 0, 0, 0, loc)
	inTenDays := time.Date(2026, 12, 2, 10, 0, 0, 0, loc)

	work := api.Category{ID: 1, Name: "工作", Color: "#C46849"}
	tasks := []api.Task{
		{ID: 1, Title: "逾期报销", Status: "pending", Priority: 2, DueDate: &yesterday},
		{ID: 2, Title: "今天发版", Status: "pending", Priority: 3, DueDate: &todayDue, Categories: []api.Category{work}},
		{ID: 3, Title: "收件箱想法", Status: "pending", Priority: 1},
		{ID: 4, Title: "下周评审", Status: "pending", DueDate: &inThreeDays},
		{ID: 5, Title: "下月计划", Status: "pending", DueDate: &inTenDays},
		{ID: 6, Title: "已完成项", Status: "completed"},
	}

	counts := Counts(tasks, now, loc)
	if counts.Today != 2 || counts.Overdue != 1 || counts.Inbox != 1 || counts.Upcoming != 3 || counts.All != 5 || counts.Completed != 1 {
		t.Fatalf("unexpected counts: %+v", counts)
	}
	if counts.Category[1] != 1 {
		t.Fatalf("expected category 1 count = 1, got %d", counts.Category[1])
	}

	today := FilterAndSort(tasks, FilterToday, 0, "", now, loc)
	if len(today) != 2 || today[0].ID != 1 || today[1].ID != 2 {
		t.Fatalf("expected overdue task first in today list, got %+v", today)
	}

	search := FilterAndSort(tasks, FilterAll, 0, "工作", now, loc)
	if len(search) != 1 || search[0].ID != 2 {
		t.Fatalf("expected category name search match task 2, got %+v", search)
	}

	label, overdue := FormatTaskDate(tasks[0], now, loc)
	if !overdue || label != "昨天 09:00" {
		t.Fatalf("unexpected overdue date formatting: %q overdue=%v", label, overdue)
	}
}

func TestProjectTasksHidesEndedOrDeletedRecurringSeriesWithoutNextOccurrence(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2026, 11, 23, 2, 30, 0, 0, loc)
	oldAnchor := time.Date(2026, 10, 1, 21, 0, 0, 0, loc)
	endedAt := time.Date(2026, 11, 10, 20, 59, 59, 0, loc)
	todayStart := time.Date(2026, 11, 23, 9, 0, 0, 0, loc)
	todayOrig := time.Date(2026, 11, 23, 0, 0, 0, 0, time.UTC)
	skippedStart := time.Date(2026, 11, 11, 21, 0, 0, 0, loc)
	skippedOrig := time.Date(2026, 11, 11, 0, 0, 0, 0, time.UTC)

	dailyRule := json.RawMessage(`{"freq":"daily","interval":1}`)
	tasks := []api.Task{
		{
			// Stopped/deleted recurring series on Web (recurrence_end_date in past,
			// base row still status="pending", zero entries in /tasks/next-occurrences).
			ID:                101,
			Title:             "obsidian 日报复盘",
			Status:            "pending",
			StartTime:         &oldAnchor,
			DueDate:           &oldAnchor,
			RecurrenceRule:    dailyRule,
			RecurrenceEndDate: &endedAt,
		},
		{
			// Active recurring series that DOES have a next pending occurrence today.
			ID:             102,
			Title:          "晨会同步",
			Status:         "pending",
			StartTime:      &oldAnchor,
			DueDate:        &oldAnchor, // stale series due date must be cleared by projection
			RecurrenceRule: dailyRule,
		},
		{
			// Locally created unsynced recurring task (negative ID) must remain visible.
			ID:             -1,
			Title:          "本地新建每日背单词",
			Status:         "pending",
			StartTime:      &todayStart,
			RecurrenceRule: dailyRule,
		},
	}

	next := []api.Occurrence{
		{
			InstanceID:   "102_20261123",
			TaskID:       102,
			Title:        "晨会同步",
			Status:       "pending",
			Priority:     2,
			StartTime:    todayStart,
			OriginalDate: todayOrig,
		},
	}
	history := []api.Occurrence{
		{
			InstanceID:   "101_20261111",
			TaskID:       101,
			Title:        "obsidian 日报复盘",
			Status:       "skipped",
			StartTime:    skippedStart,
			OriginalDate: skippedOrig,
		},
	}

	projected := ProjectTasks(tasks, next, history)

	activeAll := FilterAndSort(projected, FilterAll, 0, "", now, loc)
	if len(activeAll) != 2 {
		t.Fatalf("expected 2 active tasks (102 projected + -1 local), got %d: %+v", len(activeAll), activeAll)
	}
	for _, item := range activeAll {
		if item.ID == 101 {
			t.Fatalf("ended recurring series 101 (obsidian 日报复盘) must NOT appear in active lists: %+v", item)
		}
		if item.ID == 102 {
			if item.DueDate != nil {
				t.Fatalf("expected projected recurring occurrence 102 to clear stale DueDate, got %v", item.DueDate)
			}
			if item.InstanceID != "102_20261123" || item.OccurrenceDate != "2026-11-23" {
				t.Fatalf("unexpected projected occurrence metadata: %+v", item)
			}
		}
	}

	// Its skipped history occurrence still shows under FilterSkipped, just like Web/mygo-todo.
	skipped := FilterAndSort(projected, FilterSkipped, 0, "", now, loc)
	if len(skipped) != 1 || skipped[0].ID != 101 || skipped[0].InstanceID != "101_20261111" {
		t.Fatalf("expected skipped history occurrence for 101, got %+v", skipped)
	}
}
