package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"testing"
)

func TestHistoryRefreshRetainsLoadedDepthAndUsesNewValues(t *testing.T) {
	var cursors []int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cursor, _ := strconv.Atoi(r.URL.Query().Get("cursor"))
		cursors = append(cursors, cursor)
		page := OccurrencePage{NextCursor: cursor + 200, HasMore: cursor < 400}
		page.Items = []Occurrence{{TaskID: 1, InstanceID: "duplicate", Description: strconv.Itoa(cursor)}, {TaskID: int64(cursor + 2), InstanceID: "unique"}}
		_ = json.NewEncoder(w).Encode(page)
	}))
	defer srv.Close()
	c, _ := New(srv.URL, "jwt")
	page, err := c.OccurrenceHistoryThrough(context.Background(), 400)
	if err != nil || !slices.Equal(cursors, []int{0, 200}) || len(page.Items) != 3 || page.Items[0].Description != "200" || !page.HasMore || page.NextCursor != 400 {
		t.Fatalf("cursors=%v page=%+v err=%v", cursors, page, err)
	}
	cursors = nil
	page, err = c.OccurrenceHistoryThrough(context.Background(), 1000)
	if err != nil || !slices.Equal(cursors, []int{0, 200, 400}) || page.HasMore || page.NextCursor != 600 || len(page.Items) != 4 {
		t.Fatal(cursors, page, err)
	}
}

func TestHistoryRefreshRejectsBrokenCursorAndPartialReads(t *testing.T) {
	for _, mode := range []string{"no-progress", "regression", "second-page-failure"} {
		t.Run(mode, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				cursor, _ := strconv.Atoi(r.URL.Query().Get("cursor"))
				page := OccurrencePage{Items: []Occurrence{{TaskID: 1, InstanceID: "one"}}, NextCursor: cursor + 200, HasMore: true}
				if mode == "no-progress" {
					page.NextCursor = cursor
				}
				if cursor > 0 {
					if mode == "second-page-failure" {
						http.Error(w, "offline", 503)
						return
					}
					page.NextCursor, page.HasMore = 0, false
				}
				_ = json.NewEncoder(w).Encode(page)
			}))
			defer srv.Close()
			c, _ := New(srv.URL, "jwt")
			page, err := c.OccurrenceHistoryThrough(context.Background(), 400)
			if err == nil || len(page.Items) != 0 || page.NextCursor != 0 {
				t.Fatal(page, err)
			}
		})
	}
}
