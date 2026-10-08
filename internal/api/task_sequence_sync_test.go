package api

import (
	"fmt"
	"net/http"
	"testing"
	"todo-app/internal/models"
)

type sequenceSyncPage struct {
	Tasks      []models.Task
	Deleted    []models.TaskDeleteLog
	NextCursor string `json:"next_cursor"`
	HasMore    bool   `json:"has_more"`
}

func TestSequenceSyncPaginationUpdatesAndDeletion(t *testing.T) {
	router, _ := setupE2ERouterWithDB(t)
	token, _ := registerAndLoginReminderUser(t, router)
	var tasks []models.Task
	for _, title := range []string{"first", "second"} {
		res := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{"title": title}, nil)
		if res.Code != http.StatusCreated {
			t.Fatal(res.Body.String())
		}
		tasks = append(tasks, decodeJSON[models.Task](t, res))
	}
	pull := func(cursor string) sequenceSyncPage {
		res := doJSON(t, router, http.MethodGet, "/api/tasks/sync?cursor="+cursor+"&limit=1", token, nil, nil)
		if res.Code != http.StatusOK {
			t.Fatal(res.Body.String())
		}
		return decodeJSON[sequenceSyncPage](t, res)
	}
	first := pull("v1:0")
	if len(first.Tasks) != 1 || first.Tasks[0].ID != tasks[0].ID || !first.HasMore {
		t.Fatalf("first=%+v", first)
	}
	second := pull(first.NextCursor)
	if len(second.Tasks) != 1 || second.Tasks[0].ID != tasks[1].ID || second.HasMore {
		t.Fatalf("second=%+v", second)
	}
	res := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", tasks[0].ID), token, map[string]any{"title": "changed"}, map[string]string{"If-Match": "1", "X-Client-Op-Id": "sync-update"})
	if res.Code != http.StatusOK {
		t.Fatal(res.Body.String())
	}
	update := pull(second.NextCursor)
	if len(update.Tasks) != 1 || update.Tasks[0].Title != "changed" || update.Tasks[0].Revision != 2 {
		t.Fatalf("update=%+v", update)
	}
	res = doJSON(t, router, http.MethodDelete, fmt.Sprintf("/api/tasks/%d", tasks[0].ID), token, nil, nil)
	if res.Code < 200 || res.Code >= 300 {
		t.Fatal(res.Body.String())
	}
	deletion := pull(update.NextCursor)
	if len(deletion.Tasks) != 0 || len(deletion.Deleted) != 1 || deletion.Deleted[0].TaskID != tasks[0].ID {
		t.Fatalf("deletion=%+v", deletion)
	}
	for _, cursor := range []string{"v2:1", "v1:-1", "v1:nope"} {
		res := doJSON(t, router, http.MethodGet, "/api/tasks/sync?cursor="+cursor, token, nil, nil)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("invalid cursor %q status=%d", cursor, res.Code)
		}
	}
}
