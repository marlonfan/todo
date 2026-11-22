package app

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nsgo-dev/nsgo/core"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/storage"
	"nsgo-todo/internal/voice"
)

// nsgoSecretStore adapts NSGo's platform keychain / Android Keystore to storage.SecretStore.
// core.Secrets is explicitly safe to call off the engine goroutine.
type nsgoSecretStore struct {
	secrets core.Secrets
}

func (s nsgoSecretStore) Set(key string, val []byte) error {
	return s.secrets.Set(key, string(val))
}

func (s nsgoSecretStore) Get(key string) ([]byte, error) {
	v, ok, err := s.secrets.Get(key)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, os.ErrNotExist
	}
	return []byte(v), nil
}

func (s nsgoSecretStore) Delete(key string) error {
	return s.secrets.Delete(key)
}

// persistence wraps file-backed storage.Store (using cx.DataDir() on Android/desktop/nsgotest)
// and safely coordinates any core.Storage KV writes onto the engine goroutine via cx.Post.
type persistence struct {
	cx        *core.Scope
	fileStore storage.Store
	useFile   bool
	kv        core.Storage
	secrets   core.Secrets
}

const (
	kvSessionKey    = "todo.session.v1"
	kvCacheKey      = "todo.cache.v1"
	kvPrefsKey      = "todo.prefs.v1"
	kvLastServerKey = "todo.last_server.v1"
	secretDoubaoKey = "todo.doubao.asr.v1"
)

func newPersistence(cx *core.Scope) persistence {
	secrets := cx.Secrets()
	dataDir := cx.DataDir()
	if dataDir != "" {
		dir := filepath.Join(dataDir, "nsgo-todo")
		return persistence{
			cx: cx,
			fileStore: storage.Store{
				Dir:     dir,
				Secrets: nsgoSecretStore{secrets: secrets},
			},
			useFile: true,
			kv:      cx.Storage(),
			secrets: secrets,
		}
	}
	return persistence{
		cx:      cx,
		useFile: false,
		kv:      cx.Storage(),
		secrets: secrets,
	}
}

func (p persistence) SyncStore() storage.Store {
	if p.useFile {
		return p.fileStore
	}
	return storage.Store{
		OnSaveCache: func(storage.Cache) error { return nil },
	}
}

// LoadLastServer MUST be called on the engine goroutine (during init).
func (p persistence) LoadLastServer() string {
	if v, ok := p.kv.GetItem(kvLastServerKey); ok && v != "" {
		return v
	}
	return api.DefaultServer
}

// SaveLastServer posts the reactive KV write to the engine goroutine so it is safe from any goroutine.
func (p persistence) SaveLastServer(server string) {
	if server == "" {
		return
	}
	p.cx.Post(func() {
		_ = p.kv.SetItem(kvLastServerKey, server)
	})
}

// LoadPreferences MUST be called on the engine goroutine (during init).
func (p persistence) LoadPreferences() storage.Preferences {
	if p.useFile {
		if prefs, err := p.fileStore.Preferences(); err == nil {
			return prefs
		}
	}
	if raw, ok := p.kv.GetItem(kvPrefsKey); ok {
		var prefs storage.Preferences
		if json.Unmarshal([]byte(raw), &prefs) == nil {
			return prefs
		}
	}
	return storage.Preferences{}
}

// SavePreferences is safe to call from any goroutine.
func (p persistence) SavePreferences(prefs storage.Preferences) error {
	if b, err := json.Marshal(prefs); err == nil {
		raw := string(b)
		p.cx.Post(func() {
			_ = p.kv.SetItem(kvPrefsKey, raw)
		})
	}
	if p.useFile {
		return p.fileStore.SavePreferences(prefs)
	}
	return nil
}

func kvSecretAccount(server string, userID int64) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%d", server, userID)))
	return fmt.Sprintf("nsgo-session-%x", sum[:])
}

// LoadSession is safe to call off the engine goroutine when useFile is true.
func (p persistence) LoadSession() (api.Session, error) {
	if p.useFile {
		return p.fileStore.Session()
	}
	return api.Session{}, os.ErrNotExist
}

// SaveSession is safe to call from any goroutine.
func (p persistence) SaveSession(s api.Session) error {
	p.SaveLastServer(s.Server)
	if p.useFile {
		return p.fileStore.SaveSession(s)
	}
	meta := s
	if s.Token != "" && s.Server != "" && s.User.ID != 0 {
		if err := p.secrets.Set(kvSecretAccount(s.Server, s.User.ID), s.Token); err == nil {
			meta.Token = ""
		}
	}
	b, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	raw := string(b)
	p.cx.Post(func() {
		_ = p.kv.SetItem(kvSessionKey, raw)
	})
	return nil
}

// LoadCache is safe to call from any goroutine when useFile is true.
func (p persistence) LoadCache(server string, userID int64) (storage.Cache, error) {
	if p.useFile {
		return p.fileStore.Cache(server, userID)
	}
	return storage.Cache{}, os.ErrNotExist
}

// SaveCache is safe to call from any goroutine.
func (p persistence) SaveCache(c storage.Cache) error {
	if p.useFile {
		return p.fileStore.SaveCache(c)
	}
	b, err := json.Marshal(c)
	if err != nil {
		return err
	}
	raw := string(b)
	p.cx.Post(func() {
		_ = p.kv.SetItem(kvCacheKey, raw)
	})
	return nil
}

// Logout is safe to call from any goroutine.
func (p persistence) Logout() error {
	if p.useFile {
		return p.fileStore.Logout()
	}
	p.cx.Post(func() {
		if raw, ok := p.kv.GetItem(kvSessionKey); ok {
			var s api.Session
			if json.Unmarshal([]byte(raw), &s) == nil && s.Server != "" && s.User.ID != 0 {
				acc := kvSecretAccount(s.Server, s.User.ID)
				go func() { _ = p.secrets.Delete(acc) }()
			}
		}
		p.kv.RemoveItem(kvSessionKey)
		p.kv.RemoveItem(kvCacheKey)
	})
	return nil
}

// LoadDoubaoConfig loads encrypted Doubao IME ASR credentials from the platform
// keystore (safe to call off the engine goroutine), falling back to build defaults.
func (p persistence) LoadDoubaoConfig() voice.DoubaoConfig {
	def := voice.DefaultDoubaoConfig()
	raw, ok, err := p.secrets.Get(secretDoubaoKey)
	if err != nil || !ok || raw == "" {
		return def
	}
	var saved voice.DoubaoConfig
	if json.Unmarshal([]byte(raw), &saved) != nil {
		return def
	}
	if saved.AppID == "" {
		saved.AppID = def.AppID
	}
	if saved.AppKey == "" {
		saved.AppKey = def.AppKey
	}
	if saved.DeviceID == "" {
		saved.DeviceID = def.DeviceID
	}
	return saved.Normalized()
}

// SaveDoubaoConfig persists Doubao IME ASR credentials encrypted in the platform keystore.
func (p persistence) SaveDoubaoConfig(cfg voice.DoubaoConfig) error {
	norm := cfg.Normalized()
	b, err := json.Marshal(norm)
	if err != nil {
		return err
	}
	return p.secrets.Set(secretDoubaoKey, string(b))
}
