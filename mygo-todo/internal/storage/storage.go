// Package storage keeps Native Todo's data separate from Electron's profile.
package storage

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"todo-native/internal/api"
)

// SecretStore is the small system credential store used for session tokens.
// Store keeps file-only behavior when it is nil, which makes recovery possible
// on platforms without a credential service.
type SecretStore interface {
	Set(string, []byte) error
	Get(string) ([]byte, error)
	Delete(string) error
}

type Store struct {
	Dir     string
	Secrets SecretStore
}
type Cache struct {
	CategoryOutbox  []CategoryMutation  `json:"category_outbox,omitempty"`
	NextCategoryID  int64               `json:"next_category_id,omitempty"`
	CategoryAliases map[int64]int64     `json:"category_aliases,omitempty"`
	ProfileChanges  *ProfileChanges     `json:"profile_changes,omitempty"`
	SyncCursor      string              `json:"sync_cursor,omitempty"`
	Server          string              `json:"server"`
	UserID          int64               `json:"user_id"`
	Tasks           []api.Task          `json:"tasks"`
	Categories      []api.Category      `json:"categories"`
	Next            []api.Occurrence    `json:"next_occurrences"`
	History         api.OccurrencePage  `json:"occurrence_history"`
	SavedAt         time.Time           `json:"saved_at"`
	Outbox          []Mutation          `json:"outbox,omitempty"`
	NextLocalID     int64               `json:"next_local_id,omitempty"`
	ReminderEvents  []api.CalendarEvent `json:"reminder_events,omitempty"`
	Calendar        *CalendarSnapshot   `json:"calendar,omitempty"`
	// Local creations keep the same notification identity after server acknowledgement.
	ReminderKeys map[int64]string `json:"reminder_keys,omitempty"`
	// LocalAckRevisions records the latest successful local POST/PUT/PATCH
	// receipt by server task ID. Remote reads must never advance these revisions.
	LocalAckRevisions map[int64]int64 `json:"local_ack_revisions,omitempty"`
}

type CategoryMutation struct {
	ID         string       `json:"id"`
	Method     string       `json:"method"`
	CategoryID int64        `json:"category_id"`
	Local      api.Category `json:"local"`
	Base       api.Category `json:"base"`
	State      string       `json:"state"`
	Sent       bool         `json:"sent"`
	Failure    string       `json:"failure,omitempty"`
	CreatedAt  time.Time    `json:"created_at"`
}

type ProfileChanges struct {
	Values   api.ProfilePreferences `json:"values"`
	Base     api.ProfilePreferences `json:"base"`
	Rejected bool                   `json:"rejected,omitempty"`
	Failure  string                 `json:"failure,omitempty"`
}

type CalendarSnapshot struct {
	Start           time.Time           `json:"start"`
	End             time.Time           `json:"end"`
	Timezone        string              `json:"timezone"`
	SavedAt         time.Time           `json:"saved_at"`
	Events          []api.CalendarEvent `json:"events"`
	SeriesRevisions map[int64]int64     `json:"series_revisions"`
}

type Preferences struct {
	Theme           string              `json:"theme,omitempty"`
	LocalReminders  *bool               `json:"local_reminders,omitempty"`
	CalendarView    string              `json:"calendar_view,omitempty"`
	SidebarWidth    float32             `json:"sidebar_width,omitempty"`
	TaskListWidth   float32             `json:"task_list_width,omitempty"`
	TrayTitleMode   string              `json:"tray_title_mode,omitempty"`
	ManualTaskOrder map[string][]string `json:"manual_task_order,omitempty"`
}
type ReminderRecord struct {
	At         time.Time `json:"at"`
	State      string    `json:"state"`
	Scope      string    `json:"scope"`
	TaskKey    string    `json:"task_key"`
	InstanceID string    `json:"instance_id,omitempty"`
}
type ReminderLedger struct {
	Records map[string]ReminderRecord `json:"records"`
}

func (s Store) Preferences() (Preferences, error) {
	var v Preferences
	err := s.read("preferences.json", &v)
	return v, err
}
func (s Store) SavePreferences(v Preferences) error { return s.write("preferences.json", v) }
func (s Store) ReminderLedger() (ReminderLedger, error) {
	var v ReminderLedger
	err := s.read("reminders.json", &v)
	return v, err
}
func (s Store) SaveReminderLedger(v ReminderLedger) error { return s.write("reminders.json", v) }

type Mutation struct {
	ID        string          `json:"id"`
	Method    string          `json:"method"`
	TaskID    int64           `json:"task_id"`
	Suffix    string          `json:"suffix,omitempty"`
	Body      json.RawMessage `json:"body,omitempty"`
	Revision  int64           `json:"revision"`
	CreatedAt time.Time       `json:"created_at"`
	Base      api.Task        `json:"base"`
	Local     api.Task        `json:"local"`
	Sent      bool            `json:"sent"`
	State     string          `json:"state"`
	Failure   string          `json:"failure,omitempty"`
	Latest    *api.Task       `json:"latest,omitempty"`
}

func (s Store) read(name string, v any) error {
	b, err := os.ReadFile(filepath.Join(s.Dir, name))
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func (s Store) write(name string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err = os.MkdirAll(s.Dir, 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(s.Dir, ".todo-*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if _, err = f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(s.Dir, name))
}

func (s Store) Session() (api.Session, error) {
	var v api.Session
	err := s.read("session.json", &v)
	if err != nil {
		return v, err
	}
	if v.Token == "" && s.Secrets != nil && v.Server != "" && v.User.ID != 0 {
		token, secretErr := s.Secrets.Get(sessionSecretKey(v.Server, v.User.ID))
		if secretErr != nil {
			return v, secretErr
		}
		v.Token = string(token)
	}
	return v, err
}
func (s Store) SaveSession(v api.Session) error {
	if s.Secrets == nil || v.Token == "" || v.Server == "" || v.User.ID == 0 {
		return s.write("session.json", v)
	}
	key := sessionSecretKey(v.Server, v.User.ID)
	if err := s.Secrets.Set(key, []byte(v.Token)); err != nil {
		// Fall back to private 0600 session.json if the OS credential service is
		// unavailable or rejects an ad-hoc upgraded binary's Keychain update ACL.
		return s.write("session.json", v)
	}
	fileSession := v
	fileSession.Token = ""
	if err := s.write("session.json", fileSession); err != nil {
		_ = s.Secrets.Delete(key)
		return err
	}
	return nil
}

// SaveSessionMetadata updates non-secret user profile metadata in session.json
// without re-writing the token in the system credential store when the token is unchanged.
func (s Store) SaveSessionMetadata(v api.Session) error {
	if s.Secrets == nil || v.Token == "" || v.Server == "" || v.User.ID == 0 {
		return s.write("session.json", v)
	}
	var existing api.Session
	if err := s.read("session.json", &existing); err == nil && existing.Token != "" {
		return s.write("session.json", v)
	}
	fileSession := v
	fileSession.Token = ""
	return s.write("session.json", fileSession)
}
func (s Store) SaveCache(v Cache) error { return s.write("cache.json", v) }
func (s Store) Cache(server string, userID int64) (Cache, error) {
	var v Cache
	err := s.read("cache.json", &v)
	if err == nil && (v.Server != server || v.UserID != userID) {
		return Cache{}, errors.New("缓存属于其他账户或服务")
	}
	return v, err
}
func (s Store) Logout() error {
	if s.Secrets != nil {
		// Read only the on-disk metadata so a locked credential service cannot
		// prevent us from finding the key that must be deleted.
		var session api.Session
		if err := s.read("session.json", &session); err == nil && session.Server != "" && session.User.ID != 0 {
			if err := s.Secrets.Delete(sessionSecretKey(session.Server, session.User.ID)); err != nil && !errors.Is(err, errors.ErrUnsupported) {
				return err
			}
		}
	}
	for _, name := range []string{"session.json", "cache.json"} {
		if err := os.Remove(filepath.Join(s.Dir, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}

func sessionSecretKey(server string, userID int64) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%d", server, userID)))
	return fmt.Sprintf("session-%x", sum[:])
}
