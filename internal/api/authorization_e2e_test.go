package api

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"todo-app/internal/models"
	"todo-app/pkg/utils"
)

func TestAccountIsolationAndRejectedCategoryUpdateIsAtomic(t *testing.T) {
	router := setupE2ERouter(t)
	owner, _ := registerAndLoginReminderUser(t, router)
	other, _ := registerAndLoginReminderUser(t, router)
	create := func(path, token string, body map[string]any) int64 {
		t.Helper()
		rec := doJSON(t, router, http.MethodPost, path, token, body, nil)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create %s: %d %s", path, rec.Code, rec.Body.String())
		}
		return int64(decodeJSON[map[string]any](t, rec)["id"].(float64))
	}
	categoryID := create("/api/categories", owner, map[string]any{"name": "Private category"})
	promptID := create("/api/prompts", owner, map[string]any{"title": "Private prompt", "content": "Private content"})
	taskID := create("/api/tasks", owner, map[string]any{"title": "Private task", "category_ids": []int64{categoryID}})
	otherTaskID := create("/api/tasks", other, map[string]any{"title": "Other task"})
	for _, resource := range []struct {
		path string
		body map[string]any
	}{
		{fmt.Sprintf("/api/tasks/%d", taskID), map[string]any{"title": "Unauthorized"}},
		{fmt.Sprintf("/api/categories/%d", categoryID), map[string]any{"name": "Unauthorized"}},
		{fmt.Sprintf("/api/prompts/%d", promptID), map[string]any{"title": "Unauthorized"}},
	} {
		for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
			t.Run(method+resource.path, func(t *testing.T) {
				rec := doJSON(t, router, method, resource.path, other, resource.body, nil)
				if rec.Code != http.StatusNotFound && rec.Code != http.StatusBadRequest && rec.Code != http.StatusForbidden {
					t.Fatalf("cross-account request returned %d: %s", rec.Code, rec.Body.String())
				}
			})
		}
		rec := doJSON(t, router, http.MethodGet, resource.path, owner, nil, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("owner lost access to %s: %d", resource.path, rec.Code)
		}
	}
	for _, endpoint := range []struct {
		method, path string
		body         map[string]any
	}{
		{http.MethodPatch, fmt.Sprintf("/api/tasks/%d/status", taskID), map[string]any{"status": "completed"}},
		{http.MethodPatch, fmt.Sprintf("/api/tasks/%d/schedule", taskID), map[string]any{"all_day": true}},
		{http.MethodGet, fmt.Sprintf("/api/tasks/%d/activities", taskID), nil},
		{http.MethodGet, fmt.Sprintf("/api/tasks/%d/notifications", taskID), nil},
		{http.MethodPost, "/api/prompts/history", map[string]any{"prompt_id": promptID, "input": "unauthorized", "output": "unauthorized"}},
	} {
		t.Run(endpoint.method+endpoint.path, func(t *testing.T) {
			rec := doJSON(t, router, endpoint.method, endpoint.path, other, endpoint.body, nil)
			if rec.Code < 400 || rec.Code >= 500 {
				t.Fatalf("cross-account request returned %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
	before := decodeJSON[models.Task](t, doJSON(t, router, http.MethodGet, fmt.Sprintf("/api/tasks/%d", otherTaskID), other, nil, nil))
	rec := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", otherTaskID), other, map[string]any{"title": "Must roll back", "category_ids": []int64{categoryID}}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("foreign category returned %d: %s", rec.Code, rec.Body.String())
	}
	after := decodeJSON[models.Task](t, doJSON(t, router, http.MethodGet, fmt.Sprintf("/api/tasks/%d", otherTaskID), other, nil, nil))
	if after.Title != before.Title || after.Revision != before.Revision || len(after.Categories) != 0 {
		t.Fatalf("rejected update changed task: before=%+v after=%+v", before, after)
	}
}

func TestAccessTokenContractAndExpiredTokenRefresh(t *testing.T) {
	router := setupE2ERouter(t)
	_, user := registerAndLoginReminderUser(t, router)
	sign := func(claims utils.Claims, method jwt.SigningMethod) string {
		t.Helper()
		raw, err := jwt.NewWithClaims(method, claims).SignedString([]byte("e2e-secret"))
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	expired := utils.Claims{UserID: user.ID, Username: user.Username, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour))}}
	rawExpired := sign(expired, jwt.SigningMethodHS256)
	for name, raw := range map[string]string{
		"expired":         rawExpired,
		"missing expiry":  sign(utils.Claims{UserID: user.ID, Username: user.Username}, jwt.SigningMethodHS256),
		"other algorithm": sign(utils.Claims{UserID: user.ID, Username: user.Username, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}}, jwt.SigningMethodHS512),
	} {
		t.Run(name, func(t *testing.T) {
			rec := doJSON(t, router, http.MethodGet, "/api/tasks", raw, nil, nil)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("invalid access token accepted: %d", rec.Code)
			}
		})
	}
	refresh := doJSON(t, router, http.MethodPost, "/api/auth/refresh", rawExpired, nil, nil)
	if refresh.Code != http.StatusOK {
		t.Fatalf("expired token within grace failed: %d %s", refresh.Code, refresh.Body.String())
	}
	refreshed := decodeJSON[map[string]string](t, refresh)["token"]
	if rec := doJSON(t, router, http.MethodGet, "/api/tasks", refreshed, nil, nil); rec.Code != http.StatusOK {
		t.Fatalf("refreshed token rejected: %d", rec.Code)
	}
	for name, claim := range map[string]utils.Claims{
		"past grace": {UserID: user.ID, Username: user.Username, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(-31 * 24 * time.Hour))}},
		"future nbf": {UserID: user.ID, Username: user.Username, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)), NotBefore: jwt.NewNumericDate(time.Now().Add(time.Hour))}},
	} {
		t.Run(name, func(t *testing.T) {
			rec := doJSON(t, router, http.MethodPost, "/api/auth/refresh", sign(claim, jwt.SigningMethodHS256), nil, nil)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("invalid refresh accepted: %d", rec.Code)
			}
		})
	}
}

func TestCalendarSubscriptionTokenCannotAccessPrivateAPI(t *testing.T) {
	router := setupE2ERouter(t)
	token, _ := registerAndLoginReminderUser(t, router)
	rec := doJSON(t, router, http.MethodGet, "/api/calendar/subscription", token, nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("subscription: %d %s", rec.Code, rec.Body.String())
	}
	info := decodeJSON[map[string]string](t, rec)
	feedURL, err := url.Parse(info["ics_url"])
	if err != nil {
		t.Fatal(err)
	}
	feedToken := strings.TrimSuffix(strings.TrimPrefix(feedURL.Path, "/feeds/calendar/"), ".ics")
	for _, endpoint := range []struct {
		method, path string
		body         map[string]any
	}{
		{http.MethodGet, "/api/tasks", nil},
		{http.MethodPost, "/api/tasks", map[string]any{"title": "feed must not write"}},
		{http.MethodGet, "/api/ai/config", nil},
		{http.MethodPost, "/api/auth/refresh", nil},
	} {
		response := doJSON(t, router, endpoint.method, endpoint.path, feedToken, endpoint.body, nil)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("feed token accepted on %s %s: %d", endpoint.method, endpoint.path, response.Code)
		}
	}
	feed := doJSON(t, router, http.MethodGet, feedURL.RequestURI(), "", nil, nil)
	if feed.Code != http.StatusOK || !strings.Contains(feed.Body.String(), "BEGIN:VCALENDAR") {
		t.Fatalf("legitimate feed failed: %d %s", feed.Code, feed.Body.String())
	}
}
