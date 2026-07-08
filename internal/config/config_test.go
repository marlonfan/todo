package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDefaultSetsCaldavCheckIntervalToFifteenMinutes(t *testing.T) {
	cfg := Default()
	if cfg.Caldav.CheckInterval != 15*time.Minute {
		t.Fatalf("caldav check interval=%v want=%v", cfg.Caldav.CheckInterval, 15*time.Minute)
	}
}

func TestDefaultSetsJWTExpireToOneYear(t *testing.T) {
	cfg := Default()
	if cfg.JWT.Expire != DefaultJWTExpire {
		t.Fatalf("jwt expire=%v want=%v", cfg.JWT.Expire, DefaultJWTExpire)
	}
}

func TestLoadAppliesDefaultCaldavCheckIntervalWhenMissing(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	content := `server:
  port: 8080
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.Caldav.CheckInterval != 15*time.Minute {
		t.Fatalf("caldav check interval=%v want=%v", cfg.Caldav.CheckInterval, 15*time.Minute)
	}
}

func TestLoadAppliesDefaultJWTExpireWhenMissing(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	content := `server:
  port: 8080
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.JWT.Expire != DefaultJWTExpire {
		t.Fatalf("jwt expire=%v want=%v", cfg.JWT.Expire, DefaultJWTExpire)
	}
}
