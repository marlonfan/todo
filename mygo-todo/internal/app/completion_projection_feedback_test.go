package app

import (
	"testing"
	"time"

	"todo-native/internal/api"
)

func TestCompletionFeedbackSurvivesFastOccurrenceProjectionReplacement(t *testing.T) {
	now := time.Now()
	before := api.Task{ID: 7, Title: "本次任务", Status: "pending", InstanceID: "7_20261111", OccurrenceDate: "2026-11-11"}
	a := &App{}
	a.interaction.recordStatus(before, "completed", "acknowledged", now)
	next := before
	next.InstanceID = "7_20261112"
	next.OccurrenceDate = "2026-11-12"
	// A fast server response has already removed today's occurrence from Next
	// before the 180ms visual feedback period finishes.
	visible := a.interactionTasks([]api.Task{next}, "all", "", now.Add(70*time.Millisecond))
	found := false
	for _, task := range visible {
		if taskRowKey(task) == taskRowKey(before) {
			found = true
			if task.Status != "completed" {
				t.Fatal("retained row lost checked feedback")
			}
		}
	}
	if !found || len(visible) != 2 {
		t.Fatal("fast projection removed checked feedback early", visible)
	}
	visible = a.interactionTasks([]api.Task{next}, "all", "", now.Add(motionCompleteHold+20*time.Millisecond))
	if len(visible) != 1 || visible[0].InstanceID != next.InstanceID || len(a.interaction.statuses) != 0 {
		t.Fatal("feedback did not end at its own identity boundary", visible)
	}
}
