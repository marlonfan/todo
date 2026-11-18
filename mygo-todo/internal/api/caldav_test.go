package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCaldavAPIContractAndFeedCredentialIsolation(t *testing.T) {
	feedHits := 0
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") && r.Header.Get("Authorization") != "Bearer jwt" {
			t.Error("missing account authentication")
		}
		switch r.URL.Path {
		case "/api/caldav/sources":
			fmt.Fprint(w, `[{"id":5,"name":"工作","is_active":false,"calendars":[{"calendar_url":"https://dav.example.test/work/","is_selected":true}]}]`)
		case "/api/caldav/discover":
			var got CaldavDiscover
			_ = json.NewDecoder(r.Body).Decode(&got)
			if r.Method != "POST" || got.SourceID != 5 || got.Password != "" {
				t.Error("blank password/source ID contract", got)
			}
			fmt.Fprint(w, `[{"calendar_url":"https://dav.example.test/work/","display_name":"工作"}]`)
		case "/api/calendar/subscription":
			fmt.Fprint(w, `{"ics_url":"/feed","username":"user"}`)
		case "/feeds/calendar/test.ics":
			feedHits++
			if r.Header.Get("Authorization") != "" || r.Header.Get("X-Client-Op-Id") != "" {
				t.Error("account credentials leaked to feed")
			}
			fmt.Fprint(w, "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")
		case "/feeds/calendar/redirect.ics":
			http.Redirect(w, r, "/feeds/calendar/test.ics", http.StatusFound)
		case "/feeds/calendar/html.ics":
			fmt.Fprint(w, "<html>not a calendar</html>")
		default:
			t.Error("unexpected request", r.URL.Path)
			http.NotFound(w, r)
		}
	}))
	defer s.Close()
	c, _ := New(s.URL, "jwt")
	ctx := context.Background()
	sources, err := c.CaldavSources(ctx)
	if err != nil || len(sources) != 1 || sources[0].IsActive || !sources[0].Calendars[0].IsSelected {
		t.Fatal(sources, err)
	}
	if choices, err := c.DiscoverCaldav(ctx, CaldavDiscover{SourceID: 5}); err != nil || len(choices) != 1 {
		t.Fatal(choices, err)
	}
	if sub, err := c.CalendarSubscription(ctx); err != nil || sub.Username != "user" {
		t.Fatal(sub, err)
	}
	if data, err := c.ExportCalendar(ctx, s.URL+"/feeds/calendar/test.ics"); err != nil || !strings.Contains(string(data), "BEGIN:VCALENDAR") {
		t.Fatal(string(data), err)
	}
	for _, invalid := range []string{"https://other.example.test/feeds/calendar/token.ics", s.URL + "/api/auth/me", s.URL + "/feeds/calendar/html.ics", s.URL + "/feeds/calendar/redirect.ics"} {
		if _, err := c.ExportCalendar(ctx, invalid); err == nil {
			t.Fatal("invalid export accepted", invalid)
		}
	}
	if feedHits != 1 {
		t.Fatal("export followed a redirect", feedHits)
	}
}
