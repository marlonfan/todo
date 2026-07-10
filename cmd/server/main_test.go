package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestStaticFallbackRejectsUnknownWriteMethods(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	setupStaticFiles(router)

	req := httptest.NewRequest("PROPPATCH", "/calendars/marlon/todo/", strings.NewReader(`<D:propertyupdate xmlns:D="DAV:"/>`))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status=%d want=%d", rec.Code, http.StatusNotFound)
	}
	if strings.Contains(strings.ToLower(rec.Header().Get("Content-Type")), "text/html") || strings.Contains(strings.ToLower(rec.Body.String()), "<!doctype html") {
		t.Fatalf("unknown write method returned SPA HTML: headers=%v body=%s", rec.Header(), rec.Body.String())
	}
}

func TestStaticFallbackPreservesAPIAndSPAResponses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	setupStaticFiles(router)

	apiReq := httptest.NewRequest(http.MethodPost, "/api/missing", nil)
	apiRec := httptest.NewRecorder()
	router.ServeHTTP(apiRec, apiReq)
	if apiRec.Code != http.StatusNotFound || !strings.Contains(apiRec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("API fallback status=%d headers=%v body=%s", apiRec.Code, apiRec.Header(), apiRec.Body.String())
	}

	spaReq := httptest.NewRequest(http.MethodGet, "/settings/profile", nil)
	spaRec := httptest.NewRecorder()
	router.ServeHTTP(spaRec, spaReq)
	if spaRec.Code != http.StatusOK || !strings.Contains(spaRec.Header().Get("Content-Type"), "text/html") || !strings.Contains(spaRec.Body.String(), `<div id="root"></div>`) {
		t.Fatalf("SPA fallback status=%d headers=%v body=%s", spaRec.Code, spaRec.Header(), spaRec.Body.String())
	}
}
