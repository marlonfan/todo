package service

import (
	"errors"
	"testing"
	"todo-app/internal/models"
)

func TestParseOccurrenceDateFromInstanceID(t *testing.T) {
	got, found, err := parseOccurrenceDate("12_20260227", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !found {
		t.Fatalf("expected found=true")
	}
	if got.Format("2006-01-02") != "2026-02-27" {
		t.Fatalf("unexpected date %s", got.Format("2006-01-02"))
	}
}

func TestParseOccurrenceDateFromDateString(t *testing.T) {
	got, found, err := parseOccurrenceDate("", "2026-03-01")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !found {
		t.Fatalf("expected found=true")
	}
	if got.Format("2006-01-02") != "2026-03-01" {
		t.Fatalf("unexpected date %s", got.Format("2006-01-02"))
	}
}

func TestParseOccurrenceDateInvalid(t *testing.T) {
	if _, _, err := parseOccurrenceDate("invalid", ""); err == nil {
		t.Fatalf("expected invalid instance_id error")
	}
	if _, _, err := parseOccurrenceDate("", "2026/03/01"); err == nil {
		t.Fatalf("expected invalid occurrence_date error")
	}
}

func TestCheckRevisionNilExpectedAllowsWrite(t *testing.T) {
	task := &models.Task{Revision: 3}
	if err := checkRevision(nil, task); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func TestCheckRevisionMatch(t *testing.T) {
	expected := int64(2)
	task := &models.Task{Revision: 2}
	if err := checkRevision(&expected, task); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func TestCheckRevisionConflictReturnsLatestTask(t *testing.T) {
	expected := int64(1)
	task := &models.Task{ID: 99, Revision: 2, Title: "latest"}

	err := checkRevision(&expected, task)
	if err == nil {
		t.Fatalf("expected revision conflict")
	}

	var conflict *RevisionConflictError
	if !errors.As(err, &conflict) {
		t.Fatalf("expected RevisionConflictError, got %T", err)
	}
	if conflict.Latest == nil || conflict.Latest.ID != 99 {
		t.Fatalf("expected latest task snapshot to be returned")
	}
}

func TestRequiresRecurringOccurrenceContext(t *testing.T) {
	recurring := &models.Task{
		RecurrenceRule: &models.RecurrenceRule{Freq: "weekly"},
	}
	nonRecurring := &models.Task{}

	if !requiresRecurringOccurrenceContext(recurring, models.TaskStatusCompleted, false) {
		t.Fatalf("expected recurring completed status without context to require occurrence context")
	}
	if !requiresRecurringOccurrenceContext(recurring, models.TaskStatusPending, false) {
		t.Fatalf("expected recurring pending status without context to require occurrence context")
	}
	if requiresRecurringOccurrenceContext(recurring, models.TaskStatusCancelled, false) {
		t.Fatalf("cancelled should still allow series-level updates without occurrence context")
	}
	if requiresRecurringOccurrenceContext(recurring, models.TaskStatusCompleted, true) {
		t.Fatalf("status with occurrence context should not be blocked")
	}
	if requiresRecurringOccurrenceContext(nonRecurring, models.TaskStatusCompleted, false) {
		t.Fatalf("non-recurring task should not require occurrence context")
	}
}
