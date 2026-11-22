package voice

// Optional build-time defaults (injectable via -ldflags or a gitignored
// local_defaults_local.go init() function; always empty in committed source).
var (
	BuildDoubaoAppID    string
	BuildDoubaoAppKey   string
	BuildDoubaoDeviceID string
	BuildDoubaoHost     string
	BuildDoubaoPath     string
)

// DefaultDoubaoConfig returns the default Doubao IME ASR configuration,
// combining standard public host/path defaults with any local build-time prefill.
func DefaultDoubaoConfig() DoubaoConfig {
	cfg := DoubaoConfig{
		AppID:    BuildDoubaoAppID,
		AppKey:   BuildDoubaoAppKey,
		DeviceID: BuildDoubaoDeviceID,
		Host:     BuildDoubaoHost,
		Path:     BuildDoubaoPath,
		Language: "zh",
	}
	return cfg.Normalized()
}
