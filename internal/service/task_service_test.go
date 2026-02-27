package service

import "testing"

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
