package api

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestOccurrenceScheduleHTTPContractAndAtomicReceipt(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)
	other, _ := registerAndLoginReminderUser(t, router)
	start := time.Now().UTC().AddDate(0, 0, 8).Truncate(24 * time.Hour).Add(10 * time.Hour)
	end := start.Add(time.Hour)
	rec := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{"title": "仅本次时间", "description": "系列描述", "start_time": start, "end_time": end, "recurrence_rule": map[string]any{"freq": "daily", "count": 1}}, nil)
	if rec.Code != 201 {
		t.Fatal(rec.Code, rec.Body.String())
	}
	task := decodeJSON[models.Task](t, rec)
	endpoint := fmt.Sprintf("/api/tasks/%d/occurrences/schedule", task.ID)
	id := fmt.Sprintf("%d_%s", task.ID, start.Format("20060102"))
	moved := start.AddDate(0, 0, -3)
	body := map[string]any{"instance_id": id, "occurrence_date": start.Format("2006-01-02"), "start_time": moved, "end_time": nil, "all_day": true}
	headers := map[string]string{"If-Match": fmt.Sprint(task.Revision), "X-Client-Op-Id": "schedule-http-retry"}
	for _, identity := range []string{"", other} {
		res := doJSON(t, router, http.MethodPatch, endpoint, identity, body, headers)
		if res.Code != http.StatusUnauthorized && res.Code != http.StatusNotFound {
			t.Fatal(res.Code, res.Body.String())
		}
	}
	res := doJSON(t, router, http.MethodPatch, endpoint, token, body, headers)
	if res.Code != 200 {
		t.Fatal(res.Code, res.Body.String())
	}
	saved := decodeJSON[models.Task](t, res)
	replay := doJSON(t, router, http.MethodPatch, endpoint, token, body, headers)
	if replay.Code != 200 || decodeJSON[models.Task](t, replay).Revision != saved.Revision {
		t.Fatal(replay.Code, replay.Body.String())
	}
	conflict := doJSON(t, router, http.MethodPatch, endpoint, token, body, map[string]string{"If-Match": fmt.Sprint(task.Revision), "X-Client-Op-Id": "another-op"})
	if conflict.Code != 409 {
		t.Fatal(conflict.Code, conflict.Body.String())
	}
	var rows int64
	db.Model(&models.TaskOccurrence{}).Where("task_id = ?", task.ID).Count(&rows)
	if rows != 1 || !saved.StartTime.Equal(start) || !saved.EndTime.Equal(end) || saved.AllDay || saved.Description != "系列描述" {
		t.Fatal(rows, saved)
	}
	var receipts int64
	db.Model(&models.TaskMutationReceipt{}).Where("user_id = ? AND op_id = ?", user.ID, headers["X-Client-Op-Id"]).Count(&receipts)
	if receipts != 1 {
		t.Fatal(receipts)
	}
	events := func(day time.Time) []models.CalendarEvent {
		query := url.Values{"start": {day.Add(-time.Hour).Format(time.RFC3339)}, "end": {day.Add(2 * time.Hour).Format(time.RFC3339)}}
		rec := doJSON(t, router, http.MethodGet, "/api/calendar?"+query.Encode(), token, nil, nil)
		if rec.Code != 200 {
			t.Fatal(rec.Code, rec.Body.String())
		}
		return decodeJSON[[]models.CalendarEvent](t, rec)
	}
	old := events(start)
	for _, e := range old {
		if e.ExtendedProps.TaskID == task.ID {
			t.Fatal("moved instance remained at original date", old)
		}
	}
	found := 0
	for _, e := range events(moved) {
		if e.ExtendedProps.TaskID == task.ID {
			found++
			if e.ExtendedProps.InstanceID != id || e.End != "" || !e.AllDay {
				t.Fatal(e)
			}
		}
	}
	if found != 1 {
		t.Fatal("missing or duplicate shifted event", found)
	}
	activities := doJSON(t, router, http.MethodGet, fmt.Sprintf("/api/tasks/%d/activities", task.ID), token, nil, nil)
	activity := decodeJSON[[]models.TaskActivity](t, activities)
	field := "occurrence_schedule:" + start.Format("2006-01-02")
	has := false
	for _, a := range activity {
		if _, ok := a.Changes[field]; ok {
			has = true
		}
	}
	if !has {
		t.Fatal("missing scoped activity", activity)
	}
	reset := doJSON(t, router, http.MethodPatch, endpoint, token, map[string]any{"instance_id": id, "reset_schedule": true}, map[string]string{"If-Match": fmt.Sprint(saved.Revision), "X-Client-Op-Id": "restore-http"})
	if reset.Code != 200 {
		t.Fatal(reset.Code, reset.Body.String())
	}
	db.Model(&models.TaskOccurrence{}).Where("task_id = ?", task.ID).Count(&rows)
	if rows != 0 {
		t.Fatal("default override not cleaned up", rows)
	}
}
