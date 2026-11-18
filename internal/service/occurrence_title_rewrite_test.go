package service

import (
	"fmt"
	"testing"
	"time"
	"todo-app/internal/models"
)

func TestOccurrenceTitleRepeatedUpdatesAndClearPreserveDescription(t *testing.T) {
	svc, repo, uid := newTestTaskService(t)
	start := time.Date(2026, 3, 10, 9, 0, 0, 0, time.UTC)
	task := &models.Task{UserID: uid, Title: "系列标题", Status: models.TaskStatusPending, Priority: models.PriorityMedium, StartTime: &start, Revision: 1, RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Interval: 1}}
	if err := repo.Create(task); err != nil {
		t.Fatal(err)
	}
	instanceID := fmt.Sprintf("%d_20260310", task.ID)
	date, _, _ := parseOccurrenceDate("", "2026-03-10")
	for _, title := range []string{"首次实例标题", "第二次实例标题", "系列标题", ""} {
		latest, err := repo.GetByID(task.ID)
		if err != nil {
			t.Fatal(err)
		}
		revision := latest.Revision
		req := &models.UpdateTaskRequest{Title: title, InstanceID: instanceID, OccurrenceDate: "2026-03-10"}
		mask := map[string]bool{"title": true}
		if title == "首次实例标题" {
			req.Description = "只属于本次的描述"
			mask["description"] = true
		}
		if _, err := svc.Update(uid, task.ID, req, mask, &revision, nil); err != nil {
			t.Fatal(err)
		}
		row, err := repo.GetTaskOccurrence(uid, task.ID, date)
		if err != nil || row.Title != title || row.Description != "只属于本次的描述" {
			t.Fatalf("success response must persist repeated title: title=%q row=%+v err=%v", title, row, err)
		}
		latest, err = repo.GetByID(task.ID)
		if err != nil || latest.Title != "系列标题" {
			t.Fatal("instance write changed series", latest, err)
		}
		items, err := svc.ListNextPendingOccurrences(uid, start.Add(-time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		found := false
		want := title
		if want == "" {
			want = "系列标题"
		}
		for _, item := range items {
			if item.InstanceID == instanceID {
				found = true
				if item.Title != want || item.Description != "只属于本次的描述" {
					t.Fatalf("next-occurrence projection stale: got %+v want title %q", item, want)
				}
			}
		}
		if !found {
			t.Fatal("next-occurrence projection missing edited instance")
		}
	}
}
