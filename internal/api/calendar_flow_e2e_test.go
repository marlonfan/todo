package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"todo-app/internal/api/handler"
	"todo-app/internal/config"
	"todo-app/internal/models"
	"todo-app/internal/notify"
	"todo-app/internal/repository"
	"todo-app/internal/service"
	"todo-app/migrations"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupE2ERouter(t *testing.T) *gin.Engine {
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
	catRepo := repository.NewCategoryRepository(db)
	notifyRepo := repository.NewNotificationRepository(db)
	caldavRepo := repository.NewCaldavRepository(db)

	authSvc := service.NewAuthService(userRepo, &config.JWTConfig{
		Secret: "e2e-secret",
		Expire: 24 * time.Hour,
	})
	notifySvc := service.NewNotifyService(notifyRepo, userRepo, taskRepo, notify.NewRegistry())
	taskSvc := service.NewTaskService(taskRepo, catRepo, userRepo, notifyRepo)
	caldavSvc := service.NewCaldavService(caldavRepo, "e2e-secret")
	taskSvc.SetCaldavService(caldavSvc)
	catSvc := service.NewCategoryService(catRepo)

	return NewRouter(
		handler.NewAuthHandler(authSvc, notifySvc),
		handler.NewTaskHandler(taskSvc, notifySvc),
		handler.NewCategoryHandler(catSvc),
		handler.NewCalendarHandler(taskSvc, caldavSvc),
		handler.NewNotifyHandler(notifySvc),
		handler.NewCaldavHandler(caldavSvc),
		&config.Config{JWT: config.JWTConfig{Secret: "e2e-secret", Expire: 24 * time.Hour}},
	).Setup()
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
