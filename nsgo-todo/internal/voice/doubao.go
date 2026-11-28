package voice

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/darui3018823/opus"
	"github.com/gorilla/websocket"
)

const (
	DefaultDoubaoHost = "frontier-audio-ime-ws.doubao.com"
	DefaultDoubaoPath = "/ocean/api/v1/ws"
	DefaultDoubaoLang = "zh"

	doubaoFrameSamples        = 320 // 20ms @ 16kHz mono
	doubaoFrameBytes          = doubaoFrameSamples * 2
	doubaoFramePace           = 20 * time.Millisecond // 1x real-time pace required by Doubao IME
	doubaoWindowMax           = 480000                // 30s @ 16kHz (matches xinliqiu pcmWindows)
	doubaoWindowMin           = 320000                // 20s @ 16kHz silence search start
	doubaoRollMinFrames       = 1150                  // ~23s: start looking for a quiet pause to roll over cleanly
	doubaoRollMaxFrames       = 1400                  // ~28s: force rollover before Doubao IME's ~30s session cap
	doubaoFinishSilenceFrames = 8                     // 160ms trailing silence before FinishSession so final words settle
	doubaoQuietRMSThreshold   = 350.0                 // ~0.01 full-scale RMS pause threshold (matches xinliqiu silence valley)
)

// DoubaoConfig holds credentials and endpoint settings for the Doubao IME
// WebSocket ASR protocol (ported from xinliqiu/internal/tingji/doubao.go).
type DoubaoConfig struct {
	AppID           string `json:"app_id"`
	AppKey          string `json:"app_key"`
	DeviceID        string `json:"device_id"`
	Host            string `json:"host"`
	Path            string `json:"path"`
	Language        string `json:"language"`
	Timeout         time.Duration
	FramePace       time.Duration // override for unit tests; 0 defaults to 20ms
	AllowInsecureWS bool          // test-only: allow ws:// against httptest servers
}

func (c DoubaoConfig) Normalized() DoubaoConfig {
	c.AppID = strings.TrimSpace(c.AppID)
	c.AppKey = strings.TrimSpace(c.AppKey)
	c.DeviceID = strings.TrimSpace(c.DeviceID)
	c.Host = strings.TrimSpace(c.Host)
	c.Path = strings.TrimSpace(c.Path)
	c.Language = strings.TrimSpace(c.Language)
	if c.Host == "" {
		c.Host = DefaultDoubaoHost
	}
	if c.Path == "" {
		c.Path = DefaultDoubaoPath
	}
	if !strings.HasPrefix(c.Path, "/") {
		c.Path = "/" + c.Path
	}
	if c.Language == "" {
		c.Language = DefaultDoubaoLang
	}
	if c.Timeout <= 0 {
		c.Timeout = 60 * time.Second
	}
	if c.FramePace <= 0 {
		c.FramePace = doubaoFramePace
	}
	return c
}

func (c DoubaoConfig) Ready() bool {
	return c.Validate() == nil
}

func (c DoubaoConfig) Validate() error {
	n := c.Normalized()
	if n.AppID == "" || n.AppKey == "" || n.DeviceID == "" {
		return errors.New("未配置豆包语音识别凭据（AppID / AppKey / DeviceID），请前往「我的 → 语音与 AI」填写")
	}
	if len(n.DeviceID) < 10 || len(n.DeviceID) > 24 {
		return errors.New("豆包 DeviceID 需为 10~24 位数字")
	}
	for _, r := range n.DeviceID {
		if r < '0' || r > '9' {
			return errors.New("豆包 DeviceID 必须为纯数字")
		}
	}
	if n.Host == "" || strings.Contains(n.Host, "/") {
		return errors.New("豆包 ASR Host 格式无效")
	}
	if !c.AllowInsecureWS && strings.Contains(n.Host, ":") {
		return errors.New("豆包 ASR Host 不应包含端口号")
	}
	if n.Language != "zh" && n.Language != "en" {
		return errors.New("豆包 ASR 语言仅支持 zh 或 en")
	}
	return nil
}

// --- Hand-rolled Doubao IME Protobuf Framing ---

func protoBytes(dst []byte, field uint64, b []byte) []byte {
	if len(b) == 0 {
		return dst
	}
	dst = binary.AppendUvarint(dst, field<<3|2)
	dst = binary.AppendUvarint(dst, uint64(len(b)))
	return append(dst, b...)
}

func doubaoRequest(key, event, payload string, data []byte, seq uint64) []byte {
	b := protoBytes(nil, 3, []byte("ASR"))
	b = protoBytes(b, 2, []byte(key))
	b = protoBytes(b, 5, []byte(event))
	b = protoBytes(b, 6, []byte(payload))
	b = protoBytes(b, 7, data)
	if seq > 0 {
		b = binary.AppendUvarint(b, 9<<3)
		b = binary.AppendUvarint(b, seq)
	}
	return b
}

type doubaoReply struct {
	TaskID     string
	MessageID  string
	Event      string
	StatusCode int64
	StatusText string
	Payload    string
}

func doubaoResponse(b []byte) (doubaoReply, error) {
	fields := map[uint64]any{}
	for len(b) > 0 {
		k, n := binary.Uvarint(b)
		if n <= 0 {
			return doubaoReply{}, errors.New("invalid doubao protobuf key")
		}
		b = b[n:]
		field, wire := k>>3, k&7
		switch wire {
		case 0:
			v, n := binary.Uvarint(b)
			if n <= 0 {
				return doubaoReply{}, errors.New("invalid doubao protobuf varint")
			}
			b = b[n:]
			fields[field] = int64(v)
		case 2:
			l, n := binary.Uvarint(b)
			if n <= 0 || l > uint64(len(b)-n) {
				return doubaoReply{}, errors.New("invalid doubao protobuf length")
			}
			b = b[n:]
			fields[field] = string(b[:l])
			b = b[l:]
		case 5:
			if len(b) < 4 {
				return doubaoReply{}, io.ErrUnexpectedEOF
			}
			b = b[4:]
		case 1:
			if len(b) < 8 {
				return doubaoReply{}, io.ErrUnexpectedEOF
			}
			b = b[8:]
		default:
			return doubaoReply{}, errors.New("unsupported doubao protobuf wire type")
		}
	}

	reply := doubaoReply{
		TaskID:     asString(fields[1]),
		MessageID:  asString(fields[2]),
		Event:      asString(fields[4]),
		StatusCode: asInt64(fields[5]),
		StatusText: asString(fields[6]),
	}
	for k, v := range fields {
		if k == 1 || k == 2 || k == 4 || k == 5 || k == 6 {
			continue
		}
		if s, ok := v.(string); ok && (strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[")) {
			reply.Payload = s
			break
		}
	}
	return reply, nil
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func asInt64(v any) int64 {
	if n, ok := v.(int64); ok {
		return n
	}
	return 0
}

func jsonFloat(v any) float64 {
	switch x := v.(type) {
	case json.Number:
		f, _ := x.Float64()
		return f
	case float64:
		return x
	case int64:
		return float64(x)
	}
	return 0
}

// --- Cumulative Transcript State (Matches xinliqiu/internal/tingji/doubao.go) ---

// doubaoTextState follows xinliqiu's exact Doubao IME transcript rule:
// only the untagged cumulative (start_time == 0, no extra.seq_id) result
// drives preview/final. Incremental extra.seq_id packets are ignored for text
// assembly so repeated revisions of the same sentence are never duplicated.
type doubaoTextState struct {
	preview  string
	final    string
	hasFinal bool
}

func (s *doubaoTextState) update(payload string) string {
	preview, settled, updated := doubaoTranscriptUpdate(payload, s.preview)
	if updated {
		s.preview = preview
		s.hasFinal = settled
		if settled {
			s.final = preview
		}
	}
	return s.bestDisplay()
}

func (s *doubaoTextState) bestDisplay() string {
	if s.hasFinal && strings.TrimSpace(s.final) != "" {
		return strings.TrimSpace(s.final)
	}
	return strings.TrimSpace(s.preview)
}

func (s *doubaoTextState) settledText() string {
	return s.bestDisplay()
}

func doubaoTranscriptUpdate(payload, current string) (string, bool, bool) {
	dec := json.NewDecoder(strings.NewReader(payload))
	dec.UseNumber()
	var data map[string]any
	if err := dec.Decode(&data); err != nil || data == nil {
		return current, false, false
	}
	rawResults, _ := data["results"].([]any)
	items := make([]map[string]any, 0, len(rawResults))
	timed := make([]map[string]any, 0, len(rawResults))
	for _, v := range rawResults {
		item, ok := v.(map[string]any)
		if !ok {
			continue
		}
		if _, ok := item["text"].(string); ok {
			items = append(items, item)
			if _, a := item["start_time"].(json.Number); a {
				if _, b := item["end_time"].(json.Number); b {
					timed = append(timed, item)
				}
			}
		}
	}
	return doubaoTranscriptUpdateFromParsed(items, timed, current)
}

func doubaoTranscriptUpdateFromParsed(items, timed []map[string]any, current string) (string, bool, bool) {
	if len(timed) > 0 {
		var selected map[string]any
		allSentences := true
		for _, item := range timed {
			extra, isObj := item["extra"].(map[string]any)
			_, hasSeq := extra["seq_id"]
			allSentences = allSentences && isObj && hasSeq
			if jsonFloat(item["start_time"]) == 0 && (!isObj || !hasSeq) &&
				(selected == nil || jsonFloat(item["end_time"]) > jsonFloat(selected["end_time"])) {
				selected = item
			}
		}
		if selected != nil {
			interim, ok := selected["is_interim"].(bool)
			return asString(selected["text"]), ok && !interim, true
		}
		if allSentences {
			return current, false, false
		}
	}
	lastFinal := ""
	hasFinal := false
	for _, item := range items {
		if interim, ok := item["is_interim"].(bool); ok && !interim {
			lastFinal = asString(item["text"])
			hasFinal = true
		}
	}
	if hasFinal {
		return lastFinal, true, true
	}
	updated := false
	for _, item := range items {
		if strings.TrimSpace(asString(item["text"])) != "" {
			current = asString(item["text"])
			updated = true
		}
	}
	return current, false, updated
}

// --- Audio Preprocessing (WAV -> 16kHz Mono PCM16 -> Pure-Go Opus) ---

// WAVToPCM16kMono extracts 16-bit signed little-endian PCM from a RIFF/WAVE
// buffer, mixes multi-channel audio to mono, and resamples to 16000 Hz if needed.
func WAVToPCM16kMono(wav []byte) ([]byte, error) {
	if len(wav) < 44 || string(wav[0:4]) != "RIFF" || string(wav[8:12]) != "WAVE" {
		return nil, errors.New("无效的 WAV 音频文件")
	}
	var (
		audioFormat   uint16
		channels      uint16
		sampleRate    uint32
		bitsPerSample uint16
		foundFmt      bool
		pcmData       []byte
	)
	off := 12
	for off+8 <= len(wav) {
		chunkID := string(wav[off : off+4])
		chunkSize := int(binary.LittleEndian.Uint32(wav[off+4 : off+8]))
		off += 8
		if chunkSize < 0 {
			break
		}
		end := off + chunkSize
		if end > len(wav) {
			end = len(wav)
		}
		switch chunkID {
		case "fmt ":
			if end-off >= 16 {
				audioFormat = binary.LittleEndian.Uint16(wav[off : off+2])
				channels = binary.LittleEndian.Uint16(wav[off+2 : off+4])
				sampleRate = binary.LittleEndian.Uint32(wav[off+4 : off+8])
				bitsPerSample = binary.LittleEndian.Uint16(wav[off+14 : off+16])
				foundFmt = true
			}
		case "data":
			pcmData = wav[off:end]
		}
		off = end
		if chunkSize%2 == 1 && off < len(wav) {
			off++
		}
	}
	if !foundFmt {
		return nil, errors.New("WAV 缺少 fmt 音频头")
	}
	if audioFormat != 1 || bitsPerSample != 16 || channels < 1 || sampleRate == 0 {
		return nil, fmt.Errorf("不支持的 WAV 格式（format=%d bits=%d ch=%d rate=%d）", audioFormat, bitsPerSample, channels, sampleRate)
	}
	if len(pcmData) < 2*int(channels) {
		return nil, errors.New("录音内容为空")
	}

	mono := downmixToMono(pcmData, int(channels))
	if sampleRate != 16000 {
		mono = resampleLinear(mono, int(sampleRate), 16000)
	}
	out := int16SliceToBytes(mono)
	return normalizePCM(out), nil
}

func downmixToMono(pcmData []byte, channels int) []int16 {
	if channels < 1 {
		channels = 1
	}
	frameBytes := 2 * channels
	numFrames := len(pcmData) / frameBytes
	mono := make([]int16, numFrames)
	if channels == 1 {
		for i := 0; i < numFrames; i++ {
			mono[i] = int16(binary.LittleEndian.Uint16(pcmData[i*2:]))
		}
		return mono
	}
	for i := 0; i < numFrames; i++ {
		var sum int32
		base := i * frameBytes
		for c := 0; c < channels; c++ {
			sum += int32(int16(binary.LittleEndian.Uint16(pcmData[base+c*2:])))
		}
		mono[i] = int16(sum / int32(channels))
	}
	return mono
}

func int16SliceToBytes(in []int16) []byte {
	out := make([]byte, len(in)*2)
	for i, s := range in {
		binary.LittleEndian.PutUint16(out[i*2:], uint16(s))
	}
	return out
}

func resampleLinear(in []int16, srcRate, dstRate int) []int16 {
	if len(in) == 0 || srcRate <= 0 || dstRate <= 0 || srcRate == dstRate {
		return in
	}
	outLen := int(math.Round(float64(len(in)) * float64(dstRate) / float64(srcRate)))
	if outLen <= 0 {
		return nil
	}
	out := make([]int16, outLen)
	ratio := float64(srcRate) / float64(dstRate)
	lastIdx := len(in) - 1
	for i := 0; i < outLen; i++ {
		pos := float64(i) * ratio
		idx := int(pos)
		if idx >= lastIdx {
			out[i] = in[lastIdx]
			continue
		}
		frac := pos - float64(idx)
		v := float64(in[idx])*(1-frac) + float64(in[idx+1])*frac
		if v > 32767 {
			v = 32767
		} else if v < -32768 {
			v = -32768
		}
		out[i] = int16(math.Round(v))
	}
	return out
}

// normalizePCM gently amplifies quiet microphone captures to match xinliqiu's
// Doubao preprocessing without clipping peaks.
func normalizePCM(pcm []byte) []byte {
	if len(pcm) < 2 {
		return pcm
	}
	rms, peak := 0.0, 0.0
	n := len(pcm) / 2
	for i := 0; i < n; i++ {
		x := float64(int16(binary.LittleEndian.Uint16(pcm[i*2:])))
		rms += x * x
		if ax := math.Abs(x); ax > peak {
			peak = ax
		}
	}
	rms = math.Sqrt(rms / float64(n))
	gain := math.Max(1, math.Min(32, math.Min(0.1*32768/math.Max(rms, 1), 0.95*32768/math.Max(peak, 1))))
	if gain <= 1.01 {
		return pcm
	}
	out := make([]byte, n*2)
	for i := 0; i < n; i++ {
		x := int16(binary.LittleEndian.Uint16(pcm[i*2:]))
		v := int16(math.Max(-32768, math.Min(32767, math.RoundToEven(float64(x)*gain))))
		binary.LittleEndian.PutUint16(out[i*2:], uint16(v))
	}
	return out
}

func hasNonZeroAudio(pcm []byte) bool {
	for _, b := range pcm {
		if b != 0 {
			return true
		}
	}
	return false
}

// pcmWindows splits long 16kHz PCM recordings (>30s) at lowest-energy silence
// valleys between 20s and 30s, mirroring xinliqiu/internal/tingji/asr.go.
func pcmWindows(pcm []byte) [][2]int {
	total := len(pcm) / 2
	if total == 0 {
		return nil
	}
	var out [][2]int
	start := 0
	for total-start > doubaoWindowMax {
		best := math.MaxFloat64
		stop := start + doubaoWindowMax
		for a := start + doubaoWindowMin; a <= start+doubaoWindowMax-3200; a += 3200 {
			energy := 0.0
			for i := a; i < a+3200; i++ {
				x := float64(int16(binary.LittleEndian.Uint16(pcm[2*i:])))
				energy += x * x
			}
			energy /= 3200
			if energy < best {
				best = energy
				stop = a + 1600
			}
		}
		if best > 0.0001*32768*32768 {
			stop = start + doubaoWindowMax
		}
		out = append(out, [2]int{start, stop})
		start = stop
	}
	if start < total {
		out = append(out, [2]int{start, total})
	}
	return out
}

// streamOpusEncoder incrementally encodes 16kHz mono PCM16 into 20ms Opus frames.
type streamOpusEncoder struct {
	enc      *opus.Encoder
	pending  []byte
	consumed bool
}

func newStreamOpusEncoder() (*streamOpusEncoder, error) {
	enc, err := opus.NewEncoder(16000, 1, opus.ApplicationAudio)
	if err != nil {
		return nil, fmt.Errorf("初始化 Opus 编码器失败: %w", err)
	}
	if err := enc.SetBitrate(32000); err != nil {
		return nil, fmt.Errorf("配置 Opus 码率失败: %w", err)
	}
	return &streamOpusEncoder{enc: enc}, nil
}

func (e *streamOpusEncoder) encode(pcm []byte, flush bool) ([][]byte, error) {
	if len(pcm)%2 != 0 {
		pcm = pcm[:len(pcm)-1]
	}
	if len(pcm) > 0 {
		e.pending = append(e.pending, pcm...)
		e.consumed = true
	}
	if flush && e.consumed {
		if rem := len(e.pending) % doubaoFrameBytes; rem != 0 {
			e.pending = append(e.pending, make([]byte, doubaoFrameBytes-rem)...)
		}
		// One trailing silence frame flushes Opus encoder lookahead cleanly.
		e.pending = append(e.pending, make([]byte, doubaoFrameBytes)...)
	}
	var frames [][]byte
	samples := make([]int16, doubaoFrameSamples)
	for len(e.pending) >= doubaoFrameBytes {
		for i := 0; i < doubaoFrameSamples; i++ {
			samples[i] = int16(binary.LittleEndian.Uint16(e.pending[i*2:]))
		}
		pkt, err := e.enc.Encode(samples, doubaoFrameSamples)
		if err != nil {
			return nil, fmt.Errorf("Opus 编码失败: %w", err)
		}
		if len(pkt) > 0 {
			frames = append(frames, pkt)
		}
		e.pending = e.pending[doubaoFrameBytes:]
	}
	return frames, nil
}

type taggedOpusFrame struct {
	data  []byte
	flush bool // synthetic trailing silence appended by Finish()
	quiet bool // low-energy frame suitable for silence-aligned live rollover
}

func framePCM16RMS(samples []int16) float64 {
	if len(samples) == 0 {
		return 0
	}
	var sumSq float64
	for _, s := range samples {
		x := float64(s)
		sumSq += x * x
	}
	return math.Sqrt(sumSq / float64(len(samples)))
}

func (e *streamOpusEncoder) encodeTagged(pcm []byte) ([]taggedOpusFrame, error) {
	if len(pcm)%2 != 0 {
		pcm = pcm[:len(pcm)-1]
	}
	if len(pcm) > 0 {
		e.pending = append(e.pending, pcm...)
		e.consumed = true
	}
	var frames []taggedOpusFrame
	samples := make([]int16, doubaoFrameSamples)
	for len(e.pending) >= doubaoFrameBytes {
		for i := 0; i < doubaoFrameSamples; i++ {
			samples[i] = int16(binary.LittleEndian.Uint16(e.pending[i*2:]))
		}
		quiet := framePCM16RMS(samples) <= doubaoQuietRMSThreshold
		pkt, err := e.enc.Encode(samples, doubaoFrameSamples)
		if err != nil {
			return nil, fmt.Errorf("Opus 编码失败: %w", err)
		}
		if len(pkt) > 0 {
			frames = append(frames, taggedOpusFrame{data: pkt, quiet: quiet})
		}
		e.pending = e.pending[doubaoFrameBytes:]
	}
	return frames, nil
}

func (e *streamOpusEncoder) flushTagged(silenceFrames int) ([]taggedOpusFrame, error) {
	if !e.consumed {
		return nil, nil
	}
	var frames []taggedOpusFrame
	samples := make([]int16, doubaoFrameSamples)

	// First flush any remaining partial real audio frame (padded with zeros) as real speech.
	if len(e.pending) > 0 {
		if rem := len(e.pending) % doubaoFrameBytes; rem != 0 {
			e.pending = append(e.pending, make([]byte, doubaoFrameBytes-rem)...)
		}
		for len(e.pending) >= doubaoFrameBytes {
			for i := 0; i < doubaoFrameSamples; i++ {
				samples[i] = int16(binary.LittleEndian.Uint16(e.pending[i*2:]))
			}
			pkt, err := e.enc.Encode(samples, doubaoFrameSamples)
			if err != nil {
				return nil, fmt.Errorf("Opus 编码失败: %w", err)
			}
			if len(pkt) > 0 {
				frames = append(frames, taggedOpusFrame{data: pkt, flush: false, quiet: false})
			}
			e.pending = e.pending[doubaoFrameBytes:]
		}
	}

	// Then append synthetic trailing silence frames so Doubao's streaming decoder
	// has enough lookahead to finalize the last word before FinishSession.
	clear(samples)
	for i := 0; i < silenceFrames; i++ {
		pkt, err := e.enc.Encode(samples, doubaoFrameSamples)
		if err != nil {
			return nil, fmt.Errorf("Opus 编码失败: %w", err)
		}
		if len(pkt) > 0 {
			frames = append(frames, taggedOpusFrame{data: pkt, flush: true, quiet: true})
		}
	}
	return frames, nil
}

func encodeOpus16kMono(pcm []byte) ([][]byte, error) {
	if len(pcm) < 2 {
		return nil, errors.New("音频数据为空")
	}
	enc, err := newStreamOpusEncoder()
	if err != nil {
		return nil, err
	}
	return enc.encode(pcm, true)
}

// --- Low-Level Single Doubao WebSocket Connection ---

type doubaoConn struct {
	cfg        DoubaoConfig
	ws         *websocket.Conn
	ctx        context.Context
	cancel     context.CancelFunc
	onPartial  func(string)
	done       chan doubaoConnResult
	readerDone chan struct{}
	seq        uint64
	closeOnce  sync.Once
}

type doubaoConnResult struct {
	text string
	err  error
}

func dialDoubaoConn(ctx context.Context, cfg DoubaoConfig, onPartial func(string)) (*doubaoConn, error) {
	cfg = cfg.Normalized()
	cctx, cancel := context.WithTimeout(ctx, cfg.Timeout)

	scheme := "wss"
	if cfg.AllowInsecureWS {
		scheme = "ws"
	}
	u := url.URL{
		Scheme:   scheme,
		Host:     cfg.Host,
		Path:     cfg.Path,
		RawQuery: url.Values{"aid": {cfg.AppID}, "device_id": {cfg.DeviceID}}.Encode(),
	}
	headers := http.Header{
		"Proto-Version":      {"v2"},
		"X-Custom-Keepalive": {"true"},
		"Origin":             {scheme + "://" + cfg.Host},
		"Pragma":             {"no-cache"},
		"Cache-Control":      {"no-cache"},
		"User-Agent":         {"nsgo-todo-asr/1.0"},
	}

	ws, resp, err := websocket.DefaultDialer.DialContext(cctx, u.String(), headers)
	if err != nil {
		cancel()
		if resp != nil {
			return nil, fmt.Errorf("连接豆包语音服务失败（HTTP %d）: %w", resp.StatusCode, err)
		}
		return nil, fmt.Errorf("连接豆包语音服务失败: %w", err)
	}
	ws.SetReadLimit(1 << 20)
	if deadline, ok := cctx.Deadline(); ok {
		_ = ws.SetReadDeadline(deadline)
		_ = ws.SetWriteDeadline(deadline)
	}

	dc := &doubaoConn{
		cfg:        cfg,
		ws:         ws,
		ctx:        cctx,
		cancel:     cancel,
		onPartial:  onPartial,
		done:       make(chan doubaoConnResult, 1),
		readerDone: make(chan struct{}),
	}

	send := func(key, event, payload string, data []byte, seq uint64) error {
		return ws.WriteMessage(websocket.BinaryMessage, doubaoRequest(key, event, payload, data, seq))
	}
	recv := func() (doubaoReply, error) {
		kind, b, err := ws.ReadMessage()
		if err != nil {
			return doubaoReply{}, err
		}
		if kind == websocket.TextMessage {
			return doubaoReply{Payload: string(b)}, nil
		}
		return doubaoResponse(b)
	}
	expectOK := func(stage string) error {
		reply, err := recv()
		if err != nil {
			return fmt.Errorf("豆包语音 %s 响应异常: %w", stage, err)
		}
		if reply.StatusCode != 20000000 {
			msg := strings.TrimSpace(reply.StatusText)
			if msg == "" {
				msg = fmt.Sprintf("status=%d", reply.StatusCode)
			}
			return fmt.Errorf("豆包语音 %s 被拒绝（%s），请检查 AppID / AppKey / DeviceID", stage, msg)
		}
		return nil
	}

	if err := send(cfg.AppKey, "StartTask", "", nil, 0); err != nil {
		cancel()
		_ = ws.Close()
		return nil, fmt.Errorf("发送 StartTask 失败: %w", err)
	}
	if err := expectOK("StartTask"); err != nil {
		cancel()
		_ = ws.Close()
		return nil, err
	}

	startPayload, _ := json.Marshal(map[string]any{
		"audio_info": map[string]any{
			"channel":     1,
			"format":      "speech_opus",
			"sample_rate": 16000,
		},
		"enable_speech_rejection": false,
		"extra":                   map[string]any{},
		"lang":                    cfg.Language,
	})
	if err := send(cfg.AppKey, "StartSession", string(startPayload), nil, 0); err != nil {
		cancel()
		_ = ws.Close()
		return nil, fmt.Errorf("发送 StartSession 失败: %w", err)
	}
	if err := expectOK("StartSession"); err != nil {
		cancel()
		_ = ws.Close()
		return nil, err
	}

	// Cancel watcher closes the socket immediately when parent ctx cancels.
	go func() {
		select {
		case <-cctx.Done():
			_ = ws.Close()
		case <-dc.readerDone:
		}
	}()

	// Dedicated reader goroutine consumes all hypotheses & terminal events.
	go func() {
		defer close(dc.readerDone)
		var state doubaoTextState
		lastShown := ""
		for {
			reply, err := recv()
			if err != nil {
				settled := state.settledText()
				if settled != "" && isCleanDoubaoClose(err) {
					dc.done <- doubaoConnResult{text: settled}
					return
				}
				dc.done <- doubaoConnResult{text: settled, err: err}
				return
			}
			if reply.StatusCode != 0 && reply.StatusCode != 20000000 {
				msg := strings.TrimSpace(reply.StatusText)
				if msg == "" {
					msg = fmt.Sprintf("status=%d", reply.StatusCode)
				}
				dc.done <- doubaoConnResult{text: state.settledText(), err: fmt.Errorf("豆包语音识别失败（%s）", msg)}
				return
			}
			if reply.Payload != "" {
				display := state.update(reply.Payload)
				if display != "" && display != lastShown && dc.onPartial != nil {
					lastShown = display
					dc.onPartial(display)
				}
			}
			if reply.Event == "SessionFinished" || reply.Event == "TaskFinished" {
				dc.done <- doubaoConnResult{text: state.settledText()}
				return
			}
		}
	}()

	return dc, nil
}

func (dc *doubaoConn) sendFrame(frame []byte) (ended bool, res doubaoConnResult, err error) {
	select {
	case res = <-dc.done:
		return true, res, nil
	case <-dc.ctx.Done():
		return true, doubaoConnResult{}, dc.ctx.Err()
	default:
	}
	dc.seq++
	reqPayload := fmt.Sprintf(`{"timestamp_ms":%d}`, time.Now().UnixMilli())
	if err := dc.ws.WriteMessage(websocket.BinaryMessage, doubaoRequest("", "TaskRequest", reqPayload, frame, dc.seq)); err != nil {
		// If the server already sent SessionFinished right before closing, wait
		// briefly for the reader goroutine to deliver the terminal result.
		select {
		case res = <-dc.done:
			if res.err == nil {
				return true, res, nil
			}
		case <-time.After(150 * time.Millisecond):
		}
		return false, doubaoConnResult{}, fmt.Errorf("发送语音帧失败: %w", err)
	}
	return false, doubaoConnResult{}, nil
}

func (dc *doubaoConn) finish() (string, error) {
	defer dc.closeNow()
	select {
	case res := <-dc.done:
		return res.text, res.err
	default:
	}
	_ = dc.ws.WriteMessage(websocket.BinaryMessage, doubaoRequest(dc.cfg.AppKey, "FinishSession", "", nil, 0))
	select {
	case res := <-dc.done:
		return res.text, res.err
	case <-dc.ctx.Done():
		return "", errors.New("豆包语音识别超时，请检查网络后重试")
	}
}

func (dc *doubaoConn) closeNow() {
	dc.closeOnce.Do(func() {
		dc.cancel()
		_ = dc.ws.Close()
		if dc.readerDone != nil {
			<-dc.readerDone
		}
	})
}

func isCleanDoubaoClose(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	return websocket.IsCloseError(
		err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived,
	)
}

func sleepContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// --- Batch Transcription (20ms Real-Time Pacing + 30s Windows + Multi-Sentence Resume) ---

// TranscribeWAVFile reads a recorded WAV file, converts it to 16kHz mono Opus,
// and streams it to Doubao IME ASR with strict 1x real-time pacing.
func TranscribeWAVFile(ctx context.Context, cfg DoubaoConfig, wavPath string, onPartial func(string)) (string, error) {
	raw, err := os.ReadFile(wavPath)
	if err != nil {
		return "", fmt.Errorf("读取录音文件失败: %w", err)
	}
	pcm, err := WAVToPCM16kMono(raw)
	if err != nil {
		return "", err
	}
	return TranscribePCM(ctx, cfg, pcm, onPartial)
}

// TranscribePCM sends 16kHz 16-bit mono PCM audio to Doubao IME ASR at strict
// 20ms frame pacing. Long recordings are split into <=30s silence-aligned
// windows, and if Doubao ends a session mid-speech after an earlier sentence,
// the remaining audio automatically resumes on a fresh session so nothing is lost.
func TranscribePCM(ctx context.Context, cfg DoubaoConfig, pcm16k []byte, onPartial func(string)) (string, error) {
	if err := cfg.Validate(); err != nil {
		return "", err
	}
	cfg = cfg.Normalized()
	windows := pcmWindows(pcm16k)
	if len(windows) == 0 {
		return "", errors.New("音频数据为空")
	}

	var accumulated []string
	emitCombined := func(live string) {
		if onPartial == nil {
			return
		}
		combined := joinSegments(accumulated, live)
		if combined != "" {
			onPartial(combined)
		}
	}

	for _, w := range windows {
		chunk := pcm16k[w[0]*2 : w[1]*2]
		if !hasNonZeroAudio(chunk) {
			continue
		}
		chunk = normalizePCM(chunk)
		frames, err := encodeOpus16kMono(chunk)
		if err != nil {
			return "", err
		}
		segText, err := transcribeFramesWithAutoResume(ctx, cfg, frames, emitCombined)
		if err != nil {
			return "", err
		}
		if segText != "" {
			accumulated = append(accumulated, segText)
			emitCombined("")
		}
	}

	final := joinSegments(accumulated, "")
	if final == "" {
		return "", errors.New("未识别到有效语音内容，请靠近麦克风重试")
	}
	return final, nil
}

func transcribeFramesWithAutoResume(ctx context.Context, cfg DoubaoConfig, frames [][]byte, onPartial func(string)) (string, error) {
	var segments []string
	idx := 0
	const maxSessions = 8

	for idx < len(frames) && len(segments) < maxSessions {
		prefix := append([]string(nil), segments...)
		dc, err := dialDoubaoConn(ctx, cfg, func(p string) {
			if onPartial != nil {
				onPartial(joinSegments(prefix, p))
			}
		})
		if err != nil {
			return "", err
		}

		nextSend := time.Now()
		endedEarly := false
		var earlyRes doubaoConnResult

		for idx < len(frames) {
			if delay := time.Until(nextSend); delay > 0 {
				if err := sleepContext(ctx, delay); err != nil {
					dc.closeNow()
					return "", err
				}
			}
			ended, res, err := dc.sendFrame(frames[idx])
			if err != nil {
				dc.closeNow()
				return "", err
			}
			if ended {
				endedEarly = true
				earlyRes = res
				break
			}
			idx++
			nextSend = nextSend.Add(cfg.FramePace)
			if now := time.Now(); nextSend.Before(now.Add(-cfg.FramePace)) {
				nextSend = now
			}
		}

		if endedEarly {
			dc.closeNow()
			if earlyRes.err != nil {
				return "", earlyRes.err
			}
			if t := strings.TrimSpace(earlyRes.text); t != "" {
				segments = append(segments, t)
				if onPartial != nil {
					onPartial(joinSegments(segments, ""))
				}
			}
			// Continue remaining frames on a fresh Doubao session!
			continue
		}

		text, err := dc.finish()
		if err != nil {
			return "", err
		}
		if t := strings.TrimSpace(text); t != "" {
			segments = append(segments, t)
			if onPartial != nil {
				onPartial(joinSegments(segments, ""))
			}
		}
		break
	}
	return joinSegments(segments, ""), nil
}

func joinSegments(segments []string, live string) string {
	var b strings.Builder
	for _, s := range segments {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		b.WriteString(s)
	}
	if live = strings.TrimSpace(live); live != "" {
		b.WriteString(live)
	}
	return strings.TrimSpace(b.String())
}

// --- Live Real-Time Streaming Session (Stream While Recording!) ---

// LiveDoubaoSession streams microphone PCM to Doubao IME in real time while the
// user is still speaking, showing live subtitles and automatically rolling over
// to a fresh Doubao session if Doubao finalizes an early sentence mid-speech.
type LiveDoubaoSession struct {
	cfg       DoubaoConfig
	srcRate   int
	channels  int
	onPartial func(string)

	ctx    context.Context
	cancel context.CancelFunc

	frameCh chan taggedOpusFrame
	doneCh  chan doubaoConnResult

	mu         sync.Mutex
	closed     bool
	enc        *streamOpusEncoder
	rawCarry   []byte // leftover bytes not aligned to one input sample frame
	resampPos  float64
	lastSample int16
	hasPrev    bool
}

// NewLiveDoubaoSession starts a real-time Doubao ASR session accepting raw PCM16
// chunks at the microphone's native sampleRate and channel count.
func NewLiveDoubaoSession(ctx context.Context, cfg DoubaoConfig, sampleRate, channels int, onPartial func(string)) (*LiveDoubaoSession, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if sampleRate <= 0 {
		sampleRate = 16000
	}
	if channels < 1 {
		channels = 1
	}
	enc, err := newStreamOpusEncoder()
	if err != nil {
		return nil, err
	}
	lctx, cancel := context.WithCancel(ctx)
	s := &LiveDoubaoSession{
		cfg:       cfg.Normalized(),
		srcRate:   sampleRate,
		channels:  channels,
		onPartial: onPartial,
		ctx:       lctx,
		cancel:    cancel,
		frameCh:   make(chan taggedOpusFrame, 1024),
		doneCh:    make(chan doubaoConnResult, 1),
		enc:       enc,
	}
	go s.run()
	return s, nil
}

// PushPCM feeds raw 16-bit little-endian PCM bytes directly from the recording
// file into the live encoder and Doubao WebSocket stream.
func (s *LiveDoubaoSession) PushPCM(raw []byte) error {
	if len(raw) == 0 {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}

	s.rawCarry = append(s.rawCarry, raw...)
	inFrameBytes := 2 * s.channels
	usable := (len(s.rawCarry) / inFrameBytes) * inFrameBytes
	if usable == 0 {
		return nil
	}
	chunk := s.rawCarry[:usable]
	s.rawCarry = append(s.rawCarry[:0], s.rawCarry[usable:]...)

	mono := downmixToMono(chunk, s.channels)
	mono16k := s.resampleIncremental(mono)
	if len(mono16k) == 0 {
		return nil
	}
	pcm16k := int16SliceToBytes(mono16k)
	frames, err := s.enc.encodeTagged(pcm16k)
	if err != nil {
		return err
	}
	for _, f := range frames {
		select {
		case s.frameCh <- f:
		case <-s.ctx.Done():
			return s.ctx.Err()
		}
	}
	return nil
}

func (s *LiveDoubaoSession) resampleIncremental(in []int16) []int16 {
	if len(in) == 0 || s.srcRate == 16000 {
		return in
	}
	ratio := float64(s.srcRate) / 16000.0
	var out []int16
	for {
		idx := int(math.Floor(s.resampPos))
		if idx >= len(in)-1 {
			break
		}
		frac := s.resampPos - float64(idx)
		var a, b float64
		if idx < 0 {
			if s.hasPrev {
				a = float64(s.lastSample)
			} else {
				a = float64(in[0])
			}
			b = float64(in[0])
		} else {
			a = float64(in[idx])
			b = float64(in[idx+1])
		}
		v := a*(1-frac) + b*frac
		if v > 32767 {
			v = 32767
		} else if v < -32768 {
			v = -32768
		}
		out = append(out, int16(math.Round(v)))
		s.resampPos += ratio
	}
	s.lastSample = in[len(in)-1]
	s.hasPrev = true
	s.resampPos -= float64(len(in))
	return out
}

// Finish flushes remaining encoded audio plus brief trailing silence, sends
// FinishSession, and returns the complete multi-sentence transcript accumulated
// across the recording.
func (s *LiveDoubaoSession) Finish() (string, error) {
	s.mu.Lock()
	if !s.closed {
		s.closed = true
		if frames, err := s.enc.flushTagged(doubaoFinishSilenceFrames); err == nil {
			for _, f := range frames {
				select {
				case s.frameCh <- f:
				case <-s.ctx.Done():
				}
			}
		}
		close(s.frameCh)
	}
	s.mu.Unlock()

	res := <-s.doneCh
	text := strings.TrimSpace(res.text)
	if res.err != nil {
		// If we already settled non-empty text and only hit a normal close on
		// teardown, keep the confirmed text instead of forcing a full re-transcribe.
		if text != "" && isCleanDoubaoClose(res.err) {
			return text, nil
		}
		return text, res.err
	}
	if text == "" {
		return "", errors.New("未识别到有效语音内容，请靠近麦克风重试")
	}
	return text, nil
}

// Abort immediately cancels and tears down the live session.
func (s *LiveDoubaoSession) Abort() {
	s.cancel()
	s.mu.Lock()
	if !s.closed {
		s.closed = true
		close(s.frameCh)
	}
	s.mu.Unlock()
}

func (s *LiveDoubaoSession) run() {
	var segments []string
	var active *doubaoConn
	var sentInSession int
	var quietStreak int
	var nextSend time.Time

	emit := func(live string) {
		if s.onPartial == nil {
			return
		}
		if text := joinSegments(segments, live); text != "" {
			s.onPartial(text)
		}
	}

	openFresh := func() error {
		prefix := append([]string(nil), segments...)
		dc, err := dialDoubaoConn(s.ctx, s.cfg, func(p string) {
			if s.onPartial != nil {
				if text := joinSegments(prefix, p); text != "" {
					s.onPartial(text)
				}
			}
		})
		if err != nil {
			return err
		}
		active = dc
		sentInSession = 0
		quietStreak = 0
		nextSend = time.Now()
		return nil
	}

	finalizeActive := func() error {
		if active == nil {
			return nil
		}
		dc := active
		active = nil
		quietStreak = 0
		text, err := dc.finish()
		if t := strings.TrimSpace(text); t != "" {
			segments = append(segments, t)
			emit("")
		}
		return err
	}

	defer func() {
		if active != nil {
			active.closeNow()
		}
	}()

	for frame := range s.frameCh {
		if s.ctx.Err() != nil {
			s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: s.ctx.Err()}
			return
		}

		// Never open a fresh WebSocket session solely to send synthetic trailing
		// flush silence after a previous session has already finalized.
		if frame.flush && active == nil {
			break
		}

		// Silence-aligned rollover before Doubao IME's ~30s single-session cap:
		// between ~23s and ~28s roll over on the first natural pause (>=60ms quiet),
		// or force rollover at ~28s so long speeches never clip mid-session.
		if active != nil && !frame.flush {
			if frame.quiet {
				quietStreak++
			} else {
				quietStreak = 0
			}
			if sentInSession >= doubaoRollMaxFrames || (sentInSession >= doubaoRollMinFrames && quietStreak >= 3) {
				if err := finalizeActive(); err != nil {
					s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
					return
				}
			}
		}

		if active == nil {
			if err := openFresh(); err != nil {
				s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
				return
			}
		}

		// Pace frames no faster than 1x real-time (20ms/frame) so buffered tail
		// chunks never burst faster than Doubao IME expects.
		if delay := time.Until(nextSend); delay > 0 {
			if err := sleepContext(s.ctx, delay); err != nil {
				s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
				return
			}
		}

		ended, res, err := active.sendFrame(frame.data)
		if err != nil {
			s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
			return
		}
		if ended {
			active.closeNow()
			active = nil
			quietStreak = 0
			if res.err != nil {
				s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: res.err}
				return
			}
			if t := strings.TrimSpace(res.text); t != "" {
				segments = append(segments, t)
				emit("")
			}
			// If we are already in synthetic trailing flush silence and have
			// confirmed text, do NOT open a new session for silence.
			if frame.flush && len(segments) > 0 {
				break
			}
			// Real user speech remains: open a fresh session and immediately
			// send this real frame into it so the final sentence is never lost.
			if err := openFresh(); err != nil {
				s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
				return
			}
			if _, _, err := active.sendFrame(frame.data); err != nil {
				s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
				return
			}
		}
		sentInSession++
		nextSend = nextSend.Add(s.cfg.FramePace)
		if now := time.Now(); nextSend.Before(now.Add(-s.cfg.FramePace)) {
			nextSend = now
		}
	}

	if err := finalizeActive(); err != nil {
		s.doneCh <- doubaoConnResult{text: joinSegments(segments, ""), err: err}
		return
	}
	s.doneCh <- doubaoConnResult{text: joinSegments(segments, "")}
}

// BuildWAVBytes wraps 16-bit PCM bytes in a minimal valid RIFF/WAVE header (used in tests).
func BuildWAVBytes(pcm []byte, sampleRate, channels int) []byte {
	var buf bytes.Buffer
	byteRate := uint32(sampleRate * channels * 2)
	blockAlign := uint16(channels * 2)
	dataLen := uint32(len(pcm))
	buf.WriteString("RIFF")
	_ = binary.Write(&buf, binary.LittleEndian, uint32(36+dataLen))
	buf.WriteString("WAVE")
	buf.WriteString("fmt ")
	_ = binary.Write(&buf, binary.LittleEndian, uint32(16))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(channels))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(&buf, binary.LittleEndian, byteRate)
	_ = binary.Write(&buf, binary.LittleEndian, blockAlign)
	_ = binary.Write(&buf, binary.LittleEndian, uint16(16))
	buf.WriteString("data")
	_ = binary.Write(&buf, binary.LittleEndian, dataLen)
	buf.Write(pcm)
	return buf.Bytes()
}
