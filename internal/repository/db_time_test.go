package repository

import (
	"testing"
	"time"
)

func TestNullableDBTimeScan(t *testing.T) {
	want := time.Date(2026, 7, 10, 10, 21, 30, 443657000, time.UTC)
	for _, input := range []any{
		want,
		"2026-07-10 10:21:30.443657+00:00",
		[]byte("2026-07-10T10:21:30.443657Z"),
	} {
		var got nullableDBTime
		if err := got.Scan(input); err != nil {
			t.Fatalf("scan %T: %v", input, err)
		}
		if !got.Valid || !got.Time.Equal(want) {
			t.Fatalf("scan %T = (%v, %v), want %v", input, got.Time, got.Valid, want)
		}
	}

	var empty nullableDBTime
	if err := empty.Scan(nil); err != nil || empty.Valid {
		t.Fatalf("scan nil = (%v, %v), err=%v", empty.Time, empty.Valid, err)
	}
	if err := empty.Scan("not-a-time"); err == nil {
		t.Fatal("invalid time should fail")
	}

	var zoned nullableDBTime
	if err := zoned.Scan("2026-07-10 18:21:30.443657+08:00"); err != nil {
		t.Fatalf("scan zoned time: %v", err)
	}
	if !zoned.Time.Equal(want) {
		t.Fatalf("zoned time=%v want=%v", zoned.Time, want)
	}
}
