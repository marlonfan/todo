package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTaskChangesCursorWaitAndCancellation(t *testing.T) {
	started := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tasks/sync" || r.URL.Query().Get("cursor") != "v1:7" || r.URL.Query().Get("wait") != "25" || r.URL.Query().Get("limit") != "500" {
			t.Error(r.URL)
		}
		close(started)
		<-r.Context().Done()
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "jwt")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { _, err := c.TaskChanges(ctx, "v1:7", time.Minute); done <- err }()
	<-started
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}

func TestTaskChangesRejectsUnsafePagination(t *testing.T) {
	for _, page := range []TaskChanges{
		{NextCursor: "v2:4"}, {NextCursor: "v1:2"}, {NextCursor: "v1:3", HasMore: true},
		{NextCursor: "v1:3", Tasks: []Task{{ID: 1}}},
		{NextCursor: "v1:4", Deleted: []TaskDeletion{{TaskID: 0}}},
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(page) }))
		c, _ := New(srv.URL, "")
		if _, err := c.TaskChanges(context.Background(), "v1:3", 0); err == nil {
			t.Fatal("unsafe cursor accepted", page)
		}
		srv.Close()
	}
}
