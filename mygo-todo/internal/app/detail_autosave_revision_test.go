package app

import (
	"fmt"
	"testing"

	"todo-native/internal/api"
	"todo-native/internal/syncer"
)

func TestAutosaveStatusReceiptCannotAuthorizeUnseenInstanceBody(t *testing.T) {
	a := autosaveFixture(t)
	series := a.tasks[0]
	series.Revision = 7
	a.cache.Tasks[0] = series
	a.adoptCache(a.cache)
	occurrence := series
	occurrence.InstanceID = "1_20261111"
	occurrence.OccurrenceDate = "2026-11-11"
	a.openTask(occurrence)
	if a.selectedOccurrence == nil {
		t.Fatal("fixture did not open an occurrence")
	}
	state := syncer.Clone(a.cache)
	state.Tasks[0].Revision = 8
	state.Tasks[0].Description = "他端描述 B"
	a.adoptCache(state)
	if a.selectedOccurrence.Description != "远端原描述" || a.selectedOccurrence.Revision != 7 {
		t.Fatal("fixture did not retain old visible baseline")
	}
	payload, _ := taskStatusPayload(occurrence, "completed")
	op, err := a.persistTaskIntent("PATCH", "/tasks/1/status", payload, 8)
	if err != nil {
		t.Fatal(err)
	}
	a.cache.Outbox[0].Sent = true
	receipt := state.Tasks[0]
	receipt.Revision = 9
	a.localWrites.reply = &taskWriteReply{op: op, task: receipt}
	a.drainTaskReceipts()
	if a.selectedOccurrence.Revision != 7 {
		t.Fatal("independent status receipt authorized unseen instance baseline", a.selectedOccurrence.Revision)
	}
	a.occurrenceEditing = true
	a.occurrenceTitle = a.selectedOccurrence.Title
	a.occurrenceDescription = "本机基于 A 的编辑"
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	if a.cache.Outbox[0].Revision != 7 {
		t.Fatal("autosave lost original guard", a.cache.Outbox[0].Revision)
	}
}

func TestAutosaveIndependentReceiptDoesNotRebaseAlreadyQueuedStaleText(t *testing.T) {
	a := autosaveFixture(t)
	// Keep the old editor active while a read brings in a newer server row.
	a.autosave.focused = true
	state := syncer.Clone(a.cache)
	state.Tasks[0].Revision = 2
	state.Tasks[0].Description = "他端新描述"
	a.adoptCache(state)
	op, err := a.persistTaskIntent("PATCH", "/tasks/1/status", map[string]any{"status": "completed"}, 2)
	if err != nil {
		t.Fatal(err)
	}
	a.cache.Outbox[0].Sent = true
	a.draft.Description = "基于旧描述继续编辑"
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	if a.cache.Outbox[1].Revision != 1 {
		t.Fatal("stale edit did not retain guard")
	}
	receipt := state.Tasks[0]
	receipt.Revision = 3
	receipt.Status = "completed"
	a.localWrites.reply = &taskWriteReply{op: op, task: receipt}
	a.drainTaskReceipts()
	if len(a.cache.Outbox) != 1 || a.cache.Outbox[0].Revision != 1 || a.draft.Task.Revision != 1 {
		t.Fatal("newer independent write authorized unseen body", fmt.Sprint(a.cache.Outbox), a.draft.Task.Revision)
	}
}

func TestAutosaveMissingTaskReceiptOffersOrphanRecovery(t *testing.T) {
	a := autosaveFixture(t)
	a.draft.Title = "必须保留的自动保存正文"
	if !a.flushDetailAutosave() {
		t.Fatal(a.autosave.failure)
	}
	op := a.cache.Outbox[0]
	a.cache.Outbox[0].Sent = true
	a.localWrites.reply = &taskWriteReply{op: op, err: &api.Error{Status: 404}}
	a.drainTaskReceipts()
	if !a.taskDraftOrphaned || a.draft.Title != "必须保留的自动保存正文" || len(a.cache.Outbox) != 1 {
		t.Fatal("deleted server task lost local input or recovery path")
	}
}
