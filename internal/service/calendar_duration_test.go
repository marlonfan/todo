package service

import (
	"testing"
	"time"
)

func TestParseICalDuration(t *testing.T) {
	for raw, want := range map[string]time.Duration{
		"PT90M":   90 * time.Minute,
		"PT1H30M": 90 * time.Minute,
		"P1DT2H":  26 * time.Hour,
		"P2D":     48 * time.Hour,
		"P1W":     7 * 24 * time.Hour,
	} {
		got, err := parseICalDuration(raw)
		if err != nil || got != want {
			t.Fatalf("parseICalDuration(%q) = %s, %v; want %s", raw, got, err, want)
		}
	}
	for _, raw := range []string{"", "P", "PT", "PT0S", "P1M", "P1Y", "P1D2D", "P1W1D", "P1D1H", "PT1S1H", "-PT1H", "PT1H30"} {
		if _, err := parseICalDuration(raw); err == nil {
			t.Fatalf("parseICalDuration(%q) accepted invalid duration", raw)
		}
	}
}
