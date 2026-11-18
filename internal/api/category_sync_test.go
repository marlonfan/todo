package api

import (
	"errors"
	"fmt"
	"gorm.io/gorm"
	"net/http"
	"testing"
	"todo-app/internal/models"
)

func TestCategorySyncAtomicReceiptReplayIsolationAndTaskRetention(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)
	other, _ := registerAndLoginReminderUser(t, router)
	headers := map[string]string{"X-Client-Op-Id": "category-create-1"}
	body := map[string]any{"method": "POST", "category_id": 0, "category": map[string]string{"name": "离线工作", "emoji": "🧪", "color": "#3788d8"}}
	res := doJSON(t, router, "POST", "/api/categories/sync", token, body, headers)
	if res.Code != 200 {
		t.Fatal(res.Code, res.Body.String())
	}
	var result struct {
		Category models.Category `json:"category"`
		Replayed bool            `json:"replayed"`
	}
	result = decodeJSON[struct {
		Category models.Category `json:"category"`
		Replayed bool            `json:"replayed"`
	}](t, res)
	id := result.Category.ID
	again := doJSON(t, router, "POST", "/api/categories/sync", token, body, headers)
	if again.Code != 200 {
		t.Fatal(again.Code, again.Body.String())
	}
	replay := decodeJSON[struct {
		Category models.Category `json:"category"`
		Replayed bool            `json:"replayed"`
	}](t, again)
	if !replay.Replayed || replay.Category.ID != id {
		t.Fatal(replay)
	}
	modified := map[string]any{"method": "POST", "category_id": 0, "category": map[string]string{"name": "另一个名称", "emoji": "🧪", "color": "#3788d8"}}
	if bad := doJSON(t, router, "POST", "/api/categories/sync", token, modified, headers); bad.Code != 409 {
		t.Fatal(bad.Code, bad.Body.String())
	}
	// The same op ID is independent in another account.
	if independent := doJSON(t, router, "POST", "/api/categories/sync", other, body, headers); independent.Code != 200 {
		t.Fatal(independent.Code, independent.Body.String())
	}
	taskRes := doJSON(t, router, "POST", "/api/tasks", token, map[string]any{"title": "保留任务", "category_ids": []int64{id}}, nil)
	if taskRes.Code != 201 {
		t.Fatal(taskRes.Code, taskRes.Body.String())
	}
	task := decodeJSON[models.Task](t, taskRes)
	remove := map[string]any{"method": "DELETE", "category_id": id}
	if forbidden := doJSON(t, router, "POST", "/api/categories/sync", other, remove, map[string]string{"X-Client-Op-Id": "foreign-delete"}); forbidden.Code != http.StatusNotFound {
		t.Fatal(forbidden.Code, forbidden.Body.String())
	}
	for i := 0; i < 2; i++ {
		deleted := doJSON(t, router, "POST", "/api/categories/sync", token, remove, map[string]string{"X-Client-Op-Id": "delete-1"})
		if deleted.Code != 200 {
			t.Fatal(deleted.Code, deleted.Body.String())
		}
	}
	retained := doJSON(t, router, "GET", fmt.Sprintf("/api/tasks/%d", task.ID), token, nil, nil)
	if retained.Code != 200 || len(decodeJSON[models.Task](t, retained).Categories) != 0 {
		t.Fatal(retained.Code, retained.Body.String())
	}
	// Replay must not resurrect a category that was subsequently deleted.
	old := doJSON(t, router, "POST", "/api/categories/sync", token, body, headers)
	if old.Code != 200 {
		t.Fatal(old.Code, old.Body.String())
	}
	var count int64
	db.Model(&models.Category{}).Where("user_id = ?", user.ID).Count(&count)
	if count != 0 {
		t.Fatal("create replay resurrected deleted category", count)
	}
	// Receipt failure rolls back the category, not only its acknowledgement.
	if err := db.Callback().Create().Before("gorm:create").Register("qa_fail_category_receipt", func(tx *gorm.DB) {
		if tx.Statement.Table == "category_mutation_receipts" {
			tx.AddError(errors.New("injected receipt failure"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	failed := doJSON(t, router, "POST", "/api/categories/sync", token, modified, map[string]string{"X-Client-Op-Id": "receipt-fail"})
	if failed.Code != 500 {
		t.Fatal(failed.Code, failed.Body.String())
	}
	db.Model(&models.Category{}).Where("user_id = ?", user.ID).Count(&count)
	if count != 0 {
		t.Fatal("failed receipt left category behind", count)
	}
}
