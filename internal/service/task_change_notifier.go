package service

import "sync"

type TaskChangeNotifier struct {
	mu          sync.Mutex
	subscribers map[int64]map[chan struct{}]struct{}
}

func NewTaskChangeNotifier() *TaskChangeNotifier {
	return &TaskChangeNotifier{
		subscribers: make(map[int64]map[chan struct{}]struct{}),
	}
}

func (n *TaskChangeNotifier) Subscribe(userID int64) (<-chan struct{}, func()) {
	if n == nil || userID <= 0 {
		return nil, func() {}
	}

	ch := make(chan struct{}, 1)
	n.mu.Lock()
	if n.subscribers[userID] == nil {
		n.subscribers[userID] = make(map[chan struct{}]struct{})
	}
	n.subscribers[userID][ch] = struct{}{}
	n.mu.Unlock()

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			n.mu.Lock()
			if subscribers := n.subscribers[userID]; subscribers != nil {
				delete(subscribers, ch)
				if len(subscribers) == 0 {
					delete(n.subscribers, userID)
				}
			}
			n.mu.Unlock()
		})
	}

	return ch, unsubscribe
}

func (n *TaskChangeNotifier) Notify(userID int64) {
	if n == nil || userID <= 0 {
		return
	}

	n.mu.Lock()
	subscribers := make([]chan struct{}, 0, len(n.subscribers[userID]))
	for ch := range n.subscribers[userID] {
		subscribers = append(subscribers, ch)
	}
	n.mu.Unlock()

	for _, ch := range subscribers {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}
