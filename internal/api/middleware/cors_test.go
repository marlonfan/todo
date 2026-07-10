package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSAllowsDAVOptionsHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.OPTIONS("/dav/*path", func(c *gin.Context) {
		c.Header("DAV", "1, calendar-access")
		c.Header("Allow", "OPTIONS, PROPFIND, REPORT, GET, PUT, DELETE")
		c.Header("MS-Author-Via", "DAV")
		c.Status(http.StatusNoContent)
	})

	for _, test := range []struct {
		name      string
		preflight bool
	}{
		{name: "plain DAV options"},
		{name: "browser DAV preflight", preflight: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodOptions, "/dav/", nil)
			if test.preflight {
				req.Header.Set("Origin", "https://calendar.example")
				req.Header.Set("Access-Control-Request-Method", "PROPFIND")
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusNoContent {
				t.Fatalf("status=%d want=%d", rec.Code, http.StatusNoContent)
			}
			if got := rec.Header().Get("DAV"); got != "1, calendar-access" {
				t.Fatalf("DAV header=%q", got)
			}
			if got := rec.Header().Get("MS-Author-Via"); got != "DAV" {
				t.Fatalf("MS-Author-Via=%q", got)
			}
			if got := rec.Header().Get("Access-Control-Allow-Methods"); got == "" {
				t.Fatal("missing CORS allow methods")
			}
		})
	}
}

func TestCORSStillHandlesAPIBrowserPreflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS())
	router.POST("/api/tasks", func(c *gin.Context) {
		c.Status(http.StatusCreated)
	})

	req := httptest.NewRequest(http.MethodOptions, "/api/tasks", nil)
	req.Header.Set("Origin", "https://app.example")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status=%d want=%d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example" {
		t.Fatalf("allow origin=%q", got)
	}
}
