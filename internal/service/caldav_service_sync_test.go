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
	futureStart := now.AddDate(0, 2, 0).Truncate(time.Second)
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

func TestDefaultCaldavExpansionWindow_UsesThreeMonthsBackAndSixMonthsForward(t *testing.T) {
	now := time.Now().UTC()
	start, end := defaultCaldavExpansionWindow()
	wantStart := now.AddDate(0, -3, 0)
	wantEnd := now.AddDate(0, 6, 0)
	const tolerance = 2 * time.Second

	if diff := start.Sub(wantStart); diff < -tolerance || diff > tolerance {
		t.Fatalf("start diff=%v want within ±%v", diff, tolerance)
	}
	if diff := end.Sub(wantEnd); diff < -tolerance || diff > tolerance {
		t.Fatalf("end diff=%v want within ±%v", diff, tolerance)
	}
}

func TestSyncCalendarCache_FeishuIncrementalSkipsCoverageExtension(t *testing.T) {
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
	var calendarQueryCount int64
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
				atomic.AddInt64(&calendarQueryCount, 1)
			}
			return xmlHTTPResponse(http.StatusMultiStatus, `<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:"/>`), nil
		}),
	}

	source := &models.CaldavSource{
		UserID:   1,
		Name:     "feishu",
		BaseURL:  "https://caldav.feishu.cn",
		Username: "user",
		IsActive: true,
	}
	if err := repo.CreateSource(source); err != nil {
		t.Fatalf("create source: %v", err)
	}
	calendar := &models.CaldavCalendar{
		UserID:      source.UserID,
		SourceID:    source.ID,
		CalendarURL: "https://caldav.feishu.cn/calendar/",
		IsSelected:  true,
		SyncToken:   "token-old",
	}
	if err := db.Create(calendar).Error; err != nil {
		t.Fatalf("create calendar: %v", err)
	}
	if err := repo.UpsertEvent(&models.CaldavEventCache{
		UserID:       source.UserID,
		SourceID:     source.ID,
		CalendarID:   calendar.ID,
		EventUID:     "seed-mid",
		RecurrenceID: "",
		Title:        "seed",
		StartTime:    time.Now().UTC().AddDate(0, -1, 0),
		Status:       "confirmed",
	}); err != nil {
		t.Fatalf("seed event: %v", err)
	}

	if err := svc.syncCalendarCache(context.Background(), source, "pwd", calendar); err != nil {
		t.Fatalf("sync calendar cache: %v", err)
	}
	if got := strings.TrimSpace(calendar.SyncToken); got != "token-next" {
		t.Fatalf("sync token=%q want token-next", got)
	}
	if got := atomic.LoadInt64(&calendarQueryCount); got <= 0 {
		t.Fatalf("calendar-query count=%d want > 0", got)
	}
}

func TestSyncCalendarCache_FeishuCTagNoChangeSkipsCoverageExtension(t *testing.T) {
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
	var calendarQueryCount int64
	svc.httpClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method == "PROPFIND" {
				return xmlHTTPResponse(http.StatusMultiStatus, `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
  <d:response>
    <d:propstat>
      <d:prop>
        <cs:getctag>same-ctag</cs:getctag>
        <d:sync-token>token-next</d:sync-token>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`), nil
			}
			if r.Method == "REPORT" {
				raw, _ := io.ReadAll(r.Body)
				if strings.Contains(string(raw), "calendar-query") {
					atomic.AddInt64(&calendarQueryCount, 1)
				}
				return xmlHTTPResponse(http.StatusMultiStatus, `<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:"/>`), nil
			}
			return xmlHTTPResponse(http.StatusMethodNotAllowed, "<error>method not allowed</error>"), nil
		}),
	}

	source := &models.CaldavSource{
		UserID:   1,
		Name:     "feishu",
		BaseURL:  "https://caldav.feishu.cn",
		Username: "user",
		IsActive: true,
	}
	if err := repo.CreateSource(source); err != nil {
		t.Fatalf("create source: %v", err)
	}
	calendar := &models.CaldavCalendar{
		UserID:      source.UserID,
		SourceID:    source.ID,
		CalendarURL: "https://caldav.feishu.cn/calendar/",
		IsSelected:  true,
		CTag:        "same-ctag",
	}
	if err := db.Create(calendar).Error; err != nil {
		t.Fatalf("create calendar: %v", err)
	}
	if err := repo.UpsertEvent(&models.CaldavEventCache{
		UserID:       source.UserID,
		SourceID:     source.ID,
		CalendarID:   calendar.ID,
		EventUID:     "seed-mid",
		RecurrenceID: "",
		Title:        "seed",
		StartTime:    time.Now().UTC().AddDate(0, -1, 0),
		Status:       "confirmed",
	}); err != nil {
		t.Fatalf("seed event: %v", err)
	}

	if err := svc.syncCalendarCache(context.Background(), source, "pwd", calendar); err != nil {
		t.Fatalf("sync calendar cache: %v", err)
	}
	if got := strings.TrimSpace(calendar.SyncToken); got != "token-next" {
		t.Fatalf("sync token=%q want token-next", got)
	}
	if got := atomic.LoadInt64(&calendarQueryCount); got <= 0 {
		t.Fatalf("calendar-query count=%d want > 0", got)
	}
}

func TestSyncCalendarCache_FeishuIncrementalRepairsMissingRemoteHref(t *testing.T) {
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

	base := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
	startA := base
	endA := startA.Add(30 * time.Minute)
	startB := base.Add(24 * time.Hour)
	endB := startB.Add(90 * time.Minute)
	hrefA := "/calendar/a.ics"
	hrefB := "/calendar/b.ics"
	icsA := fmt.Sprintf("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:uid-a\r\nDTSTART:%s\r\nDTEND:%s\r\nSUMMARY:A Event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
		startA.Format("20060102T150405Z"),
		endA.Format("20060102T150405Z"),
	)
	icsB := fmt.Sprintf("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:uid-b\r\nDTSTART:%s\r\nDTEND:%s\r\nSUMMARY:年夜饭\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
		startB.Format("20060102T150405Z"),
		endB.Format("20060102T150405Z"),
	)
	var fullQueryCount int64
	var reconcileQueryCount int64
	var multigetCount int64
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
			if strings.Contains(body, "calendar-multiget") {
				atomic.AddInt64(&multigetCount, 1)
				return xmlHTTPResponse(http.StatusMultiStatus, fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>%s</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"etag-a"</d:getetag>
        <c:calendar-data><![CDATA[%s]]></c:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>%s</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"etag-b"</d:getetag>
        <c:calendar-data><![CDATA[%s]]></c:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`, hrefA, icsA, hrefB, icsB)), nil
			}
			if strings.Contains(body, "calendar-query") && strings.Contains(body, "time-range") && !strings.Contains(body, "calendar-data") {
				atomic.AddInt64(&reconcileQueryCount, 1)
				return xmlHTTPResponse(http.StatusMultiStatus, fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>%s</d:href></d:response>
  <d:response><d:href>%s</d:href></d:response>
</d:multistatus>`, hrefA, hrefB)), nil
			}
			if strings.Contains(body, "calendar-query") {
				atomic.AddInt64(&fullQueryCount, 1)
				return xmlHTTPResponse(http.StatusMultiStatus, fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>%s</d:href></d:response>
  <d:response><d:href>%s</d:href></d:response>
</d:multistatus>`, hrefA, hrefB)), nil
			}
			return xmlHTTPResponse(http.StatusMultiStatus, `<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:"/>`), nil
		}),
	}

	source := &models.CaldavSource{
		UserID:   1,
		Name:     "feishu",
		BaseURL:  "https://caldav.feishu.cn",
		Username: "user",
		IsActive: true,
	}
	if err := repo.CreateSource(source); err != nil {
		t.Fatalf("create source: %v", err)
	}
	calendar := &models.CaldavCalendar{
		UserID:      source.UserID,
		SourceID:    source.ID,
		CalendarURL: "https://caldav.feishu.cn/calendar/",
		IsSelected:  true,
		SyncToken:   "token-old",
	}
	if err := db.Create(calendar).Error; err != nil {
		t.Fatalf("create calendar: %v", err)
	}
	if err := repo.UpsertEvent(&models.CaldavEventCache{
		UserID:       source.UserID,
		SourceID:     source.ID,
		CalendarID:   calendar.ID,
		EventUID:     "uid-a",
		RecurrenceID: "",
		Title:        "A Event",
		StartTime:    startA,
		EndTime:      &endA,
		Status:       "confirmed",
		RawHref:      hrefA,
	}); err != nil {
		t.Fatalf("seed event: %v", err)
	}

	if err := svc.syncCalendarCache(context.Background(), source, "pwd", calendar); err != nil {
		t.Fatalf("sync calendar cache: %v", err)
	}
	if got := strings.TrimSpace(calendar.SyncToken); got != "token-next" {
		t.Fatalf("sync token=%q want token-next", got)
	}
	if got := atomic.LoadInt64(&reconcileQueryCount); got <= 0 {
		t.Fatalf("reconcile query count=%d want > 0", got)
	}
	if got := atomic.LoadInt64(&fullQueryCount); got <= 0 {
		t.Fatalf("full replace query count=%d want > 0", got)
	}
	if got := atomic.LoadInt64(&multigetCount); got <= 0 {
		t.Fatalf("multiget count=%d want > 0", got)
	}

	var repaired models.CaldavEventCache
	if err := db.Where("user_id = ? AND source_id = ? AND calendar_id = ? AND event_uid = ?", source.UserID, source.ID, calendar.ID, "uid-b").
		First(&repaired).Error; err != nil {
		t.Fatalf("repaired event missing: %v", err)
	}
	if got := strings.TrimSpace(repaired.Title); got != "年夜饭" {
		t.Fatalf("repaired title=%q want 年夜饭", got)
	}
	if got := strings.TrimSpace(repaired.RawHref); got != hrefB {
		t.Fatalf("repaired href=%q want %q", got, hrefB)
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
