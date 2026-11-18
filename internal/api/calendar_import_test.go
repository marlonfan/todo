package api

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"todo-app/internal/models"
)

type calendarWriteRaceReader struct {
	io.Reader
	once       sync.Once
	beforeRead func()
}

func (r *calendarWriteRaceReader) Read(p []byte) (int, error) {
	r.once.Do(r.beforeRead)
	return r.Reader.Read(p)
}

func TestCalendarImportDAVWriteNativeProjectionAndAtomicPreconditions(t *testing.T) {
	router := setupE2ERouter(t)
	token, user := registerAndLoginReminderUser(t, router)
	if r := doJSON(t, router, "PATCH", "/api/auth/profile", token, map[string]any{"timezone": "UTC", "default_reminder_enabled": false}, nil); r.Code != 200 {
		t.Fatal(r.Body.String())
	}
	start := time.Now().UTC().AddDate(0, 0, 10).Truncate(time.Second)
	end := start.Add(time.Hour)
	created := doJSON(t, router, "POST", "/api/tasks", token, map[string]any{"title": "DAV 系列", "description": "系列说明", "start_time": start, "end_time": end, "recurrence_rule": map[string]any{"freq": "daily", "count": 3}}, nil)
	if created.Code != 201 {
		t.Fatal(created.Code, created.Body.String())
	}
	task := decodeJSON[models.Task](t, created)
	path := fmt.Sprintf("/dav/calendars/%s/todo/task-%d.ics", user.Username, task.ID)
	dav := func(method, path string, body io.Reader, headers map[string]string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, body)
		req.SetBasicAuth(user.Username, "secret123")
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	initial := dav("GET", path, nil, nil)
	if initial.Code != 200 {
		t.Fatal(initial.Code, initial.Body.String())
	}
	uid := fmt.Sprintf("todo-task-%d@todo-app", task.ID)
	moved := start.AddDate(0, 0, -4)
	child := fmt.Sprintf("BEGIN:VEVENT\r\nUID:%s\r\nRECURRENCE-ID:%s\r\nDTSTART:%s\r\nDTEND:%s\r\nDESCRIPTION:外部日历改本次\r\nEND:VEVENT\r\n", uid, start.AddDate(0, 0, 1).Format("20060102T150405Z"), moved.Format("20060102T150405Z"), moved.Add(2*time.Hour).Format("20060102T150405Z"))
	cancelled := fmt.Sprintf("BEGIN:VEVENT\r\nUID:%s\r\nRECURRENCE-ID:%s\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\n", uid, start.AddDate(0, 0, 2).Format("20060102T150405Z"))
	data := strings.Replace(initial.Body.String(), "END:VCALENDAR", child+cancelled+"END:VCALENDAR", 1)
	written := dav("PUT", path, strings.NewReader(data), map[string]string{"If-Match": initial.Header().Get("ETag"), "Content-Type": "text/calendar"})
	if written.Code != 204 {
		t.Fatal(written.Code, written.Body.String())
	}
	after := dav("GET", path, nil, nil)
	if after.Code != 200 || strings.Count(after.Body.String(), "RECURRENCE-ID") != 2 || after.Header().Get("ETag") != written.Header().Get("ETag") {
		t.Fatal(after.Body.String())
	}
	calendarURL := fmt.Sprintf("/api/calendar?start=%s&end=%s", moved.Add(-time.Hour).Format(time.RFC3339), moved.Add(3*time.Hour).Format(time.RFC3339))
	calendar := doJSON(t, router, "GET", calendarURL, token, nil, nil)
	if calendar.Code != 200 || !strings.Contains(calendar.Body.String(), "外部日历改本次") || !strings.Contains(calendar.Body.String(), fmt.Sprintf("%d_%s", task.ID, start.AddDate(0, 0, 1).Format("20060102"))) {
		t.Fatal("native calendar projection lost original identity", calendar.Code, calendar.Body.String())
	}
	activities := doJSON(t, router, "GET", fmt.Sprintf("/api/tasks/%d/activities", task.ID), token, nil, nil)
	if activities.Code != 200 || !strings.Contains(activities.Body.String(), "caldav_occurrence:") || !strings.Contains(activities.Body.String(), "caldav") {
		t.Fatal(activities.Code, activities.Body.String())
	}

	// Modify the task after the PUT begins reading its body. Checking If-Match
	// before reading would accept an obsolete full-resource replacement.
	raceBody := &calendarWriteRaceReader{Reader: strings.NewReader(after.Body.String()), beforeRead: func() {
		update := doJSON(t, router, "PUT", fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{"title": "并行修改保留"}, nil)
		if update.Code != 200 {
			t.Fatal(update.Code, update.Body.String())
		}
	}}
	stale := dav("PUT", path, raceBody, map[string]string{"If-Match": after.Header().Get("ETag")})
	if stale.Code != http.StatusPreconditionFailed {
		t.Fatal("non-atomic If-Match", stale.Code, stale.Body.String())
	}
	current := dav("GET", path, nil, nil)
	if !strings.Contains(current.Body.String(), "SUMMARY:并行修改保留") || strings.Count(current.Body.String(), "RECURRENCE-ID") != 2 {
		t.Fatal(current.Body.String())
	}
	// Create-only conditions are checked under the same lock as creation too.
	newPath := fmt.Sprintf("/dav/calendars/%s/todo/new-race.ics", user.Username)
	newData := "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:race@example\r\nSUMMARY:并行创建保留\r\nDTSTART:20261201T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
	createRace := &calendarWriteRaceReader{Reader: strings.NewReader(strings.Replace(newData, "并行创建保留", "不应覆盖", 1)), beforeRead: func() {
		inner := dav("PUT", newPath, strings.NewReader(newData), map[string]string{"If-None-Match": "*"})
		if inner.Code != 201 {
			t.Fatal(inner.Code, inner.Body.String())
		}
	}}
	if outer := dav("PUT", newPath, createRace, map[string]string{"If-None-Match": "*"}); outer.Code != 412 {
		t.Fatal(outer.Code, outer.Body.String())
	}
	if r := dav("GET", newPath, nil, nil); !strings.Contains(r.Body.String(), "SUMMARY:并行创建保留") {
		t.Fatal(r.Body.String())
	}
}
