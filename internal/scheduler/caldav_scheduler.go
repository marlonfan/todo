package scheduler

import (
	"context"
	"log"
	"sync/atomic"
	"time"
	"todo-app/internal/service"
)

type CaldavScheduler struct {
	service   *service.CaldavService
	interval  time.Duration
	stopCh    chan struct{}
	isRunning int32
}

func NewCaldavScheduler(caldavService *service.CaldavService, interval time.Duration) *CaldavScheduler {
	return &CaldavScheduler{
		service:  caldavService,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

func (s *CaldavScheduler) Start() {
	go s.run()
}

func (s *CaldavScheduler) Stop() {
	close(s.stopCh)
}

func (s *CaldavScheduler) run() {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	s.process()

	for {
		select {
		case <-ticker.C:
			s.process()
		case <-s.stopCh:
			return
		}
	}
}

func (s *CaldavScheduler) process() {
	if !atomic.CompareAndSwapInt32(&s.isRunning, 0, 1) {
		return
	}
	defer atomic.StoreInt32(&s.isRunning, 0)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if err := s.service.SyncAllActiveSources(ctx); err != nil {
		log.Printf("CalDAV sync scheduler error: %v", err)
	}
}
