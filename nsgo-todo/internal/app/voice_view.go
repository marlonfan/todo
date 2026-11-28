package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/nsgo-dev/nsgo/base"
	"github.com/nsgo-dev/nsgo/core"
	"github.com/nsgo-dev/nsgo/icons/lucide"
	"github.com/nsgo-dev/nsgo/microphone"
	"github.com/nsgo-dev/nsgo/ui"

	"nsgo-todo/internal/api"
	"nsgo-todo/internal/domain"
	"nsgo-todo/internal/voice"
)

type voiceStage int

const (
	voiceIdle voiceStage = iota
	voiceRecording
	voiceTranscribing
	voiceParsing
	voicePreview
	voiceError
)

type voiceTaskDraft struct {
	id                int
	included          *core.Signal[bool]
	title             *core.Signal[string]
	description       *core.Signal[string]
	priority          *core.Signal[int]
	allDay            *core.Signal[bool]
	startTime         *core.Signal[*time.Time]
	endTime           *core.Signal[*time.Time]
	dueDate           *core.Signal[*time.Time]
	categoryIDs       *core.Signal[[]int64]
	recurrenceRule    *core.Signal[*voice.RecurrenceRule]
	recurrenceEndDate *core.Signal[*time.Time]
}

// voiceController coordinates WeChat-style hold-to-talk recording, live audio
// level waveform animation, Doubao IME ASR transcription, LLM parsing, and
// task preview confirmation.
type voiceController struct {
	cx    *core.Scope
	state *AppState

	stage      *core.Signal[voiceStage]
	cancelZone *core.Signal[bool]
	elapsedMs  *core.Signal[int64]
	wavePhase  *core.Signal[float64]
	waveBars   *core.Signal[[15]float64]
	audioLevel *core.Signal[float64]
	transcript *core.Signal[string]
	errorMsg   *core.Signal[string]
	drafts     *core.Signal[[]*voiceTaskDraft]
	creating   *core.Signal[bool]

	// Guarded by mu for cross-goroutine recording/cancel coordination.
	mu             sync.Mutex
	gen            uint64
	activeRec      *microphone.Recording
	activeCancel   context.CancelFunc
	liveCtx        context.Context
	liveASR        *voice.LiveDoubaoSession
	tailStop       chan struct{}
	tailDone       chan struct{}
	tailOffset     int64
	tailFrameBytes int64
	recordStart    time.Time
	recordTicker   *time.Ticker
	pendingRelease bool
	pendingCancel  bool
	latestRMS      float64
	latestPeak     float64
}

func newVoiceController(cx *core.Scope, state *AppState) *voiceController {
	vc := &voiceController{
		cx:         cx,
		state:      state,
		stage:      core.NewSignal(cx, voiceIdle),
		cancelZone: core.NewSignal(cx, false),
		elapsedMs:  core.NewSignal(cx, int64(0)),
		wavePhase:  core.NewSignal(cx, 0.0),
		waveBars:   core.NewSignalFunc(cx, [15]float64{}, nil),
		audioLevel: core.NewSignal(cx, 0.0),
		transcript: core.NewSignal(cx, ""),
		errorMsg:   core.NewSignal(cx, ""),
		drafts:     core.NewSignalFunc(cx, []*voiceTaskDraft(nil), nil),
		creating:   core.NewSignal(cx, false),
	}
	cx.Cleanup(func() {
		vc.abortAll()
	})
	return vc
}

func (vc *voiceController) isRecording() bool {
	return vc.stage.GetUntracked() == voiceRecording
}

func (vc *voiceController) setCancelZone(inCancel bool) {
	if vc.stage.GetUntracked() != voiceRecording {
		return
	}
	if vc.cancelZone.GetUntracked() != inCancel {
		vc.cancelZone.Set(inCancel)
		vc.cx.PlayHaptic(core.HapticSelection)
	}
}

func (vc *voiceController) abortAll() {
	vc.mu.Lock()
	vc.gen++
	rec := vc.activeRec
	vc.activeRec = nil
	cancel := vc.activeCancel
	vc.activeCancel = nil
	liveSess := vc.liveASR
	vc.liveASR = nil
	vc.liveCtx = nil
	tailStop := vc.tailStop
	vc.tailStop = nil
	vc.tailDone = nil
	vc.tailOffset = 0
	vc.tailFrameBytes = 0
	ticker := vc.recordTicker
	vc.recordTicker = nil
	vc.pendingRelease = false
	vc.pendingCancel = false
	vc.mu.Unlock()

	if tailStop != nil {
		close(tailStop)
	}
	if ticker != nil {
		ticker.Stop()
	}
	if liveSess != nil {
		liveSess.Abort()
	}
	if cancel != nil {
		cancel()
	}
	if rec != nil {
		go func(r *microphone.Recording) {
			r.Stop()
			if p := r.File().Path; p != "" {
				_ = os.Remove(p)
			}
		}(rec)
	}
}

func (vc *voiceController) dismiss() {
	vc.abortAll()
	vc.cx.Batch(func() {
		vc.stage.Set(voiceIdle)
		vc.cancelZone.Set(false)
		vc.elapsedMs.Set(0)
		vc.audioLevel.Set(0)
		vc.errorMsg.Set("")
		vc.drafts.Set(nil)
		vc.creating.Set(false)
	})
}

// beginHoldRecording starts a WeChat-style hold-to-talk recording session.
func (vc *voiceController) beginHoldRecording() {
	if vc.stage.GetUntracked() != voiceIdle {
		return
	}
	doubaoCfg := vc.state.doubaoConfig.GetUntracked()
	if !doubaoCfg.Ready() {
		vc.cx.PlayHaptic(core.HapticWarning)
		vc.state.ToastInfo("请先在「语音与 AI」中填写豆包语音凭据")
		vc.state.voiceSettingsOpen.Set(true)
		return
	}

	vc.abortAll()
	vc.mu.Lock()
	vc.gen++
	gen := vc.gen
	vc.recordStart = time.Now()
	vc.latestRMS = 0
	vc.latestPeak = 0
	vc.pendingRelease = false
	vc.pendingCancel = false
	ticker := time.NewTicker(45 * time.Millisecond)
	vc.recordTicker = ticker
	vc.mu.Unlock()

	vc.cx.PlayHaptic(core.HapticMedium)
	vc.cx.Batch(func() {
		vc.stage.Set(voiceRecording)
		vc.cancelZone.Set(false)
		vc.elapsedMs.Set(0)
		vc.audioLevel.Set(0.12)
		vc.transcript.Set("")
		vc.errorMsg.Set("")
		vc.drafts.Set(nil)
	})

	// Drive smooth 22fps waveform bar animation + elapsed clock while recording.
	go func() {
		var phase float64
		var bars [15]float64
		for range ticker.C {
			vc.mu.Lock()
			if vc.gen != gen {
				vc.mu.Unlock()
				return
			}
			rms := vc.latestRMS
			peak := vc.latestPeak
			elapsed := time.Since(vc.recordStart).Milliseconds()
			vc.mu.Unlock()

			phase += 0.34
			// Combine RMS & Peak with soft log compression so human speech dances clearly.
			energy := math.Min(1.0, math.Pow(math.Max(rms*3.6, peak*1.4), 0.65))
			for i := range bars {
				centerDist := math.Abs(float64(i)-7.0) / 7.0
				envelope := 1.0 - centerDist*0.58
				ripple := 0.5 + 0.5*math.Sin(phase*1.45+float64(i)*0.72)
				ripple2 := 0.5 + 0.5*math.Cos(phase*0.85-float64(i)*0.55)
				idle := 0.14 + 0.10*ripple
				active := energy * envelope * (0.48 + 0.52*(0.65*ripple+0.35*ripple2))
				target := math.Min(1.0, math.Max(idle, active))
				bars[i] = bars[i]*0.38 + target*0.62
			}

			snapBars := bars
			snapPhase := phase
			snapEnergy := energy
			vc.cx.Post(func() {
				vc.mu.Lock()
				alive := vc.gen == gen
				vc.mu.Unlock()
				if !alive || vc.stage.GetUntracked() != voiceRecording {
					return
				}
				vc.cx.Batch(func() {
					vc.elapsedMs.Set(elapsed)
					vc.wavePhase.Set(snapPhase)
					vc.audioLevel.Set(snapEnergy)
					vc.waveBars.Set(snapBars)
				})
			})
		}
	}()

	// Start Android native WAV microphone recording off the engine goroutine.
	fileName := fmt.Sprintf("voice_%d.wav", time.Now().UnixMilli())
	go func() {
		rec, err := microphone.RecordWAV(fileName, microphone.RecordOptions{
			Rate:          16000,
			Channels:      1,
			LevelInterval: 40 * time.Millisecond,
			Level: func(l microphone.Level) {
				vc.mu.Lock()
				if vc.gen == gen {
					vc.latestRMS = float64(l.RMS)
					vc.latestPeak = float64(l.Peak)
				}
				vc.mu.Unlock()
			},
		})
		if err != nil {
			vc.mu.Lock()
			same := vc.gen == gen
			if same && vc.recordTicker != nil {
				vc.recordTicker.Stop()
				vc.recordTicker = nil
			}
			vc.mu.Unlock()
			if !same {
				return
			}
			msg := formatMicError(err)
			vc.cx.Post(func() {
				vc.cx.PlayHaptic(core.HapticError)
				vc.stage.Set(voiceIdle)
				vc.state.ToastError(msg)
			})
			return
		}

		vc.mu.Lock()
		if vc.gen != gen {
			vc.mu.Unlock()
			rec.Stop()
			if p := rec.File().Path; p != "" {
				_ = os.Remove(p)
			}
			return
		}
		vc.activeRec = rec
		shouldCancel := vc.pendingCancel
		shouldRelease := vc.pendingRelease
		vc.pendingCancel = false
		vc.pendingRelease = false
		var (
			tailStop chan struct{}
			tailDone chan struct{}
		)
		if !shouldCancel && !shouldRelease {
			f := rec.File()
			channels := f.Channels
			if channels < 1 {
				channels = 1
			}
			rate := f.Rate
			if rate <= 0 {
				rate = 16000
			}
			frameBytes := int64(channels * 2)
			liveCtx, liveCancel := context.WithCancel(vc.state.ctx)
			liveSess, liveErr := voice.NewLiveDoubaoSession(liveCtx, doubaoCfg, rate, channels, func(partial string) {
				vc.cx.Post(func() {
					vc.mu.Lock()
					alive := vc.gen == gen
					vc.mu.Unlock()
					if alive {
						vc.transcript.Set(partial)
					}
				})
			})
			if liveErr == nil {
				vc.activeCancel = liveCancel
				vc.liveCtx = liveCtx
				vc.liveASR = liveSess
				tailStop = make(chan struct{})
				tailDone = make(chan struct{})
				vc.tailStop = tailStop
				vc.tailDone = tailDone
				vc.tailOffset = 44 // skip 44-byte RIFF/WAVE header
				vc.tailFrameBytes = frameBytes

				targetPath := f.Path
				partPath := filepath.Join(filepath.Dir(targetPath), "."+filepath.Base(targetPath)+".part")
				go vc.tailRecordingFile(gen, partPath, frameBytes, liveSess, tailStop, tailDone)
			} else {
				liveCancel()
			}
		}
		vc.mu.Unlock()

		if shouldCancel {
			rec.Stop()
			if p := rec.File().Path; p != "" {
				_ = os.Remove(p)
			}
			return
		}
		if shouldRelease {
			vc.cx.Post(func() {
				vc.finishHoldRecording()
			})
		}
	}()
}

func (vc *voiceController) tailRecordingFile(
	gen uint64,
	partPath string,
	frameBytes int64,
	liveSess *voice.LiveDoubaoSession,
	stopCh <-chan struct{},
	doneCh chan<- struct{},
) {
	defer close(doneCh)
	var offset int64 = 44
	poll := time.NewTicker(40 * time.Millisecond)
	defer poll.Stop()

	flushAvailable := func() bool {
		buf, nextOff := readPCMChunkFromFile(partPath, offset, frameBytes)
		if len(buf) > 0 {
			offset = nextOff
			vc.mu.Lock()
			if vc.gen == gen {
				vc.tailOffset = offset
			}
			vc.mu.Unlock()
			_ = liveSess.PushPCM(buf)
			return true
		}
		return false
	}

	for {
		select {
		case <-stopCh:
			for flushAvailable() {
			}
			return
		case <-poll.C:
			vc.mu.Lock()
			alive := vc.gen == gen
			vc.mu.Unlock()
			if !alive {
				return
			}
			flushAvailable()
		}
	}
}

func readPCMChunkFromFile(path string, offset, frameBytes int64) ([]byte, int64) {
	if path == "" || frameBytes <= 0 {
		return nil, offset
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, offset
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return nil, offset
	}
	size := fi.Size()
	if size <= offset {
		return nil, offset
	}
	avail := ((size - offset) / frameBytes) * frameBytes
	if avail <= 0 {
		return nil, offset
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return nil, offset
	}
	buf := make([]byte, avail)
	n, err := io.ReadFull(f, buf)
	if err != nil && err != io.ErrUnexpectedEOF {
		return nil, offset
	}
	usable := (int64(n) / frameBytes) * frameBytes
	if usable <= 0 {
		return nil, offset
	}
	return buf[:usable], offset + usable
}

func formatLiveSubtitle(text string, maxRunes int) string {
	text = strings.TrimSpace(text)
	if maxRunes <= 1 {
		return text
	}
	runes := []rune(text)
	if len(runes) <= maxRunes {
		return text
	}
	return "…" + string(runes[len(runes)-(maxRunes-1):])
}

func formatMicError(err error) string {
	switch {
	case errors.Is(err, microphone.ErrDenied):
		return "未授予麦克风权限，请在系统设置中允许录音后重试"
	case errors.Is(err, microphone.ErrUnsupported):
		return "当前设备暂不支持原生录音"
	case errors.Is(err, microphone.ErrBusy):
		return "麦克风正被其他应用占用，请稍后重试"
	case errors.Is(err, microphone.ErrUnavailable):
		return "麦克风暂时不可用，请重试"
	default:
		return "启动录音失败：" + err.Error()
	}
}

// finishHoldRecording completes a hold-to-talk gesture upon finger release.
func (vc *voiceController) finishHoldRecording() {
	if vc.stage.GetUntracked() != voiceRecording {
		return
	}
	if vc.cancelZone.GetUntracked() {
		vc.cancelRecording("已取消录音")
		return
	}

	vc.mu.Lock()
	gen := vc.gen
	elapsed := time.Since(vc.recordStart)
	rec := vc.activeRec
	if elapsed < 400*time.Millisecond {
		vc.pendingCancel = true
		vc.mu.Unlock()
		vc.cancelRecording("说话时间太短，请按住多说一点")
		return
	}
	if rec == nil {
		// RecordWAV is still opening (e.g. Android permission prompt or fast release).
		vc.pendingRelease = true
		vc.mu.Unlock()
		return
	}
	vc.activeRec = nil
	liveSess := vc.liveASR
	liveCtx := vc.liveCtx
	vc.liveASR = nil
	vc.liveCtx = nil
	tailStop := vc.tailStop
	tailDone := vc.tailDone
	tailFrameBytes := vc.tailFrameBytes
	vc.tailStop = nil
	vc.tailDone = nil
	if vc.recordTicker != nil {
		vc.recordTicker.Stop()
		vc.recordTicker = nil
	}
	var (
		ctx    context.Context
		cancel context.CancelFunc
	)
	if liveSess != nil && liveCtx != nil && vc.activeCancel != nil {
		// Keep the live ASR context running through tail grace + Flush + Finish;
		// abortAll() still cancels it if the user taps Cancel mid-transcribe/parse.
		ctx = liveCtx
		cancel = vc.activeCancel
	} else {
		if vc.activeCancel != nil {
			vc.activeCancel()
		}
		ctx, cancel = context.WithCancel(vc.state.ctx)
		vc.activeCancel = cancel
	}
	vc.mu.Unlock()

	doubaoCfg := vc.state.doubaoConfig.GetUntracked()
	aiCfg := vc.state.aiConfig.GetUntracked()
	cats := append([]api.Category(nil), vc.state.viewCache.GetUntracked().Categories...)
	client := vc.state.client
	loc := vc.state.location()

	vc.cx.PlayHaptic(core.HapticLight)
	vc.cx.Batch(func() {
		vc.stage.Set(voiceTranscribing)
		vc.cancelZone.Set(false)
		vc.errorMsg.Set("")
	})

	go func() {
		defer cancel()
		// Brief mic tail grace period (~250ms) before stopping AudioRecord so the
		// user's final syllable finishes flushing out of Android's audio pipeline
		// into the recording file (while tailRecordingFile keeps streaming it live).
		if ctx.Err() == nil {
			tailGrace := time.NewTimer(250 * time.Millisecond)
			select {
			case <-tailGrace.C:
			case <-ctx.Done():
				tailGrace.Stop()
			}
		}
		if tailStop != nil {
			close(tailStop)
		}
		if tailDone != nil {
			<-tailDone
		}
		rec.Stop()
		wavPath := rec.File().Path
		defer func() {
			if wavPath != "" {
				_ = os.Remove(wavPath)
			}
		}()

		onPartial := func(partial string) {
			vc.cx.Post(func() {
				vc.mu.Lock()
				alive := vc.gen == gen
				vc.mu.Unlock()
				if alive {
					vc.transcript.Set(partial)
				}
			})
		}

		var (
			transcript string
			err        error
		)
		if liveSess != nil {
			// FinishWatcher aborts liveSess if finishHoldRecording's ctx is cancelled.
			stopWatch := make(chan struct{})
			go func() {
				select {
				case <-ctx.Done():
					liveSess.Abort()
				case <-stopWatch:
				}
			}()

			vc.mu.Lock()
			finalOff := vc.tailOffset
			vc.mu.Unlock()
			if finalOff < 44 {
				finalOff = 44
			}
			if tailFrameBytes <= 0 {
				tailFrameBytes = 2
			}
			for {
				rem, nextOff := readPCMChunkFromFile(wavPath, finalOff, tailFrameBytes)
				if len(rem) == 0 {
					break
				}
				finalOff = nextOff
				_ = liveSess.PushPCM(rem)
			}
			transcript, err = liveSess.Finish()
			close(stopWatch)

			// If live streaming already produced confirmed text (and wasn't explicitly
			// cancelled), use it directly rather than re-transcribing from scratch.
			if err != nil && ctx.Err() == nil && strings.TrimSpace(transcript) != "" {
				transcript = strings.TrimSpace(transcript)
				err = nil
			}
			// Only fall back to full-file WAV transcription when live streaming
			// yielded no transcript at all (e.g. failed to dial while holding).
			if err != nil && strings.TrimSpace(transcript) == "" && ctx.Err() == nil && wavPath != "" {
				if fbText, fbErr := voice.TranscribeWAVFile(ctx, doubaoCfg, wavPath, onPartial); fbErr == nil {
					transcript, err = fbText, nil
				}
			}
		} else {
			transcript, err = voice.TranscribeWAVFile(ctx, doubaoCfg, wavPath, onPartial)
		}
		if err != nil {
			vc.failStage(gen, "豆包语音识别失败："+err.Error())
			return
		}

		vc.cx.Post(func() {
			vc.mu.Lock()
			alive := vc.gen == gen
			vc.mu.Unlock()
			if alive {
				vc.transcript.Set(transcript)
				vc.stage.Set(voiceParsing)
			}
		})

		vc.runLLMParse(ctx, gen, transcript, aiCfg, client, cats, loc)
	}()
}

func (vc *voiceController) cancelRecording(notice string) {
	vc.abortAll()
	vc.cx.PlayHaptic(core.HapticLight)
	vc.cx.Batch(func() {
		vc.stage.Set(voiceIdle)
		vc.cancelZone.Set(false)
		vc.elapsedMs.Set(0)
		vc.audioLevel.Set(0)
	})
	if notice != "" {
		vc.state.ToastInfo(notice)
	}
}

// reparseTranscript re-runs LLM parsing on the (optionally user-edited) transcript.
func (vc *voiceController) reparseTranscript() {
	text := strings.TrimSpace(vc.transcript.GetUntracked())
	if text == "" {
		vc.state.ToastError("语音文本不能为空")
		return
	}
	vc.abortAll()
	vc.mu.Lock()
	vc.gen++
	gen := vc.gen
	ctx, cancel := context.WithCancel(vc.state.ctx)
	vc.activeCancel = cancel
	vc.mu.Unlock()

	aiCfg := vc.state.aiConfig.GetUntracked()
	cats := append([]api.Category(nil), vc.state.viewCache.GetUntracked().Categories...)
	client := vc.state.client
	loc := vc.state.location()

	vc.cx.Batch(func() {
		vc.stage.Set(voiceParsing)
		vc.errorMsg.Set("")
	})

	go func() {
		defer cancel()
		vc.runLLMParse(ctx, gen, text, aiCfg, client, cats, loc)
	}()
}

func (vc *voiceController) runLLMParse(
	ctx context.Context,
	gen uint64,
	transcript string,
	aiCfg api.AIConfig,
	client *api.Client,
	cats []api.Category,
	loc *time.Location,
) {
	// If AI config wasn't synced yet, pull /api/ai/config on demand before failing.
	if !aiCfg.Ready() && client != nil {
		if fetched, ok, err := client.GetAIConfig(ctx); err == nil && ok {
			aiCfg = fetched
			vc.cx.Post(func() {
				vc.state.aiConfig.Set(fetched)
				vc.state.aiConfigured.Set(true)
			})
		}
	}
	if !aiCfg.Ready() {
		vc.failStage(gen, "尚未配置大模型，请前往「语音与 AI 设置」同步或填写 API Key 与 Model ID")
		return
	}

	parsed, err := voice.ParseTasksWithLLM(ctx, aiCfg, transcript, cats, time.Now(), loc)
	if err != nil {
		vc.failStage(gen, "大模型解析失败："+err.Error())
		return
	}

	vc.cx.Post(func() {
		vc.mu.Lock()
		alive := vc.gen == gen
		vc.mu.Unlock()
		if !alive {
			return
		}
		drafts := make([]*voiceTaskDraft, 0, len(parsed))
		for i, p := range parsed {
			var stCopy, etCopy, ddCopy, recEndCopy *time.Time
			if p.StartTime != nil {
				t := *p.StartTime
				stCopy = &t
			}
			if p.EndTime != nil {
				t := *p.EndTime
				etCopy = &t
			}
			if p.DueDate != nil {
				t := *p.DueDate
				ddCopy = &t
			}
			if p.RecurrenceEndDate != nil {
				t := *p.RecurrenceEndDate
				recEndCopy = &t
			}
			var ruleCopy *voice.RecurrenceRule
			if p.RecurrenceRule != nil {
				r := *p.RecurrenceRule
				ruleCopy = &r
			}
			drafts = append(drafts, &voiceTaskDraft{
				id:                i + 1,
				included:          core.NewSignal(vc.cx, true),
				title:             core.NewSignal(vc.cx, p.Title),
				description:       core.NewSignal(vc.cx, p.Description),
				priority:          core.NewSignal(vc.cx, p.Priority),
				allDay:            core.NewSignal(vc.cx, p.AllDay),
				startTime:         core.NewSignalFunc(vc.cx, stCopy, nil),
				endTime:           core.NewSignalFunc(vc.cx, etCopy, nil),
				dueDate:           core.NewSignalFunc(vc.cx, ddCopy, nil),
				categoryIDs:       core.NewSignalFunc(vc.cx, append([]int64(nil), p.CategoryIDs...), nil),
				recurrenceRule:    core.NewSignalFunc(vc.cx, ruleCopy, nil),
				recurrenceEndDate: core.NewSignalFunc(vc.cx, recEndCopy, nil),
			})
		}
		vc.cx.PlayHaptic(core.HapticSuccess)
		vc.cx.Batch(func() {
			vc.drafts.Set(drafts)
			vc.stage.Set(voicePreview)
			vc.errorMsg.Set("")
		})
	})
}

func (vc *voiceController) failStage(gen uint64, msg string) {
	vc.cx.Post(func() {
		vc.mu.Lock()
		alive := vc.gen == gen
		vc.mu.Unlock()
		if !alive {
			return
		}
		vc.cx.PlayHaptic(core.HapticError)
		vc.cx.Batch(func() {
			vc.errorMsg.Set(msg)
			vc.stage.Set(voiceError)
		})
	})
}

func (vc *voiceController) confirmCreateAll() {
	if vc.creating.GetUntracked() {
		return
	}
	drafts := vc.drafts.GetUntracked()
	created := 0
	for _, d := range drafts {
		if !d.included.GetUntracked() {
			continue
		}
		title := strings.TrimSpace(d.title.GetUntracked())
		if title == "" {
			continue
		}
		parsed := voice.ParsedTask{
			Title:             title,
			Description:       strings.TrimSpace(d.description.GetUntracked()),
			Priority:          d.priority.GetUntracked(),
			AllDay:            d.allDay.GetUntracked(),
			StartTime:         d.startTime.GetUntracked(),
			EndTime:           d.endTime.GetUntracked(),
			DueDate:           d.dueDate.GetUntracked(),
			CategoryIDs:       d.categoryIDs.GetUntracked(),
			RecurrenceRule:    d.recurrenceRule.GetUntracked(),
			RecurrenceEndDate: d.recurrenceEndDate.GetUntracked(),
		}
		if _, err := vc.state.CreateTaskFromParsed(parsed, false); err == nil {
			created++
		}
	}
	if created == 0 {
		vc.state.ToastError("请至少勾选一项有效任务")
		return
	}
	vc.dismiss()
	if created == 1 {
		vc.state.ToastSuccess("已创建语音任务")
	} else {
		vc.state.ToastSuccess(fmt.Sprintf("已创建 %d 项语音任务", created))
	}
}

// --- Voice HUD Overlay (Recording Animation + Transcribing + Parsing + Error) ---

func voiceOverlayView(cx *core.Scope, vc *voiceController, openManualWithText func(string)) core.Node {
	colors := ui.ColorsOf(cx)

	return core.Group([]core.Node{
		// Stage 1: Live WeChat-style Recording HUD
		// CRITICAL: PointerEventsNone ensures the user's held finger on the '+' FAB
		// stays the active touch responder and can slide up to cancel seamlessly!
		core.Show{
			When: func() bool { return vc.stage.Get() == voiceRecording },
			Then: func(cx *core.Scope) core.Node {
				return core.View{
					TestID:        "voice-recording-hud",
					PointerEvents: core.PointerEventsNone,
					Style: core.Style{
						Position:       core.Absolute,
						Top:            core.Pt(0),
						Right:          core.Pt(0),
						Bottom:         core.Pt(0),
						Left:           core.Pt(0),
						AlignItems:     core.AlignCenter,
						JustifyContent: core.JustifyCenter,
						Padding:        core.Symmetric(28, 24),
					},
					StyleFunc: func() core.Style {
						bg := core.RGBA(0x1C1917, 0.72)
						if vc.cancelZone.Get() {
							bg = core.RGBA(0x3B1612, 0.78)
						}
						return core.Style{Background: bg}
					},
					Children: []core.Node{
						voiceRecordingCard(cx, vc),
					},
				}
			},
		},

		// Stage 2 & 3: Interactive Transcribing / LLM Parsing / Error Overlay
		core.Show{
			When: func() bool {
				st := vc.stage.Get()
				return st == voiceTranscribing || st == voiceParsing || st == voiceError
			},
			Then: func(cx *core.Scope) core.Node {
				return core.View{
					TestID: "voice-hud-overlay",
					Style: core.Style{
						Position:       core.Absolute,
						Top:            core.Pt(0),
						Right:          core.Pt(0),
						Bottom:         core.Pt(0),
						Left:           core.Pt(0),
						AlignItems:     core.AlignCenter,
						JustifyContent: core.JustifyCenter,
						Padding:        core.Symmetric(28, 24),
						Background:     core.RGBA(0x1C1917, 0.68),
					},
					Children: []core.Node{
						core.Show{
							When: func() bool {
								st := vc.stage.Get()
								return st == voiceTranscribing || st == voiceParsing
							},
							Then: func(cx *core.Scope) core.Node {
								return voiceProcessingCard(cx, vc, colors)
							},
						},
						core.Show{
							When: func() bool { return vc.stage.Get() == voiceError },
							Then: func(cx *core.Scope) core.Node {
								return voiceErrorCard(cx, vc, colors, openManualWithText)
							},
						},
					},
				}
			},
		},
	})
}

func voiceRecordingCard(cx *core.Scope, vc *voiceController) core.Node {
	colors := ui.ColorsOf(cx)
	return core.View{
		Style: core.Style{
			Width:        core.Pct(100),
			MaxWidth:     core.Pt(332),
			CornerRadius: 24,
			Padding:      core.Edges{Top: 28, Right: 22, Bottom: 24, Left: 22},
			AlignItems:   core.AlignCenter,
			Gap:          16,
			BorderWidth:  1,
		},
		StyleFunc: func() core.Style {
			if vc.cancelZone.Get() {
				return core.Style{
					Background:  colors.Surface(),
					BorderColor: colors.Danger(),
				}
			}
			return core.Style{
				Background:  colors.Surface(),
				BorderColor: ui.Alpha(colors.AccentFill(), 0.45),
			}
		},
		Children: []core.Node{
			// Top Pulsing Concentric Mic Halo + Live Waveform Canvas
			core.View{
				Style: core.Style{
					Width:          core.Pt(112),
					Height:         core.Pt(112),
					AlignItems:     core.AlignCenter,
					JustifyContent: core.JustifyCenter,
				},
				Children: []core.Node{
					core.Canvas{
						Style: core.Style{
							Position: core.Absolute,
							Top:      core.Pt(0),
							Left:     core.Pt(0),
							Width:    core.Pt(112),
							Height:   core.Pt(112),
						},
						Draw: func(d *core.Drawing, size core.Size) {
							level := vc.audioLevel.Get()
							phase := vc.wavePhase.Get()
							cancel := vc.cancelZone.Get()

							baseColor := colors.AccentFill()
							if cancel {
								baseColor = colors.Danger()
							}
							cxPt, cyPt := float32(size.Width)/2, float32(size.Height)/2
							pulse1 := 0.5 + 0.5*math.Sin(phase*0.85)
							pulse2 := 0.5 + 0.5*math.Cos(phase*0.65)

							rOuter := float32(38 + level*15 + pulse1*5)
							rMid := float32(31 + level*10 + pulse2*3)
							d.BeginPath().Arc(cxPt, cyPt, rOuter, 0, 2*math.Pi, false).SetFillColor(ui.Alpha(baseColor, float32(0.11+level*0.10))).Fill()
							d.BeginPath().Arc(cxPt, cyPt, rMid, 0, 2*math.Pi, false).SetFillColor(ui.Alpha(baseColor, float32(0.22+level*0.12))).Fill()
							d.BeginPath().Arc(cxPt, cyPt, 27, 0, 2*math.Pi, false).SetFillColor(baseColor).Fill()
						},
					},
					core.Show{
						When: vc.cancelZone.Get,
						Then: func(*core.Scope) core.Node {
							return ui.Icon(lucide.X, 26, ui.Fixed(core.RGB(0xFFFFFF)))
						},
						Else: func(*core.Scope) core.Node {
							return ui.Icon(lucide.Mic, 26, ui.Fixed(core.RGB(0xFFFFFF)))
						},
					},
				},
			},

			// Elapsed duration & Status Title
			core.View{
				Style: core.Style{AlignItems: core.AlignCenter, Gap: 4},
				Children: []core.Node{
					core.Text{
						ContentFunc: func() string {
							if vc.cancelZone.Get() {
								return "松手取消录音"
							}
							sec := vc.elapsedMs.Get() / 1000
							return fmt.Sprintf("正在聆听 · %02d:%02d", sec/60, sec%60)
						},
						Style: core.Style{FontSize: 17, FontWeight: ui.Semibold},
						StyleFunc: func() core.Style {
							if vc.cancelZone.Get() {
								return core.Style{Color: colors.Danger()}
							}
							return core.Style{Color: colors.Text()}
						},
					},
					core.Text{
						ContentFunc: func() string {
							if vc.cancelZone.Get() {
								return "向下滑回可继续说话"
							}
							return "可说分类、时间、是否重复和任务细节"
						},
						Style:     core.Style{FontSize: 12.5, TextAlign: core.TextAlignCenter},
						StyleFunc: ui.Colored(colors.Muted),
					},
				},
			},

			// Live 15-bar Symmetric Voice Waveform Canvas
			core.Canvas{
				Style: core.Style{
					Width:  core.Pt(256),
					Height: core.Pt(56),
				},
				Draw: func(d *core.Drawing, size core.Size) {
					bars := vc.waveBars.Get()
					cancel := vc.cancelZone.Get()
					primary := colors.AccentFill()
					warmGold := colors.Warn()
					if cancel {
						primary = colors.Danger()
						warmGold = colors.Danger()
					}

					const count = 15
					w, h := float32(size.Width), float32(size.Height)
					barW := float32(7)
					gap := (w - float32(count)*barW) / float32(count-1)
					midY := h / 2
					for i := 0; i < count; i++ {
						amp := bars[i]
						if amp < 0.12 {
							amp = 0.12
						}
						bh := float32(8 + amp*float64(h-12))
						x := float32(i) * (barW + gap)
						y := midY - bh/2
						c := primary
						if !cancel && i%3 == 1 && amp > 0.45 {
							c = warmGold
						}
						if cancel {
							c = ui.Alpha(c, 0.72)
						}
						d.BeginPath().RoundRect(x, y, barW, bh, barW/2).SetFillColor(c).Fill()
					}
				},
			},

			// Live Real-Time Transcript Subtitle Box while holding
			core.Show{
				When: func() bool {
					return !vc.cancelZone.Get() && strings.TrimSpace(vc.transcript.Get()) != ""
				},
				Then: func(*core.Scope) core.Node {
					return core.View{
						Style: core.Style{
							Width:        core.Pct(100),
							Padding:      core.Symmetric(8, 12),
							CornerRadius: 12,
							BorderWidth:  1,
						},
						StyleFunc: func() core.Style {
							return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
						},
						Children: []core.Node{
							core.Text{
								ContentFunc: func() string { return "「" + formatLiveSubtitle(vc.transcript.Get(), 54) + "」" },
								MaxLines:    3,
								Style:       core.Style{FontSize: 13, LineHeight: 18},
								StyleFunc:   ui.Colored(colors.Text),
							},
						},
					}
				},
			},

			// Bottom Action Hint Pill
			core.View{
				Style: core.Style{
					Direction:      core.Row,
					AlignItems:     core.AlignCenter,
					JustifyContent: core.JustifyCenter,
					Gap:            8,
					Padding:        core.Symmetric(8, 16),
					CornerRadius:   999,
				},
				StyleFunc: func() core.Style {
					if vc.cancelZone.Get() {
						return core.Style{Background: ui.Alpha(colors.Danger(), 0.14)}
					}
					return core.Style{Background: ui.TintsOf(cx).Accent()}
				},
				Children: []core.Node{
					core.Show{
						When: vc.cancelZone.Get,
						Then: func(*core.Scope) core.Node {
							return ui.Icon(lucide.Trash, 14, colors.Danger)
						},
						Else: func(*core.Scope) core.Node {
							return ui.Icon(lucide.ArrowUp, 14, colors.Accent)
						},
					},
					core.Text{
						ContentFunc: func() string {
							if vc.cancelZone.Get() {
								return "松开手指即可取消"
							}
							return "松开立即识别 · 上滑取消"
						},
						Style: core.Style{FontSize: 13, FontWeight: ui.Medium},
						StyleFunc: func() core.Style {
							if vc.cancelZone.Get() {
								return core.Style{Color: colors.Danger()}
							}
							return core.Style{Color: colors.Accent()}
						},
					},
				},
			},
		},
	}
}

func voiceProcessingCard(cx *core.Scope, vc *voiceController, colors ui.Colors) core.Node {
	return core.View{
		Style: core.Style{
			Width:        core.Pct(100),
			MaxWidth:     core.Pt(336),
			CornerRadius: 22,
			Padding:      core.All(22),
			AlignItems:   core.AlignCenter,
			Gap:          14,
			BorderWidth:  1,
		},
		StyleFunc: func() core.Style { return cardStyle(cx) },
		Children: []core.Node{
			core.View{
				Style: core.Style{
					Width:          core.Pt(56),
					Height:         core.Pt(56),
					CornerRadius:   28,
					AlignItems:     core.AlignCenter,
					JustifyContent: core.JustifyCenter,
				},
				StyleFunc: func() core.Style { return core.Style{Background: ui.TintsOf(cx).Accent()} },
				Children: []core.Node{
					spinningIcon(cx, lucide.RefreshCw, 24, colors.Accent, func() bool {
						st := vc.stage.Get()
						return st == voiceTranscribing || st == voiceParsing
					}),
				},
			},

			core.Text{
				ContentFunc: func() string {
					if vc.stage.Get() == voiceTranscribing {
						if strings.TrimSpace(vc.transcript.Get()) != "" {
							return "正在确认语音终稿…"
						}
						return "豆包语音转写中…"
					}
					return "大模型正在解析任务…"
				},
				Style:     core.Style{FontSize: 16.5, FontWeight: ui.Semibold},
				StyleFunc: ui.Colored(colors.Text),
			},

			// Step progress indicator
			core.View{
				Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 8},
				Children: []core.Node{
					core.Text{
						Content: "1. 语音转文字",
						Style:   core.Style{FontSize: 12, FontWeight: ui.Medium},
						StyleFunc: func() core.Style {
							if vc.stage.Get() == voiceTranscribing {
								return core.Style{Color: colors.Accent()}
							}
							return core.Style{Color: colors.Up()}
						},
					},
					core.Text{
						Content:   "→",
						Style:     core.Style{FontSize: 12},
						StyleFunc: ui.Colored(colors.Faint),
					},
					core.Text{
						Content: "2. AI 拆解任务",
						Style:   core.Style{FontSize: 12, FontWeight: ui.Medium},
						StyleFunc: func() core.Style {
							if vc.stage.Get() == voiceParsing {
								return core.Style{Color: colors.Accent()}
							}
							return core.Style{Color: colors.Faint()}
						},
					},
				},
			},

			// Live transcript quote preview
			core.Show{
				When: func() bool { return strings.TrimSpace(vc.transcript.Get()) != "" },
				Then: func(*core.Scope) core.Node {
					return core.View{
						Style: core.Style{
							Width:        core.Pct(100),
							Padding:      core.Symmetric(10, 12),
							CornerRadius: 12,
							BorderWidth:  1,
						},
						StyleFunc: func() core.Style {
							return core.Style{
								Background:  colors.Inset(),
								BorderColor: colors.Line(),
							}
						},
						Children: []core.Node{
							core.Text{
								ContentFunc: func() string { return "「" + vc.transcript.Get() + "」" },
								Style:       core.Style{FontSize: 13.5, LineHeight: 20},
								StyleFunc:   ui.Colored(colors.Text),
							},
						},
					}
				},
			},

			ui.Button{
				Text:    "取消",
				Variant: ui.ButtonOutline,
				Size:    ui.SizeSmall,
				OnPress: vc.dismiss,
				Style:   core.Style{Margin: core.Edges{Top: 2}, CornerRadius: 10},
			},
		},
	}
}

func voiceErrorCard(cx *core.Scope, vc *voiceController, colors ui.Colors, openManualWithText func(string)) core.Node {
	return core.View{
		Style: core.Style{
			Width:        core.Pct(100),
			MaxWidth:     core.Pt(344),
			CornerRadius: 20,
			Padding:      core.All(20),
			Gap:          14,
			BorderWidth:  1,
		},
		StyleFunc: func() core.Style { return cardStyle(cx) },
		Children: []core.Node{
			core.View{
				Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 10},
				Children: []core.Node{
					ui.Icon(lucide.MicOff, 20, colors.Danger),
					core.Text{
						Content:   "语音创建遇到问题",
						Style:     core.Style{FontSize: 16, FontWeight: ui.Semibold},
						StyleFunc: ui.Colored(colors.Text),
					},
				},
			},
			core.Text{
				ContentFunc: vc.errorMsg.Get,
				Style:       core.Style{FontSize: 13.5, LineHeight: 20},
				StyleFunc:   ui.Colored(colors.Muted),
			},
			core.Show{
				When: func() bool { return strings.TrimSpace(vc.transcript.Get()) != "" },
				Then: func(*core.Scope) core.Node {
					return core.View{
						Style: core.Style{
							Padding:      core.Symmetric(10, 12),
							CornerRadius: 12,
							BorderWidth:  1,
							Gap:          4,
						},
						StyleFunc: func() core.Style {
							return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
						},
						Children: []core.Node{
							core.Text{
								Content:   "已识别语音原文",
								Style:     core.Style{FontSize: 11.5, FontWeight: ui.Medium},
								StyleFunc: ui.Colored(colors.Muted),
							},
							core.Text{
								ContentFunc: vc.transcript.Get,
								Style:       core.Style{FontSize: 13.5, LineHeight: 20},
								StyleFunc:   ui.Colored(colors.Text),
							},
						},
					}
				},
			},
			core.View{
				Style: core.Style{Direction: core.Row, Wrap: core.Wrap, Gap: 8, JustifyContent: core.JustifyEnd},
				Children: []core.Node{
					ui.Button{
						Text:    "关闭",
						Variant: ui.ButtonOutline,
						Size:    ui.SizeSmall,
						OnPress: vc.dismiss,
						Style:   core.Style{CornerRadius: 10},
					},
					ui.Button{
						Text:    "语音与 AI 设置",
						Variant: ui.ButtonOutline,
						Size:    ui.SizeSmall,
						OnPress: func() {
							vc.dismiss()
							vc.state.voiceSettingsOpen.Set(true)
						},
						Style: core.Style{CornerRadius: 10},
					},
					core.Show{
						When: func() bool { return strings.TrimSpace(vc.transcript.Get()) != "" },
						Then: func(*core.Scope) core.Node {
							return ui.Button{
								Text:    "手动新建",
								Variant: ui.ButtonOutline,
								Size:    ui.SizeSmall,
								OnPress: func() {
									text := vc.transcript.GetUntracked()
									vc.dismiss()
									openManualWithText(text)
								},
								Style: core.Style{CornerRadius: 10},
							}
						},
					},
					core.Show{
						When: func() bool { return strings.TrimSpace(vc.transcript.Get()) != "" },
						Then: func(*core.Scope) core.Node {
							return ui.Button{
								Text:    "重试 AI 解析",
								Variant: ui.ButtonPrimary,
								Size:    ui.SizeSmall,
								OnPress: vc.reparseTranscript,
								Style:   core.Style{CornerRadius: 10},
							}
						},
					},
				},
			},
		},
	}
}

// --- Task Preview Confirmation Sheet ---

func voicePreviewSheet(cx *core.Scope, vc *voiceController) core.Node {
	colors := ui.ColorsOf(cx)
	loc := vc.state.location()

	formatPreviewSchedule := func(d *voiceTaskDraft) string {
		st := d.startTime.Get()
		et := d.endTime.Get()
		dd := d.dueDate.Get()
		allDay := d.allDay.Get()

		if st != nil && et != nil && !allDay {
			sLoc, eLoc := st.In(loc), et.In(loc)
			if sLoc.Format("2006-01-02") == eLoc.Format("2006-01-02") {
				return fmt.Sprintf("%s %s ~ %s", formatRelativeDay(sLoc, time.Now().In(loc)), sLoc.Format("15:04"), eLoc.Format("15:04"))
			}
			return fmt.Sprintf("%s ~ %s", sLoc.Format("01月02日 15:04"), eLoc.Format("01月02日 15:04"))
		}
		if st != nil {
			sLoc := st.In(loc)
			if allDay {
				return formatRelativeDay(sLoc, time.Now().In(loc)) + " · 全天"
			}
			return formatRelativeDay(sLoc, time.Now().In(loc)) + " " + sLoc.Format("15:04")
		}
		if dd != nil {
			dLoc := dd.In(loc)
			if allDay {
				return formatRelativeDay(dLoc, time.Now().In(loc)) + " · 全天"
			}
			return formatRelativeDay(dLoc, time.Now().In(loc)) + " " + dLoc.Format("15:04") + " 截止"
		}
		return "未设定时间"
	}

	return ui.Sheet{
		Open: func() bool { return vc.stage.Get() == voicePreview },
		OnClose: func() {
			if vc.stage.GetUntracked() == voicePreview {
				vc.dismiss()
			}
		},
		Children: []core.Node{
			core.View{
				TestID: "voice-preview-sheet",
				Style:  core.Style{Gap: 14, Padding: core.Edges{Top: 4, Bottom: 12}},
				Children: []core.Node{
					core.Text{
						Content:   "语音任务预览",
						Style:     core.Style{FontSize: 16.5, FontWeight: ui.Semibold},
						StyleFunc: ui.Colored(colors.Text),
					},
					// Editable Transcript Box + Re-parse trigger
					core.View{
						Style: core.Style{
							Padding:      core.All(12),
							CornerRadius: 12,
							BorderWidth:  1,
							Gap:          8,
						},
						StyleFunc: func() core.Style {
							return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
						},
						Children: []core.Node{
							core.View{
								Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, JustifyContent: core.JustifySpaceBetween, Gap: 8},
								Children: []core.Node{
									core.View{
										Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 6},
										Children: []core.Node{
											ui.Icon(lucide.AudioLines, 14, colors.Accent),
											core.Text{
												Content:   "语音转写原文（可修改后重新解析）",
												Style:     core.Style{FontSize: 12, FontWeight: ui.Medium},
												StyleFunc: ui.Colored(colors.Muted),
											},
										},
									},
									base.Button{
										Label:   "重新解析",
										OnPress: func(core.PressEvent) { vc.reparseTranscript() },
										Style: core.Style{
											Direction:    core.Row,
											AlignItems:   core.AlignCenter,
											Gap:          4,
											Padding:      core.Symmetric(4, 9),
											CornerRadius: 999,
										},
										StyleFunc: func() core.Style { return core.Style{Background: ui.TintsOf(cx).Accent()} },
										Children: []core.Node{
											ui.Icon(lucide.RefreshCw, 12, colors.Accent),
											core.Text{
												Content:   "重解析",
												Style:     core.Style{FontSize: 11.5, FontWeight: ui.Medium},
												StyleFunc: ui.Colored(colors.Accent),
											},
										},
									},
								},
							},
							ui.Input{
								Value:       vc.transcript.Get,
								OnChange:    vc.transcript.Set,
								Multiline:   true,
								Placeholder: "语音识别内容…",
								Style:       core.Style{MinHeight: core.Pt(44), FontSize: 13.5},
							},
						},
					},

					// Scrollable Parsed Task Cards
					smoothScroll(core.Scroll{
						Style: core.Style{MaxHeight: core.Pt(400)},
						Children: []core.Node{
							core.View{
								Style: core.Style{Gap: 12},
								Children: []core.Node{
									core.Each(
										vc.drafts.Get,
										func(d *voiceTaskDraft) int { return d.id },
										func(cx *core.Scope, item func() *voiceTaskDraft, _ func() int) core.Node {
											d := item()
											return core.View{
												Style: core.Style{
													CornerRadius: 14,
													Padding:      core.All(14),
													Gap:          12,
													BorderWidth:  1,
												},
												StyleFunc: func() core.Style {
													s := cardStyle(cx)
													if !d.included.Get() {
														s.Opacity = core.Alpha(0.48)
													}
													return s
												},
												Children: []core.Node{
													// Header row: Include toggle (if >1) + Editable Title
													core.View{
														Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 8},
														Children: []core.Node{
															core.Show{
																When: func() bool { return len(vc.drafts.Get()) > 1 },
																Then: func(*core.Scope) core.Node {
																	return base.Button{
																		Label:   "选择创建此任务",
																		OnPress: func(core.PressEvent) { d.included.Set(!d.included.GetUntracked()) },
																		Style: core.Style{
																			Width:          core.Pt(24),
																			Height:         core.Pt(24),
																			CornerRadius:   12,
																			BorderWidth:    1.8,
																			AlignItems:     core.AlignCenter,
																			JustifyContent: core.JustifyCenter,
																		},
																		StyleFunc: func() core.Style {
																			if d.included.Get() {
																				return core.Style{Background: colors.AccentFill(), BorderColor: colors.AccentFill()}
																			}
																			return core.Style{Background: core.Transparent, BorderColor: colors.Border()}
																		},
																		Children: []core.Node{
																			core.Show{
																				When: d.included.Get,
																				Then: func(*core.Scope) core.Node {
																					return ui.Icon(lucide.Check, 13, colors.OnAccent)
																				},
																			},
																		},
																	}
																},
															},
															core.View{
																Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0)},
																Children: []core.Node{
																	ui.Input{
																		Value:       d.title.Get,
																		OnChange:    d.title.Set,
																		Placeholder: "任务标题",
																		Style:       core.Style{Height: core.Pt(40), FontSize: 15.5, FontWeight: ui.Semibold},
																	},
																},
															},
														},
													},

													// Schedule & Recurrence Summary Badges
													core.View{
														Style: core.Style{Direction: core.Row, Wrap: core.Wrap, AlignItems: core.AlignCenter, Gap: 8},
														Children: []core.Node{
															// Time badge
															core.View{
																Style: core.Style{
																	Direction:    core.Row,
																	AlignItems:   core.AlignCenter,
																	Gap:          5,
																	Padding:      core.Symmetric(5, 10),
																	CornerRadius: 999,
																	BorderWidth:  1,
																},
																StyleFunc: func() core.Style {
																	if d.startTime.Get() != nil || d.dueDate.Get() != nil {
																		return core.Style{Background: ui.TintsOf(cx).Accent(), BorderColor: ui.Alpha(colors.Accent(), 0.25)}
																	}
																	return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
																},
																Children: []core.Node{
																	ui.Icon(lucide.Calendar, 13, func() core.Color {
																		if d.startTime.Get() != nil || d.dueDate.Get() != nil {
																			return colors.Accent()
																		}
																		return colors.Muted()
																	}),
																	core.Text{
																		ContentFunc: func() string { return formatPreviewSchedule(d) },
																		Style:       core.Style{FontSize: 12.5, FontWeight: ui.Medium},
																		StyleFunc: func() core.Style {
																			if d.startTime.Get() != nil || d.dueDate.Get() != nil {
																				return core.Style{Color: colors.Accent()}
																			}
																			return core.Style{Color: colors.Muted()}
																		},
																	},
																},
															},
															// Clear time button if any time is set
															core.Show{
																When: func() bool { return d.startTime.Get() != nil || d.dueDate.Get() != nil },
																Then: func(*core.Scope) core.Node {
																	return base.Button{
																		Label: "清除时间",
																		OnPress: func(core.PressEvent) {
																			d.startTime.Set(nil)
																			d.endTime.Set(nil)
																			d.dueDate.Set(nil)
																			d.allDay.Set(false)
																		},
																		Style:     core.Style{Padding: core.Symmetric(4, 8), CornerRadius: 999},
																		StyleFunc: func() core.Style { return core.Style{Background: colors.Inset()} },
																		Children: []core.Node{
																			core.Text{Content: "清除时间", Style: core.Style{FontSize: 11.5}, StyleFunc: ui.Colored(colors.Muted)},
																		},
																	}
																},
															},
															// Recurrence pill if recurring
															core.Show{
																When: func() bool { return d.recurrenceRule.Get().Valid() },
																Then: func(*core.Scope) core.Node {
																	return core.View{
																		Style: core.Style{
																			Direction:    core.Row,
																			AlignItems:   core.AlignCenter,
																			Gap:          5,
																			Padding:      core.Symmetric(5, 10),
																			CornerRadius: 999,
																			BorderWidth:  1,
																		},
																		StyleFunc: func() core.Style {
																			return core.Style{Background: ui.TintsOf(cx).Up(), BorderColor: ui.Alpha(colors.Up(), 0.25)}
																		},
																		Children: []core.Node{
																			core.Text{
																				ContentFunc: func() string {
																					return "↻ " + voice.RecurrenceSummary(d.recurrenceRule.Get(), d.recurrenceEndDate.Get(), loc)
																				},
																				Style:     core.Style{FontSize: 12.5, FontWeight: ui.Medium},
																				StyleFunc: ui.Colored(colors.Up),
																			},
																			base.Button{
																				Label: "取消重复",
																				OnPress: func(core.PressEvent) {
																					d.recurrenceRule.Set(nil)
																					d.recurrenceEndDate.Set(nil)
																				},
																				Style: core.Style{Padding: core.All(2)},
																				Children: []core.Node{
																					ui.Icon(lucide.X, 12, colors.Up),
																				},
																			},
																		},
																	}
																},
															},
														},
													},

													// Priority Selector Chips
													core.View{
														Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 6},
														Children: func() []core.Node {
															nodes := []core.Node{
																core.Text{
																	Content:   "优先级",
																	Style:     core.Style{FontSize: 12, FontWeight: ui.Medium, Margin: core.Edges{Right: 2}},
																	StyleFunc: ui.Colored(colors.Muted),
																},
															}
															for _, p := range []int{0, 1, 2, 3} {
																prio := p
																active := func() bool { return d.priority.Get() == prio }
																nodes = append(nodes, base.Button{
																	Label: "优先级 " + domain.PriorityLabel(prio),
																	OnPress: func(core.PressEvent) {
																		d.priority.Set(prio)
																		cx.PlayHaptic(core.HapticSelection)
																	},
																	Style: core.Style{
																		Direction:    core.Row,
																		AlignItems:   core.AlignCenter,
																		Gap:          4,
																		Padding:      core.Symmetric(4, 10),
																		CornerRadius: 999,
																		BorderWidth:  1,
																	},
																	StyleFunc: func() core.Style {
																		if active() {
																			return core.Style{Background: colors.AccentFill(), BorderColor: colors.AccentFill()}
																		}
																		return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
																	},
																	Children: []core.Node{
																		core.View{
																			Style: core.Style{Width: core.Pt(6), Height: core.Pt(6), CornerRadius: 3},
																			StyleFunc: func() core.Style {
																				if active() {
																					return core.Style{Background: colors.OnAccent()}
																				}
																				return core.Style{Background: priorityColor(cx, prio)}
																			},
																		},
																		core.Text{
																			Content: domain.PriorityLabel(prio),
																			Style:   core.Style{FontSize: 12, FontWeight: ui.Medium},
																			StyleFunc: func() core.Style {
																				if active() {
																					return core.Style{Color: colors.OnAccent()}
																				}
																				return core.Style{Color: colors.Text()}
																			},
																		},
																	},
																})
															}
															return nodes
														}(),
													},

													// Category Multi-Select Chips
													core.Show{
														When: func() bool { return len(vc.state.viewCache.Get().Categories) > 0 },
														Then: func(*core.Scope) core.Node {
															return core.View{
																Style: core.Style{Direction: core.Row, Wrap: core.Wrap, AlignItems: core.AlignCenter, Gap: 6},
																Children: []core.Node{
																	core.Text{
																		Content:   "分类",
																		Style:     core.Style{FontSize: 12, FontWeight: ui.Medium, Margin: core.Edges{Right: 2}},
																		StyleFunc: ui.Colored(colors.Muted),
																	},
																	core.Each(
																		func() []api.Category { return vc.state.viewCache.Get().Categories },
																		func(c api.Category) int64 { return c.ID },
																		func(cx *core.Scope, cat func() api.Category, _ func() int) core.Node {
																			selected := func() bool { return slices.Contains(d.categoryIDs.Get(), cat().ID) }
																			return base.Button{
																				LabelFunc: func() string { return "分类 " + cat().Name },
																				OnPress: func(core.PressEvent) {
																					id := cat().ID
																					cur := append([]int64(nil), d.categoryIDs.GetUntracked()...)
																					if idx := slices.Index(cur, id); idx >= 0 {
																						cur = append(cur[:idx], cur[idx+1:]...)
																					} else {
																						cur = append(cur, id)
																					}
																					d.categoryIDs.Set(cur)
																					cx.PlayHaptic(core.HapticSelection)
																				},
																				Style: core.Style{
																					Direction:    core.Row,
																					AlignItems:   core.AlignCenter,
																					Gap:          4,
																					Padding:      core.Symmetric(4, 10),
																					CornerRadius: 999,
																					BorderWidth:  1,
																				},
																				StyleFunc: func() core.Style {
																					if selected() {
																						return core.Style{Background: ui.TintsOf(cx).Accent(), BorderColor: colors.Accent()}
																					}
																					return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
																				},
																				Children: []core.Node{
																					core.Text{
																						ContentFunc: func() string {
																							c := cat()
																							if c.Emoji != "" {
																								return c.Emoji + " " + c.Name
																							}
																							return c.Name
																						},
																						Style: core.Style{FontSize: 12, FontWeight: ui.Medium},
																						StyleFunc: func() core.Style {
																							if selected() {
																								return core.Style{Color: colors.Accent()}
																							}
																							return core.Style{Color: colors.Text()}
																						},
																					},
																				},
																			}
																		},
																	),
																},
															}
														},
													},

													// Editable Description / Notes
													ui.Input{
														Value:       d.description.Get,
														OnChange:    d.description.Set,
														Multiline:   true,
														Placeholder: "补充说明 / 备注（可选，支持 Markdown）",
														Style:       core.Style{MinHeight: core.Pt(46), FontSize: 13},
													},
												},
											}
										},
									),
								},
							},
						},
					}),

					// Footer Confirmation Buttons
					core.View{
						Style: core.Style{Direction: core.Row, Gap: 10, Padding: core.Edges{Top: 4}},
						Children: []core.Node{
							ui.Button{
								Text:    "取消",
								Variant: ui.ButtonOutline,
								OnPress: vc.dismiss,
								Style:   core.Style{FlexGrow: 1, Height: core.Pt(44), CornerRadius: 11},
							},
							base.Button{
								Label:   "确认创建",
								TestID:  "voice-preview-confirm",
								OnPress: func(core.PressEvent) { vc.confirmCreateAll() },
								Style: core.Style{
									FlexGrow:       2,
									Height:         core.Pt(44),
									CornerRadius:   11,
									AlignItems:     core.AlignCenter,
									JustifyContent: core.JustifyCenter,
								},
								StyleFunc: ui.Filled(colors.AccentFill),
								Children: []core.Node{
									core.Text{
										ContentFunc: func() string {
											n := 0
											for _, d := range vc.drafts.Get() {
												if d.included.Get() && strings.TrimSpace(d.title.Get()) != "" {
													n++
												}
											}
											if n > 1 {
												return fmt.Sprintf("确认创建 (%d 项)", n)
											}
											return "确认创建"
										},
										Style:     core.Style{FontSize: 15, FontWeight: ui.Semibold},
										StyleFunc: ui.Colored(colors.OnAccent),
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func formatRelativeDay(target, now time.Time) string {
	tDay := time.Date(target.Year(), target.Month(), target.Day(), 0, 0, 0, 0, target.Location())
	nDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	diff := int(math.Round(tDay.Sub(nDay).Hours() / 24))
	switch diff {
	case 0:
		return "今天"
	case 1:
		return "明天"
	case 2:
		return "后天"
	case -1:
		return "昨天"
	default:
		if target.Year() == now.Year() {
			return target.Format("1月2日")
		}
		return target.Format("2006年1月2日")
	}
}

// --- Voice & AI Settings Sheet (Keystore Doubao ASR + Server /api/ai/config) ---

func voiceAISettingsSheet(cx *core.Scope, state *AppState) core.Node {
	colors := ui.ColorsOf(cx)

	appID := core.NewSignal(cx, "")
	appKey := core.NewSignal(cx, "")
	deviceID := core.NewSignal(cx, "")
	host := core.NewSignal(cx, voice.DefaultDoubaoHost)
	path := core.NewSignal(cx, voice.DefaultDoubaoPath)

	aiProto := core.NewSignal(cx, api.AIProtocolOpenAI)
	aiBase := core.NewSignal(cx, api.DefaultAIBaseURL(api.AIProtocolOpenAI))
	aiKey := core.NewSignal(cx, "")
	aiModel := core.NewSignal(cx, "")

	// Populate draft inputs whenever the sheet opens or server config updates.
	cx.Effect(func() {
		if !state.voiceSettingsOpen.Get() {
			return
		}
		dc := state.doubaoConfig.Get()
		appID.Set(dc.AppID)
		appKey.Set(dc.AppKey)
		deviceID.Set(dc.DeviceID)
		host.Set(dc.Host)
		path.Set(dc.Path)

		ac := state.aiConfig.Get().Normalized()
		aiProto.Set(ac.Protocol)
		aiBase.Set(ac.BaseURL)
		aiKey.Set(ac.APIKey)
		aiModel.Set(ac.ModelID)
	})

	return ui.Sheet{
		Open:    state.voiceSettingsOpen.Get,
		OnClose: func() { state.voiceSettingsOpen.Set(false) },
		Children: []core.Node{
			core.View{
				TestID: "voice-ai-settings-sheet",
				Style:  core.Style{Gap: 12},
				Children: []core.Node{
					core.Text{
						Content:   "语音识别与 AI 解析设置",
						Style:     core.Style{FontSize: 16.5, FontWeight: ui.Semibold},
						StyleFunc: ui.Colored(colors.Text),
					},
					smoothScroll(core.Scroll{
						Style: core.Style{MaxHeight: core.Pt(500)},
						Children: []core.Node{
							core.View{
								Style: core.Style{Gap: 16, Padding: core.Edges{Top: 4, Bottom: 16}},
								Children: []core.Node{
									// Section 1: Doubao IME ASR
									core.View{
										Style: core.Style{
											CornerRadius: 14,
											Padding:      core.All(14),
											Gap:          10,
											BorderWidth:  1,
										},
										StyleFunc: func() core.Style { return cardStyle(cx) },
										Children: []core.Node{
											core.View{
												Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, JustifyContent: core.JustifySpaceBetween},
												Children: []core.Node{
													core.View{
														Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 6},
														Children: []core.Node{
															ui.Icon(lucide.Mic, 16, colors.Accent),
															core.Text{
																Content:   "豆包输入法语音识别（ASR）",
																Style:     core.Style{FontSize: 14.5, FontWeight: ui.Semibold},
																StyleFunc: ui.Colored(colors.Text),
															},
														},
													},
													core.Text{
														ContentFunc: func() string {
															if state.doubaoConfig.Get().Ready() {
																return "已配置"
															}
															return "未配置"
														},
														Style: core.Style{FontSize: 12, FontWeight: ui.Medium},
														StyleFunc: func() core.Style {
															if state.doubaoConfig.Get().Ready() {
																return core.Style{Color: colors.Up()}
															}
															return core.Style{Color: colors.Warn()}
														},
													},
												},
											},
											core.Text{
												Content:   "凭据仅加密保存在本机系统 Keystore 中，不上传至第三方。",
												Style:     core.Style{FontSize: 12, LineHeight: 17},
												StyleFunc: ui.Colored(colors.Muted),
											},
											ui.Input{
												Value:       appID.Get,
												OnChange:    appID.Set,
												Placeholder: "ASR_APP_ID（例如 685343）",
												TestID:      "doubao-appid-input",
												Style:       core.Style{Height: core.Pt(40), FontSize: 13.5},
											},
											ui.Input{
												Value:       appKey.Get,
												OnChange:    appKey.Set,
												Masked:      true,
												Placeholder: "ASR_APP_KEY",
												TestID:      "doubao-appkey-input",
												Style:       core.Style{Height: core.Pt(40), FontSize: 13.5},
											},
											ui.Input{
												Value:       deviceID.Get,
												OnChange:    deviceID.Set,
												Placeholder: "ASR_DEVICE_ID（10~24 位数字）",
												TestID:      "doubao-deviceid-input",
												Style:       core.Style{Height: core.Pt(40), FontSize: 13.5},
											},
											core.View{
												Style: core.Style{Direction: core.Row, Gap: 8},
												Children: []core.Node{
													core.View{
														Style: core.Style{FlexGrow: 2, FlexShrink: 1, MinWidth: core.Pt(0)},
														Children: []core.Node{
															ui.Input{
																Value:       host.Get,
																OnChange:    host.Set,
																Placeholder: voice.DefaultDoubaoHost,
																Style:       core.Style{Height: core.Pt(38), FontSize: 12.5},
															},
														},
													},
													core.View{
														Style: core.Style{FlexGrow: 1, FlexShrink: 1, MinWidth: core.Pt(0)},
														Children: []core.Node{
															ui.Input{
																Value:       path.Get,
																OnChange:    path.Set,
																Placeholder: voice.DefaultDoubaoPath,
																Style:       core.Style{Height: core.Pt(38), FontSize: 12.5},
															},
														},
													},
												},
											},
											ui.Button{
												Text:    "加密保存豆包语音配置",
												Variant: ui.ButtonPrimary,
												TestID:  "doubao-save-btn",
												OnPress: func() {
													_ = state.SaveDoubaoConfig(voice.DoubaoConfig{
														AppID:    appID.GetUntracked(),
														AppKey:   appKey.GetUntracked(),
														DeviceID: deviceID.GetUntracked(),
														Host:     host.GetUntracked(),
														Path:     path.GetUntracked(),
														Language: "zh",
													})
												},
												Style: core.Style{Width: core.Pct(100), Height: core.Pt(42), CornerRadius: 10},
											},
										},
									},

									// Section 2: LLM AI Config (synced with todo backend /api/ai/config)
									core.View{
										Style: core.Style{
											CornerRadius: 14,
											Padding:      core.All(14),
											Gap:          10,
											BorderWidth:  1,
										},
										StyleFunc: func() core.Style { return cardStyle(cx) },
										Children: []core.Node{
											core.View{
												Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, JustifyContent: core.JustifySpaceBetween, Gap: 8},
												Children: []core.Node{
													core.View{
														Style: core.Style{Direction: core.Row, AlignItems: core.AlignCenter, Gap: 6},
														Children: []core.Node{
															ui.Icon(lucide.Bot, 16, colors.Accent),
															core.Text{
																Content:   "大模型解析（复用服务端 AI）",
																Style:     core.Style{FontSize: 14.5, FontWeight: ui.Semibold},
																StyleFunc: ui.Colored(colors.Text),
															},
														},
													},
													base.Button{
														Label:   "从服务器同步",
														OnPress: func(core.PressEvent) { state.RefreshAIConfig(true) },
														Style: core.Style{
															Direction:    core.Row,
															AlignItems:   core.AlignCenter,
															Gap:          4,
															Padding:      core.Symmetric(4, 9),
															CornerRadius: 999,
														},
														StyleFunc: func() core.Style { return core.Style{Background: ui.TintsOf(cx).Accent()} },
														Children: []core.Node{
															spinningIcon(cx, lucide.RefreshCw, 12, colors.Accent, state.aiConfigBusy.Get),
															core.Text{
																Content:   "拉取配置",
																Style:     core.Style{FontSize: 11.5, FontWeight: ui.Medium},
																StyleFunc: ui.Colored(colors.Accent),
															},
														},
													},
												},
											},
											// Protocol selector pills
											core.View{
												Style: core.Style{Direction: core.Row, Gap: 8},
												Children: func() []core.Node {
													opts := []struct{ id, label string }{
														{api.AIProtocolOpenAI, "OpenAI 兼容"},
														{api.AIProtocolAnthropic, "Anthropic"},
													}
													nodes := make([]core.Node, 0, len(opts))
													for _, o := range opts {
														opt := o
														active := func() bool { return aiProto.Get() == opt.id }
														nodes = append(nodes, base.Button{
															Label: opt.label,
															OnPress: func(core.PressEvent) {
																prev := aiProto.GetUntracked()
																aiProto.Set(opt.id)
																curBase := strings.TrimSpace(aiBase.GetUntracked())
																if curBase == "" || curBase == api.DefaultAIBaseURL(prev) {
																	aiBase.Set(api.DefaultAIBaseURL(opt.id))
																}
																cx.PlayHaptic(core.HapticSelection)
															},
															Style: core.Style{
																Padding:      core.Symmetric(6, 12),
																CornerRadius: 999,
																BorderWidth:  1,
															},
															StyleFunc: func() core.Style {
																if active() {
																	return core.Style{Background: colors.AccentFill(), BorderColor: colors.AccentFill()}
																}
																return core.Style{Background: colors.Inset(), BorderColor: colors.Line()}
															},
															Children: []core.Node{
																core.Text{
																	Content: opt.label,
																	Style:   core.Style{FontSize: 12.5, FontWeight: ui.Medium},
																	StyleFunc: func() core.Style {
																		if active() {
																			return core.Style{Color: colors.OnAccent()}
																		}
																		return core.Style{Color: colors.Text()}
																	},
																},
															},
														})
													}
													return nodes
												}(),
											},
											ui.Input{
												Value:       aiBase.Get,
												OnChange:    aiBase.Set,
												Placeholder: "API Base URL（例如 https://api.openai.com/v1）",
												Style:       core.Style{Height: core.Pt(40), FontSize: 13.5},
											},
											ui.Input{
												Value:       aiKey.Get,
												OnChange:    aiKey.Set,
												Masked:      true,
												Placeholder: "API Key",
												Style:       core.Style{Height: core.Pt(40), FontSize: 13.5},
											},
											ui.Input{
												Value:       aiModel.Get,
												OnChange:    aiModel.Set,
												Placeholder: "Model ID（例如 gpt-4o-mini / claude-sonnet-4）",
												Style:       core.Style{Height: core.Pt(40), FontSize: 13.5},
											},
											ui.Button{
												Text:     "保存并同步大模型配置",
												Variant:  ui.ButtonOutline,
												Disabled: state.aiConfigBusy.Get,
												OnPress: func() {
													cur := state.aiConfig.GetUntracked()
													cur.Protocol = aiProto.GetUntracked()
													cur.BaseURL = aiBase.GetUntracked()
													cur.APIKey = aiKey.GetUntracked()
													cur.ModelID = aiModel.GetUntracked()
													state.SaveAIConfig(cur)
												},
												Style: core.Style{Width: core.Pct(100), Height: core.Pt(42), CornerRadius: 10},
											},
										},
									},
								},
							},
						},
					}),
				},
			},
		},
	}
}
