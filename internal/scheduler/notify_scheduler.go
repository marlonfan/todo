package scheduler

import (
	"context"
	"log"
	"time"
	"todo-app/internal/service"
)

type NotifyScheduler struct {
	notifyService *service.NotifyService
	interval      time.Duration
	stopCh        chan struct{}
	isRunning     bool // Fix 7: 防止重复执行
}

func NewNotifyScheduler(notifyService *service.NotifyService, interval time.Duration) *NotifyScheduler {
	return &NotifyScheduler{
		notifyService: notifyService,
		interval:      interval,
		stopCh:        make(chan struct{}),
		isRunning:     false,
	}
}

func (s *NotifyScheduler) Start() {
	go s.run()
}

func (s *NotifyScheduler) Stop() {
	close(s.stopCh)
}

func (s *NotifyScheduler) run() {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	// Run immediately on start
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

func (s *NotifyScheduler) process() {
	// Fix 7: 简单锁防止重叠执行
	if s.isRunning {
		log.Println("Notification processing is already running, skipping...")
		return
	}
	s.isRunning = true
	defer func() { s.isRunning = false }()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := s.notifyService.ProcessPendingNotifications(); err != nil {
		log.Printf("Error processing notifications: %v", err)
	}

	_ = ctx
}
