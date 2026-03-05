package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"todo-app/internal/models"
	"todo-app/internal/repository"
	"todo-app/migrations"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSyncCalendarCache_ExtendsCoverageAfterIncrementalSync(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	repo := repository.NewCaldavRepository(db)
	svc := NewCaldavService(repo, "test-secret")

	now := time.Now().UTC()
	futureStart := now.AddDate(1, 0, 0).Truncate(time.Second)
	futureEnd := futureStart.Add(45 * time.Minute)
	ics := fmt.Sprintf("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:future-uid\r\nDTSTART:%s\r\nDTEND:%s\r\nSUMMARY:Future Meeting\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
		futureStart.Format("20060102T150405Z"),
		futureEnd.Format("20060102T150405Z"),
	)

	var queryCount int64
	svc.httpClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != "REPORT" {
				return xmlHTTPResponse(http.StatusMethodNotAllowed, "<error>method not allowed</error>"), nil
			}
			raw, _ := io.ReadAll(r.Body)
			body := string(raw)
			if strings.Contains(body, "sync-collection") {
				return xmlHTTPResponse(http.StatusMultiStatus, `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:sync-token>token-next</d:sync-token>
</d:multistatus>`), nil
			}
			if strings.Contains(body, "calendar-query") {
				atomic.AddInt64(&queryCount, 1)
				return xmlHTTPResponse(http.StatusMultiStatus, fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/calendar/future.ics</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"etag-future"</d:getetag>
        <c:calendar-data><![CDATA[%s]]></c:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`, ics)), nil
			}
			return xmlHTTPResponse(http.StatusMultiStatus, `<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:"/>`), nil
		}),
	}

	source := &models.CaldavSource{
		UserID:   1,
		Name:     "feishu",
		BaseURL:  "https://caldav.example",
		Username: "user",
		IsActive: true,
	}
	if err := repo.CreateSource(source); err != nil {
		t.Fatalf("create source: %v", err)
	}

	calendar := &models.CaldavCalendar{
		UserID:      source.UserID,
		SourceID:    source.ID,
		CalendarURL: "https://caldav.example/calendar/",
		IsSelected:  true,
		SyncToken:   "token-old",
	}
	if err := db.Create(calendar).Error; err != nil {
		t.Fatalf("create calendar: %v", err)
	}

	seedEvents := []models.CaldavEventCache{
		{
			UserID:       source.UserID,
			SourceID:     source.ID,
			CalendarID:   calendar.ID,
			EventUID:     "seed-early",
			RecurrenceID: "",
			Title:        "early",
			StartTime:    now.AddDate(-2, 0, 0),
			Status:       "confirmed",
		},
		{
			UserID:       source.UserID,
			SourceID:     source.ID,
			CalendarID:   calendar.ID,
			EventUID:     "seed-late",
			RecurrenceID: "",
			Title:        "late",
			StartTime:    now.AddDate(0, -2, 0),
			Status:       "confirmed",
		},
	}
	for i := range seedEvents {
		if err := repo.UpsertEvent(&seedEvents[i]); err != nil {
			t.Fatalf("seed event: %v", err)
		}
	}

	if err := svc.syncCalendarCache(context.Background(), source, "pwd", calendar); err != nil {
		t.Fatalf("sync calendar cache: %v", err)
	}

	if got := strings.TrimSpace(calendar.SyncToken); got != "token-next" {
		t.Fatalf("sync token = %q, want token-next", got)
	}
	if atomic.LoadInt64(&queryCount) == 0 {
		t.Fatalf("expected at least one calendar-query request for coverage extension")
	}

	var inserted models.CaldavEventCache
	if err := db.Where("user_id = ? AND source_id = ? AND calendar_id = ? AND event_uid = ?", source.UserID, source.ID, calendar.ID, "future-uid").
		First(&inserted).Error; err != nil {
		t.Fatalf("future event not inserted: %v", err)
	}
	if inserted.StartTime.UTC().Format(time.RFC3339) != futureStart.Format(time.RFC3339) {
		t.Fatalf("future start=%s want=%s", inserted.StartTime.UTC().Format(time.RFC3339), futureStart.Format(time.RFC3339))
	}
}

func TestExpandParsedEvents_RecurrenceOverrideUsesCanonicalRecurrenceID(t *testing.T) {
	raw := strings.Join([]string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"X-WR-TIMEZONE:Asia/Shanghai",
		"BEGIN:VEVENT",
		"UID:override-test",
		"DTSTART;TZID=Asia/Shanghai:20260227T100000",
		"DTEND;TZID=Asia/Shanghai:20260227T110000",
		"RRULE:FREQ=WEEKLY;COUNT=2",
		"SUMMARY:Weekly",
		"END:VEVENT",
		"BEGIN:VEVENT",
		"UID:override-test",
		"RECURRENCE-ID;TZID=Asia/Shanghai:20260306T100000",
		"DTSTART;TZID=Asia/Shanghai:20260306T103000",
		"DTEND;TZID=Asia/Shanghai:20260306T113000",
		"SUMMARY:Weekly",
		"END:VEVENT",
		"END:VCALENDAR",
	}, "\r\n") + "\r\n"

	events := parseICSCalendarData(raw)
	start, _ := time.Parse(time.RFC3339, "2026-02-26T00:00:00Z")
	end, _ := time.Parse(time.RFC3339, "2026-03-10T00:00:00Z")
	expanded := expandParsedEvents(events, start, end, true)

	if len(expanded) != 2 {
		t.Fatalf("expanded count = %d, want 2", len(expanded))
	}

	var gotMarch6 *parsedEvent
	for i := range expanded {
		item := expanded[i]
		if item.Start.UTC().Format(time.RFC3339) == "2026-03-06T02:30:00Z" {
			gotMarch6 = &item
			break
		}
	}
	if gotMarch6 == nil {
		t.Fatalf("missing overridden occurrence at 2026-03-06T02:30:00Z")
	}
	if gotMarch6.RecurrenceID != "20260306T020000Z" {
		t.Fatalf("recurrence id = %s, want 20260306T020000Z", gotMarch6.RecurrenceID)
	}
}

func TestUpdateSource_EmptyPasswordKeepsExistingCredentials(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	repo := repository.NewCaldavRepository(db)
	svc := NewCaldavService(repo, "test-secret")

	enc, err := encryptSecret("old-pass", "test-secret")
	if err != nil {
		t.Fatalf("encrypt old pass: %v", err)
	}
	source := &models.CaldavSource{
		UserID:      1,
		Name:        "feishu",
		BaseURL:     "https://caldav.example",
		Username:    "u1",
		PasswordEnc: enc,
	}
	if err := repo.CreateSource(source); err != nil {
		t.Fatalf("create source: %v", err)
	}

	inactive := false
	resp, err := svc.UpdateSource(context.Background(), source.UserID, source.ID, &models.CaldavUpsertSourceRequest{
		Name:     "feishu-updated",
		BaseURL:  "https://caldav.example",
		Username: "u1",
		Password: "",
		Calendars: []models.CaldavCalendarChoice{
			{CalendarURL: "https://caldav.example/calendar/main/"},
		},
		IsActive: &inactive,
	})
	if err != nil {
		t.Fatalf("update source: %v", err)
	}
	if resp.Name != "feishu-updated" {
		t.Fatalf("updated name=%q want feishu-updated", resp.Name)
	}

	updated, err := repo.GetSourceByID(source.UserID, source.ID)
	if err != nil {
		t.Fatalf("get updated source: %v", err)
	}
	if updated.PasswordEnc != enc {
		t.Fatalf("password ciphertext changed unexpectedly")
	}
	pass, err := decryptSecret(updated.PasswordEnc, "test-secret")
	if err != nil {
		t.Fatalf("decrypt updated pass: %v", err)
	}
	if pass != "old-pass" {
		t.Fatalf("password=%q want old-pass", pass)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func xmlHTTPResponse(code int, body string) *http.Response {
	return &http.Response{
		StatusCode: code,
		Status:     fmt.Sprintf("%d %s", code, http.StatusText(code)),
		Header:     http.Header{"Content-Type": []string{"application/xml; charset=utf-8"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
