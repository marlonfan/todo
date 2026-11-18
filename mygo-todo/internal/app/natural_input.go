package app

import (
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type naturalTimeOptions struct {
	DefaultStart string
	Morning      string
	Noon         string
	Afternoon    string
	Evening      string
}

type textSpan struct {
	start int
	end   int
	kind  string
}

type priorityParseResult struct {
	PriorityLabel string
	PriorityValue int
	CleanedTitle  string
	Marker        string
}

type naturalTimeResult struct {
	Time         time.Time
	CleanedTitle string
	Display      string
	Confidence   string
	Ambiguous    bool
	Spans        []textSpan
}

type smartTaskInputResult struct {
	CleanedTitle  string
	HasPriority   bool
	PriorityLabel string
	PriorityValue int
	HasTime       bool
	Time          time.Time
	TimeDisplay   string
}

var (
	reExclamationMarker = regexp.MustCompile(`[!！]+`)
	reExplicitPriority  = regexp.MustCompile(`(?i)(?:^|\s)([pP][123]|[\[【][高中低]优?级?[\]】])(?:\s|$)`)
	reAbsYearDate       = regexp.MustCompile(`(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?`)
	reLunarMonthDay     = regexp.MustCompile(`(农历|阴历)?(闰)?(正月|腊月|冬月|[一二三四五六七八九十]{1,2}月|\d{1,2}月)(初[一二三四五六七八九十]|十[一二三四五六七八九]|二十|廿[一二三四五六七八九]|三十|[1-9]|[12]\d|30)[日号]?`)
	reAbsMonthDay       = regexp.MustCompile(`(\d{1,2})月(\d{1,2})[日号]?`)
	reAbsCnMonthDay     = regexp.MustCompile(`([一二三四五六七八九十两零〇廿卅]{1,3})月(\d{1,2}|[一二三四五六七八九十两零〇廿卅]{1,3})[日号]?`)
	reRelativeDate      = regexp.MustCompile(`(?i)(大后天|后天|明天|今天|明早|今早|明晚|今晚|day after tomorrow|tomorrow|today|tonight|this morning)`)
	reCnWeekday         = regexp.MustCompile(`(下下|下|本|这)?(?:周|星期|礼拜)(末|[一二三四五六日天])`)
	reEnNextWeekday     = regexp.MustCompile(`(?i)\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b`)
	reEnWeekday         = regexp.MustCompile(`(?i)\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b`)
	reCnPartOfDay       = regexp.MustCompile(`(凌晨|早上|上午|早晨|今早|明早|中午|下午|晚上|傍晚|今晚|明晚)`)
	reEnPartOfDay       = regexp.MustCompile(`(?i)\b(this morning|morning|noon|afternoon|evening|tonight|late night)\b`)
	reClockColon        = regexp.MustCompile(`(\d{1,2})\s*[:：]\s*(\d{1,2})`)
	reClockHalf         = regexp.MustCompile(`(\d{1,2})\s*点\s*半`)
	reClockPoint        = regexp.MustCompile(`(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分?)?`)
	reClockAMPM         = regexp.MustCompile(`(?i)\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b`)
	reCleanupPunct      = regexp.MustCompile(`[，,。！？!?.、；;]+`)
	reMultiSpace        = regexp.MustCompile(`\s+`)
)

var cnWeekdayMondayIndex = map[string]int{
	"一": 0,
	"二": 1,
	"三": 2,
	"四": 3,
	"五": 4,
	"六": 5,
	"日": 6,
	"天": 6,
	"末": 5,
}

var enWeekdaySundayIndex = map[string]time.Weekday{
	"sunday":    time.Sunday,
	"monday":    time.Monday,
	"tuesday":   time.Tuesday,
	"wednesday": time.Wednesday,
	"thursday":  time.Thursday,
	"friday":    time.Friday,
	"saturday":  time.Saturday,
}

var cnDigitMap = map[rune]int{
	'零': 0,
	'〇': 0,
	'一': 1,
	'二': 2,
	'两': 2,
	'三': 3,
	'四': 4,
	'五': 5,
	'六': 6,
	'七': 7,
	'八': 8,
	'九': 9,
}

func (a *App) naturalTimeOptions() naturalTimeOptions {
	u := a.session.User
	return naturalTimeOptions{
		DefaultStart: firstNonEmptyClock(u.DefaultTaskStartTime, "09:00"),
		Morning:      firstNonEmptyClock(u.DefaultMorningTime, "09:00"),
		Noon:         firstNonEmptyClock(u.DefaultNoonTime, "12:00"),
		Afternoon:    firstNonEmptyClock(u.DefaultAfternoonTime, "15:00"),
		Evening:      firstNonEmptyClock(u.DefaultEveningTime, "20:00"),
	}
}

func firstNonEmptyClock(val, fallback string) string {
	val = strings.TrimSpace(val)
	if len(val) == 5 && val[2] == ':' {
		return val
	}
	return fallback
}

func parseClockParts(raw string, defHour, defMin int) (int, int) {
	raw = strings.TrimSpace(raw)
	if len(raw) == 5 && raw[2] == ':' {
		h, err1 := strconv.Atoi(raw[:2])
		m, err2 := strconv.Atoi(raw[3:])
		if err1 == nil && err2 == nil && h >= 0 && h <= 23 && m >= 0 && m <= 59 {
			return h, m
		}
	}
	return defHour, defMin
}

func mergeTextSpans(spans []textSpan) []textSpan {
	var valid []textSpan
	for _, s := range spans {
		if s.end > s.start && s.start >= 0 {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return nil
	}
	sort.Slice(valid, func(i, j int) bool {
		if valid[i].start != valid[j].start {
			return valid[i].start < valid[j].start
		}
		return valid[i].end < valid[j].end
	})
	merged := []textSpan{valid[0]}
	for _, cur := range valid[1:] {
		last := &merged[len(merged)-1]
		if cur.start <= last.end {
			if cur.end > last.end {
				last.end = cur.end
			}
			if last.kind == "" && cur.kind != "" {
				last.kind = cur.kind
			}
			continue
		}
		merged = append(merged, cur)
	}
	return merged
}

func cleanupTitleBySpans(input string, spans []textSpan) string {
	if strings.TrimSpace(input) == "" {
		return ""
	}
	merged := mergeTextSpans(spans)
	if len(merged) == 0 {
		return strings.TrimSpace(reMultiSpace.ReplaceAllString(input, " "))
	}
	var b strings.Builder
	lastIdx := 0
	for _, sp := range merged {
		if sp.start > lastIdx && sp.start <= len(input) {
			b.WriteString(input[lastIdx:sp.start])
		}
		b.WriteByte(' ')
		if sp.end > lastIdx {
			lastIdx = sp.end
		}
	}
	if lastIdx < len(input) {
		b.WriteString(input[lastIdx:])
	}
	cleaned := reCleanupPunct.ReplaceAllString(b.String(), " ")
	cleaned = reMultiSpace.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

func parsePriorityFromTitle(title string) (*priorityParseResult, bool) {
	raw := title
	if strings.TrimSpace(raw) == "" {
		return nil, false
	}

	type markerMatch struct {
		start int
		end   int
		count int
		val   int
	}
	var matches []markerMatch

	for _, loc := range reExclamationMarker.FindAllStringIndex(raw, -1) {
		start, end := loc[0], loc[1]
		marker := raw[start:end]
		runeCount := len([]rune(marker))

		var prevRune, nextRune rune
		hasPrev, hasNext := false, false
		if start > 0 {
			for _, r := range raw[:start] {
				prevRune = r
				hasPrev = true
			}
		}
		if end < len(raw) {
			for _, r := range raw[end:] {
				nextRune = r
				hasNext = true
				break
			}
		}
		atStart := !hasPrev
		atEnd := !hasNext
		standalone := (atStart || unicode.IsSpace(prevRune)) && (atEnd || unicode.IsSpace(nextRune))
		suffixNoSpace := atEnd && runeCount >= 2
		if standalone || atStart || suffixNoSpace {
			val := -1
			if runeCount >= 3 {
				val = 1
			} else if runeCount == 2 {
				val = 0
			}
			matches = append(matches, markerMatch{start: start, end: end, count: runeCount, val: val})
		}
	}

	for _, sub := range reExplicitPriority.FindAllStringSubmatchIndex(raw, -1) {
		if len(sub) >= 4 {
			start, end := sub[2], sub[3]
			token := strings.ToUpper(raw[start:end])
			val, count := 0, 2
			switch {
			case strings.Contains(token, "1") || strings.Contains(token, "高"):
				val, count = 1, 3
			case strings.Contains(token, "3") || strings.Contains(token, "低"):
				val, count = -1, 1
			}
			matches = append(matches, markerMatch{start: start, end: end, count: count, val: val})
		}
	}

	if len(matches) == 0 {
		return nil, false
	}

	best := matches[0]
	var spans []textSpan
	for _, m := range matches {
		spans = append(spans, textSpan{start: m.start, end: m.end, kind: "priority"})
		if m.count > best.count {
			best = m
		}
	}

	cleaned := cleanupTitleBySpans(raw, spans)
	if cleaned == "" {
		cleaned = strings.TrimSpace(raw)
	}
	label := "普通"
	switch best.val {
	case 1:
		label = "高"
	case -1:
		label = "低"
	}
	return &priorityParseResult{
		PriorityLabel: label,
		PriorityValue: best.val,
		CleanedTitle:  cleaned,
		Marker:        strings.Repeat("!", min(3, max(1, best.count))),
	}, true
}

func parseChineseNumber(raw string) (int, bool) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return 0, false
	}
	if n, err := strconv.Atoi(text); err == nil {
		return n, true
	}
	if text == "十" || text == "初十" {
		return 10, true
	}
	text = strings.TrimPrefix(text, "初")
	switch text {
	case "正":
		return 1, true
	case "冬":
		return 11, true
	case "腊":
		return 12, true
	}
	runes := []rune(text)
	if runes[0] == '廿' {
		if len(runes) == 1 {
			return 20, true
		}
		if u, ok := cnDigitMap[runes[1]]; ok {
			return 20 + u, true
		}
		return 0, false
	}
	if runes[0] == '卅' {
		if len(runes) == 1 {
			return 30, true
		}
		if u, ok := cnDigitMap[runes[1]]; ok {
			return 30 + u, true
		}
		return 0, false
	}
	if strings.ContainsRune(text, '十') {
		parts := strings.SplitN(text, "十", 2)
		tens := 1
		if parts[0] != "" {
			tRunes := []rune(parts[0])
			v, ok := cnDigitMap[tRunes[0]]
			if !ok {
				return 0, false
			}
			tens = v
		}
		units := 0
		if parts[1] != "" {
			uRunes := []rune(parts[1])
			v, ok := cnDigitMap[uRunes[0]]
			if !ok {
				return 0, false
			}
			units = v
		}
		return tens*10 + units, true
	}
	if len(runes) == 1 {
		if v, ok := cnDigitMap[runes[0]]; ok {
			return v, true
		}
	}
	return 0, false
}

func normalizeParsedHour(partOfDay string, hour int, ampm string) int {
	ampm = strings.ToLower(strings.TrimSpace(ampm))
	if ampm == "am" {
		if hour == 12 {
			return 0
		}
		return hour
	}
	if ampm == "pm" {
		if hour == 12 {
			return 12
		}
		return hour + 12
	}
	switch partOfDay {
	case "late-night", "morning":
		if hour == 12 {
			return 0
		}
		return hour
	case "noon":
		if hour >= 1 && hour <= 10 {
			return hour + 12
		}
		return hour
	case "afternoon", "evening":
		if hour >= 1 && hour <= 11 {
			return hour + 12
		}
		return hour
	}
	return hour
}

func parseNaturalTimeFromTitle(title string, now time.Time, opts naturalTimeOptions) (*naturalTimeResult, bool) {
	raw := strings.TrimSpace(title)
	if raw == "" {
		return nil, false
	}
	loc := now.Location()
	baseDay := dayStart(now)

	defHour, defMin := parseClockParts(opts.DefaultStart, 9, 0)
	mornHour, mornMin := parseClockParts(opts.Morning, 9, 0)
	noonHour, noonMin := parseClockParts(opts.Noon, 12, 0)
	aftHour, aftMin := parseClockParts(opts.Afternoon, 15, 0)
	eveHour, eveMin := parseClockParts(opts.Evening, 20, 0)

	type dateCandidate struct {
		span textSpan
		date time.Time
	}
	var absYearDates []dateCandidate
	for _, sub := range reAbsYearDate.FindAllStringSubmatchIndex(raw, -1) {
		y, _ := strconv.Atoi(raw[sub[2]:sub[3]])
		m, _ := strconv.Atoi(raw[sub[4]:sub[5]])
		d, _ := strconv.Atoi(raw[sub[6]:sub[7]])
		if m >= 1 && m <= 12 && d >= 1 && d <= 31 {
			absYearDates = append(absYearDates, dateCandidate{
				span: textSpan{start: sub[0], end: sub[1], kind: "absolute_date"},
				date: time.Date(y, time.Month(m), d, 0, 0, 0, 0, loc),
			})
		}
	}

	var absMonthDays []dateCandidate
	for _, sub := range reLunarMonthDay.FindAllStringSubmatchIndex(raw, -1) {
		hasPrefix := sub[2] >= 0 && sub[3] > sub[2]
		isLeap := sub[4] >= 0 && sub[5] > sub[4]
		mStr := strings.TrimSuffix(raw[sub[6]:sub[7]], "月")
		dStr := raw[sub[8]:sub[9]]
		isLunarKeyword := hasPrefix || isLeap || mStr == "正" || mStr == "冬" || mStr == "腊" || strings.HasPrefix(dStr, "初") || strings.HasPrefix(dStr, "廿")
		if !isLunarKeyword {
			continue
		}
		m, ok1 := parseChineseNumber(mStr)
		d, ok2 := parseChineseNumber(dStr)
		if ok1 && ok2 && m >= 1 && m <= 12 && d >= 1 && d <= 30 {
			if solar, ok := nextSolarFromLunar(m, d, isLeap, baseDay); ok {
				absMonthDays = append(absMonthDays, dateCandidate{
					span: textSpan{start: sub[0], end: sub[1], kind: "lunar_month_day"},
					date: dayStart(solar),
				})
			}
		}
	}
	for _, sub := range reAbsMonthDay.FindAllStringSubmatchIndex(raw, -1) {
		overlapsLunar := false
		for _, lc := range absMonthDays {
			if sub[0] >= lc.span.start && sub[1] <= lc.span.end {
				overlapsLunar = true
				break
			}
		}
		if overlapsLunar {
			continue
		}
		m, _ := strconv.Atoi(raw[sub[2]:sub[3]])
		d, _ := strconv.Atoi(raw[sub[4]:sub[5]])
		if m >= 1 && m <= 12 && d >= 1 && d <= 31 {
			resolved := time.Date(baseDay.Year(), time.Month(m), d, 0, 0, 0, 0, loc)
			if resolved.Before(baseDay) {
				resolved = resolved.AddDate(1, 0, 0)
			}
			absMonthDays = append(absMonthDays, dateCandidate{
				span: textSpan{start: sub[0], end: sub[1], kind: "absolute_month_day"},
				date: resolved,
			})
		}
	}
	for _, sub := range reAbsCnMonthDay.FindAllStringSubmatchIndex(raw, -1) {
		overlapsLunar := false
		for _, lc := range absMonthDays {
			if sub[0] >= lc.span.start && sub[1] <= lc.span.end {
				overlapsLunar = true
				break
			}
		}
		if overlapsLunar {
			continue
		}
		m, ok1 := parseChineseNumber(raw[sub[2]:sub[3]])
		d, ok2 := parseChineseNumber(raw[sub[4]:sub[5]])
		if ok1 && ok2 && m >= 1 && m <= 12 && d >= 1 && d <= 31 {
			resolved := time.Date(baseDay.Year(), time.Month(m), d, 0, 0, 0, 0, loc)
			if resolved.Before(baseDay) {
				resolved = resolved.AddDate(1, 0, 0)
			}
			absMonthDays = append(absMonthDays, dateCandidate{
				span: textSpan{start: sub[0], end: sub[1], kind: "absolute_month_day"},
				date: resolved,
			})
		}
	}

	var relDates []dateCandidate
	for _, sub := range reRelativeDate.FindAllStringSubmatchIndex(raw, -1) {
		val := strings.ToLower(raw[sub[2]:sub[3]])
		offset := 0
		switch val {
		case "大后天":
			offset = 3
		case "后天", "day after tomorrow":
			offset = 2
		case "明天", "明早", "明晚", "tomorrow":
			offset = 1
		}
		relDates = append(relDates, dateCandidate{
			span: textSpan{start: sub[0], end: sub[1], kind: "relative_date"},
			date: baseDay.AddDate(0, 0, offset),
		})
	}

	var cnWeekdays []dateCandidate
	for _, sub := range reCnWeekday.FindAllStringSubmatchIndex(raw, -1) {
		prefix := ""
		if sub[2] >= 0 && sub[3] >= 0 {
			prefix = raw[sub[2]:sub[3]]
		}
		wdChar := raw[sub[4]:sub[5]]
		if wdIdx, ok := cnWeekdayMondayIndex[wdChar]; ok {
			mondayOffset := (int(baseDay.Weekday()) + 6) % 7
			weekStart := baseDay.AddDate(0, 0, -mondayOffset)
			weekShift := 0
			if prefix == "下" {
				weekShift = 1
			} else if prefix == "下下" {
				weekShift = 2
			}
			cnWeekdays = append(cnWeekdays, dateCandidate{
				span: textSpan{start: sub[0], end: sub[1], kind: "weekday"},
				date: weekStart.AddDate(0, 0, weekShift*7+wdIdx),
			})
		}
	}

	var enWeekdays []dateCandidate
	for _, sub := range reEnNextWeekday.FindAllStringSubmatchIndex(raw, -1) {
		wdName := strings.ToLower(raw[sub[2]:sub[3]])
		if targetWd, ok := enWeekdaySundayIndex[wdName]; ok {
			diff := (int(targetWd) - int(baseDay.Weekday()) + 7) % 7
			diff += 7
			enWeekdays = append(enWeekdays, dateCandidate{
				span: textSpan{start: sub[0], end: sub[1], kind: "weekday"},
				date: baseDay.AddDate(0, 0, diff),
			})
		}
	}
	for _, sub := range reEnWeekday.FindAllStringSubmatchIndex(raw, -1) {
		overlapsNext := false
		for _, nx := range enWeekdays {
			if sub[0] >= nx.span.start && sub[1] <= nx.span.end {
				overlapsNext = true
				break
			}
		}
		if overlapsNext {
			continue
		}
		wdName := strings.ToLower(raw[sub[2]:sub[3]])
		if targetWd, ok := enWeekdaySundayIndex[wdName]; ok {
			diff := (int(targetWd) - int(baseDay.Weekday()) + 7) % 7
			if diff == 0 {
				diff = 7
			}
			enWeekdays = append(enWeekdays, dateCandidate{
				span: textSpan{start: sub[0], end: sub[1], kind: "weekday"},
				date: baseDay.AddDate(0, 0, diff),
			})
		}
	}

	type partCandidate struct {
		span textSpan
		part string
	}
	var partTokens []partCandidate
	for _, sub := range reCnPartOfDay.FindAllStringSubmatchIndex(raw, -1) {
		word := raw[sub[2]:sub[3]]
		part := "evening"
		switch {
		case word == "凌晨":
			part = "late-night"
		case word == "早上" || word == "上午" || word == "早晨" || word == "今早" || word == "明早":
			part = "morning"
		case word == "中午":
			part = "noon"
		case word == "下午":
			part = "afternoon"
		}
		partTokens = append(partTokens, partCandidate{
			span: textSpan{start: sub[0], end: sub[1], kind: "part_of_day"},
			part: part,
		})
	}
	for _, sub := range reEnPartOfDay.FindAllStringSubmatchIndex(raw, -1) {
		word := strings.ToLower(raw[sub[2]:sub[3]])
		part := "evening"
		switch word {
		case "morning", "this morning":
			part = "morning"
		case "noon":
			part = "noon"
		case "afternoon":
			part = "afternoon"
		case "late night":
			part = "late-night"
		}
		partTokens = append(partTokens, partCandidate{
			span: textSpan{start: sub[0], end: sub[1], kind: "part_of_day"},
			part: part,
		})
	}
	sort.Slice(partTokens, func(i, j int) bool { return partTokens[i].span.start < partTokens[j].span.start })

	type clockCandidate struct {
		span   textSpan
		hour   int
		minute int
		ampm   string
	}
	var clockTokens []clockCandidate
	for _, sub := range reClockColon.FindAllStringSubmatchIndex(raw, -1) {
		h, _ := strconv.Atoi(raw[sub[2]:sub[3]])
		m, _ := strconv.Atoi(raw[sub[4]:sub[5]])
		clockTokens = append(clockTokens, clockCandidate{
			span:   textSpan{start: sub[0], end: sub[1], kind: "time"},
			hour:   h,
			minute: m,
		})
	}
	for _, sub := range reClockHalf.FindAllStringSubmatchIndex(raw, -1) {
		h, _ := strconv.Atoi(raw[sub[2]:sub[3]])
		clockTokens = append(clockTokens, clockCandidate{
			span:   textSpan{start: sub[0], end: sub[1], kind: "time"},
			hour:   h,
			minute: 30,
		})
	}
	for _, sub := range reClockPoint.FindAllStringSubmatchIndex(raw, -1) {
		// Skip if already covered by "点半"
		covered := false
		for _, existing := range clockTokens {
			if sub[0] >= existing.span.start && sub[1] <= existing.span.end {
				covered = true
				break
			}
		}
		if covered {
			continue
		}
		h, _ := strconv.Atoi(raw[sub[2]:sub[3]])
		m := 0
		if sub[4] >= 0 && sub[5] >= 0 {
			m, _ = strconv.Atoi(raw[sub[4]:sub[5]])
		}
		clockTokens = append(clockTokens, clockCandidate{
			span:   textSpan{start: sub[0], end: sub[1], kind: "time"},
			hour:   h,
			minute: m,
		})
	}
	for _, sub := range reClockAMPM.FindAllStringSubmatchIndex(raw, -1) {
		h, _ := strconv.Atoi(raw[sub[2]:sub[3]])
		m := 0
		if sub[4] >= 0 && sub[5] >= 0 {
			m, _ = strconv.Atoi(raw[sub[4]:sub[5]])
		}
		ampm := strings.ToLower(raw[sub[6]:sub[7]])
		clockTokens = append(clockTokens, clockCandidate{
			span:   textSpan{start: sub[0], end: sub[1], kind: "time"},
			hour:   h,
			minute: m,
			ampm:   ampm,
		})
	}
	sort.Slice(clockTokens, func(i, j int) bool { return clockTokens[i].span.start < clockTokens[j].span.start })

	var allSpans []textSpan
	for _, c := range absYearDates {
		allSpans = append(allSpans, c.span)
	}
	for _, c := range absMonthDays {
		allSpans = append(allSpans, c.span)
	}
	for _, c := range relDates {
		allSpans = append(allSpans, c.span)
	}
	for _, c := range cnWeekdays {
		allSpans = append(allSpans, c.span)
	}
	for _, c := range enWeekdays {
		allSpans = append(allSpans, c.span)
	}
	for _, c := range partTokens {
		allSpans = append(allSpans, c.span)
	}
	for _, c := range clockTokens {
		allSpans = append(allSpans, c.span)
	}
	if len(allSpans) == 0 {
		return nil, false
	}

	sortCandidates := func(list []dateCandidate) {
		sort.Slice(list, func(i, j int) bool { return list[i].span.start < list[j].span.start })
	}
	sortCandidates(absYearDates)
	sortCandidates(absMonthDays)
	sortCandidates(relDates)
	sortCandidates(cnWeekdays)
	sortCandidates(enWeekdays)

	resolvedDay := baseDay
	hasDateInfo := false
	switch {
	case len(absYearDates) > 0:
		resolvedDay = absYearDates[0].date
		hasDateInfo = true
	case len(absMonthDays) > 0:
		resolvedDay = absMonthDays[0].date
		hasDateInfo = true
	case len(relDates) > 0:
		resolvedDay = relDates[0].date
		hasDateInfo = true
	case len(cnWeekdays) > 0:
		resolvedDay = cnWeekdays[0].date
		hasDateInfo = true
	case len(enWeekdays) > 0:
		resolvedDay = enWeekdays[0].date
		hasDateInfo = true
	}

	partOfDay := ""
	if len(partTokens) > 0 {
		partOfDay = partTokens[0].part
	}

	hour, minute := defHour, defMin
	if len(clockTokens) > 0 {
		tk := clockTokens[0]
		hour = normalizeParsedHour(partOfDay, tk.hour, tk.ampm)
		minute = tk.minute
	} else {
		switch partOfDay {
		case "morning":
			hour, minute = mornHour, mornMin
		case "noon":
			hour, minute = noonHour, noonMin
		case "afternoon":
			hour, minute = aftHour, aftMin
		case "evening":
			hour, minute = eveHour, eveMin
		case "late-night":
			hour, minute = 1, 0
		}
	}

	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return nil, false
	}

	parsedTime := time.Date(resolvedDay.Year(), resolvedDay.Month(), resolvedDay.Day(), hour, minute, 0, 0, loc)
	confidence := "low"
	if hasDateInfo {
		confidence = "high"
	} else if len(clockTokens) > 0 || len(partTokens) > 0 {
		confidence = "medium"
	}

	merged := mergeTextSpans(allSpans)
	cleaned := cleanupTitleBySpans(raw, merged)
	if cleaned == "" {
		cleaned = raw
	}

	return &naturalTimeResult{
		Time:         parsedTime,
		CleanedTitle: cleaned,
		Display:      parsedTime.Format("2006-01-02 15:04:05"),
		Confidence:   confidence,
		Ambiguous:    !hasDateInfo,
		Spans:        merged,
	}, true
}

func parseSmartTaskInput(rawTitle string, now time.Time, opts naturalTimeOptions) smartTaskInputResult {
	res := smartTaskInputResult{CleanedTitle: strings.TrimSpace(rawTitle)}
	if res.CleanedTitle == "" {
		return res
	}
	working := rawTitle
	if prio, ok := parsePriorityFromTitle(working); ok {
		res.HasPriority = true
		res.PriorityLabel = prio.PriorityLabel
		res.PriorityValue = prio.PriorityValue
		working = prio.CleanedTitle
		res.CleanedTitle = working
	}
	if nt, ok := parseNaturalTimeFromTitle(working, now, opts); ok {
		res.HasTime = true
		res.Time = nt.Time
		res.TimeDisplay = formatSmartTimeChip(nt.Time, now)
		if strings.TrimSpace(nt.CleanedTitle) != "" {
			res.CleanedTitle = nt.CleanedTitle
		}
	}
	return res
}

func formatSmartTimeChip(target, now time.Time) string {
	today := dayStart(now)
	targetDay := dayStart(target)
	clock := target.Format("15:04")
	switch targetDay {
	case today:
		return "今天 " + clock
	case today.AddDate(0, 0, 1):
		return "明天 " + clock
	case today.AddDate(0, 0, 2):
		return "后天 " + clock
	default:
		if target.Year() == now.Year() {
			return target.Format("01/02 15:04")
		}
		return target.Format("2006/01/02 15:04")
	}
}

func (a *App) previewSmartInput(rawTitle string) smartTaskInputResult {
	now := time.Now().In(a.location())
	return parseSmartTaskInput(rawTitle, now, a.naturalTimeOptions())
}

// alignDraftStartToRecurrence shifts d.Start (and d.End preserving duration) to
// the nearest upcoming occurrence date matching the configured weekly weekdays
// or monthly day numbers, mirroring Electron's alignStartInputToNearestRecurrence.
func alignDraftStartToRecurrence(d *Draft) {
	if d == nil || !d.HasStart {
		return
	}
	base := d.Start
	dur := time.Hour
	if d.HasEnd && d.End.After(d.Start) {
		dur = d.End.Sub(d.Start)
	}

	switch d.Repeat {
	case "每周":
		parts := splitValues(d.Rule.Weekdays)
		var targetWeekdays []time.Weekday
		for _, p := range parts {
			if idx := slices.Index(weekdays, p); idx >= 0 {
				// weekdays is Monday-first (0=Mon..5=Sat, 6=Sun)
				wd := time.Weekday((idx + 1) % 7)
				if !slices.Contains(targetWeekdays, wd) {
					targetWeekdays = append(targetWeekdays, wd)
				}
			}
		}
		if len(targetWeekdays) == 0 {
			return
		}
		for offset := 0; offset <= 14; offset++ {
			cand := base.AddDate(0, 0, offset)
			if slices.Contains(targetWeekdays, cand.Weekday()) {
				d.Start = cand
				if d.HasEnd {
					d.End = cand.Add(dur)
				}
				return
			}
		}
	case "每月":
		dates, err := repeatNumbers(d.Rule.Dates, "月内日期", 1, 31)
		if err != nil || len(dates) == 0 {
			return
		}
		for mOffset := 0; mOffset <= 12; mOffset++ {
			firstOfMonth := time.Date(base.Year(), base.Month()+time.Month(mOffset), 1, base.Hour(), base.Minute(), base.Second(), base.Nanosecond(), base.Location())
			daysInMonth := time.Date(firstOfMonth.Year(), firstOfMonth.Month()+1, 0, 0, 0, 0, 0, base.Location()).Day()
			for _, targetDay := range dates {
				dayVal := min(targetDay, daysInMonth)
				cand := time.Date(firstOfMonth.Year(), firstOfMonth.Month(), dayVal, base.Hour(), base.Minute(), base.Second(), base.Nanosecond(), base.Location())
				if !cand.Before(base) {
					d.Start = cand
					if d.HasEnd {
						d.End = cand.Add(dur)
					}
					return
				}
			}
		}
	case "农历每年":
		m, err1 := repeatNumber(d.Rule.LunarMonth, "农历月份", 1, 12)
		day, err2 := repeatNumber(d.Rule.LunarDay, "农历日期", 1, 30)
		if err1 == nil && err2 == nil {
			if nextSolar, ok := nextSolarFromLunar(m, day, d.Rule.LunarLeap, base); ok {
				d.Start = nextSolar
				if d.HasEnd {
					d.End = nextSolar.Add(dur)
				}
			}
		}
	}
}

func (a *App) applySmartTitleToDraft(d *Draft) bool {
	if d == nil || d.Task.ReadOnly {
		return false
	}
	smart := a.previewSmartInput(d.Title)
	if !smart.HasPriority && !smart.HasTime {
		return false
	}
	if smart.HasPriority {
		d.Priority = smart.PriorityLabel
	}
	if smart.HasTime {
		dur := time.Hour
		if d.HasStart && d.HasEnd && d.End.After(d.Start) {
			dur = d.End.Sub(d.Start)
		}
		d.HasStart = true
		d.AllDay = false
		d.Start = smart.Time
		if d.HasEnd || d.Task.ID == 0 {
			d.End = smart.Time.Add(dur)
		}
	}
	if strings.TrimSpace(smart.CleanedTitle) != "" {
		d.Title = smart.CleanedTitle
	}
	return true
}

func (a *App) applySmartQuickDraft() {
	q := &a.quick
	smart := a.previewSmartInput(q.Draft.Title)
	if !smart.HasPriority && !smart.HasTime {
		return
	}
	if smart.HasPriority && q.Draft.Priority == q.Base.Priority {
		q.Draft.Priority = smart.PriorityLabel
	}
	if smart.HasTime && q.Draft.HasStart == q.Base.HasStart && q.Draft.Start.Equal(q.Base.Start) {
		q.Draft.HasStart = true
		q.Draft.AllDay = false
		q.Draft.Start = smart.Time
		q.Draft.End = smart.Time.Add(time.Hour)
	}
	if strings.TrimSpace(smart.CleanedTitle) != "" {
		q.Draft.Title = smart.CleanedTitle
	}
}

func smartSummaryText(smart smartTaskInputResult) string {
	var parts []string
	if smart.HasTime {
		parts = append(parts, smart.TimeDisplay)
	}
	if smart.HasPriority {
		parts = append(parts, fmt.Sprintf("%s优先级", smart.PriorityLabel))
	}
	return strings.Join(parts, " · ")
}
