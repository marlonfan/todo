package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestCalendarOccurrenceFeedAndDAVRefreshContract(t *testing.T) {
	router := setupE2ERouter(t)
	token, user := registerAndLoginReminderUser(t, router)
	profile := doJSON(t, router, http.MethodPatch, "/api/auth/profile", token, map[string]any{"timezone": "Asia/Shanghai", "default_reminder_enabled": false}, nil)
	if profile.Code != 200 {
		t.Fatal(profile.Body.String())
	}
	loc, _ := time.LoadLocation("Asia/Shanghai")
	day := time.Now().In(loc).AddDate(0, 0, 9)
	start := time.Date(day.Year(), day.Month(), day.Day(), 10, 0, 0, 0, loc)
	until := start.AddDate(0, 0, 1)
	created := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{"title": "订阅单次改期", "start_time": start, "recurrence_rule": map[string]any{"freq": "daily"}, "recurrence_end_date": until}, nil)
	if created.Code != 201 {
		t.Fatal(created.Body.String())
	}
	task := decodeJSON[models.Task](t, created)
	calendar := "/dav/calendars/" + user.Username + "/todo/"
	objectPath := calendar + fmt.Sprintf("task-%d.ics", task.ID)
	dav := func(method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.SetBasicAuth(user.Username, "secret123")
		for key, value := range headers {
			req.Header.Set(key, value)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	ctag := func() string {
		r := dav("PROPFIND", calendar, `<D:propfind xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/"><D:prop><CS:getctag/></D:prop></D:propfind>`, map[string]string{"Depth": "0", "Content-Type": "application/xml"})
		if r.Code != 207 {
			t.Fatal(r.Code, r.Body.String())
		}
		return r.Body.String()
	}
	before := dav("GET", objectPath, "", nil)
	if before.Code != 200 {
		t.Fatal(before.Code, before.Body.String())
	}
	beforeTag := ctag()
	moved := start.AddDate(0, 0, -4)
	endpoint := fmt.Sprintf("/api/tasks/%d/occurrences/schedule", task.ID)
	update := doJSON(t, router, "PATCH", endpoint, token, map[string]any{"occurrence_date": start.Format("2006-01-02"), "start_time": moved, "all_day": true}, map[string]string{"If-Match": fmt.Sprint(task.Revision), "X-Client-Op-Id": "calendar-export-move"})
	if update.Code != 200 {
		t.Fatal(update.Code, update.Body.String())
	}
	get := dav("GET", objectPath, "", nil)
	if get.Code != 200 || before.Header().Get("ETag") == get.Header().Get("ETag") || ctag() == beforeTag {
		t.Fatal("DAV refresh state did not change")
	}
	if strings.Count(get.Body.String(), "BEGIN:VEVENT") != 2 || !strings.Contains(get.Body.String(), "RECURRENCE-ID;TZID=Asia/Shanghai:"+start.Format("20060102T150405")) {
		t.Fatal(get.Body.String())
	}
	info := decodeJSON[map[string]string](t, doJSON(t, router, "GET", "/api/calendar/subscription", token, nil, nil))
	feedURL, err := url.Parse(info["ics_url"])
	if err != nil {
		t.Fatal(err)
	}
	feed := doJSON(t, router, "GET", feedURL.RequestURI(), "", nil, nil)
	if feed.Code != 200 || strings.Count(feed.Body.String(), "BEGIN:VEVENT") != 2 || !strings.Contains(feed.Body.String(), "RECURRENCE-ID") {
		t.Fatal(feed.Code, feed.Body.String())
	}
	query := fmt.Sprintf(`<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><D:getetag/><C:calendar-data/></D:prop><C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"><C:time-range start="%s" end="%s"/></C:comp-filter></C:comp-filter></C:filter></C:calendar-query>`, moved.Add(-time.Hour).UTC().Format("20060102T150405Z"), moved.Add(time.Hour).UTC().Format("20060102T150405Z"))
	queryResponse := dav("REPORT", calendar, query, map[string]string{"Depth": "1", "Content-Type": "application/xml"})
	if queryResponse.Code != 207 || !strings.Contains(queryResponse.Body.String(), "RECURRENCE-ID") {
		t.Fatal("range query lost the moved-in instance", queryResponse.Code, queryResponse.Body.String())
	}
	multiget := `<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-data/></D:prop><D:href>` + objectPath + `</D:href></C:calendar-multiget>`
	multiResponse := dav("REPORT", calendar, multiget, map[string]string{"Depth": "1", "Content-Type": "application/xml"})
	if multiResponse.Code != 207 || !strings.Contains(multiResponse.Body.String(), "RECURRENCE-ID") {
		t.Fatal(multiResponse.Code, multiResponse.Body.String())
	}
	stale := dav("PUT", objectPath, get.Body.String(), map[string]string{"If-Match": before.Header().Get("ETag")})
	if stale.Code != 412 {
		t.Fatal("stale DAV write accepted", stale.Code)
	}
	written := dav("PUT", objectPath, get.Body.String(), map[string]string{"If-Match": get.Header().Get("ETag"), "Content-Type": "text/calendar"})
	if written.Code != 204 || written.Header().Get("ETag") == "" {
		t.Fatal("detached DAV roundtrip failed", written.Code, written.Body.String())
	}
	if after := dav("GET", objectPath, "", nil); after.Code != 200 || strings.Count(after.Body.String(), "RECURRENCE-ID") != 1 || after.Header().Get("ETag") != written.Header().Get("ETag") {
		t.Fatal("detached DAV roundtrip lost instance or returned wrong ETag")
	}
	reset := doJSON(t, router, "PATCH", endpoint, token, map[string]any{"occurrence_date": start.Format("2006-01-02"), "reset_schedule": true}, nil)
	if reset.Code != 200 {
		t.Fatal(reset.Code, reset.Body.String())
	}
	if after := dav("GET", objectPath, "", nil); after.Code != 200 || strings.Contains(after.Body.String(), "RECURRENCE-ID") || after.Header().Get("ETag") == get.Header().Get("ETag") {
		t.Fatal("reset did not remove the detached override")
	}
}
