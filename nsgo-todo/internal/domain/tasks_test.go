package domain

import (
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
