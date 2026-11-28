package voice

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"nsgo-todo/internal/api"
)

func buildFakeDoubaoResponse(event string, status int64, payload string) []byte {
	b := protoBytes(nil, 4, []byte(event))
	b = binary.AppendUvarint(b, 5<<3)
	b = binary.AppendUvarint(b, uint64(status))
	b = protoBytes(b, 7, []byte(payload))
	return b
}

func TestWAVToPCM16kMonoAndOpusEncode(t *testing.T) {
	// Generate 48kHz stereo 100ms sine wave (4800 frames)
	const srcRate = 48000
	const frames = 4800
	pcm := make([]byte, frames*4)
	for i := 0; i < frames; i++ {
		s := int16(math.Sin(2*math.Pi*440*float64(i)/srcRate) * 2000)
		binary.LittleEndian.PutUint16(pcm[i*4:], uint16(s))
		binary.LittleEndian.PutUint16(pcm[i*4+2:], uint16(s))
	}
	wav := BuildWAVBytes(pcm, srcRate, 2)

	pcm16k, err := WAVToPCM16kMono(wav)
	if err != nil {
		t.Fatalf("WAVToPCM16kMono failed: %v", err)
	}
	// 100ms @ 16kHz mono = 1600 samples = 3200 bytes
	if len(pcm16k) != 3200 {
		t.Fatalf("expected 3200 bytes at 16kHz mono, got %d", len(pcm16k))
	}

	opusFrames, err := encodeOpus16kMono(pcm16k)
	if err != nil {
		t.Fatalf("encodeOpus16kMono failed: %v", err)
	}
	// 5 frames (100ms) + 1 trailing flush frame = 6 Opus packets
	if len(opusFrames) != 6 {
		t.Fatalf("expected 6 Opus frames, got %d", len(opusFrames))
	}
}

func TestDoubaoTranscribeEndToEnd(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	var (
		gotEvents     []string
		gotAudioCount int
		gotAppID      string
		gotDeviceID   string
		gotProtoVer   string
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAppID = r.URL.Query().Get("aid")
		gotDeviceID = r.URL.Query().Get("device_id")
		gotProtoVer = r.Header.Get("Proto-Version")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			// Parse request protobuf: field 5 = event, field 7 = audio bytes
			ev, hasData := parseReqEvent(msg)
			gotEvents = append(gotEvents, ev)
			switch ev {
			case "StartTask", "StartSession":
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse(ev, 20000000, ""))
			case "TaskRequest":
				if hasData {
					gotAudioCount++
				}
				if gotAudioCount == 2 {
					interim := `{"results":[{"text":"明天早上九点","is_interim":true,"start_time":0,"end_time":1200}]}`
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, interim))
				}
			case "FinishSession":
				finalPayload := `{"results":[{"text":"明天早上九点在工作分类建一个每周例会","is_interim":false,"start_time":0,"end_time":2400}]}`
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, finalPayload))
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
				return
			}
		}
	}))
	defer srv.Close()

	// 120ms of 16kHz mono audio (1920 samples = 3840 bytes)
	pcm := make([]byte, 3840)
	for i := 0; i < 1920; i++ {
		s := int16(math.Sin(2*math.Pi*300*float64(i)/16000) * 6000)
		binary.LittleEndian.PutUint16(pcm[i*2:], uint16(s))
	}

	var partials []string
	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       time.Millisecond,
		AllowInsecureWS: true,
	}
	got, err := TranscribePCM(context.Background(), cfg, pcm, func(p string) {
		partials = append(partials, p)
	})
	if err != nil {
		t.Fatalf("TranscribePCM failed: %v", err)
	}
	if got != "明天早上九点在工作分类建一个每周例会" {
		t.Fatalf("unexpected transcript: %q", got)
	}
	if gotAppID != "685343" || gotDeviceID != "1234567890123" || gotProtoVer != "v2" {
		t.Fatalf("unexpected handshake params: aid=%q device=%q proto=%q", gotAppID, gotDeviceID, gotProtoVer)
	}
	if gotAudioCount < 6 {
		t.Fatalf("expected >= 6 opus packets, got %d", gotAudioCount)
	}
	if len(partials) == 0 {
		t.Fatalf("expected at least one partial transcript callback")
	}
}

func parseReqEvent(b []byte) (string, bool) {
	var ev string
	var hasData bool
	for len(b) > 0 {
		k, n := binary.Uvarint(b)
		if n <= 0 {
			break
		}
		b = b[n:]
		field, wire := k>>3, k&7
		switch wire {
		case 0:
			_, n := binary.Uvarint(b)
			b = b[n:]
		case 2:
			l, n := binary.Uvarint(b)
			b = b[n:]
			val := b[:l]
			b = b[l:]
			if field == 5 {
				ev = string(val)
			}
			if field == 7 && len(val) > 0 {
				hasData = true
			}
		}
	}
	return ev, hasData
}

func TestParseTasksWithLLMOpenAIAndAnthropic(t *testing.T) {
	shanghai, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		shanghai = time.FixedZone("CST", 8*3600)
	}
	now := time.Date(2026, 11, 22, 23, 0, 0, 0, shanghai)
	cats := []api.Category{
		{ID: 7, Name: "Work", Emoji: "🏠"},
		{ID: 9, Name: "生活", Emoji: "🌿"},
	}

	// 1. OpenAI-compatible mock server (returning fenced JSON + reasoning tag + recurring rule)
	openAISrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("unexpected OpenAI path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer sk-test" {
			t.Errorf("missing bearer auth")
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{
					"message": map[string]any{
						"content": "<think>分析时间与重复规则</think>\n```json\n" +
							`{"tasks":[{"title":"项目周会","description":"- 同步进度\n- 确认风险","priority":3,"all_day":false,"start_time":"2026-11-23 09:30","end_time":"2026-11-23 10:30","due_date":"2026-11-23 09:30","category_ids":[7,999],"recurrence_rule":{"freq":"weekly","interval":1,"byday":["MO","WE","FR"]},"recurrence_end_date":"2026-12-31"}]}` +
							"\n```",
					},
				},
			},
		})
	}))
	defer openAISrv.Close()

	tasks, err := ParseTasksWithLLM(context.Background(), api.AIConfig{
		Protocol: api.AIProtocolOpenAI,
		BaseURL:  openAISrv.URL + "/v1",
		APIKey:   "sk-test",
		ModelID:  "gpt-4o-mini",
	}, "明天早上九点半到十点半在工作分类建一个高优先级项目周会，每周一三五重复到年底，需要同步进度和确认风险", cats, now, shanghai)
	if err != nil {
		t.Fatalf("OpenAI ParseTasksWithLLM failed: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	got := tasks[0]
	if got.Title != "项目周会" || got.Priority != 3 {
		t.Fatalf("unexpected title/priority: %+v", got)
	}
	if len(got.CategoryIDs) != 1 || got.CategoryIDs[0] != 7 {
		t.Fatalf("expected filtered valid category [7], got %v", got.CategoryIDs)
	}
	if got.StartTime == nil || got.StartTime.In(shanghai).Format("2006-01-02 15:04") != "2026-11-23 09:30" {
		t.Fatalf("unexpected start_time: %v", got.StartTime)
	}
	if got.RecurrenceRule == nil || got.RecurrenceRule.Freq != "weekly" || len(got.RecurrenceRule.ByDay) != 3 {
		t.Fatalf("unexpected recurrence rule: %+v", got.RecurrenceRule)
	}
	if summary := RecurrenceSummary(got.RecurrenceRule, got.RecurrenceEndDate, shanghai); !strings.Contains(summary, "每周一、三、五") || !strings.Contains(summary, "2026-12-31") {
		t.Fatalf("unexpected recurrence summary: %q", summary)
	}

	// 2. Anthropic-compatible mock server (multi-task response)
	anthSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" {
			t.Errorf("unexpected Anthropic path: %s", r.URL.Path)
		}
		if r.Header.Get("x-api-key") != "ant-key" || r.Header.Get("anthropic-version") != "2023-06-01" {
			t.Errorf("missing Anthropic headers")
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"content": []map[string]any{
				{
					"type": "text",
					"text": `{"tasks":[{"title":"买猫粮","all_day":true,"due_date":"2026-11-24","category_ids":[9]},{"title":"每日吃维生素","start_time":"2026-11-23 08:00","recurrence_rule":{"freq":"daily","interval":1}}]}`,
				},
			},
		})
	}))
	defer anthSrv.Close()

	multi, err := ParseTasksWithLLM(context.Background(), api.AIConfig{
		Protocol: api.AIProtocolAnthropic,
		BaseURL:  anthSrv.URL + "/v1",
		APIKey:   "ant-key",
		ModelID:  "claude-sonnet",
	}, "后天买猫粮放生活分类，另外每天早上八点吃维生素", cats, now, shanghai)
	if err != nil {
		t.Fatalf("Anthropic ParseTasksWithLLM failed: %v", err)
	}
	if len(multi) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(multi))
	}
	if multi[0].Title != "买猫粮" || !multi[0].AllDay || len(multi[0].CategoryIDs) != 1 || multi[0].CategoryIDs[0] != 9 {
		t.Fatalf("unexpected first task: %+v", multi[0])
	}
	if multi[1].RecurrenceRule == nil || multi[1].RecurrenceRule.Freq != "daily" {
		t.Fatalf("unexpected second task recurrence: %+v", multi[1])
	}
}

func newTwoSentenceMockDoubaoServer(t *testing.T, conns *atomic.Int32) *httptest.Server {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		connIdx := conns.Add(1)
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		audioCount := 0
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			ev, hasData := parseReqEvent(msg)
			switch ev {
			case "StartTask", "StartSession":
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse(ev, 20000000, ""))
			case "TaskRequest":
				if hasData {
					audioCount++
				}
				if connIdx == 1 && audioCount == 3 {
					// Simulate Doubao finalizing Sentence 1 mid-speech and closing Session 1 early.
					p1 := `{"results":[{"text":"明天早上九点开会","is_interim":false,"start_time":0,"end_time":1200}]}`
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, p1))
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
					return
				}
				if connIdx >= 2 && audioCount == 2 {
					p2Interim := `{"results":[{"text":"放工作","is_interim":true,"start_time":0,"end_time":800}]}`
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, p2Interim))
				}
			case "FinishSession":
				text := "明天早上九点开会"
				if connIdx >= 2 {
					text = "放工作分类每周一重复"
				}
				pFinal, _ := json.Marshal(map[string]any{
					"results": []map[string]any{
						{"text": text, "is_interim": false, "start_time": 0, "end_time": 2400},
					},
				})
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, string(pFinal)))
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
				return
			}
		}
	}))
}

func TestDoubaoMultiSentenceAutoResume(t *testing.T) {
	var conns atomic.Int32
	srv := newTwoSentenceMockDoubaoServer(t, &conns)
	defer srv.Close()

	// 240ms @ 16kHz mono (3840 samples -> 12 Opus frames + flush = 13 frames)
	pcm := make([]byte, 3840*2)
	for i := 0; i < 3840; i++ {
		s := int16(math.Sin(2*math.Pi*350*float64(i)/16000) * 6000)
		binary.LittleEndian.PutUint16(pcm[i*2:], uint16(s))
	}

	var mu sync.Mutex
	var partials []string
	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       12 * time.Millisecond,
		AllowInsecureWS: true,
	}
	got, err := TranscribePCM(context.Background(), cfg, pcm, func(p string) {
		mu.Lock()
		partials = append(partials, p)
		mu.Unlock()
	})
	if err != nil {
		t.Fatalf("TranscribePCM auto-resume failed: %v", err)
	}
	want := "明天早上九点开会放工作分类每周一重复"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
	if conns.Load() < 2 {
		t.Fatalf("expected >= 2 Doubao sessions to capture all sentences, got %d", conns.Load())
	}
	mu.Lock()
	defer mu.Unlock()
	if len(partials) == 0 || partials[len(partials)-1] != want {
		t.Fatalf("unexpected partials sequence: %v", partials)
	}
}

func TestDoubaoSeqIDRevisionsNeverDuplicateTranscript(t *testing.T) {
	var state doubaoTextState
	// Real Doubao IME emits incrementing extra.seq_id revisions of the SAME sentence
	// alongside the single untagged start_time==0 cumulative result.
	_ = state.update(`{"results":[{"text":"明天早上九点","start_time":0,"end_time":1.2,"is_interim":true},{"text":"明天早上九点","start_time":0.08,"end_time":1.2,"is_interim":true,"extra":{"seq_id":11}}]}`)
	_ = state.update(`{"results":[{"text":"明天早上九点开会","start_time":0,"end_time":1.8,"is_interim":true},{"text":"明天早上九点开会","start_time":0.08,"end_time":1.8,"is_interim":false,"extra":{"seq_id":12}}]}`)
	// Sentence-only packet with seq_id must not replace or duplicate the cumulative text.
	_ = state.update(`{"results":[{"text":"明天早上九点开会","start_time":0.08,"end_time":1.8,"is_interim":false,"extra":{"seq_id":13}}]}`)
	display := state.update(`{"results":[{"text":"明天早上九点开会，放工作分类，每周一重复。","start_time":0,"end_time":4.2,"is_interim":false},{"text":"放工作分类，每周一重复。","start_time":2.0,"end_time":4.2,"is_interim":false,"extra":{"seq_id":37}}]}`)

	want := "明天早上九点开会，放工作分类，每周一重复。"
	if display != want || state.settledText() != want {
		t.Fatalf("expected single clean cumulative transcript %q, got display=%q settled=%q", want, display, state.settledText())
	}
}

func TestLiveDoubaoSessionStreamingAndRollover(t *testing.T) {
	var conns atomic.Int32
	srv := newTwoSentenceMockDoubaoServer(t, &conns)
	defer srv.Close()

	var mu sync.Mutex
	var partials []string
	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       12 * time.Millisecond,
		AllowInsecureWS: true,
	}
	sess, err := NewLiveDoubaoSession(context.Background(), cfg, 48000, 2, func(p string) {
		mu.Lock()
		partials = append(partials, p)
		mu.Unlock()
	})
	if err != nil {
		t.Fatalf("NewLiveDoubaoSession failed: %v", err)
	}

	// Stream 240ms of 48kHz stereo PCM (11520 frames) across 12 small chunks.
	const totalFrames = 11520
	const chunkFrames = 960
	pcm := make([]byte, chunkFrames*4)
	for c := 0; c < totalFrames/chunkFrames; c++ {
		for i := 0; i < chunkFrames; i++ {
			idx := c*chunkFrames + i
			s := int16(math.Sin(2*math.Pi*440*float64(idx)/48000) * 5000)
			binary.LittleEndian.PutUint16(pcm[i*4:], uint16(s))
			binary.LittleEndian.PutUint16(pcm[i*4+2:], uint16(s))
		}
		if err := sess.PushPCM(pcm); err != nil {
			t.Fatalf("PushPCM chunk %d failed: %v", c, err)
		}
		time.Sleep(5 * time.Millisecond)
	}

	got, err := sess.Finish()
	if err != nil {
		t.Fatalf("LiveDoubaoSession Finish failed: %v", err)
	}
	want := "明天早上九点开会放工作分类每周一重复"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
	if conns.Load() < 2 {
		t.Fatalf("expected >= 2 sessions across live rollover, got %d", conns.Load())
	}
	mu.Lock()
	defer mu.Unlock()
	joined := strings.Join(partials, " | ")
	if !strings.Contains(joined, "明天早上九点开会") || !strings.Contains(joined, "明天早上九点开会放工作") {
		t.Fatalf("expected live streaming partials for both sentences, got: %s", joined)
	}
}

func TestDoubaoCleanCloseAfterFinalDoesNotError(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	var conns atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conns.Add(1)
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			ev, _ := parseReqEvent(msg)
			switch ev {
			case "StartTask", "StartSession":
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse(ev, 20000000, ""))
			case "FinishSession":
				// Server delivers final transcript and immediately closes with CloseNormalClosure (1000),
				// without a separate SessionFinished event.
				pFinal := `{"results":[{"text":"周五下午三点提交方案","is_interim":false,"start_time":0,"end_time":2.1}]}`
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, pFinal))
				_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "done"))
				return
			}
		}
	}))
	defer srv.Close()

	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       time.Millisecond,
		AllowInsecureWS: true,
	}
	sess, err := NewLiveDoubaoSession(context.Background(), cfg, 16000, 1, nil)
	if err != nil {
		t.Fatalf("NewLiveDoubaoSession failed: %v", err)
	}
	pcm := make([]byte, 1600*2)
	for i := 0; i < 1600; i++ {
		binary.LittleEndian.PutUint16(pcm[i*2:], uint16(int16(math.Sin(2*math.Pi*300*float64(i)/16000)*5000)))
	}
	if err := sess.PushPCM(pcm); err != nil {
		t.Fatalf("PushPCM failed: %v", err)
	}
	got, err := sess.Finish()
	if err != nil {
		t.Fatalf("expected clean close with final text to succeed, got err=%v text=%q", err, got)
	}
	if got != "周五下午三点提交方案" {
		t.Fatalf("unexpected final text: %q", got)
	}
	if conns.Load() != 1 {
		t.Fatalf("expected exactly 1 connection (no re-transcription), got %d", conns.Load())
	}
}

func TestLiveDoubaoFinishDoesNotReopenForTrailingFlushSilence(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	var conns atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conns.Add(1)
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		audioCount := 0
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			ev, hasData := parseReqEvent(msg)
			switch ev {
			case "StartTask", "StartSession":
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse(ev, 20000000, ""))
			case "TaskRequest":
				if hasData {
					audioCount++
				}
				if audioCount == 5 {
					// Server already finalized on the last real speech frame right before Finish() adds 1 flush silence frame.
					pFinal := `{"results":[{"text":"今晚八点跑步","is_interim":false,"start_time":0,"end_time":1.0}]}`
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, pFinal))
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
					return
				}
			}
		}
	}))
	defer srv.Close()

	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       10 * time.Millisecond,
		AllowInsecureWS: true,
	}
	sess, err := NewLiveDoubaoSession(context.Background(), cfg, 16000, 1, nil)
	if err != nil {
		t.Fatalf("NewLiveDoubaoSession failed: %v", err)
	}
	// Exactly 5 frames (100ms @ 16kHz = 1600 samples)
	pcm := make([]byte, 1600*2)
	for i := 0; i < 1600; i++ {
		binary.LittleEndian.PutUint16(pcm[i*2:], uint16(int16(math.Sin(2*math.Pi*300*float64(i)/16000)*5000)))
	}
	if err := sess.PushPCM(pcm); err != nil {
		t.Fatalf("PushPCM failed: %v", err)
	}
	time.Sleep(100 * time.Millisecond) // allow the 5 speech frames to settle on Session 1
	got, err := sess.Finish()
	if err != nil {
		t.Fatalf("Finish failed: %v", err)
	}
	if got != "今晚八点跑步" {
		t.Fatalf("unexpected text: %q", got)
	}
	if conns.Load() != 1 {
		t.Fatalf("expected 1 connection (must not open a 2nd session for trailing flush silence), got %d", conns.Load())
	}
}

func TestLiveDoubaoFinishSendsTrailingSilenceAndCapturesLastSentence(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	var (
		audioCount atomic.Int32
		gotFinish  atomic.Bool
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			ev, hasData := parseReqEvent(msg)
			switch ev {
			case "StartTask", "StartSession":
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse(ev, 20000000, ""))
			case "TaskRequest":
				if hasData {
					n := audioCount.Add(1)
					if n == 5 {
						interim := `{"results":[{"text":"明天去体检","is_interim":true,"start_time":0,"end_time":1.0}]}`
						_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, interim))
					}
				}
			case "FinishSession":
				gotFinish.Store(true)
				finalPayload := `{"results":[{"text":"明天去体检，记得空腹带身份证。","is_interim":false,"start_time":0,"end_time":2.2}]}`
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, finalPayload))
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
				return
			}
		}
	}))
	defer srv.Close()

	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       time.Millisecond,
		AllowInsecureWS: true,
	}
	sess, err := NewLiveDoubaoSession(context.Background(), cfg, 16000, 1, nil)
	if err != nil {
		t.Fatalf("NewLiveDoubaoSession failed: %v", err)
	}
	// 5 real frames (1600 samples)
	pcm := make([]byte, 1600*2)
	for i := 0; i < 1600; i++ {
		binary.LittleEndian.PutUint16(pcm[i*2:], uint16(int16(math.Sin(2*math.Pi*320*float64(i)/16000)*5000)))
	}
	if err := sess.PushPCM(pcm); err != nil {
		t.Fatalf("PushPCM failed: %v", err)
	}
	got, err := sess.Finish()
	if err != nil {
		t.Fatalf("Finish failed: %v", err)
	}
	if !gotFinish.Load() {
		t.Fatalf("expected FinishSession to be sent")
	}
	wantFrames := int32(5 + doubaoFinishSilenceFrames)
	if audioCount.Load() != wantFrames {
		t.Fatalf("expected %d audio frames (5 real + %d trailing silence), got %d", wantFrames, doubaoFinishSilenceFrames, audioCount.Load())
	}
	want := "明天去体检，记得空腹带身份证。"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestLiveDoubaoRealFramesAfterEarlyCloseNeverDroppedOnFinish(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	var conns atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idx := conns.Add(1)
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		audioCount := 0
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			ev, hasData := parseReqEvent(msg)
			switch ev {
			case "StartTask", "StartSession":
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse(ev, 20000000, ""))
			case "TaskRequest":
				if hasData {
					audioCount++
				}
				if idx == 1 && audioCount == 4 {
					p1 := `{"results":[{"text":"第一句说完，","is_interim":false,"start_time":0,"end_time":0.8}]}`
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, p1))
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
					return
				}
			case "FinishSession":
				if idx >= 2 {
					p2 := `{"results":[{"text":"最后一句不能丢。","is_interim":false,"start_time":0,"end_time":0.6}]}`
					_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("TaskResult", 20000000, p2))
				}
				_ = conn.WriteMessage(websocket.BinaryMessage, buildFakeDoubaoResponse("SessionFinished", 20000000, ""))
				return
			}
		}
	}))
	defer srv.Close()

	cfg := DoubaoConfig{
		AppID:           "685343",
		AppKey:          "test-key",
		DeviceID:        "1234567890123",
		Host:            strings.TrimPrefix(srv.URL, "http://"),
		Path:            "/ocean/api/v1/ws",
		Language:        "zh",
		Timeout:         5 * time.Second,
		FramePace:       10 * time.Millisecond,
		AllowInsecureWS: true,
	}
	sess, err := NewLiveDoubaoSession(context.Background(), cfg, 16000, 1, nil)
	if err != nil {
		t.Fatalf("NewLiveDoubaoSession failed: %v", err)
	}
	// Push 4 frames (Session 1 will finish on frame 4), wait for it to settle,
	// then push just 2 real frames right before Finish(). Because these 2 frames
	// are tagged flush=false (real speech), they MUST open Session 2!
	pcm4 := make([]byte, 4*doubaoFrameSamples*2)
	for i := 0; i < 4*doubaoFrameSamples; i++ {
		binary.LittleEndian.PutUint16(pcm4[i*2:], uint16(int16(math.Sin(2*math.Pi*300*float64(i)/16000)*5000)))
	}
	if err := sess.PushPCM(pcm4); err != nil {
		t.Fatalf("PushPCM(pcm4) failed: %v", err)
	}
	time.Sleep(90 * time.Millisecond)

	pcm2 := make([]byte, 2*doubaoFrameSamples*2)
	for i := 0; i < 2*doubaoFrameSamples; i++ {
		binary.LittleEndian.PutUint16(pcm2[i*2:], uint16(int16(math.Sin(2*math.Pi*450*float64(i)/16000)*5000)))
	}
	if err := sess.PushPCM(pcm2); err != nil {
		t.Fatalf("PushPCM(pcm2) failed: %v", err)
	}
	got, err := sess.Finish()
	if err != nil {
		t.Fatalf("Finish failed: %v", err)
	}
	want := "第一句说完，最后一句不能丢。"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
	if conns.Load() != 2 {
		t.Fatalf("expected 2 connections so last real frames are captured, got %d", conns.Load())
	}
}
