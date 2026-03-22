package service

import (
	"errors"
	"testing"
	"time"
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

	if requiresRecurringOccurrenceContext(recurring, models.TaskStatusCompleted, false) {
		t.Fatalf("series-level completed should not require occurrence context")
	}
	if requiresRecurringOccurrenceContext(recurring, models.TaskStatusPending, false) {
		t.Fatalf("series-level pending should not require occurrence context")
	}
	if requiresRecurringOccurrenceContext(recurring, models.TaskStatusCancelled, false) {
		t.Fatalf("series-level cancelled should not require occurrence context")
	}
	if requiresRecurringOccurrenceContext(recurring, models.TaskStatusCompleted, true) {
		t.Fatalf("status with occurrence context should not be blocked")
	}
	if requiresRecurringOccurrenceContext(nonRecurring, models.TaskStatusCompleted, false) {
		t.Fatalf("non-recurring task should not require occurrence context")
	}
}

func TestStatusTimestampTransitionCompletedAndReset(t *testing.T) {
	baseNow := time.Date(2026, 3, 22, 8, 0, 0, 0, time.UTC)
	status, completedAt, deletedAt, changed := statusTimestampTransition(
		models.TaskStatusPending,
		nil,
		nil,
		models.TaskStatusCompleted,
		baseNow,
	)
	if !changed {
		t.Fatalf("expected changed=true")
	}
	if status != models.TaskStatusCompleted {
		t.Fatalf("status = %q, want completed", status)
	}
	if completedAt == nil || !completedAt.UTC().Equal(baseNow) {
		t.Fatalf("completed_at = %v, want %v", completedAt, baseNow)
	}
	if deletedAt != nil {
		t.Fatalf("deleted_at = %v, want nil", deletedAt)
	}

	status, completedAt, deletedAt, changed = statusTimestampTransition(
		status,
		completedAt,
		deletedAt,
		models.TaskStatusPending,
		baseNow.Add(1*time.Hour),
	)
	if !changed {
		t.Fatalf("expected changed=true on reset to pending")
	}
	if status != models.TaskStatusPending {
		t.Fatalf("status = %q, want pending", status)
	}
	if completedAt != nil || deletedAt != nil {
		t.Fatalf("timestamps should be cleared when status goes pending")
	}
}

func TestStatusTimestampTransitionCancelledAndReset(t *testing.T) {
	baseNow := time.Date(2026, 3, 22, 9, 0, 0, 0, time.UTC)
	status, completedAt, deletedAt, changed := statusTimestampTransition(
		models.TaskStatusPending,
		nil,
		nil,
		models.TaskStatusCancelled,
		baseNow,
	)
	if !changed {
		t.Fatalf("expected changed=true")
	}
	if status != models.TaskStatusCancelled {
		t.Fatalf("status = %q, want cancelled", status)
	}
	if deletedAt == nil || !deletedAt.UTC().Equal(baseNow) {
		t.Fatalf("deleted_at = %v, want %v", deletedAt, baseNow)
	}
	if completedAt != nil {
		t.Fatalf("completed_at = %v, want nil", completedAt)
	}

	status, completedAt, deletedAt, changed = statusTimestampTransition(
		status,
		completedAt,
		deletedAt,
		models.TaskStatusPending,
		baseNow.Add(1*time.Hour),
	)
	if !changed {
		t.Fatalf("expected changed=true on reset to pending")
	}
	if completedAt != nil || deletedAt != nil {
		t.Fatalf("timestamps should be cleared when status goes pending")
	}
}
