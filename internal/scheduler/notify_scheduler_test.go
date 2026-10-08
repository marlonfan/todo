package scheduler

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type blockingProcessor struct {
	calls    atomic.Int32
	started  chan struct{}
	finished chan struct{}
}

func (p *blockingProcessor) ProcessPendingNotifications(ctx context.Context) error {
	p.calls.Add(1)
	close(p.started)
	<-ctx.Done()
	close(p.finished)
	return ctx.Err()
}
func TestNotifySchedulerStopCancelsAndWaits(t *testing.T) {
	p := &blockingProcessor{started: make(chan struct{}), finished: make(chan struct{})}
	s := NewNotifyScheduler(p, time.Hour)
	s.Stop()
	s.Start()
	s.Start()
	select {
	case <-p.started:
	case <-time.After(time.Second):
		t.Fatal("scheduler did not start")
	}
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); s.Stop() }()
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Stop did not cancel")
	}
	select {
	case <-p.finished:
	default:
		t.Fatal("Stop returned before work finished")
	}
	if p.calls.Load() != 1 {
		t.Fatal("duplicate Start created workers")
	}
	s.Stop()
}
