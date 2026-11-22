package storage

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"nsgo-todo/internal/api"
)

type memorySecrets struct {
	values      map[string][]byte
	unsupported bool
}

func (m *memorySecrets) Set(key string, value []byte) error {
	if m.unsupported {
		return errors.ErrUnsupported
	}
	if m.values == nil {
		m.values = map[string][]byte{}
	}
	m.values[key] = append([]byte(nil), value...)
	return nil
}
func (m *memorySecrets) Get(key string) ([]byte, error) {
	if m.unsupported {
		return nil, errors.ErrUnsupported
	}
	v, ok := m.values[key]
	if !ok {
		return nil, errors.New("secret not found")
	}
	return append([]byte(nil), v...), nil
}
func (m *memorySecrets) Delete(key string) error {
	if m.unsupported {
		return errors.ErrUnsupported
	}
	delete(m.values, key)
	return nil
}

func TestSessionAndCacheArePrivateAndAccountScoped(t *testing.T) {
	s := Store{Dir: filepath.Join(t.TempDir(), "profile")}
	session := api.Session{Server: "https://todo.example", Token: "private", User: api.User{ID: 1}}
	if err := s.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	if err := s.SaveCache(Cache{Server: session.Server, UserID: 1, Tasks: []api.Task{{ID: 4, Title: "cached"}}}); err != nil {
		t.Fatal(err)
	}
	got, err := s.Session()
	if err != nil || got.Token != session.Token {
		t.Fatalf("%+v %v", got, err)
	}
	if _, err := s.Cache(session.Server, 2); err == nil {
		t.Fatal("another account read cache")
	}
	if _, err := s.Cache("https://elsewhere", 1); err == nil {
		t.Fatal("another server read cache")
	}
	if runtime.GOOS != "windows" {
		info, _ := os.Stat(filepath.Join(s.Dir, "session.json"))
		if info.Mode().Perm() != 0600 {
			t.Fatalf("mode %v", info.Mode())
		}
	}
	if err := s.Logout(); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Session(); !os.IsNotExist(err) {
		t.Fatalf("session remains: %v", err)
	}
	if _, err := s.Cache(session.Server, 1); !os.IsNotExist(err) {
		t.Fatalf("cache remains: %v", err)
	}
}

func TestSessionTokenUsesSystemSecretAndLogoutRemovesIt(t *testing.T) {
	s := Store{Dir: filepath.Join(t.TempDir(), "profile"), Secrets: &memorySecrets{values: map[string][]byte{}}}
	session := api.Session{Server: "https://todo.example", Token: "private-token", User: api.User{ID: 7}}
	if err := s.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(s.Dir, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	var disk api.Session
	if err := json.Unmarshal(raw, &disk); err != nil {
		t.Fatal(err)
	}
	if disk.Token != "" || string(raw) == string([]byte(`{"token":"private-token"}`)) {
		t.Fatalf("token leaked to session file: %s", raw)
	}
	got, err := s.Session()
	if err != nil || got.Token != session.Token {
		t.Fatalf("%+v %v", got, err)
	}
	if err := s.Logout(); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.Secrets.(*memorySecrets).values[sessionSecretKey(session.Server, session.User.ID)]; ok {
		t.Fatal("secret remains after logout")
	}
}

func TestSessionFallsBackToFileWhenCredentialServiceUnsupported(t *testing.T) {
	s := Store{Dir: filepath.Join(t.TempDir(), "profile"), Secrets: &memorySecrets{unsupported: true}}
	session := api.Session{Server: "https://todo.example", Token: "file-fallback", User: api.User{ID: 8}}
	if err := s.SaveSession(session); err != nil {
		t.Fatal(err)
	}
	got, err := s.Session()
	if err != nil || got.Token != session.Token {
		t.Fatalf("%+v %v", got, err)
	}
}
