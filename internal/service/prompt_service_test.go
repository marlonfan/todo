package service

import (
	"testing"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newTestPromptService(t *testing.T) *PromptService {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.Prompt{}, &models.PromptAskHistory{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return NewPromptService(repository.NewPromptRepository(db))
}

func TestPromptServiceCreateUpdateAndUserIsolation(t *testing.T) {
	service := newTestPromptService(t)

	created, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "  Standup coach  ",
		Content: "  Ask concise follow-up questions.  ",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if created.Title != "Standup coach" {
		t.Fatalf("expected trimmed title, got %q", created.Title)
	}
	if created.Content != "Ask concise follow-up questions." {
		t.Fatalf("expected trimmed content, got %q", created.Content)
	}

	if _, err := service.GetByID(2, created.ID); err == nil {
		t.Fatalf("expected prompt to be isolated by user")
	}

	updated, err := service.Update(1, created.ID, &models.UpdatePromptRequest{
		Title: "Decision helper",
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if updated.Title != "Decision helper" {
		t.Fatalf("expected updated title, got %q", updated.Title)
	}
	if updated.Content != "Ask concise follow-up questions." {
		t.Fatalf("expected content to remain unchanged, got %q", updated.Content)
	}
}

func TestPromptServiceRequiresTitleAndContent(t *testing.T) {
	service := newTestPromptService(t)

	if _, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "   ",
		Content: "content",
	}); err == nil {
		t.Fatalf("expected blank title to fail")
	}

	if _, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "title",
		Content: "   ",
	}); err == nil {
		t.Fatalf("expected blank content to fail")
	}
}

func TestPromptServiceAskHistoryIsUserScoped(t *testing.T) {
	service := newTestPromptService(t)

	prompt, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "Reviewer",
		Content: "Review the input.",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	history, err := service.CreateAskHistory(1, &models.CreatePromptAskHistoryRequest{
		PromptID: prompt.ID,
		Input:    "  Check this plan  ",
		Output:   "  Looks good.  ",
		Status:   "stopped",
	})
	if err != nil {
		t.Fatalf("CreateAskHistory returned error: %v", err)
	}
	if history.PromptTitle != "Reviewer" {
		t.Fatalf("expected prompt title snapshot, got %q", history.PromptTitle)
	}
	if history.Input != "Check this plan" {
		t.Fatalf("expected trimmed input, got %q", history.Input)
	}
	if history.Output != "Looks good." {
		t.Fatalf("expected trimmed output, got %q", history.Output)
	}
	if history.Status != "stopped" {
		t.Fatalf("expected stopped status, got %q", history.Status)
	}

	items, err := service.ListAskHistory(1, 0, 10)
	if err != nil {
		t.Fatalf("ListAskHistory returned error: %v", err)
	}
	if len(items.Items) != 1 || items.Items[0].ID != history.ID {
		t.Fatalf("expected one history item, got %#v", items.Items)
	}

	otherItems, err := service.ListAskHistory(2, 0, 10)
	if err != nil {
		t.Fatalf("ListAskHistory for other user returned error: %v", err)
	}
	if len(otherItems.Items) != 0 {
		t.Fatalf("expected no history for other user, got %#v", otherItems.Items)
	}

	if _, err := service.CreateAskHistory(2, &models.CreatePromptAskHistoryRequest{
		PromptID: prompt.ID,
		Input:    "question",
		Output:   "answer",
	}); err == nil {
		t.Fatalf("expected prompt history to require same user prompt")
	}
}

func TestPromptServiceAskHistoryStoresReasoningAndIncompleteFinish(t *testing.T) {
	service := newTestPromptService(t)
	prompt, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "Planner",
		Content: "Think before answering.",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	history, err := service.CreateAskHistory(1, &models.CreatePromptAskHistoryRequest{
		PromptID:     prompt.ID,
		Input:        "Make a plan",
		Reasoning:    "  Consider dependencies first.  ",
		Output:       "  Partial plan  ",
		Status:       "incomplete",
		FinishReason: "max_tokens",
	})
	if err != nil {
		t.Fatalf("CreateAskHistory returned error: %v", err)
	}
	if history.Reasoning != "Consider dependencies first." {
		t.Fatalf("expected trimmed reasoning, got %q", history.Reasoning)
	}
	if history.Output != "Partial plan" {
		t.Fatalf("expected trimmed output, got %q", history.Output)
	}
	if history.Status != "incomplete" {
		t.Fatalf("expected incomplete status, got %q", history.Status)
	}
	if history.FinishReason != "max_tokens" {
		t.Fatalf("expected max_tokens finish reason, got %q", history.FinishReason)
	}
}

func TestPromptServiceAskHistoryPaginationAndDelete(t *testing.T) {
	service := newTestPromptService(t)

	prompt, err := service.Create(1, &models.CreatePromptRequest{
		Title:   "Reviewer",
		Content: "Review the input.",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	var ids []int64
	for i := 0; i < 3; i++ {
		history, err := service.CreateAskHistory(1, &models.CreatePromptAskHistoryRequest{
			PromptID: prompt.ID,
			Input:    "question",
			Output:   "answer",
		})
		if err != nil {
			t.Fatalf("CreateAskHistory returned error: %v", err)
		}
		ids = append(ids, history.ID)
	}

	firstPage, err := service.ListAskHistory(1, 0, 2)
	if err != nil {
		t.Fatalf("ListAskHistory first page returned error: %v", err)
	}
	if len(firstPage.Items) != 2 {
		t.Fatalf("expected first page to contain 2 items, got %d", len(firstPage.Items))
	}
	if !firstPage.HasMore || firstPage.NextCursor == 0 {
		t.Fatalf("expected first page to expose a next cursor, got %#v", firstPage)
	}
	if firstPage.Items[0].ID != ids[2] || firstPage.Items[1].ID != ids[1] {
		t.Fatalf("expected newest-first history order, got %#v", firstPage.Items)
	}

	secondPage, err := service.ListAskHistory(1, firstPage.NextCursor, 2)
	if err != nil {
		t.Fatalf("ListAskHistory second page returned error: %v", err)
	}
	if len(secondPage.Items) != 1 || secondPage.Items[0].ID != ids[0] {
		t.Fatalf("expected second page to contain oldest item, got %#v", secondPage.Items)
	}
	if secondPage.HasMore || secondPage.NextCursor != 0 {
		t.Fatalf("expected second page to be terminal, got %#v", secondPage)
	}

	if err := service.DeleteAskHistory(2, ids[1]); err == nil {
		t.Fatalf("expected deleting another user's history to fail")
	}
	if err := service.DeleteAskHistory(1, ids[1]); err != nil {
		t.Fatalf("DeleteAskHistory returned error: %v", err)
	}
	afterDelete, err := service.ListAskHistory(1, 0, 10)
	if err != nil {
		t.Fatalf("ListAskHistory after delete returned error: %v", err)
	}
	if len(afterDelete.Items) != 2 {
		t.Fatalf("expected two history rows after delete, got %d", len(afterDelete.Items))
	}
	for _, item := range afterDelete.Items {
		if item.ID == ids[1] {
			t.Fatalf("deleted history item still returned: %#v", afterDelete.Items)
		}
	}
}
