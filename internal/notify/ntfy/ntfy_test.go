package ntfy

import "testing"

func TestValidateConfigRejectsPrivateDestination(t *testing.T) {
	t.Parallel()
	notifier := New()
	if err := notifier.ValidateConfig(map[string]string{"server_url": "http://169.254.169.254", "topic": "alerts"}); err == nil {
		t.Fatal("expected metadata ntfy URL to be rejected")
	}
}
