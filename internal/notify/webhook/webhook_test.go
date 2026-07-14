package webhook

import "testing"

func TestValidateConfigRejectsPrivateDestination(t *testing.T) {
	t.Parallel()
	notifier := New()
	if err := notifier.ValidateConfig(map[string]string{"url": "http://127.0.0.1/internal"}); err == nil {
		t.Fatal("expected loopback webhook URL to be rejected")
	}
}
