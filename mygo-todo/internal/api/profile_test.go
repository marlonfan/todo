package api

import (
	"encoding/json"
	"testing"
)

func TestProfilePreferencesWhitelistAndValueValidation(t *testing.T) {
	for _, payload := range []map[string]any{
		{}, {"password": "secret"}, {"avatar_url": "https://example.test"}, {"api_key": "secret"},
		{"default_reminder_enabled": nil}, {"default_reminder_enabled": "false"},
		{"timezone": "No/SuchZone"}, {"default_task_start_time": "8:00"},
		{"calendar_default_view": "week"}, {"default_time_granularity": 7}, {"default_reminder_minutes": 0},
	} {
		if _, err := NewProfilePreferences(payload); err == nil {
			t.Fatal("unsafe/invalid preference accepted", payload)
		}
	}
	if err := (ProfilePreferences{"default_reminder_enabled": json.RawMessage(" null ")}).Validate(); err == nil {
		t.Fatal("whitespace null accepted")
	}
	prefs, err := NewProfilePreferences(map[string]any{"default_reminder_enabled": false, "timezone": "Europe/London"})
	if err != nil {
		t.Fatal(err)
	}
	user := prefs.Apply(User{ID: 3, Username: "kept", DefaultReminderEnabled: true, DefaultNoonTime: "13:00"})
	if user.DefaultReminderEnabled || user.Timezone != "Europe/London" || user.ID != 3 || user.Username != "kept" || user.DefaultNoonTime != "13:00" {
		t.Fatal(user)
	}
	if got := prefs.Labels(); len(got) != 2 || got[1] != "账户默认提前提醒：关闭" {
		t.Fatal(got)
	}
}
