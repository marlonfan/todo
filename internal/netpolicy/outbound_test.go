package netpolicy

import (
	"net/http"
	"net/netip"
	"testing"
	"time"
)

func TestValidateURLRejectsUnsafeTargets(t *testing.T) {
	t.Parallel()
	cases := []string{
		"file:///etc/passwd",
		"http://127.0.0.1/admin",
		"http://169.254.169.254/latest/meta-data",
		"https://10.0.0.1/",
		"https://[::1]/",
		"https://user:pass@example.com/",
	}
	for _, rawURL := range cases {
		if err := ValidateURL(rawURL); err == nil {
			t.Fatalf("expected %q to be rejected", rawURL)
		}
	}
}

func TestValidateURLAcceptsPublicHTTPURLs(t *testing.T) {
	t.Parallel()
	for _, rawURL := range []string{"https://example.com/caldav", "http://8.8.8.8/hook"} {
		if err := ValidateURL(rawURL); err != nil {
			t.Fatalf("expected %q to be accepted: %v", rawURL, err)
		}
	}
}

func TestPublicIPClassification(t *testing.T) {
	t.Parallel()
	for _, rawIP := range []string{"127.0.0.1", "100.64.0.1", "192.168.1.1", "::1", "fe80::1", "2001:db8::1"} {
		if isPublicIP(netip.MustParseAddr(rawIP)) {
			t.Fatalf("expected %s to be non-public", rawIP)
		}
	}
	for _, rawIP := range []string{"1.1.1.1", "2606:4700:4700::1111"} {
		if !isPublicIP(netip.MustParseAddr(rawIP)) {
			t.Fatalf("expected %s to be public", rawIP)
		}
	}
}

func TestRedirectPolicyRevalidatesDestination(t *testing.T) {
	t.Parallel()
	client := NewHTTPClient(time.Second)
	req, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/private", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.CheckRedirect(req, []*http.Request{{}}); err == nil {
		t.Fatal("expected redirect to loopback to be rejected")
	}
}
