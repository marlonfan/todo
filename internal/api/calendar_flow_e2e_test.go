package api

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"testing"
	"time"

	"todo-app/internal/api/handler"
	"todo-app/internal/config"
	"todo-app/internal/models"
	"todo-app/internal/notify"
	"todo-app/internal/notify/telegram"
	"todo-app/internal/repository"
	"todo-app/internal/service"
	"todo-app/migrations"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupE2ERouter(t *testing.T) *gin.Engine {
	router, _ := setupE2ERouterWithDB(t)
	return router
}

func setupE2ERouterWithDB(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	taskActivityRepo := repository.NewTaskActivityRepository(db)
	catRepo := repository.NewCategoryRepository(db)
	notifyRepo := repository.NewNotificationRepository(db)
	caldavRepo := repository.NewCaldavRepository(db)
	aiConfigRepo := repository.NewAIConfigRepository(db)
	promptRepo := repository.NewPromptRepository(db)

	authSvc := service.NewAuthService(userRepo, &config.JWTConfig{
		Secret: "e2e-secret",
		Expire: 24 * time.Hour,
	})
	notifyRegistry := notify.NewRegistry()
	notifyRegistry.Register(telegram.New())
	notifySvc := service.NewNotifyService(notifyRepo, userRepo, taskRepo, notifyRegistry)
	taskSvc := service.NewTaskService(taskRepo, taskActivityRepo, catRepo, userRepo, notifyRepo)
	caldavSvc := service.NewCaldavService(caldavRepo, "e2e-secret")
	taskSvc.SetCaldavService(caldavSvc)
	exportSvc := service.NewCalendarExportService(taskSvc, userRepo, "e2e-secret")
	catSvc := service.NewCategoryService(catRepo)
	aiConfigSvc := service.NewAIConfigService(aiConfigRepo)
	promptSvc := service.NewPromptService(promptRepo)

	router := NewRouter(
		handler.NewAuthHandler(authSvc, notifySvc),
		handler.NewTaskHandler(taskSvc, notifySvc, repository.NewTaskMutationReceiptRepository(db)),
		handler.NewCategoryHandler(catSvc),
		handler.NewCalendarHandler(taskSvc, caldavSvc),
		handler.NewNotifyHandler(notifySvc),
		handler.NewCaldavHandler(caldavSvc),
		handler.NewCalendarExportHandler(exportSvc, authSvc),
		handler.NewAIConfigHandler(aiConfigSvc),
		handler.NewPromptHandler(promptSvc),
		&config.Config{JWT: config.JWTConfig{Secret: "e2e-secret", Expire: 24 * time.Hour}},
	).Setup()
	return router, db
}

func doJSON(t *testing.T, router *gin.Engine, method, path, token string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
	}
	req, err := http.NewRequest(method, path, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func decodeJSON[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var out T
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v body=%s", err, rec.Body.String())
	}
	return out
}

const (
	testDAVNS    = "DAV:"
	testCalDAVNS = "urn:ietf:params:xml:ns:caldav"
	testCSNS     = "http://calendarserver.org/ns/"
	testAppleNS  = "http://apple.com/ns/ical/"
)

type testDAVMultiStatus struct {
	XMLName   xml.Name
	Responses []testDAVResponse `xml:"DAV: response"`
}

type testDAVResponse struct {
	Href      string            `xml:"DAV: href"`
	Propstats []testDAVPropstat `xml:"DAV: propstat"`
}

type testDAVPropstat struct {
	Status string               `xml:"DAV: status"`
	Prop   testDAVPropContainer `xml:"DAV: prop"`
}

type testDAVPropContainer struct {
	Properties []testDAVProperty `xml:",any"`
}

type testDAVProperty struct {
	XMLName  xml.Name
	Text     string         `xml:",chardata"`
	Hrefs    []string       `xml:"DAV: href"`
	Children []testDAVChild `xml:",any"`
}

type testDAVChild struct {
	XMLName xml.Name
	Text    string `xml:",chardata"`
}

func decodeDAVMultiStatus(t *testing.T, rec *httptest.ResponseRecorder) testDAVMultiStatus {
	t.Helper()
	if rec.Code != 207 {
		t.Fatalf("status=%d want=207 body=%s", rec.Code, rec.Body.String())
	}
	var out testDAVMultiStatus
	if err := xml.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("invalid multistatus XML: %v body=%s", err, rec.Body.String())
	}
	if out.XMLName != (xml.Name{Space: testDAVNS, Local: "multistatus"}) {
		t.Fatalf("root QName=%v want DAV: multistatus", out.XMLName)
	}
	return out
}

func requireDAVProperty(t *testing.T, doc testDAVMultiStatus, href string, name xml.Name, status int) testDAVProperty {
	t.Helper()
	wantStatus := fmt.Sprintf("HTTP/1.1 %d %s", status, http.StatusText(status))
	matches := 0
	var got testDAVProperty
	for _, response := range doc.Responses {
		if strings.TrimSpace(response.Href) != href {
			continue
		}
		for _, propstat := range response.Propstats {
			for _, property := range propstat.Prop.Properties {
				if property.XMLName != name {
					continue
				}
				matches++
				got = property
				if strings.TrimSpace(propstat.Status) != wantStatus {
					t.Fatalf("href=%s property=%v status=%q want=%q", href, name, propstat.Status, wantStatus)
				}
			}
		}
	}
	if matches != 1 {
		t.Fatalf("href=%s property=%v occurrences=%d want=1 document=%#v", href, name, matches, doc)
	}
	return got
}

func requireDAVPropertyStatuses(t *testing.T, doc testDAVMultiStatus, href string, name xml.Name, statuses ...int) {
	t.Helper()
	want := make([]string, 0, len(statuses))
	for _, status := range statuses {
		want = append(want, fmt.Sprintf("HTTP/1.1 %d %s", status, http.StatusText(status)))
	}
	got := []string{}
	for _, response := range doc.Responses {
		if strings.TrimSpace(response.Href) != href {
			continue
		}
		for _, propstat := range response.Propstats {
			for _, property := range propstat.Prop.Properties {
				if property.XMLName == name {
					got = append(got, strings.TrimSpace(propstat.Status))
				}
			}
		}
	}
	if !slices.Equal(got, want) {
		t.Fatalf("href=%s property=%v statuses=%q want=%q", href, name, got, want)
	}
}

func requireDAVHrefProperty(t *testing.T, doc testDAVMultiStatus, resourceHref string, name xml.Name, status int, valueHref string) {
	t.Helper()
	property := requireDAVProperty(t, doc, resourceHref, name, status)
	if len(property.Hrefs) != 1 || strings.TrimSpace(property.Hrefs[0]) != valueHref {
		t.Fatalf("href=%s property=%v nested hrefs=%q want=[%q]", resourceHref, name, property.Hrefs, valueHref)
	}
}

func requireNonEmptyDAVText(t *testing.T, doc testDAVMultiStatus, href string, name xml.Name) string {
	t.Helper()
	property := requireDAVProperty(t, doc, href, name, http.StatusOK)
	value := strings.TrimSpace(property.Text)
	if value == "" {
		t.Fatalf("href=%s property=%v has empty value", href, name)
	}
	return value
}

func requireDAVChildren(t *testing.T, property testDAVProperty, names ...xml.Name) {
	t.Helper()
	for _, name := range names {
		found := false
		for _, child := range property.Children {
			if child.XMLName == name {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("property=%v missing child=%v children=%v", property.XMLName, name, property.Children)
		}
	}
}

func TestCalendarCreateDeleteFlowAcrossWeekAndMonthRanges(t *testing.T) {
	router := setupE2ERouter(t)

	username := fmt.Sprintf("u_%d", time.Now().UnixNano())
	email := fmt.Sprintf("%s@example.com", username)

	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": "secret123",
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d, want %d body=%s", registerResp.Code, http.StatusCreated, registerResp.Body.String())
	}

	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": "secret123",
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d, want %d body=%s", loginResp.Code, http.StatusOK, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatalf("missing token in login response")
	}

	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":      "333",
		"start_time": "2026-02-28T22:30:00Z",
		"end_time":   "2026-02-28T23:00:00Z",
		"all_day":    false,
		"priority":   0,
	}, nil)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d, want %d body=%s", createResp.Code, http.StatusCreated, createResp.Body.String())
	}
	created := decodeJSON[models.Task](t, createResp)
	if created.ID == 0 {
		t.Fatalf("created task id is empty")
	}

	weekResp := doJSON(t, router, http.MethodGet, "/api/calendar?start=2026-02-28T16:00:00Z&end=2026-03-07T16:00:00Z", token, nil, nil)
	if weekResp.Code != http.StatusOK {
		t.Fatalf("week calendar status = %d, want %d body=%s", weekResp.Code, http.StatusOK, weekResp.Body.String())
	}
	weekEvents := decodeJSON[[]models.CalendarEvent](t, weekResp)
	if len(weekEvents) == 0 {
		t.Fatalf("week calendar should include task 333")
	}

	monthResp := doJSON(t, router, http.MethodGet, "/api/calendar?start=2026-02-28T16:00:00Z&end=2026-03-31T16:00:00Z", token, nil, nil)
	if monthResp.Code != http.StatusOK {
		t.Fatalf("month calendar status = %d, want %d body=%s", monthResp.Code, http.StatusOK, monthResp.Body.String())
	}
	monthEvents := decodeJSON[[]models.CalendarEvent](t, monthResp)
	found := false
	for _, event := range monthEvents {
		if event.ExtendedProps.TaskID == created.ID && event.Title == "333" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("month calendar should include task 333")
	}

	delResp := doJSON(t, router, http.MethodDelete, fmt.Sprintf("/api/tasks/%d", created.ID), token, nil, map[string]string{
		"If-Match": fmt.Sprintf("%d", created.Revision),
	})
	if delResp.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d, want %d body=%s", delResp.Code, http.StatusNoContent, delResp.Body.String())
	}

	monthAfterResp := doJSON(t, router, http.MethodGet, "/api/calendar?start=2026-02-28T16:00:00Z&end=2026-03-31T16:00:00Z", token, nil, nil)
	if monthAfterResp.Code != http.StatusOK {
		t.Fatalf("month after delete status = %d, want %d body=%s", monthAfterResp.Code, http.StatusOK, monthAfterResp.Body.String())
	}
	monthAfter := decodeJSON[[]models.CalendarEvent](t, monthAfterResp)
	for _, event := range monthAfter {
		if event.ExtendedProps.TaskID == created.ID {
			t.Fatalf("deleted task should not appear in month calendar")
		}
	}
}

func TestTaskActivitiesMergedWithin15Minutes(t *testing.T) {
	router := setupE2ERouter(t)

	username := fmt.Sprintf("a_%d", time.Now().UnixNano())
	email := fmt.Sprintf("%s@example.com", username)
	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": "secret123",
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d body=%s", registerResp.Code, registerResp.Body.String())
	}

	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": "secret123",
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResp.Code, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatalf("missing token in login response")
	}

	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":    "A",
		"priority": 0,
	}, nil)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d body=%s", createResp.Code, createResp.Body.String())
	}
	task := decodeJSON[models.Task](t, createResp)

	baseSubmitAt := time.Now().UTC().Add(-5 * time.Minute).Truncate(time.Second)
	firstSubmitAt := baseSubmitAt.Format(time.RFC3339Nano)
	firstUpdateResp := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{
		"title": "B",
	}, map[string]string{
		"If-Match":               fmt.Sprintf("%d", task.Revision),
		"X-Client-Submitted-At":  firstSubmitAt,
		"X-Client-Submit-Source": "manual",
	})
	if firstUpdateResp.Code != http.StatusOK {
		t.Fatalf("first update status = %d body=%s", firstUpdateResp.Code, firstUpdateResp.Body.String())
	}
	updatedOnce := decodeJSON[models.Task](t, firstUpdateResp)

	secondSubmitAtTime := baseSubmitAt.Add(10 * time.Minute)
	secondSubmitAt := secondSubmitAtTime.Format(time.RFC3339Nano)
	secondUpdateResp := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{
		"title": "C",
	}, map[string]string{
		"If-Match":               fmt.Sprintf("%d", updatedOnce.Revision),
		"X-Client-Submitted-At":  secondSubmitAt,
		"X-Client-Submit-Source": "manual",
	})
	if secondUpdateResp.Code != http.StatusOK {
		t.Fatalf("second update status = %d body=%s", secondUpdateResp.Code, secondUpdateResp.Body.String())
	}

	activitiesResp := doJSON(t, router, http.MethodGet, fmt.Sprintf("/api/tasks/%d/activities?limit=20", task.ID), token, nil, nil)
	if activitiesResp.Code != http.StatusOK {
		t.Fatalf("activities status = %d body=%s", activitiesResp.Code, activitiesResp.Body.String())
	}
	activities := decodeJSON[[]models.TaskActivity](t, activitiesResp)
	if len(activities) != 1 {
		t.Fatalf("expected 1 merged activity, got %d", len(activities))
	}
	change, ok := activities[0].Changes["title"]
	if !ok {
		t.Fatalf("expected title change in merged activity")
	}
	if fmt.Sprint(change.From) != "A" || fmt.Sprint(change.To) != "C" {
		t.Fatalf("expected title change A->C, got %v -> %v", change.From, change.To)
	}
	if activities[0].OccurredAt.UTC().Format(time.RFC3339) != secondSubmitAtTime.Format(time.RFC3339) {
		t.Fatalf("unexpected occurred_at: %s", activities[0].OccurredAt.UTC().Format(time.RFC3339))
	}
}

func TestTaskMutationReplayWithClientOpIDAvoidsFalseConflict(t *testing.T) {
	router := setupE2ERouter(t)

	username := fmt.Sprintf("idemp_%d", time.Now().UnixNano())
	email := fmt.Sprintf("%s@example.com", username)
	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": "secret123",
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d body=%s", registerResp.Code, registerResp.Body.String())
	}

	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": "secret123",
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResp.Code, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatalf("missing token in login response")
	}

	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":    "idempotency",
		"priority": 0,
	}, nil)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d body=%s", createResp.Code, createResp.Body.String())
	}
	task := decodeJSON[models.Task](t, createResp)

	clientOpID := fmt.Sprintf("op_%d", time.Now().UnixNano())
	firstUpdateResp := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{
		"title": "idempotency-updated",
	}, map[string]string{
		"If-Match":       fmt.Sprintf("%d", task.Revision),
		"X-Client-Op-Id": clientOpID,
	})
	if firstUpdateResp.Code != http.StatusOK {
		t.Fatalf("first update status = %d body=%s", firstUpdateResp.Code, firstUpdateResp.Body.String())
	}
	updated := decodeJSON[models.Task](t, firstUpdateResp)
	if updated.Title != "idempotency-updated" {
		t.Fatalf("first update title = %q", updated.Title)
	}

	replayResp := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{
		"title": "idempotency-updated",
	}, map[string]string{
		"If-Match":       fmt.Sprintf("%d", task.Revision),
		"X-Client-Op-Id": clientOpID,
	})
	if replayResp.Code != http.StatusOK {
		t.Fatalf("replay update status = %d body=%s", replayResp.Code, replayResp.Body.String())
	}
	replayed := decodeJSON[models.Task](t, replayResp)
	if replayed.Revision != updated.Revision {
		t.Fatalf("replay revision = %d, want %d", replayed.Revision, updated.Revision)
	}

	conflictResp := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{
		"title": "should-conflict",
	}, map[string]string{
		"If-Match": fmt.Sprintf("%d", task.Revision),
	})
	if conflictResp.Code != http.StatusConflict {
		t.Fatalf("stale update without op-id status = %d, want %d body=%s", conflictResp.Code, http.StatusConflict, conflictResp.Body.String())
	}
}

func TestCalendarSubscriptionFeedAndCalDAVWrite(t *testing.T) {
	router := setupE2ERouter(t)

	username := fmt.Sprintf("caldav_%d", time.Now().UnixNano())
	email := fmt.Sprintf("%s@example.com", username)
	password := "secret123"
	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": password,
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d body=%s", registerResp.Code, registerResp.Body.String())
	}
	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": password,
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResp.Code, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatalf("missing token in login response")
	}

	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":      "Feed visible task",
		"priority":   0,
		"start_time": "2026-03-02T10:00:00Z",
		"end_time":   "2026-03-02T10:30:00Z",
	}, nil)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d body=%s", createResp.Code, createResp.Body.String())
	}

	infoResp := doJSON(t, router, http.MethodGet, "/api/calendar/subscription", token, nil, nil)
	if infoResp.Code != http.StatusOK {
		t.Fatalf("subscription status = %d body=%s", infoResp.Code, infoResp.Body.String())
	}
	info := decodeJSON[map[string]string](t, infoResp)
	if info["ics_url"] == "" || info["caldav_url"] == "" || info["username"] != username {
		t.Fatalf("unexpected subscription info: %#v", info)
	}

	feedURL, err := url.Parse(info["ics_url"])
	if err != nil {
		t.Fatalf("parse feed url: %v", err)
	}
	feedReq := httptest.NewRequest(http.MethodGet, feedURL.RequestURI(), nil)
	feedRec := httptest.NewRecorder()
	router.ServeHTTP(feedRec, feedReq)
	if feedRec.Code != http.StatusOK {
		t.Fatalf("feed status = %d body=%s", feedRec.Code, feedRec.Body.String())
	}
	if body := feedRec.Body.String(); !strings.Contains(body, "BEGIN:VCALENDAR") || !strings.Contains(body, "SUMMARY:Feed visible task") {
		t.Fatalf("feed missing task body=%s", body)
	}
	if strings.Contains(feedRec.Body.String(), "BEGIN:VALARM") {
		t.Fatalf("feed unexpectedly contains an alarm while default reminders are disabled: %s", feedRec.Body.String())
	}

	calendarPath := "/dav/calendars/" + username + "/todo/"
	ctagBody := `<?xml version="1.0"?><D:propfind xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/"><D:prop><CS:getctag/></D:prop></D:propfind>`
	readCTag := func() string {
		t.Helper()
		req := httptest.NewRequest("PROPFIND", calendarPath, strings.NewReader(ctagBody))
		req.SetBasicAuth(username, password)
		req.Header.Set("Depth", "0")
		req.Header.Set("Content-Type", "application/xml")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		doc := decodeDAVMultiStatus(t, rec)
		return requireNonEmptyDAVText(t, doc, calendarPath, xml.Name{Space: testCSNS, Local: "getctag"})
	}
	ctagWithoutAlarm := readCTag()

	profileResp := doJSON(t, router, http.MethodPatch, "/api/auth/profile", token, map[string]any{
		"default_reminder_enabled": true,
		"default_reminder_minutes": 15,
	}, nil)
	if profileResp.Code != http.StatusOK {
		t.Fatalf("update reminder profile status = %d body=%s", profileResp.Code, profileResp.Body.String())
	}
	if ctagWithAlarm := readCTag(); ctagWithAlarm == ctagWithoutAlarm {
		t.Fatalf("calendar ctag did not change after enabling default reminders: %q", ctagWithAlarm)
	}

	feedWithAlarmReq := httptest.NewRequest(http.MethodGet, feedURL.RequestURI(), nil)
	feedWithAlarmRec := httptest.NewRecorder()
	router.ServeHTTP(feedWithAlarmRec, feedWithAlarmReq)
	if feedWithAlarmRec.Code != http.StatusOK {
		t.Fatalf("feed with alarm status = %d body=%s", feedWithAlarmRec.Code, feedWithAlarmRec.Body.String())
	}
	for _, expected := range []string{
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		"DESCRIPTION:Feed visible task",
		"TRIGGER:-PT15M",
		"END:VALARM",
	} {
		if !strings.Contains(feedWithAlarmRec.Body.String(), expected) {
			t.Fatalf("feed missing %q after enabling default reminders: %s", expected, feedWithAlarmRec.Body.String())
		}
	}

	propfindBody := `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/><D:getetag/></D:prop></D:propfind>`
	propfindReq := httptest.NewRequest("PROPFIND", calendarPath, strings.NewReader(propfindBody))
	propfindReq.SetBasicAuth(username, password)
	propfindReq.Header.Set("Depth", "1")
	propfindReq.Header.Set("Content-Type", "application/xml")
	propfindRec := httptest.NewRecorder()
	router.ServeHTTP(propfindRec, propfindReq)
	if propfindRec.Code != 207 {
		t.Fatalf("propfind status = %d body=%s", propfindRec.Code, propfindRec.Body.String())
	}
	if !strings.Contains(propfindRec.Body.String(), "/dav/calendars/"+username+"/todo/task-") {
		t.Fatalf("propfind missing task href body=%s", propfindRec.Body.String())
	}

	objectPath := "/dav/calendars/" + username + "/todo/mobile-new.ics"
	ical := strings.Join([]string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"BEGIN:VEVENT",
		"UID:mobile-new@example",
		"DTSTAMP:20260302T090000Z",
		"SUMMARY:Mobile created",
		"DESCRIPTION:Created from CalDAV",
		"DTSTART:20260303T010000Z",
		"DTEND:20260303T013000Z",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		"DESCRIPTION:Client-selected reminder",
		"TRIGGER:-PT30M",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
		"",
	}, "\r\n")
	putReq := httptest.NewRequest(http.MethodPut, objectPath, strings.NewReader(ical))
	putReq.SetBasicAuth(username, password)
	putReq.Header.Set("Content-Type", "text/calendar")
	putRec := httptest.NewRecorder()
	router.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusCreated {
		t.Fatalf("put status = %d body=%s", putRec.Code, putRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, objectPath, nil)
	getReq.SetBasicAuth(username, password)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get status = %d body=%s", getRec.Code, getRec.Body.String())
	}
	if !strings.Contains(getRec.Body.String(), "SUMMARY:Mobile created") {
		t.Fatalf("get missing created object body=%s", getRec.Body.String())
	}
	if !strings.Contains(getRec.Body.String(), "DESCRIPTION:Created from CalDAV") ||
		!strings.Contains(getRec.Body.String(), "TRIGGER:-PT15M") {
		t.Fatalf("get did not apply the server default reminder cleanly body=%s", getRec.Body.String())
	}
}

func TestAppleCalDAVDiscovery(t *testing.T) {
	router := setupE2ERouter(t)

	username := fmt.Sprintf("apple_%d", time.Now().UnixNano())
	email := username + "@example.com"
	password := "secret123"
	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": password,
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d body=%s", registerResp.Code, registerResp.Body.String())
	}
	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": password,
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status=%d body=%s", loginResp.Code, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatal("missing login token")
	}
	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":      "Apple discovery task",
		"priority":   0,
		"start_time": "2026-07-11T02:00:00Z",
		"end_time":   "2026-07-11T02:30:00Z",
	}, nil)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create task status=%d body=%s", createResp.Code, createResp.Body.String())
	}
	infoResp := doJSON(t, router, http.MethodGet, "/api/calendar/subscription", token, nil, nil)
	if infoResp.Code != http.StatusOK {
		t.Fatalf("subscription info status=%d body=%s", infoResp.Code, infoResp.Body.String())
	}
	info := decodeJSON[map[string]string](t, infoResp)
	requestURI := func(key string) string {
		t.Helper()
		parsed, err := url.Parse(info[key])
		if err != nil || parsed.RequestURI() == "" {
			t.Fatalf("parse %s=%q: %v", key, info[key], err)
		}
		return parsed.RequestURI()
	}
	rootPath := requestURI("caldav_root_url")
	principalPath := requestURI("caldav_principal_url")
	homePath := requestURI("caldav_home_url")
	calendarPath := requestURI("caldav_url")

	propfind := func(path, depth, body string, authenticate bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest("PROPFIND", path, strings.NewReader(body))
		if authenticate {
			req.SetBasicAuth(username, password)
		}
		req.Header.Set("Depth", depth)
		req.Header.Set("Content-Type", "application/xml; charset=utf-8")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	proppatch := func(body string, authenticate bool) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest("PROPPATCH", calendarPath, strings.NewReader(body))
		if authenticate {
			req.SetBasicAuth(username, password)
		}
		req.Header.Set("Content-Type", "application/xml; charset=utf-8")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	optionsReq := httptest.NewRequest(http.MethodOptions, calendarPath, nil)
	optionsRec := httptest.NewRecorder()
	router.ServeHTTP(optionsRec, optionsReq)
	if optionsRec.Code != http.StatusNoContent || optionsRec.Header().Get("DAV") != "1, calendar-access" || optionsRec.Header().Get("MS-Author-Via") != "DAV" {
		t.Fatalf("DAV options status=%d headers=%v", optionsRec.Code, optionsRec.Header())
	}
	for _, method := range []string{"OPTIONS", "PROPFIND", "PROPPATCH", "REPORT", "GET", "PUT", "DELETE"} {
		if !strings.Contains(optionsRec.Header().Get("Allow"), method) {
			t.Fatalf("Allow=%q missing %s", optionsRec.Header().Get("Allow"), method)
		}
	}

	wellKnownReq := httptest.NewRequest("PROPFIND", "/.well-known/caldav", nil)
	wellKnownRec := httptest.NewRecorder()
	router.ServeHTTP(wellKnownRec, wellKnownReq)
	if wellKnownRec.Code != http.StatusTemporaryRedirect || wellKnownRec.Header().Get("Location") != "/dav/" {
		t.Fatalf("well-known status=%d location=%q", wellKnownRec.Code, wellKnownRec.Header().Get("Location"))
	}

	directBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:current-user-principal/>
    <C:calendar-home-set/>
    <D:owner/>
  </D:prop>
</D:propfind>`
	unauthorized := propfind(calendarPath, "0", directBody, false)
	if unauthorized.Code != http.StatusUnauthorized || unauthorized.Header().Get("WWW-Authenticate") == "" {
		t.Fatalf("initial challenge status=%d headers=%v", unauthorized.Code, unauthorized.Header())
	}
	direct := decodeDAVMultiStatus(t, propfind(calendarPath, "0", directBody, true))
	directResourceType := requireDAVProperty(t, direct, calendarPath, xml.Name{Space: testDAVNS, Local: "resourcetype"}, http.StatusOK)
	requireDAVChildren(t, directResourceType,
		xml.Name{Space: testDAVNS, Local: "collection"},
		xml.Name{Space: testCalDAVNS, Local: "calendar"},
	)
	requireDAVHrefProperty(t, direct, calendarPath, xml.Name{Space: testDAVNS, Local: "current-user-principal"}, http.StatusOK, principalPath)
	requireDAVHrefProperty(t, direct, calendarPath, xml.Name{Space: testCalDAVNS, Local: "calendar-home-set"}, http.StatusOK, homePath)
	requireDAVHrefProperty(t, direct, calendarPath, xml.Name{Space: testDAVNS, Local: "owner"}, http.StatusOK, principalPath)

	rootBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:X="urn:example:unsupported">
  <D:prop>
	<D:resourcetype/>
    <D:current-user-principal/>
    <C:calendar-home-set/>
    <C:calendar-user-address-set/>
    <X:missing/>
  </D:prop>
</D:propfind>`
	root := decodeDAVMultiStatus(t, propfind(rootPath, "0", rootBody, true))
	requireDAVProperty(t, root, rootPath, xml.Name{Space: testDAVNS, Local: "resourcetype"}, http.StatusOK)
	requireDAVHrefProperty(t, root, rootPath, xml.Name{Space: testDAVNS, Local: "current-user-principal"}, http.StatusOK, principalPath)
	requireDAVHrefProperty(t, root, rootPath, xml.Name{Space: testCalDAVNS, Local: "calendar-home-set"}, http.StatusOK, homePath)
	requireDAVHrefProperty(t, root, rootPath, xml.Name{Space: testCalDAVNS, Local: "calendar-user-address-set"}, http.StatusOK, "mailto:"+email)
	requireDAVProperty(t, root, rootPath, xml.Name{Space: "urn:example:unsupported", Local: "missing"}, http.StatusNotFound)

	principalBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:principal-URL/>
    <C:calendar-home-set/>
    <C:calendar-user-address-set/>
  </D:prop>
</D:propfind>`
	principal := decodeDAVMultiStatus(t, propfind(principalPath, "0", principalBody, true))
	principalResourceType := requireDAVProperty(t, principal, principalPath, xml.Name{Space: testDAVNS, Local: "resourcetype"}, http.StatusOK)
	requireDAVChildren(t, principalResourceType,
		xml.Name{Space: testDAVNS, Local: "collection"},
		xml.Name{Space: testDAVNS, Local: "principal"},
	)
	requireDAVHrefProperty(t, principal, principalPath, xml.Name{Space: testDAVNS, Local: "principal-URL"}, http.StatusOK, principalPath)
	requireDAVHrefProperty(t, principal, principalPath, xml.Name{Space: testCalDAVNS, Local: "calendar-home-set"}, http.StatusOK, homePath)
	requireDAVHrefProperty(t, principal, principalPath, xml.Name{Space: testCalDAVNS, Local: "calendar-user-address-set"}, http.StatusOK, "mailto:"+email)

	homeBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:A="http://apple.com/ns/ical/">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <C:supported-calendar-component-set/>
    <CS:getctag/>
    <A:calendar-color/>
  </D:prop>
</D:propfind>`
	home := decodeDAVMultiStatus(t, propfind(homePath, "1", homeBody, true))
	requireDAVProperty(t, home, homePath, xml.Name{Space: testDAVNS, Local: "displayname"}, http.StatusOK)
	requireDAVProperty(t, home, homePath, xml.Name{Space: testDAVNS, Local: "resourcetype"}, http.StatusOK)
	requireDAVProperty(t, home, homePath, xml.Name{Space: testCalDAVNS, Local: "supported-calendar-component-set"}, http.StatusNotFound)
	requireDAVProperty(t, home, homePath, xml.Name{Space: testCSNS, Local: "getctag"}, http.StatusNotFound)
	requireDAVProperty(t, home, homePath, xml.Name{Space: testAppleNS, Local: "calendar-color"}, http.StatusNotFound)
	calendarResourceType := requireDAVProperty(t, home, calendarPath, xml.Name{Space: testDAVNS, Local: "resourcetype"}, http.StatusOK)
	requireDAVChildren(t, calendarResourceType,
		xml.Name{Space: testDAVNS, Local: "collection"},
		xml.Name{Space: testCalDAVNS, Local: "calendar"},
	)
	requireDAVProperty(t, home, calendarPath, xml.Name{Space: testCalDAVNS, Local: "supported-calendar-component-set"}, http.StatusOK)
	ctag := requireNonEmptyDAVText(t, home, calendarPath, xml.Name{Space: testCSNS, Local: "getctag"})
	if !strings.HasPrefix(ctag, "sync-") {
		t.Fatalf("getctag=%q want sync-*", ctag)
	}
	requireNonEmptyDAVText(t, home, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"})

	propertyUpdateBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <D:displayname>Apple Todo</D:displayname>
      <C:calendar-description>Synced from macOS</C:calendar-description>
      <A:calendar-color>#1a2b3c</A:calendar-color>
      <A:calendar-order>7</A:calendar-order>
    </D:prop>
  </D:set>
</D:propertyupdate>`
	unauthorizedPatch := proppatch(propertyUpdateBody, false)
	if unauthorizedPatch.Code != http.StatusUnauthorized || unauthorizedPatch.Header().Get("WWW-Authenticate") == "" {
		t.Fatalf("PROPPATCH challenge status=%d headers=%v", unauthorizedPatch.Code, unauthorizedPatch.Header())
	}
	patched := decodeDAVMultiStatus(t, proppatch(propertyUpdateBody, true))
	for _, name := range []xml.Name{
		{Space: testDAVNS, Local: "displayname"},
		{Space: testCalDAVNS, Local: "calendar-description"},
		{Space: testAppleNS, Local: "calendar-color"},
		{Space: testAppleNS, Local: "calendar-order"},
	} {
		requireDAVProperty(t, patched, calendarPath, name, http.StatusOK)
	}

	calendarBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:A="http://apple.com/ns/ical/">
  <D:prop>
	<D:displayname/>
    <D:owner/>
    <D:supported-report-set/>
	<C:calendar-description/>
    <C:supported-calendar-data/>
    <CS:getctag/>
	<A:calendar-color/>
    <A:calendar-order/>
	<D:sync-token/>
  </D:prop>
</D:propfind>`
	calendarRec := propfind(calendarPath, "0", calendarBody, true)
	calendar := decodeDAVMultiStatus(t, calendarRec)
	requireDAVHrefProperty(t, calendar, calendarPath, xml.Name{Space: testDAVNS, Local: "owner"}, http.StatusOK, principalPath)
	if got := requireNonEmptyDAVText(t, calendar, calendarPath, xml.Name{Space: testDAVNS, Local: "displayname"}); got != "Apple Todo" {
		t.Fatalf("displayname=%q", got)
	}
	requireDAVProperty(t, calendar, calendarPath, xml.Name{Space: testDAVNS, Local: "supported-report-set"}, http.StatusOK)
	if got := requireNonEmptyDAVText(t, calendar, calendarPath, xml.Name{Space: testCalDAVNS, Local: "calendar-description"}); got != "Synced from macOS" {
		t.Fatalf("calendar-description=%q", got)
	}
	requireDAVProperty(t, calendar, calendarPath, xml.Name{Space: testCalDAVNS, Local: "supported-calendar-data"}, http.StatusOK)
	requireNonEmptyDAVText(t, calendar, calendarPath, xml.Name{Space: testCSNS, Local: "getctag"})
	if got := requireNonEmptyDAVText(t, calendar, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"}); got != "#1A2B3CFF" {
		t.Fatalf("calendar-color=%q", got)
	}
	if got := requireNonEmptyDAVText(t, calendar, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-order"}); got != "7" {
		t.Fatalf("calendar-order=%q", got)
	}
	requireDAVProperty(t, calendar, calendarPath, xml.Name{Space: testDAVNS, Local: "sync-token"}, http.StatusNotFound)
	if body := calendarRec.Body.String(); !strings.Contains(body, "<C:calendar-query/>") || !strings.Contains(body, "<C:calendar-multiget/>") || strings.Contains(body, "<D:sync-collection/>") {
		t.Fatalf("unexpected supported reports body=%s", body)
	}

	atomicFailureBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/" xmlns:X="urn:example:unsupported">
  <D:set><D:prop><A:calendar-color>#FFEEDDCC</A:calendar-color><X:unknown>value</X:unknown></D:prop></D:set>
</D:propertyupdate>`
	failedPatch := decodeDAVMultiStatus(t, proppatch(atomicFailureBody, true))
	requireDAVProperty(t, failedPatch, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"}, http.StatusFailedDependency)
	requireDAVProperty(t, failedPatch, calendarPath, xml.Name{Space: "urn:example:unsupported", Local: "unknown"}, http.StatusForbidden)
	colorBody := `<D:propfind xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/"><D:prop><A:calendar-color/></D:prop></D:propfind>`
	afterFailedPatch := decodeDAVMultiStatus(t, propfind(calendarPath, "0", colorBody, true))
	if got := requireNonEmptyDAVText(t, afterFailedPatch, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"}); got != "#1A2B3CFF" {
		t.Fatalf("calendar-color changed after atomic failure: %q", got)
	}

	duplicatePropertyBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/">
  <D:set><D:prop><A:calendar-order>invalid</A:calendar-order></D:prop></D:set>
  <D:set><D:prop><A:calendar-order>8</A:calendar-order></D:prop></D:set>
</D:propertyupdate>`
	duplicatePatch := decodeDAVMultiStatus(t, proppatch(duplicatePropertyBody, true))
	requireDAVPropertyStatuses(t, duplicatePatch, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-order"}, http.StatusConflict, http.StatusFailedDependency)
	orderBody := `<D:propfind xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/"><D:prop><A:calendar-order/></D:prop></D:propfind>`
	afterDuplicatePatch := decodeDAVMultiStatus(t, propfind(calendarPath, "0", orderBody, true))
	if got := requireNonEmptyDAVText(t, afterDuplicatePatch, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-order"}); got != "7" {
		t.Fatalf("calendar-order changed after duplicate-property failure: %q", got)
	}

	emptyDescriptionBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set><D:prop><C:calendar-description/></D:prop></D:set>
</D:propertyupdate>`
	emptyDescriptionPatch := decodeDAVMultiStatus(t, proppatch(emptyDescriptionBody, true))
	requireDAVProperty(t, emptyDescriptionPatch, calendarPath, xml.Name{Space: testCalDAVNS, Local: "calendar-description"}, http.StatusOK)
	descriptionBody := `<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-description/></D:prop></D:propfind>`
	emptyDescription := decodeDAVMultiStatus(t, propfind(calendarPath, "0", descriptionBody, true))
	if got := requireDAVProperty(t, emptyDescription, calendarPath, xml.Name{Space: testCalDAVNS, Local: "calendar-description"}, http.StatusOK); strings.TrimSpace(got.Text) != "" {
		t.Fatalf("calendar-description=%q want empty", got.Text)
	}

	protectedRemoveBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:A="http://apple.com/ns/ical/">
  <D:set><D:prop><A:calendar-color>#FFEEDDCC</A:calendar-color></D:prop></D:set>
  <D:remove><D:prop><C:calendar-description/></D:prop></D:remove>
</D:propertyupdate>`
	protectedRemove := decodeDAVMultiStatus(t, proppatch(protectedRemoveBody, true))
	requireDAVProperty(t, protectedRemove, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"}, http.StatusFailedDependency)
	requireDAVProperty(t, protectedRemove, calendarPath, xml.Name{Space: testCalDAVNS, Local: "calendar-description"}, http.StatusForbidden)
	afterProtectedRemove := decodeDAVMultiStatus(t, propfind(calendarPath, "0", colorBody, true))
	if got := requireNonEmptyDAVText(t, afterProtectedRemove, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"}); got != "#1A2B3CFF" {
		t.Fatalf("calendar-color changed after protected remove failure: %q", got)
	}

	nestedValueBody := `<?xml version="1.0" encoding="utf-8"?>
<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/" xmlns:X="urn:example:nested">
  <D:set><D:prop><A:calendar-color><X:value>#FFEEDDCC</X:value></A:calendar-color><A:calendar-order>8</A:calendar-order></D:prop></D:set>
</D:propertyupdate>`
	nestedValuePatch := decodeDAVMultiStatus(t, proppatch(nestedValueBody, true))
	requireDAVProperty(t, nestedValuePatch, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-color"}, http.StatusConflict)
	requireDAVProperty(t, nestedValuePatch, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-order"}, http.StatusFailedDependency)
	afterNestedValue := decodeDAVMultiStatus(t, propfind(calendarPath, "0", orderBody, true))
	if got := requireNonEmptyDAVText(t, afterNestedValue, calendarPath, xml.Name{Space: testAppleNS, Local: "calendar-order"}); got != "7" {
		t.Fatalf("calendar-order changed after nested-value failure: %q", got)
	}

	for name, body := range map[string]string{
		"extra operation child": `<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/" xmlns:X="urn:example:extra"><D:set><D:prop><A:calendar-order>8</A:calendar-order></D:prop><X:extra/></D:set></D:propertyupdate>`,
		"duplicate prop child":  `<D:propertyupdate xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/"><D:set><D:prop><A:calendar-order>8</A:calendar-order></D:prop><D:prop><A:calendar-order>9</A:calendar-order></D:prop></D:set></D:propertyupdate>`,
	} {
		t.Run("reject PROPPATCH "+name, func(t *testing.T) {
			if malformed := proppatch(body, true); malformed.Code != http.StatusBadRequest {
				t.Fatalf("status=%d want=%d body=%s", malformed.Code, http.StatusBadRequest, malformed.Body.String())
			}
		})
	}
	oversizedPatchBody := `<D:propertyupdate xmlns:D="DAV:"><D:set><D:prop><D:displayname>` + strings.Repeat(" ", (1<<20)+1) + `</D:displayname></D:prop></D:set></D:propertyupdate>`
	if oversized := proppatch(oversizedPatchBody, true); oversized.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized PROPPATCH status=%d want=%d", oversized.Code, http.StatusRequestEntityTooLarge)
	}

	syncReportBody := `<?xml version="1.0" encoding="utf-8"?><D:sync-collection xmlns:D="DAV:"><D:sync-token/><D:sync-level>1</D:sync-level><D:prop><D:getetag/></D:prop></D:sync-collection>`
	syncReq := httptest.NewRequest("REPORT", calendarPath, strings.NewReader(syncReportBody))
	syncReq.SetBasicAuth(username, password)
	syncRec := httptest.NewRecorder()
	router.ServeHTTP(syncRec, syncReq)
	if syncRec.Code != http.StatusForbidden {
		t.Fatalf("sync REPORT status=%d want=%d body=%s", syncRec.Code, http.StatusForbidden, syncRec.Body.String())
	}

	invalidBody := `<D:propfind xmlns:D="DAV:"><D:allprop/><D:propname/></D:propfind>`
	if invalid := propfind(rootPath, "0", invalidBody, true); invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid PROPFIND status=%d want=%d", invalid.Code, http.StatusBadRequest)
	}
	oversizedBody := `<D:propfind xmlns:D="DAV:"><D:prop>` + strings.Repeat(" ", (1<<20)+1) + `</D:prop></D:propfind>`
	if oversized := propfind(rootPath, "0", oversizedBody, true); oversized.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized PROPFIND status=%d want=%d", oversized.Code, http.StatusRequestEntityTooLarge)
	}

	missingObjectPath := calendarPath + "missing.ics"
	if missing := propfind(missingObjectPath, "0", directBody, true); missing.Code != http.StatusNotFound {
		t.Fatalf("missing object PROPFIND status=%d want=%d", missing.Code, http.StatusNotFound)
	}
	missingReportBody := `<?xml version="1.0" encoding="utf-8"?><C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:"><D:prop><D:getetag/></D:prop></C:calendar-query>`
	missingReportReq := httptest.NewRequest("REPORT", missingObjectPath, strings.NewReader(missingReportBody))
	missingReportReq.SetBasicAuth(username, password)
	missingReportRec := httptest.NewRecorder()
	router.ServeHTTP(missingReportRec, missingReportReq)
	if missingReportRec.Code != http.StatusNotFound {
		t.Fatalf("missing object REPORT status=%d want=%d", missingReportRec.Code, http.StatusNotFound)
	}
}

func TestCalendarSubscriptionIncludesImportedCaldavEvents(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)

	username := fmt.Sprintf("imported_%d", time.Now().UnixNano())
	email := fmt.Sprintf("%s@example.com", username)
	password := "secret123"
	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": password,
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d want %d body=%s", registerResp.Code, http.StatusCreated, registerResp.Body.String())
	}
	user := decodeJSON[models.UserResponse](t, registerResp)

	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": password,
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResp.Code, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatalf("missing token in login response")
	}

	source := models.CaldavSource{
		UserID:      user.ID,
		Name:        "Imported",
		BaseURL:     "https://calendar.example/dav",
		Username:    "remote",
		PasswordEnc: "encrypted",
		IsActive:    true,
	}
	if err := db.Create(&source).Error; err != nil {
		t.Fatalf("create caldav source: %v", err)
	}
	calendar := models.CaldavCalendar{
		UserID:      user.ID,
		SourceID:    source.ID,
		CalendarURL: "https://calendar.example/dav/work/",
		DisplayName: "Work",
		IsSelected:  true,
	}
	if err := db.Create(&calendar).Error; err != nil {
		t.Fatalf("create caldav calendar: %v", err)
	}
	start := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second)
	end := start.Add(45 * time.Minute)
	if err := db.Create(&models.CaldavEventCache{
		UserID:      user.ID,
		SourceID:    source.ID,
		CalendarID:  calendar.ID,
		EventUID:    "external-meeting",
		Title:       "Imported meeting",
		Description: "From subscribed calendar",
		StartTime:   start,
		EndTime:     &end,
		RawHref:     "/dav/work/external-meeting.ics",
		Etag:        `"remote-etag"`,
	}).Error; err != nil {
		t.Fatalf("create caldav event cache: %v", err)
	}

	infoResp := doJSON(t, router, http.MethodGet, "/api/calendar/subscription", token, nil, nil)
	if infoResp.Code != http.StatusOK {
		t.Fatalf("subscription status = %d body=%s", infoResp.Code, infoResp.Body.String())
	}
	info := decodeJSON[map[string]string](t, infoResp)
	feedURL, err := url.Parse(info["ics_url"])
	if err != nil {
		t.Fatalf("parse feed url: %v", err)
	}
	feedReq := httptest.NewRequest(http.MethodGet, feedURL.RequestURI(), nil)
	feedRec := httptest.NewRecorder()
	router.ServeHTTP(feedRec, feedReq)
	if feedRec.Code != http.StatusOK {
		t.Fatalf("feed status = %d body=%s", feedRec.Code, feedRec.Body.String())
	}
	if body := feedRec.Body.String(); !strings.Contains(body, "SUMMARY:Imported meeting") || !strings.Contains(body, "UID:todo-external-") {
		t.Fatalf("feed missing imported event body=%s", body)
	}

	propfindBody := `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/><D:getetag/><D:supported-report-set/><D:current-user-privilege-set/></D:prop></D:propfind>`
	propfindReq := httptest.NewRequest("PROPFIND", "/dav/calendars/"+username+"/todo/", strings.NewReader(propfindBody))
	propfindReq.SetBasicAuth(username, password)
	propfindReq.Header.Set("Depth", "1")
	propfindReq.Header.Set("Content-Type", "application/xml")
	propfindRec := httptest.NewRecorder()
	router.ServeHTTP(propfindRec, propfindReq)
	if propfindRec.Code != 207 {
		t.Fatalf("propfind status = %d body=%s", propfindRec.Code, propfindRec.Body.String())
	}
	propfindOutput := propfindRec.Body.String()
	if !strings.Contains(propfindOutput, "/dav/calendars/"+username+"/todo/external-") {
		t.Fatalf("propfind missing imported href body=%s", propfindOutput)
	}
	for _, want := range []string{"<C:calendar-query/>", "<C:calendar-multiget/>"} {
		if !strings.Contains(propfindOutput, want) {
			t.Fatalf("propfind missing supported report %s body=%s", want, propfindOutput)
		}
	}
	if strings.Contains(propfindOutput, "<D:sync-collection/>") {
		t.Fatalf("propfind should not advertise unsupported sync-collection body=%s", propfindOutput)
	}

	objectPath := ""
	for _, segment := range strings.Split(propfindOutput, "<D:href>") {
		raw, _, ok := strings.Cut(segment, "</D:href>")
		if ok && strings.Contains(raw, "/todo/external-") {
			objectPath = raw
			break
		}
	}
	if objectPath == "" {
		t.Fatalf("could not find external object href in body=%s", propfindOutput)
	}
	getReq := httptest.NewRequest(http.MethodGet, objectPath, nil)
	getReq.SetBasicAuth(username, password)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get imported status = %d body=%s", getRec.Code, getRec.Body.String())
	}
	if !strings.Contains(getRec.Body.String(), "SUMMARY:Imported meeting") {
		t.Fatalf("get missing imported object body=%s", getRec.Body.String())
	}

	multigetBody := `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <D:href>` + objectPath + `</D:href>
</C:calendar-multiget>`
	multigetReq := httptest.NewRequest("REPORT", "/dav/calendars/"+username+"/todo/", strings.NewReader(multigetBody))
	multigetReq.SetBasicAuth(username, password)
	multigetReq.Header.Set("Depth", "1")
	multigetReq.Header.Set("Content-Type", "application/xml")
	multigetRec := httptest.NewRecorder()
	router.ServeHTTP(multigetRec, multigetReq)
	if multigetRec.Code != 207 {
		t.Fatalf("multiget status = %d body=%s", multigetRec.Code, multigetRec.Body.String())
	}
	if body := multigetRec.Body.String(); !strings.Contains(body, "<C:calendar-data>") || !strings.Contains(body, "SUMMARY:Imported meeting") {
		t.Fatalf("multiget missing imported calendar-data body=%s", body)
	}

	objectPropfindReq := httptest.NewRequest("PROPFIND", objectPath, strings.NewReader(propfindBody))
	objectPropfindReq.SetBasicAuth(username, password)
	objectPropfindReq.Header.Set("Depth", "0")
	objectPropfindReq.Header.Set("Content-Type", "application/xml")
	objectPropfindRec := httptest.NewRecorder()
	router.ServeHTTP(objectPropfindRec, objectPropfindReq)
	if objectPropfindRec.Code != 207 {
		t.Fatalf("object propfind status = %d body=%s", objectPropfindRec.Code, objectPropfindRec.Body.String())
	}
	objectPropfindOutput := objectPropfindRec.Body.String()
	if !strings.Contains(objectPropfindOutput, "<D:current-user-privilege-set><D:privilege><D:read/></D:privilege></D:current-user-privilege-set>") {
		t.Fatalf("external object should be read-only body=%s", objectPropfindOutput)
	}

	putReq := httptest.NewRequest(http.MethodPut, objectPath, strings.NewReader(getRec.Body.String()))
	putReq.SetBasicAuth(username, password)
	putReq.Header.Set("Content-Type", "text/calendar")
	putRec := httptest.NewRecorder()
	router.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusForbidden {
		t.Fatalf("put imported status = %d want %d body=%s", putRec.Code, http.StatusForbidden, putRec.Body.String())
	}
}
