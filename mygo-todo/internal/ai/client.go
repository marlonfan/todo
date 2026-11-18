// Package ai talks directly to the account's model endpoint, never through
// the Todo authenticated HTTP client. Generation is explicit and cancellable.
package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"todo-native/internal/api"
)

const DefaultSystem = "你是一个谨慎、务实的任务管理助手。请把信息整理得清晰、可执行，不编造业务事实；缺失的信息请列为待确认。"
const maxResponseBytes = 8 << 20
const maxOutputRunes = 500000

type Result struct {
	Text, Reasoning, FinishReason string
	Incomplete                    bool
}

func DefaultConfig() api.AIConfig {
	return api.AIConfig{Protocol: "openai", BaseURL: "https://api.openai.com/v1", SystemPrompt: DefaultSystem, AllowTaskContext: true}
}
func ValidateConfig(c api.AIConfig, ready bool) error {
	if c.Protocol != "openai" && c.Protocol != "anthropic" {
		return errors.New("请选择 OpenAI 兼容协议或 Anthropic 协议")
	}
	u, err := url.Parse(strings.TrimSpace(c.BaseURL))
	if err != nil || u == nil || u.Hostname() == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("模型服务地址应为完整的 http(s) API 基础地址，不含凭据、查询或片段")
	}
	for _, f := range []struct {
		value, label string
		max          int
	}{{c.BaseURL, "模型服务地址", 2000}, {c.APIKey, "API Key", 20000}, {c.ModelID, "模型 ID", 200}, {c.SystemPrompt, "系统提示词", 20000}, {c.UserProfile, "使用者背景", 20000}} {
		if utf8.RuneCountInString(f.value) > f.max {
			return fmt.Errorf("%s超过允许长度", f.label)
		}
	}
	if strings.ContainsAny(c.APIKey, "\r\n") {
		return errors.New("API Key 不能包含换行")
	}
	if ready && (strings.TrimSpace(c.APIKey) == "" || strings.TrimSpace(c.ModelID) == "") {
		return errors.New("请先在 AI 配置中填写 API Key 和模型 ID")
	}
	return nil
}

// SplitThinking also withholds incomplete tag prefixes, so a split <think>
// opening never briefly appears in the visible answer during streaming.
func SplitThinking(raw string) (visible, reasoning string) {
	var text, thought strings.Builder
	in := false
	for len(raw) > 0 {
		tags := []string{"<think>", "<thinking>"}
		if in {
			tags = []string{"</think>", "</thinking>"}
		}
		lower := strings.ToLower(raw)
		idx, tag := -1, ""
		for _, candidate := range tags {
			if pos := strings.Index(lower, candidate); pos >= 0 && (idx < 0 || pos < idx) {
				idx, tag = pos, candidate
			}
		}
		write := func(s string) {
			if in {
				thought.WriteString(s)
			} else {
				text.WriteString(s)
			}
		}
		if idx >= 0 {
			write(raw[:idx])
			raw = raw[idx+len(tag):]
			in = !in
			continue
		}
		// Hide a suffix that might complete a tag in the next chunk.
		keep := len(raw)
		for _, candidate := range tags {
			for n := 1; n < len(candidate) && n <= len(lower); n++ {
				if strings.HasSuffix(lower, candidate[:n]) {
					keep = min(keep, len(raw)-n)
				}
			}
		}
		write(raw[:keep])
		break
	}
	return text.String(), thought.String()
}
func CleanDescription(raw string) string {
	text, _ := SplitThinking(raw)
	text = strings.TrimSpace(strings.ReplaceAll(text, "\r\n", "\n"))
	lines := strings.Split(text, "\n")
	if len(lines) > 1 && (strings.HasPrefix(lines[0], "```") || strings.HasPrefix(lines[0], "~~~")) {
		fence := lines[0][:3]
		kind := strings.TrimSpace(lines[0][3:])
		if strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), fence) {
			return strings.TrimSpace(strings.Join(lines[1:len(lines)-1], "\n"))
		}
		if kind == "" || kind == "md" || kind == "markdown" {
			return strings.TrimSpace(strings.Join(lines[1:], "\n"))
		}
	}
	return text
}
func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	if list, ok := v.([]any); ok {
		var b strings.Builder
		for _, v := range list {
			if m, ok := v.(map[string]any); ok {
				b.WriteString(str(m["text"]))
			}
		}
		return b.String()
	}
	return ""
}
func object(v any) map[string]any { m, _ := v.(map[string]any); return m }
func incomplete(reason string) bool {
	return reason != "stop" && reason != "end_turn" && reason != "stop_sequence"
}

type accumulator struct {
	raw, reasoning string
	result         Result
	terminal       bool
}

func (a *accumulator) consume(data []byte, protocol string) error {
	if bytes.Equal(bytes.TrimSpace(data), []byte("[DONE]")) {
		a.terminal = true
		return nil
	}
	var p map[string]any
	if err := json.Unmarshal(data, &p); err != nil {
		return errors.New("模型流包含无法解析的数据，已保留收到的内容")
	}
	if p["error"] != nil || str(p["type"]) == "error" {
		return errors.New("模型服务返回流错误，已保留收到的内容；请检查模型配置或稍后重试")
	}
	if protocol == "anthropic" {
		delta := object(p["delta"])
		a.raw += str(delta["text"])
		a.reasoning += str(delta["thinking"])
		if str(p["type"]) == "content_block_start" {
			block := object(p["content_block"])
			a.raw += str(block["text"])
			a.reasoning += str(block["thinking"])
		}
		for _, v := range anyList(p["content"]) {
			block := object(v)
			if strings.Contains(str(block["type"]), "thinking") {
				a.reasoning += str(block["thinking"])
			} else {
				a.raw += str(block["text"])
			}
		}
		if s := str(delta["stop_reason"]); s != "" {
			a.result.FinishReason = s
		}
		if s := str(p["stop_reason"]); s != "" {
			a.result.FinishReason = s
		}
		if str(p["type"]) == "message_stop" {
			a.terminal = true
			if a.result.FinishReason == "" {
				a.result.FinishReason = "end_turn"
			}
		}
	} else {
		choices := anyList(p["choices"])
		if len(choices) > 0 {
			choice := object(choices[0])
			delta := object(choice["delta"])
			if delta == nil {
				delta = object(choice["message"])
			}
			a.raw += str(delta["content"])
			for _, key := range []string{"reasoning_content", "reasoning", "thinking"} {
				if s := str(delta[key]); s != "" {
					a.reasoning += s
					break
				}
			}
			if s := str(choice["text"]); s != "" {
				a.raw += s
			}
			if s := str(choice["finish_reason"]); s != "" {
				a.result.FinishReason = s
			}
		}
	}
	return a.update()
}
func (a *accumulator) update() error {
	visible, thought := SplitThinking(a.raw)
	a.result.Text = visible
	a.result.Reasoning = a.reasoning + thought
	if utf8.RuneCountInString(a.result.Text) > maxOutputRunes || utf8.RuneCountInString(a.result.Reasoning) > maxOutputRunes {
		a.result.Text = string([]rune(a.result.Text)[:min(utf8.RuneCountInString(a.result.Text), maxOutputRunes)])
		a.result.Reasoning = string([]rune(a.result.Reasoning)[:min(utf8.RuneCountInString(a.result.Reasoning), maxOutputRunes)])
		return errors.New("模型输出超过可保存长度，已停止接收")
	}
	return nil
}
func anyList(v any) []any { a, _ := v.([]any); return a }

func Generate(ctx context.Context, c api.AIConfig, system, input string, onUpdate func(Result)) (result Result, err error) {
	if err := ValidateConfig(c, true); err != nil {
		return result, err
	}
	if strings.TrimSpace(system) == "" || strings.TrimSpace(input) == "" {
		return result, errors.New("请输入系统提示词和提问内容")
	}
	endpoint := "/chat/completions"
	payload := map[string]any{"model": strings.TrimSpace(c.ModelID), "stream": true, "messages": []map[string]string{{"role": "system", "content": system}, {"role": "user", "content": input}}}
	if c.Protocol == "anthropic" {
		endpoint = "/messages"
		payload["system"] = system
		payload["max_tokens"] = 32768
		payload["messages"] = []map[string]string{{"role": "user", "content": input}}
	}
	body, _ := json.Marshal(payload)
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")+endpoint, bytes.NewReader(body))
	if err != nil {
		return result, errors.New("无法构造模型请求，请检查服务地址")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream, application/json")
	if c.Protocol == "anthropic" {
		req.Header.Set("x-api-key", strings.TrimSpace(c.APIKey))
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(c.APIKey))
	}
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return result, ctx.Err()
		}
		return result, errors.New("无法连接模型服务，请检查网络与 AI 配置后重试")
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return result, fmt.Errorf("模型服务返回 HTTP %d，请检查 API Key、模型 ID 或服务地址后重试", res.StatusCode)
	}
	acc := accumulator{}
	defer func() {
		result = acc.result
		result.Text = strings.TrimSpace(result.Text)
		result.Reasoning = strings.TrimSpace(result.Reasoning)
		if err != nil && result.FinishReason == "" {
			result.FinishReason = "unexpected_eof"
		}
		if result.FinishReason == "" {
			result.FinishReason = "unexpected_eof"
		}
		result.Incomplete = err != nil || incomplete(result.FinishReason)
	}()
	limited := &io.LimitedReader{R: res.Body, N: maxResponseBytes + 1}
	contentType := strings.ToLower(res.Header.Get("Content-Type"))
	if strings.Contains(contentType, "text/event-stream") {
		scanner := bufio.NewScanner(limited)
		scanner.Buffer(make([]byte, 4096), 2<<20)
		var pending strings.Builder
		flush := func() error {
			if pending.Len() == 0 {
				return nil
			}
			data := pending.String()
			pending.Reset()
			if err := acc.consume([]byte(data), c.Protocol); err != nil {
				return err
			}
			if onUpdate != nil {
				onUpdate(acc.result)
			}
			return nil
		}
		for scanner.Scan() {
			line := strings.TrimSuffix(scanner.Text(), "\r")
			if line == "" {
				if err = flush(); err != nil {
					return
				}
				if acc.terminal {
					return
				}
				continue
			}
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			data := strings.TrimPrefix(line, "data:")
			data = strings.TrimPrefix(data, " ")
			// Some compatible services omit blank event separators. Complete JSON
			// payloads can be consumed independently; multiline JSON is joined first.
			if pending.Len() > 0 {
				pending.WriteByte('\n')
			}
			pending.WriteString(data)
			if json.Valid([]byte(pending.String())) || pending.String() == "[DONE]" {
				if err = flush(); err != nil {
					return
				}
				if acc.terminal {
					return
				}
			}
		}
		if err = scanner.Err(); err != nil {
			if ctx.Err() != nil {
				err = ctx.Err()
			} else {
				err = errors.New("模型流连接中断，已保留收到的内容")
			}
			return
		}
		if err = flush(); err != nil {
			return
		}
	} else {
		var data []byte
		data, err = io.ReadAll(limited)
		if err != nil {
			if ctx.Err() != nil {
				err = ctx.Err()
			} else {
				err = errors.New("读取模型回复失败，请重试")
			}
			return
		}
		if json.Valid(data) {
			err = acc.consume(data, c.Protocol)
			if err != nil {
				return
			}
		} else if strings.HasPrefix(contentType, "text/plain") {
			acc.raw = string(data)
			if err = acc.update(); err != nil {
				return
			}
		} else {
			err = errors.New("模型服务返回了不支持的回复格式，请检查 API 地址")
			return
		}
		if onUpdate != nil {
			onUpdate(acc.result)
		}
	}
	if limited.N <= 0 {
		err = errors.New("模型响应过大，已停止接收")
	}
	if ctx.Err() != nil {
		err = ctx.Err()
	}
	return
}
