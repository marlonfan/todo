package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestOccurrenceReadContracts(t *testing.T) {
	day := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	item := Occurrence{TaskID: 3, InstanceID: "3_20261109", OriginalDate: day, StartTime: day.Add(9 * time.Hour), Status: "pending"}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer jwt" {
			t.Error("missing occurrence authorization")
		}
		switch r.URL.Path {
		case "/api/tasks/next-occurrences":
			_ = json.NewEncoder(w).Encode([]Occurrence{item})
		case "/api/tasks/occurrences":
			if q := r.URL.Query(); q.Get("status") != "completed,cancelled,skipped" || q.Get("cursor") != "200" || q.Get("limit") != "200" {
				t.Errorf("wrong query: %v", q)
			}
			_ = json.NewEncoder(w).Encode(OccurrencePage{Items: []Occurrence{item}, NextCursor: 400, HasMore: true})
		default:
			t.Errorf("unexpected %s", r.URL.Path)
		}
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "jwt")
	next, err := c.NextOccurrences(context.Background())
	if err != nil || len(next) != 1 || !next[0].OriginalDate.Equal(day) {
		t.Fatalf("next: %+v %v", next, err)
	}
	history, err := c.OccurrenceHistory(context.Background(), 200)
	if err != nil || len(history.Items) != 1 || history.NextCursor != 400 || !history.HasMore {
		t.Fatalf("history: %+v %v", history, err)
	}
}

func TestNormalizeServer(t *testing.T) {
	for input, want := range map[string]string{"http://localhost:8080/": "http://localhost:8080", "https://example.com/todo/api/": "https://example.com/todo"} {
		got, err := NormalizeServer(input)
		if err != nil || got != want {
			t.Fatalf("%q: %q %v", input, got, err)
		}
	}
	for _, input := range []string{"localhost:8080", "file:///tmp/a", "https://u:p@host", "https://host?token=a", "https://host/#a"} {
		if _, err := NormalizeServer(input); err == nil {
			t.Errorf("accepted %q", input)
		}
	}
}

func TestLoginAndTaskContracts(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/auth/login":
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["username"] != "alice" || body["password"] != "secret" {
				t.Error("bad login payload")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"token": "jwt", "user": User{ID: 2, Username: "alice"}})
		case "/api/tasks/4":
			if r.Header.Get("Authorization") != "Bearer jwt" || r.Header.Get("If-Match") != "7" || r.Header.Get("X-Client-Op-Id") == "" || r.Header.Get("X-Client-Submit-Source") != "nsgo-mobile" {
				t.Error("missing mutation guards")
			}
			w.WriteHeader(409)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "revision conflict", "latest": Task{ID: 4, Revision: 8}})
		default:
			t.Errorf("unexpected %s", r.URL.Path)
		}
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "")
	session, err := c.Login(context.Background(), "alice", "secret")
	if err != nil || session.User.ID != 2 || session.Server != srv.URL {
		t.Fatalf("%+v %v", session, err)
	}
	err = c.Do(context.Background(), "PUT", "/tasks/4", map[string]string{"title": "draft"}, nil, 7)
	var conflict *Error
	if !errors.As(err, &conflict) || conflict.Status != 409 || conflict.Latest.Revision != 8 {
		t.Fatalf("%v", err)
	}
}

func TestRefreshPreservesMutationIdentity(t *testing.T) {
	var seenID, seenBody string
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/auth/refresh" {
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "new"})
			return
		}
		b, _ := io.ReadAll(r.Body)
		calls++
		if calls == 1 {
			seenID = r.Header.Get("X-Client-Op-Id")
			seenBody = string(b)
			w.WriteHeader(401)
			return
		}
		if string(b) != seenBody || r.Header.Get("X-Client-Op-Id") != seenID || r.Header.Get("Authorization") != "Bearer new" {
			t.Error("replayed mutation differs")
		}
		w.WriteHeader(204)
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "old")
	if err := c.Do(context.Background(), "POST", "/tasks", map[string]string{"title": "once"}, nil, 0); err != nil {
		t.Fatal(err)
	}
	if calls != 2 || seenID == "" {
		t.Fatalf("calls=%d id=%s", calls, seenID)
	}
}

func TestConcurrentExpiredSessionRefreshesOnce(t *testing.T) {
	var mu sync.Mutex
	refreshes := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/auth/refresh" {
			mu.Lock()
			refreshes++
			mu.Unlock()
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "new"})
			return
		}
		if r.Header.Get("Authorization") != "Bearer new" {
			w.WriteHeader(401)
			return
		}
		_ = json.NewEncoder(w).Encode(User{ID: 1})
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "old")
	var wg sync.WaitGroup
	for range 6 {
		wg.Go(func() {
			var user User
			if err := c.Do(context.Background(), "GET", "/auth/me", nil, &user, 0); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if refreshes != 1 {
		t.Fatalf("refreshes=%d", refreshes)
	}
}

func TestRedirectDoesNotForwardCredentials(t *testing.T) {
	hit := false
	other := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { hit = true }))
	defer other.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, other.URL, http.StatusTemporaryRedirect)
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "private")
	if err := c.Do(context.Background(), "GET", "/tasks", nil, nil, 0); err == nil || hit {
		t.Fatalf("err=%v followed=%v", err, hit)
	}
}
