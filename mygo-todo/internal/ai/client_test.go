package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"todo-native/internal/api"
)

func fixtureConfig(url string, protocol string) api.AIConfig {
	return api.AIConfig{Protocol: protocol, BaseURL: url + "/v1", APIKey: "model-only-key", ModelID: "fixture-model"}
}
func TestGenerateOpenAIStreamAndThinkingSeparation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer model-only-key" || r.Header.Get("X-Client-Op-Id") != "" || r.Header.Get("Cookie") != "" {
			t.Error(r.URL, r.Header)
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["stream"] != true || body["model"] != "fixture-model" {
			t.Error(body)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, ": ping\n")
		for _, d := range []map[string]any{{"reasoning_content": "explicit thought\n"}, {"content": "<thi"}, {"content": "nk>hidden thought</think>## Plan\n"}, {"content": "- first action"}} {
			b, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"delta": d}}})
			fmt.Fprintf(w, "data: %s\n", b)
		}
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer server.Close()
	var chunks []Result
	result, err := Generate(context.Background(), fixtureConfig(server.URL, "openai"), "system", "input", func(r Result) { chunks = append(chunks, r) })
	if err != nil || result.Text != "## Plan\n- first action" || result.Reasoning != "explicit thought\nhidden thought" || result.Incomplete || result.FinishReason != "stop" {
		t.Fatal(result, err)
	}
	for _, r := range chunks {
		if strings.Contains(r.Text, "hidden") || strings.Contains(r.Text, "<thi") {
			t.Fatal("thinking leaked in visible stream", r)
		}
	}
}
func TestGenerateAnthropicStreamAndJSON(t *testing.T) {
	for _, stream := range []bool{true, false} {
		t.Run(fmt.Sprint(stream), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/v1/messages" || r.Header.Get("x-api-key") != "model-only-key" || r.Header.Get("Authorization") != "" || r.Header.Get("anthropic-version") != "2023-06-01" {
					t.Error(r.URL, r.Header)
				}
				var body map[string]any
				json.NewDecoder(r.Body).Decode(&body)
				if body["system"] != "system" || body["max_tokens"] != float64(32768) {
					t.Error(body)
				}
				if stream {
					w.Header().Set("Content-Type", "text/event-stream")
					fmt.Fprint(w, "event: content_block_delta\ndata: {\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"private\"}}\n\nevent: content_block_delta\ndata: {\"delta\":{\"type\":\"text_delta\",\"text\":\"answer\"}}\n\nevent: message_delta\ndata: {\"delta\":{\"stop_reason\":\"end_turn\"}}\n\nevent: message_stop\ndata: {\"type\":\"message_stop\"}\n\n")
				} else {
					w.Header().Set("Content-Type", "application/json")
					fmt.Fprint(w, `{"content":[{"type":"thinking","thinking":"private"},{"type":"text","text":"answer"}],"stop_reason":"end_turn"}`)
				}
			}))
			defer server.Close()
			result, err := Generate(context.Background(), fixtureConfig(server.URL, "anthropic"), "system", "input", nil)
			if err != nil || result.Text != "answer" || result.Reasoning != "private" || result.Incomplete {
				t.Fatal(result, err)
			}
		})
	}
}
func TestGenerateTruncationErrorsAndNonStream(t *testing.T) {
	cases := []struct {
		label, body, contentType, reason string
		wantError                        bool
	}{
		{"truncated", `data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}`, "text/event-stream", "length", false},
		{"unexpected-eof", `data: {"choices":[{"delta":{"content":"partial"}}]}`, "text/event-stream", "unexpected_eof", false},
		{"error-after-text", "data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\ndata: {\"error\":{\"message\":\"sensitive payload\"}}\n\n", "text/event-stream", "unexpected_eof", true},
		{"multiline", "data: {\"choices\":\n" + "data: [{\"delta\":{\"content\":\"answer\"},\"finish_reason\":\"stop\"}]}\n\n", "text/event-stream", "stop", false},
		{"json", `{"choices":[{"message":{"content":"answer","reasoning_content":"thought"},"finish_reason":"stop"}]}`, "application/json", "stop", false},
		{"raw", "answer", "text/plain", "unexpected_eof", false},
	}
	for _, tc := range cases {
		t.Run(tc.label, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", tc.contentType)
				fmt.Fprint(w, tc.body)
			}))
			defer server.Close()
			r, err := Generate(context.Background(), fixtureConfig(server.URL, "openai"), "system", "input", nil)
			if (err != nil) != tc.wantError || r.FinishReason != tc.reason || r.Incomplete != (tc.reason != "stop") || r.Text == "" {
				t.Fatal(r, err)
			}
			if err != nil && strings.Contains(err.Error(), "sensitive") {
				t.Fatal("provider details echoed", err)
			}
		})
	}
}
func TestGenerateCancellationRetainsPartialAndDoesNotFollowRedirect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	r, err := Generate(ctx, fixtureConfig(server.URL, "openai"), "system", "input", func(Result) { cancel() })
	if !errors.Is(err, context.Canceled) || r.Text != "partial" || !r.Incomplete {
		t.Fatal(r, err)
	}
	leaked := false
	sink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked = true }))
	defer sink.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, sink.URL, http.StatusTemporaryRedirect)
	}))
	defer redirect.Close()
	_, err = Generate(context.Background(), fixtureConfig(redirect.URL, "openai"), "system", "input", nil)
	if err == nil || leaked || !strings.Contains(err.Error(), "307") {
		t.Fatal(leaked, err)
	}
}
func TestThinkingAndMarkdownCleanup(t *testing.T) {
	for _, s := range []string{"<think>secret</think>answer", "<thinking>secret</thinking>answer", "<think>secret</think>answer<thi"} {
		v, r := SplitThinking(s)
		if v != "answer" || r != "secret" {
			t.Fatal(s, v, r)
		}
	}
	if v, _ := SplitThinking("<think>unfinished"); v != "" {
		t.Fatal(v)
	}
	for _, s := range []string{"```markdown\n- action\n```", "```markdown\n- action", "~~~md\n- action\n~~~"} {
		if CleanDescription(s) != "- action" {
			t.Fatal(s, CleanDescription(s))
		}
	}
	cfg := DefaultConfig()
	cfg.APIKey = "secret"
	cfg.ModelID = "model"
	for _, bad := range []string{"https://u:p@example.test/v1", "file:///tmp/x", "https://example.test/v1?token=x"} {
		cfg.BaseURL = bad
		if ValidateConfig(cfg, true) == nil {
			t.Fatal(bad)
		}
	}
}

func TestGenerateHonorsTerminalEventWithoutWaitingForConnectionClose(t *testing.T) {
	for _, protocol := range []string{"openai", "anthropic"} {
		t.Run(protocol, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/event-stream")
				if protocol == "openai" {
					fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"answer\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
				} else {
					fmt.Fprint(w, "data: {\"type\":\"content_block_start\",\"content_block\":{\"type\":\"text\",\"text\":\"answer\"}}\n\ndata: {\"type\":\"message_stop\"}\n\n")
				}
				w.(http.Flusher).Flush()
				<-r.Context().Done()
			}))
			defer server.Close()
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			r, err := Generate(ctx, fixtureConfig(server.URL, protocol), "system", "input", nil)
			if err != nil || r.Incomplete || r.Text != "answer" {
				t.Fatal(r, err)
			}
		})
	}
}

func TestGenerateBoundsPlainAndStructuredOutput(t *testing.T) {
	for _, kind := range []string{"text/plain", "application/json", "text/event-stream"} {
		t.Run(kind, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", kind)
				text := strings.Repeat("长", maxOutputRunes+1)
				if kind == "text/plain" {
					fmt.Fprint(w, text)
					return
				}
				body, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{"delta": map[string]string{"content": text}, "finish_reason": "stop"}}})
				if kind == "text/event-stream" {
					fmt.Fprintf(w, "data: %s\n\n", body)
				} else {
					w.Write(body)
				}
			}))
			defer server.Close()
			r, err := Generate(context.Background(), fixtureConfig(server.URL, "openai"), "system", "input", nil)
			if err == nil || !r.Incomplete || len([]rune(r.Text)) != maxOutputRunes {
				t.Fatal("unbounded provider output", len([]rune(r.Text)), err)
			}
		})
	}
}
