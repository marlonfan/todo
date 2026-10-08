package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
	"todo-app/internal/models"
	"todo-app/internal/notify"
	"todo-app/internal/repository"
)

type dispatchNotifier struct {
	active  atomic.Int32
	peak    atomic.Int32
	sends   atomic.Int32
	block   bool
	success bool
}

func (n *dispatchNotifier) Name() string                           { return "ntfy" }
func (n *dispatchNotifier) ValidateConfig(map[string]string) error { return nil }
func (n *dispatchNotifier) DefaultTemplate() string                { return "" }
func (n *dispatchNotifier) Send(ctx context.Context, _ int64, _ map[string]string, _ *notify.Message) error {
	n.sends.Add(1)
	active := n.active.Add(1)
	defer n.active.Add(-1)
	for peak := n.peak.Load(); active > peak; peak = n.peak.Load() {
		if n.peak.CompareAndSwap(peak, active) {
			break
		}
	}
	if n.block {
		<-ctx.Done()
		return ctx.Err()
	}
	if n.success {
		return nil
	}
	return errors.New("delivery failure")
}

func TestNotificationCancellationBoundsWorkersAndReleasesClaims(t *testing.T) {
	taskSvc, db, uid := consistencyTestService(t, "sqlite")
	task, err := taskSvc.Create(uid, &models.CreateTaskRequest{Title: "dispatch"})
	if err != nil {
		t.Fatal(err)
	}
	repo := repository.NewNotificationRepository(db)
	for i := 0; i < 14; i++ {
		if err := repo.Create(&models.Notification{TaskID: task.ID, Channel: models.NotifyChannelNtfy,
			Config: models.NotifyConfigMap{}, NotifyAt: time.Now().UTC().Add(-time.Minute), Status: models.NotifyStatusPending}); err != nil {
			t.Fatal(err)
		}
	}
	plugin := &dispatchNotifier{block: true}
	registry := notify.NewRegistry()
	registry.Register(plugin)
	svc := NewNotifyService(repo, repository.NewUserRepository(db), repository.NewTaskRepository(db), registry)
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	started := time.Now()
	if err := svc.ProcessPendingNotifications(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("error=%v", err)
	}
	if time.Since(started) > 2*time.Second {
		t.Fatal("deadline not respected")
	}
	if plugin.peak.Load() != notificationWorkers || plugin.sends.Load() != notificationWorkers {
		t.Fatalf("peak=%d sends=%d", plugin.peak.Load(), plugin.sends.Load())
	}
	rows, err := repo.GetByTask(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.Status != models.NotifyStatusPending || row.RetryCount != 0 {
			t.Fatalf("claim left behind: %+v", row)
		}
	}
}

func TestNotificationFailureStopsAtAttemptLimit(t *testing.T) {
	taskSvc, db, uid := consistencyTestService(t, "sqlite")
	task, err := taskSvc.Create(uid, &models.CreateTaskRequest{Title: "terminal"})
	if err != nil {
		t.Fatal(err)
	}
	repo := repository.NewNotificationRepository(db)
	row := &models.Notification{TaskID: task.ID, Channel: models.NotifyChannelNtfy, Config: models.NotifyConfigMap{},
		NotifyAt: time.Now().UTC().Add(-time.Minute), Status: models.NotifyStatusFailed, RetryCount: maxDeliveryAttempts - 1}
	if err = repo.Create(row); err != nil {
		t.Fatal(err)
	}
	plugin := &dispatchNotifier{}
	registry := notify.NewRegistry()
	registry.Register(plugin)
	svc := NewNotifyService(repo, repository.NewUserRepository(db), repository.NewTaskRepository(db), registry)
	for i := 0; i < 2; i++ {
		if err = svc.ProcessPendingNotifications(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	saved, err := repo.GetByID(row.ID)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != models.NotifyStatusAbandoned || saved.NextRetryAt != nil || saved.RetryCount != maxDeliveryAttempts || plugin.sends.Load() != 1 {
		t.Fatalf("terminal=%+v sends=%d", saved, plugin.sends.Load())
	}
}

func TestRetryDelayNeverOverflows(t *testing.T) {
	for _, count := range []int{-1, 0, 1, 5, 28, 64, 1000000} {
		delay := nextRetryDelay(count)
		if delay <= 0 || delay > maxRetryDelay {
			t.Fatalf("count=%d delay=%v", count, delay)
		}
		if count >= 5 && delay != maxRetryDelay {
			t.Fatalf("count=%d delay=%v", count, delay)
		}
	}
}

func TestNotificationConcurrentBatchPreservesDedupe(t *testing.T) {
	taskSvc, db, uid := consistencyTestService(t, "sqlite")
	task, err := taskSvc.Create(uid, &models.CreateTaskRequest{Title: "dedupe"})
	if err != nil {
		t.Fatal(err)
	}
	repo := repository.NewNotificationRepository(db)
	for i := 0; i < 8; i++ {
		if err = repo.Create(&models.Notification{TaskID: task.ID, Channel: models.NotifyChannelNtfy, Config: models.NotifyConfigMap{}, DedupeKey: "same", NotifyAt: time.Now().UTC().Add(-time.Minute), Status: models.NotifyStatusPending}); err != nil {
			t.Fatal(err)
		}
	}
	plugin := &dispatchNotifier{success: true}
	registry := notify.NewRegistry()
	registry.Register(plugin)
	svc := NewNotifyService(repo, repository.NewUserRepository(db), repository.NewTaskRepository(db), registry)
	if err = svc.ProcessPendingNotifications(context.Background()); err != nil {
		t.Fatal(err)
	}
	if plugin.sends.Load() != 1 {
		t.Fatalf("duplicate sends=%d", plugin.sends.Load())
	}
	rows, err := repo.GetByTask(task.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.Status != models.NotifyStatusSent {
			t.Fatalf("status=%s", row.Status)
		}
	}
}
