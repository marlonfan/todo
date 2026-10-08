package scheduler

import (
	"context"
	"log"
	"sync"
	"time"
)

type notificationProcessor interface{ ProcessPendingNotifications(context.Context) error }

type NotifyScheduler struct {
	notifyService notificationProcessor
	interval      time.Duration
	mu            sync.Mutex
	cancel        context.CancelFunc
	done          chan struct{}
}

func NewNotifyScheduler(processor notificationProcessor, interval time.Duration) *NotifyScheduler {
	if interval <= 0 {
		interval = time.Minute
	}
	return &NotifyScheduler{notifyService: processor, interval: interval}
}

func (s *NotifyScheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.done != nil {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.done = make(chan struct{})
	go s.run(ctx, s.done)
}

func (s *NotifyScheduler) Stop() {
	s.mu.Lock()
	done := s.done
	if done == nil {
		s.mu.Unlock()
		return
	}
	s.cancel()
	s.mu.Unlock()
	<-done
	s.mu.Lock()
	if s.done == done {
		s.done = nil
		s.cancel = nil
	}
	s.mu.Unlock()
}

func (s *NotifyScheduler) run(ctx context.Context, done chan struct{}) {
	defer close(done)
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	s.process(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.process(ctx)
		}
	}
}

func (s *NotifyScheduler) process(parent context.Context) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Minute)
	defer cancel()
	if ctx.Err() != nil {
		return
	}
	if err := s.notifyService.ProcessPendingNotifications(ctx); err != nil && parent.Err() == nil {
		log.Printf("Error processing notifications: %v", err)
	}
}
