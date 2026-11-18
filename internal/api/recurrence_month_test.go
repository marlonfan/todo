package api

import (
	"fmt"
	"net/url"
	"reflect"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestMonthLimitedRecurrenceNativeCalendarProjection(t *testing.T) {
	router := setupE2ERouter(t)
	token, _ := registerAndLoginReminderUser(t, router)
	if r := doJSON(t, router, "PATCH", "/api/auth/profile", token, map[string]any{"timezone": "America/New_York", "default_reminder_enabled": false}, nil); r.Code != 200 {
		t.Fatal(r.Body.String())
	}
	loc, _ := time.LoadLocation("America/New_York")
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, loc)
	end := time.Date(2027, 1, 1, 0, 0, 0, 0, loc)
	created := doJSON(t, router, "POST", "/api/tasks", token, map[string]any{"title": "月份与边界", "start_time": start, "recurrence_rule": map[string]any{"freq": "weekly", "byday": []string{"MO"}, "bymonth": []int{3, 11}, "count": 3}}, nil)
	if created.Code != 201 {
		t.Fatal(created.Code, created.Body.String())
	}
	task := decodeJSON[models.Task](t, created)
	query := url.Values{"start": {start.Format(time.RFC3339)}, "end": {end.Format(time.RFC3339)}}
	path := fmt.Sprintf("/api/tasks/%d/instances?%s", task.ID, query.Encode())
	read := func() []string {
		t.Helper()
		r := doJSON(t, router, "GET", path, token, nil, nil)
		if r.Code != 200 {
			t.Fatal(r.Code, r.Body.String())
		}
		items := decodeJSON[[]struct {
			StartTime time.Time `json:"start_time"`
		}](t, r)
		dates := make([]string, len(items))
		for i, item := range items {
			dates[i] = item.StartTime.In(loc).Format("2006-01-02 15:04 -0700")
		}
		return dates
	}
	want := []string{"2026-03-02 09:00 -0500", "2026-03-09 09:00 -0400", "2026-03-16 09:00 -0400"}
	if got := read(); !reflect.DeepEqual(got, want) {
		t.Fatal("native instance projection ignored month/count/DST", got)
	}
	// Native editors support both stop conditions; only dates through the
	// earlier boundary are displayed, inclusively.
	until := time.Date(2026, 3, 9, 23, 59, 59, 0, loc)
	r := doJSON(t, router, "PUT", fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{"recurrence_end_date": until}, nil)
	if r.Code != 200 {
		t.Fatal(r.Code, r.Body.String())
	}
	if got := read(); !reflect.DeepEqual(got, want[:2]) {
		t.Fatal("month-constrained series did not respect inclusive end", got)
	}
}
