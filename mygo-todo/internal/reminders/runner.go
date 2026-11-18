package reminders

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"todo-native/internal/storage"
)

type Store interface {
	ReminderLedger() (storage.ReminderLedger, error)
	SaveReminderLedger(storage.ReminderLedger) error
}
type Deliver func(context.Context, Candidate) error
type Status struct {
	Scope   string
	Pending int
	Message string
	Failed  bool
}

// Runner owns a separate ledger; it never writes the task cache or waits on the UI.
// A reservation is durable before handing a notification to the OS. A crash in
// that tiny interval may lose that reminder, but cannot resend it after restart.
type Runner struct {
	mu           sync.Mutex
	input        Input
	candidates   []Candidate
	sending      *Candidate
	stopDelivery context.CancelFunc
	wake         chan struct{}
	store        Store
	deliver      Deliver
	report       func(Status)
	now          func() time.Time
	interval     time.Duration
}

func New(store Store, deliver Deliver, report func(Status)) *Runner {
	return &Runner{store: store, deliver: deliver, report: report, now: time.Now, interval: time.Second, wake: make(chan struct{}, 1)}
}

// Update takes ownership of an immutable cache copy. Changed/removed candidates
// cancel any pending OS permission request, including logout or account changes.
func (r *Runner) Update(in Input) {
	candidates := Plan(in)
	r.mu.Lock()
	r.input, r.candidates = in, candidates
	if r.sending != nil {
		valid := false
		for _, c := range candidates {
			if c == *r.sending {
				valid = true
				break
			}
		}
		if !valid && r.stopDelivery != nil {
			r.stopDelivery()
		}
	}
	r.mu.Unlock()
	select {
	case r.wake <- struct{}{}:
	default:
	}
}

func (r *Runner) Run(ctx context.Context) {
	ledger, loadErr := r.store.ReminderLedger()
	if errors.Is(loadErr, os.ErrNotExist) {
		loadErr = nil
	}
	if ledger.Records == nil {
		ledger.Records = make(map[string]storage.ReminderRecord)
	}
	retries := make(map[string]time.Time)
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	last := Status{}
	emit := func(s Status) {
		if s != last && ctx.Err() == nil {
			last = s
			if r.report != nil {
				r.report(s)
			}
		}
	}
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-r.wake:
		}
		r.mu.Lock()
		in, candidates := r.input, append([]Candidate(nil), r.candidates...)
		r.mu.Unlock()
		status := Status{Scope: Scope(in.Server, in.User.ID)}
		if !in.Enabled || in.User.ID == 0 {
			status.Message = "本机提醒已关闭"
			emit(status)
			continue
		}
		if loadErr != nil {
			status.Failed = true
			status.Message = "无法读取提醒记录，已暂停发送以保护原记录：" + loadErr.Error()
			emit(status)
			continue
		}
		now := r.now()
		for _, c := range candidates {
			if _, seen := ledger.Records[c.ID]; seen || now.Sub(c.At) > Grace {
				continue
			}
			status.Pending++
			if c.At.After(now) || retries[c.ID].After(now) {
				continue
			}
			if ctx.Err() != nil {
				return
			}
			deliveryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			// Recheck after acquiring the lock: logout may have arrived since planning.
			r.mu.Lock()
			current := false
			for _, live := range r.candidates {
				if live == c {
					current = true
					break
				}
			}
			if current {
				r.sending, r.stopDelivery = &c, cancel
			}
			r.mu.Unlock()
			if !current {
				cancel()
				continue
			}
			record := storage.ReminderRecord{At: now, State: "reserved", Scope: c.Scope, TaskKey: c.TaskKey, InstanceID: c.InstanceID}
			ledger.Records[c.ID] = record
			// Retain dedupe receipts longer than the cached 30-day calendar window.
			for id, receipt := range ledger.Records {
				if now.Sub(receipt.At) > 90*24*time.Hour {
					delete(ledger.Records, id)
				}
			}
			err := r.store.SaveReminderLedger(ledger)
			if err == nil {
				if deliveryCtx.Err() != nil {
					err = deliveryCtx.Err()
				} else {
					err = r.deliver(deliveryCtx, c)
				}
				if err != nil {
					delete(ledger.Records, c.ID)
					if rollbackErr := r.store.SaveReminderLedger(ledger); rollbackErr != nil {
						loadErr = rollbackErr
					}
				} else {
					record.State = "submitted"
					ledger.Records[c.ID] = record
					if saveErr := r.store.SaveReminderLedger(ledger); saveErr != nil {
						loadErr = saveErr
					}
				}
			} else {
				delete(ledger.Records, c.ID)
				loadErr = err
			}
			cancel()
			r.mu.Lock()
			r.sending, r.stopDelivery = nil, nil
			r.mu.Unlock()
			if err != nil {
				retries[c.ID] = now.Add(time.Minute)
				status.Failed = true
				status.Message = fmt.Sprintf("本机提醒暂未送达：%v；一分钟后重试，可使用测试通知检查权限。", err)
			} else {
				status.Pending--
				status.Message = "最近一条提醒已交给系统"
			}
			if loadErr != nil {
				status.Failed = true
				status.Message = "无法保存提醒记录，已暂停发送：" + loadErr.Error()
				break
			}
		}
		if status.Message == "" {
			if last.Failed && last.Scope == status.Scope {
				status.Failed, status.Message = last.Failed, last.Message
			} else {
				status.Message = "本机提醒运行中"
			}
		}
		emit(status)
	}
}
