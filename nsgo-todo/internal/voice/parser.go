package voice

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"nsgo-todo/internal/api"
)

// RecurrenceRule mirrors the todo backend's models.RecurrenceRule JSON contract.
type RecurrenceRule struct {
	Freq             string   `json:"freq,omitempty"` // daily, weekly, monthly, yearly, lunar_yearly
	Interval         int      `json:"interval,omitempty"`
	ByDay            []string `json:"byday,omitempty"`   // MO, TU, WE, TH, FR, SA, SU
	ByMonth          []int    `json:"bymonth,omitempty"` // 1-12
	ByDate           []int    `json:"bydate,omitempty"`  // 1-31
	Count            int      `json:"count,omitempty"`
	LunarMonth       int      `json:"lunar_month,omitempty"`
	LunarDay         int      `json:"lunar_day,omitempty"`
	LunarIsLeapMonth bool     `json:"lunar_is_leap_month,omitempty"`
}

func (r *RecurrenceRule) Valid() bool {
	if r == nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(r.Freq)) {
	case "daily", "weekly", "monthly", "yearly", "lunar_yearly":
		return true
	default:
		return false
	}
}

func (r *RecurrenceRule) Normalized() *RecurrenceRule {
	if !r.Valid() {
		return nil
	}
	out := *r
	out.Freq = strings.ToLower(strings.TrimSpace(out.Freq))
	if out.Interval <= 0 {
		out.Interval = 1
	}
	if len(out.ByDay) > 0 {
		validDays := map[string]bool{"MO": true, "TU": true, "WE": true, "TH": true, "FR": true, "SA": true, "SU": true}
		cleaned := make([]string, 0, len(out.ByDay))
		for _, d := range out.ByDay {
			u := strings.ToUpper(strings.TrimSpace(d))
			if validDays[u] && !slices.Contains(cleaned, u) {
				cleaned = append(cleaned, u)
			}
		}
		out.ByDay = cleaned
	}
	return &out
}

func (r *RecurrenceRule) RawJSON() json.RawMessage {
	n := r.Normalized()
	if n == nil {
		return nil
	}
	b, _ := json.Marshal(n)
	return b
}

// RecurrenceSummary formats a RecurrenceRule into concise Chinese for the preview UI.
func RecurrenceSummary(r *RecurrenceRule, endDate *time.Time, loc *time.Location) string {
	n := r.Normalized()
	if n == nil {
		return ""
	}
	if loc == nil {
		loc = time.Local
	}
	interval := n.Interval
	if interval <= 0 {
		interval = 1
	}
	dayNames := map[string]string{
		"MO": "一", "TU": "二", "WE": "三", "TH": "四", "FR": "五", "SA": "六", "SU": "日",
	}
	var label string
	switch n.Freq {
	case "daily":
		if interval == 1 {
			label = "每天"
		} else {
			label = fmt.Sprintf("每 %d 天", interval)
		}
	case "weekly":
		prefix := "每周"
		if interval > 1 {
			prefix = fmt.Sprintf("每 %d 周", interval)
		}
		if len(n.ByDay) > 0 {
			parts := make([]string, 0, len(n.ByDay))
			for _, d := range n.ByDay {
				if cn, ok := dayNames[d]; ok {
					parts = append(parts, cn)
				}
			}
			if len(parts) == 5 && slices.Contains(n.ByDay, "MO") && slices.Contains(n.ByDay, "TU") &&
				slices.Contains(n.ByDay, "WE") && slices.Contains(n.ByDay, "TH") && slices.Contains(n.ByDay, "FR") && interval == 1 {
				label = "每个工作日"
			} else if len(parts) > 0 {
				label = prefix + strings.Join(parts, "、")
			} else {
				label = prefix
			}
		} else {
			label = prefix
		}
	case "monthly":
		prefix := "每月"
		if interval > 1 {
			prefix = fmt.Sprintf("每 %d 个月", interval)
		}
		if len(n.ByDate) > 0 {
			parts := make([]string, 0, len(n.ByDate))
			for _, d := range n.ByDate {
				parts = append(parts, fmt.Sprintf("%d日", d))
			}
			label = prefix + strings.Join(parts, "、")
		} else {
			label = prefix
		}
	case "yearly":
		if interval == 1 {
			label = "每年"
		} else {
			label = fmt.Sprintf("每 %d 年", interval)
		}
		if len(n.ByMonth) > 0 && len(n.ByDate) > 0 {
			label += fmt.Sprintf("%d月%d日", n.ByMonth[0], n.ByDate[0])
		}
	case "lunar_yearly":
		leap := ""
		if n.LunarIsLeapMonth {
			leap = "闰"
		}
		if n.LunarMonth > 0 && n.LunarDay > 0 {
			label = fmt.Sprintf("农历每年%s%d月%d日", leap, n.LunarMonth, n.LunarDay)
		} else {
			label = "农历每年"
		}
	}
	if n.Count > 0 {
		label += fmt.Sprintf(" · 共 %d 次", n.Count)
	}
	if endDate != nil {
		label += " · 截至 " + endDate.In(loc).Format("2006-01-02")
	}
	return label
}

// ParsedTask is one structured task draft extracted from a voice transcript.
type ParsedTask struct {
	Title             string
	Description       string
	Priority          int // 0=无, 1=低, 2=中, 3=高
	AllDay            bool
	StartTime         *time.Time
	EndTime           *time.Time
	DueDate           *time.Time
	CategoryIDs       []int64
	RecurrenceRule    *RecurrenceRule
	RecurrenceEndDate *time.Time
}

// ParseTasksWithLLM calls the configured OpenAI- or Anthropic-compatible LLM to
// extract one or more structured tasks from a natural-language voice transcript.
func ParseTasksWithLLM(
	ctx context.Context,
	aiCfg api.AIConfig,
	transcript string,
	categories []api.Category,
	now time.Time,
	loc *time.Location,
) ([]ParsedTask, error) {
	transcript = strings.TrimSpace(transcript)
	if transcript == "" {
		return nil, errors.New("语音内容为空，无法解析任务")
	}
	cfg := aiCfg.Normalized()
	if !cfg.Ready() {
		return nil, errors.New("尚未配置大模型，请前往「我的 → 语音与 AI」配置或同步服务器 AI 设置")
	}
	if loc == nil {
		loc = time.Local
	}
	localNow := now.In(loc)

	sysPrompt := buildVoiceTaskSystemPrompt(categories, localNow, loc)
	userPrompt := "用户语音转写内容：\n" + transcript

	var (
		rawText string
		err     error
	)
	if cfg.Protocol == api.AIProtocolAnthropic {
		rawText, err = callAnthropicJSON(ctx, cfg, sysPrompt, userPrompt)
	} else {
		rawText, err = callOpenAIJSON(ctx, cfg, sysPrompt, userPrompt)
	}
	if err != nil {
		return nil, err
	}
	return decodeParsedTasks(rawText, categories, loc)
}

func buildVoiceTaskSystemPrompt(categories []api.Category, localNow time.Time, loc *time.Location) string {
	weekdays := [...]string{"星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"}
	tzName := loc.String()
	if tzName == "" || tzName == "Local" {
		tzName = localNow.Format("-07:00")
	}

	var catLines []string
	for _, c := range categories {
		if c.ID > 0 {
			catLines = append(catLines, fmt.Sprintf(`  {"id": %d, "name": %q, "emoji": %q}`, c.ID, c.Name, c.Emoji))
		}
	}
	catBlock := "  （当前无已有分类）"
	if len(catLines) > 0 {
		catBlock = strings.Join(catLines, ",\n")
	}

	return fmt.Sprintf(`你是一个精准的中文智能待办任务解析助手。请把用户的自然语言语音转写内容，解析为严格符合 JSON 格式的结构化待办任务。

当前时间：%s（%s，时区：%s）

用户已有的分类列表：
[
%s
]

输出要求（必须只输出一个合法 JSON 对象，不要包含任何解释、前后缀或 Markdown 代码块）：
{
  "tasks": [
    {
      "title": "简明扼要的任务标题（去掉时间、分类、重复等元信息，保留核心行动，不超过 60 字）",
      "description": "可选，补充细节、清单要点或背景信息（支持简洁 Markdown；无额外细节则为空字符串）",
      "priority": 0,
      "all_day": false,
      "start_time": null,
      "end_time": null,
      "due_date": null,
      "category_ids": [],
      "recurrence_rule": null,
      "recurrence_end_date": null
    }
  ]
}

字段解析规则：
1. priority：0=无优先级，1=低，2=中，3=高。仅当用户明确提到紧急/重要/高优/优先/中优/低优/不急时设置，否则为 0。
2. 时间格式：所有非空时间必须使用本地时区 RFC3339 格式（例如 "%s"），或 "YYYY-MM-DD HH:MM"（按当前时区解释）。
   - 如果用户只说了截止时间（如"周五前交报告"、"今晚8点前"），填 due_date。
   - 如果用户说了日程/执行时间或重复开始时间（如"明天下午3点开会"、"每天早上8点半吃药"），填 start_time（若有明确时长或结束时间则同时填 end_time，同时也可将 due_date 设为相同开始时间以便今日视图展示；如果是"从3点到4点半"则分别填 start_time 和 end_time）。
   - 如果用户只说了日期没说具体时刻（如"明天买猫粮"、"下周三复查"），设 all_day=true，并将 due_date 设为当天 23:59:00（若为重复任务则同时设 start_time 为当天 09:00:00）。
   - 如果完全没提时间，start_time、end_time、due_date 均为 null，all_day=false。
3. category_ids：从「用户已有的分类列表」中语义匹配最合适的分类 id（例如说到"工作/公司/项目"可匹配名为 "Work" 或 "工作" 的分类）。只允许填入上面列表中真实存在的数字 id；找不到合适分类则填空数组 []。
4. recurrence_rule：仅当用户明确提到重复（每天、隔天、每个工作日、每周一三五、每两周、每月15号、每年、农历每年等）时填写，否则为 null。合法结构：
   - freq: "daily" | "weekly" | "monthly" | "yearly" | "lunar_yearly"
   - interval: 正整数，默认 1（例如"每两天"为 2）
   - byday: 可选数组，仅 weekly 使用，值为 "MO","TU","WE","TH","FR","SA","SU"
   - bydate: 可选整数数组，monthly/yearly 的日期 1-31
   - bymonth: 可选整数数组，yearly 的月份 1-12
   - count: 可选正整数，重复总次数
   - lunar_month / lunar_day / lunar_is_leap_month: 仅 lunar_yearly 使用
   如果提到重复截止日期（如"持续到年底"、"到下个月底结束"），填入 recurrence_end_date。
5. 如果一句话里明显包含多个独立待办事项，请拆分为 tasks 数组中的多个对象；若只是同一件事的多个细节，合并为一个任务并把细节写入 description。`,
		localNow.Format("2006-01-02 15:04:05"),
		weekdays[localNow.Weekday()],
		tzName,
		catBlock,
		localNow.Format(time.RFC3339),
	)
}

func joinEndpoint(baseURL, suffix string) string {
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	suffix = strings.TrimLeft(suffix, "/")
	if strings.HasSuffix(base, "/"+suffix) {
		return base
	}
	return base + "/" + suffix
}

func callOpenAIJSON(ctx context.Context, cfg api.AIConfig, systemPrompt, userPrompt string) (string, error) {
	endpoint := joinEndpoint(cfg.BaseURL, "chat/completions")
	reqBody := map[string]any{
		"model": cfg.ModelID,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.1,
		"stream":      false,
	}
	payload, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求大模型失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", fmt.Errorf("读取大模型响应失败: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("大模型返回错误（HTTP %d）: %s", resp.StatusCode, extractAPIError(body))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content any `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("解析大模型响应 JSON 失败: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("大模型未返回任何解析结果")
	}
	return extractContentString(parsed.Choices[0].Message.Content), nil
}

func callAnthropicJSON(ctx context.Context, cfg api.AIConfig, systemPrompt, userPrompt string) (string, error) {
	endpoint := joinEndpoint(cfg.BaseURL, "messages")
	reqBody := map[string]any{
		"model":       cfg.ModelID,
		"max_tokens":  2048,
		"temperature": 0.1,
		"system":      systemPrompt,
		"messages": []map[string]string{
			{"role": "user", "content": userPrompt},
		},
	}
	payload, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求 Anthropic 大模型失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", fmt.Errorf("读取大模型响应失败: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("大模型返回错误（HTTP %d）: %s", resp.StatusCode, extractAPIError(body))
	}

	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("解析 Anthropic 响应失败: %w", err)
	}
	var out strings.Builder
	for _, block := range parsed.Content {
		if block.Type == "text" || block.Type == "" {
			out.WriteString(block.Text)
		}
	}
	return out.String(), nil
}

func extractAPIError(body []byte) string {
	var envelope struct {
		Error any `json:"error"`
	}
	if json.Unmarshal(body, &envelope) == nil && envelope.Error != nil {
		switch e := envelope.Error.(type) {
		case string:
			return e
		case map[string]any:
			if msg, ok := e["message"].(string); ok && msg != "" {
				return msg
			}
		}
	}
	s := strings.TrimSpace(string(body))
	if len(s) > 160 {
		s = s[:160] + "…"
	}
	return s
}

func extractContentString(v any) string {
	switch c := v.(type) {
	case string:
		return c
	case []any:
		var b strings.Builder
		for _, part := range c {
			if m, ok := part.(map[string]any); ok {
				if t, ok := m["text"].(string); ok {
					b.WriteString(t)
				}
			}
		}
		return b.String()
	}
	return ""
}

type rawParsedTask struct {
	Title             string          `json:"title"`
	Description       string          `json:"description"`
	Priority          int             `json:"priority"`
	AllDay            bool            `json:"all_day"`
	StartTime         *string         `json:"start_time"`
	EndTime           *string         `json:"end_time"`
	DueDate           *string         `json:"due_date"`
	CategoryIDs       []int64         `json:"category_ids"`
	RecurrenceRule    *RecurrenceRule `json:"recurrence_rule"`
	RecurrenceEndDate *string         `json:"recurrence_end_date"`
}

func decodeParsedTasks(raw string, categories []api.Category, loc *time.Location) ([]ParsedTask, error) {
	cleaned := extractJSONBlock(raw)
	if cleaned == "" {
		return nil, errors.New("大模型返回内容中未找到可解析的任务 JSON")
	}

	var envelope struct {
		Tasks []rawParsedTask `json:"tasks"`
	}
	if err := json.Unmarshal([]byte(cleaned), &envelope); err != nil || len(envelope.Tasks) == 0 {
		// Fallback: accept a single task object or top-level array
		var single rawParsedTask
		if err2 := json.Unmarshal([]byte(cleaned), &single); err2 == nil && strings.TrimSpace(single.Title) != "" {
			envelope.Tasks = []rawParsedTask{single}
		} else {
			var arr []rawParsedTask
			if err3 := json.Unmarshal([]byte(cleaned), &arr); err3 == nil && len(arr) > 0 {
				envelope.Tasks = arr
			} else {
				return nil, fmt.Errorf("无法解析大模型输出的任务结构: %w", err)
			}
		}
	}

	validCats := make(map[int64]bool, len(categories))
	for _, c := range categories {
		if c.ID > 0 {
			validCats[c.ID] = true
		}
	}

	out := make([]ParsedTask, 0, len(envelope.Tasks))
	for _, item := range envelope.Tasks {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		prio := item.Priority
		if prio < 0 {
			prio = 0
		} else if prio > 3 {
			prio = 3
		}
		catIDs := make([]int64, 0, len(item.CategoryIDs))
		for _, id := range item.CategoryIDs {
			if validCats[id] && !slices.Contains(catIDs, id) {
				catIDs = append(catIDs, id)
			}
		}
		startTime := parseFlexibleTime(item.StartTime, loc, false)
		endTime := parseFlexibleTime(item.EndTime, loc, false)
		dueDate := parseFlexibleTime(item.DueDate, loc, item.AllDay)
		recEnd := parseFlexibleTime(item.RecurrenceEndDate, loc, true)
		rule := item.RecurrenceRule.Normalized()
		if rule != nil && startTime == nil && dueDate != nil {
			// Recurring series on the todo backend anchor on start_time.
			t := *dueDate
			startTime = &t
		}
		out = append(out, ParsedTask{
			Title:             title,
			Description:       strings.TrimSpace(item.Description),
			Priority:          prio,
			AllDay:            item.AllDay,
			StartTime:         startTime,
			EndTime:           endTime,
			DueDate:           dueDate,
			CategoryIDs:       catIDs,
			RecurrenceRule:    rule,
			RecurrenceEndDate: recEnd,
		})
	}
	if len(out) == 0 {
		return nil, errors.New("大模型未提取到有效任务标题")
	}
	return out, nil
}

func extractJSONBlock(raw string) string {
	s := strings.TrimSpace(raw)
	// Strip <think>...</think> reasoning tags if a reasoning model emitted them.
	if i := strings.Index(s, "</think>"); i >= 0 {
		s = strings.TrimSpace(s[i+len("</think>"):])
	}
	// Strip markdown fenced code block ```json ... ```
	if start := strings.Index(s, "```"); start >= 0 {
		rest := s[start+3:]
		if nl := strings.IndexByte(rest, '\n'); nl >= 0 {
			rest = rest[nl+1:]
		}
		if end := strings.Index(rest, "```"); end >= 0 {
			s = strings.TrimSpace(rest[:end])
		}
	}
	// Locate outermost JSON object or array
	objStart, arrStart := strings.IndexByte(s, '{'), strings.IndexByte(s, '[')
	start := -1
	var openCh, closeCh byte
	if objStart >= 0 && (arrStart < 0 || objStart < arrStart) {
		start, openCh, closeCh = objStart, '{', '}'
	} else if arrStart >= 0 {
		start, openCh, closeCh = arrStart, '[', ']'
	}
	if start < 0 {
		return ""
	}
	depth := 0
	inStr := false
	escaped := false
	for i := start; i < len(s); i++ {
		ch := s[i]
		if inStr {
			if escaped {
				escaped = false
			} else if ch == '\\' {
				escaped = true
			} else if ch == '"' {
				inStr = false
			}
			continue
		}
		switch ch {
		case '"':
			inStr = true
		case openCh:
			depth++
		case closeCh:
			depth--
			if depth == 0 {
				return s[start : i+1]
			}
		}
	}
	return ""
}

func parseFlexibleTime(raw *string, loc *time.Location, endOfDayIfDateOnly bool) *time.Time {
	if raw == nil {
		return nil
	}
	s := strings.TrimSpace(*raw)
	if s == "" || strings.EqualFold(s, "null") {
		return nil
	}
	if loc == nil {
		loc = time.Local
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		u := t.UTC()
		return &u
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		u := t.UTC()
		return &u
	}
	for _, layout := range []string{
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04",
		"2006/01/02 15:04",
	} {
		if t, err := time.ParseInLocation(layout, s, loc); err == nil {
			u := t.UTC()
			return &u
		}
	}
	for _, layout := range []string{"2006-01-02", "2006/01/02"} {
		if t, err := time.ParseInLocation(layout, s, loc); err == nil {
			if endOfDayIfDateOnly {
				t = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 0, 0, loc)
			} else {
				t = time.Date(t.Year(), t.Month(), t.Day(), 9, 0, 0, 0, loc)
			}
			u := t.UTC()
			return &u
		}
	}
	return nil
}
