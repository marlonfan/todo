package notify

import "sync"

// Registry manages notification plugins
type Registry struct {
	mu        sync.RWMutex
	notifiers map[string]Notifier
}

// NewRegistry creates a new registry
func NewRegistry() *Registry {
	return &Registry{
		notifiers: make(map[string]Notifier),
	}
}

// Register registers a notifier
func (r *Registry) Register(n Notifier) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.notifiers[n.Name()] = n
}

// Get retrieves a notifier by name
func (r *Registry) Get(name string) (Notifier, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n, ok := r.notifiers[name]
	return n, ok
}

// List returns all registered notifier names
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	names := make([]string, 0, len(r.notifiers))
	for name := range r.notifiers {
		names = append(names, name)
	}
	return names
}
