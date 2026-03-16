package service

import (
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"
	"todo-app/internal/models"

	lunarcalendar "github.com/6tail/lunar-go/calendar"
	"github.com/teambition/rrule-go"
)

const (
	recurrenceFreqDaily       = "daily"
	recurrenceFreqWeekly      = "weekly"
	recurrenceFreqMonthly     = "monthly"
	recurrenceFreqYearly      = "yearly"
	recurrenceFreqLunarYearly = "lunar_yearly"
	recurrenceFreqLunarLegacy = "lunar"
)

var (
	weekdayTokenPattern = regexp.MustCompile(`^(-?\d)?(MO|TU|WE|TH|FR|SA|SU)$`)
	shanghaiLocation    = func() *time.Location {
		loc, err := time.LoadLocation("Asia/Shanghai")
		if err != nil {
			return time.FixedZone("CST", 8*60*60)
		}
		return loc
	}()
)

func loadLocationOrUTC(tz string) *time.Location {
	if tz == "" {
		return time.UTC
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.UTC
	}
	return loc
}

func resolveRecurrenceAnchor(start, due *time.Time) *time.Time {
	if start != nil {
		value := start.UTC()
		return &value
	}
	if due != nil {
		value := due.UTC()
		return &value
	}
	return nil
}

func normalizeRecurrenceRule(rule *models.RecurrenceRule) *models.RecurrenceRule {
	if rule == nil {
		return nil
	}
	normalized := cloneRecurrenceRule(rule)
	if normalized == nil {
		return nil
	}
	freq := strings.ToLower(strings.TrimSpace(normalized.Freq))
	if freq == recurrenceFreqLunarLegacy {
		freq = recurrenceFreqLunarYearly
	}
	normalized.Freq = freq
	if normalized.Interval <= 0 {
		normalized.Interval = 1
	}
	if len(normalized.ByDay) > 0 {
		seen := make(map[string]struct{}, len(normalized.ByDay))
		next := make([]string, 0, len(normalized.ByDay))
		for _, raw := range normalized.ByDay {
			token := strings.ToUpper(strings.TrimSpace(raw))
			if !weekdayTokenPattern.MatchString(token) {
				continue
			}
			if _, ok := seen[token]; ok {
				continue
			}
			seen[token] = struct{}{}
			next = append(next, token)
		}
		normalized.ByDay = next
	}
	if len(normalized.ByMonth) > 0 {
		next := make([]int, 0, len(normalized.ByMonth))
		for _, month := range normalized.ByMonth {
			if month < 1 || month > 12 {
				continue
			}
			next = append(next, month)
		}
		normalized.ByMonth = next
	}
	if len(normalized.ByDate) > 0 {
		next := make([]int, 0, len(normalized.ByDate))
		for _, day := range normalized.ByDate {
			if day < 1 || day > 31 {
				continue
			}
			next = append(next, day)
		}
		normalized.ByDate = next
	}
	return normalized
}

func normalizeAndValidateRecurrenceRule(
	rule *models.RecurrenceRule,
	start, due *time.Time,
) (*models.RecurrenceRule, error) {
	normalized := normalizeRecurrenceRule(rule)
	if normalized == nil {
		return nil, nil
	}
	if normalized.Count < 0 {
		return nil, errors.New("recurrence count must be greater than or equal to 0")
	}

	switch normalized.Freq {
	case recurrenceFreqDaily, recurrenceFreqWeekly, recurrenceFreqMonthly, recurrenceFreqYearly:
		return normalized, nil
	case recurrenceFreqLunarYearly:
		month := normalized.LunarMonth
		day := normalized.LunarDay
		leap := normalized.LunarIsLeapMonth
		if month < 1 || month > 12 || day < 1 || day > 30 {
			if anchor := resolveRecurrenceAnchor(start, due); anchor != nil {
				_, derivedMonth, derivedDay, derivedLeap, ok := deriveLunarFromSolarTime(*anchor)
				if ok {
					if month < 1 || month > 12 {
						month = derivedMonth
					}
					if day < 1 || day > 30 {
						day = derivedDay
					}
					if !normalized.LunarIsLeapMonth {
						leap = derivedLeap
					}
				}
			}
		}
		if month < 1 || month > 12 {
			return nil, errors.New("lunar_month must be between 1 and 12")
		}
		if day < 1 || day > 30 {
			return nil, errors.New("lunar_day must be between 1 and 30")
		}
		normalized.LunarMonth = month
		normalized.LunarDay = day
		normalized.LunarIsLeapMonth = leap
		normalized.ByDay = nil
		normalized.ByMonth = nil
		normalized.ByDate = nil
		return normalized, nil
	default:
		return nil, errors.New("unsupported recurrence frequency")
	}
}

func isLunarYearlyRule(rule *models.RecurrenceRule) bool {
	if rule == nil {
		return false
	}
	freq := strings.ToLower(strings.TrimSpace(rule.Freq))
	return freq == recurrenceFreqLunarYearly || freq == recurrenceFreqLunarLegacy
}

func buildTaskOccurrenceStarts(task *models.Task, rangeStart, rangeEnd time.Time, userTimezone string) []time.Time {
	if task == nil || task.RecurrenceRule == nil {
		return nil
	}
	anchor, hasAnchor := resolveTaskOccurrenceAnchorDate(task)
	if !hasAnchor {
		return nil
	}
	rule := normalizeRecurrenceRule(task.RecurrenceRule)
	if rule == nil {
		return nil
	}
	startUTC := rangeStart.UTC()
	endUTC := rangeEnd.UTC()
	if endUTC.Before(startUTC) {
		startUTC, endUTC = endUTC, startUTC
	}
	if isLunarYearlyRule(rule) {
		return buildLunarYearlyOccurrenceStarts(anchor, task.RecurrenceEndDate, rule, startUTC, endUTC)
	}
	return buildGregorianOccurrenceStarts(anchor, task.RecurrenceEndDate, rule, startUTC, endUTC, userTimezone)
}

func buildGregorianOccurrenceStarts(
	anchor time.Time,
	until *time.Time,
	rule *models.RecurrenceRule,
	rangeStart, rangeEnd time.Time,
	userTimezone string,
) []time.Time {
	loc := loadLocationOrUTC(userTimezone)

	// fakeUTC strategy: rrule-go requires time.UTC for all DTSTART/UNTIL values.
	// If we pass real UTC times, weekday-based rules (e.g. "every Monday") would
	// fire on the wrong local day for users offset from UTC. Instead we strip the
	// timezone offset by rewriting the user's local wall-clock time as if it were
	// UTC (toFakeUTC), run the rrule expansion, then restore the real UTC instant
	// by re-interpreting the result in the user's location (fromFakeUTC).
	toFakeUTC := func(t time.Time) time.Time {
		local := t.In(loc)
		return time.Date(local.Year(), local.Month(), local.Day(), local.Hour(), local.Minute(), local.Second(), local.Nanosecond(), time.UTC)
	}
	fromFakeUTC := func(t time.Time) time.Time {
		return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), loc).UTC()
	}

	fakeAnchor := toFakeUTC(anchor)
	var fakeUntil *time.Time
	if until != nil {
		fu := toFakeUTC(*until)
		fakeUntil = &fu
	}

	rruleText := buildRRuleString(rule, &fakeAnchor, fakeUntil)
	parsedRule, err := rrule.StrToRRule(rruleText)
	if err != nil {
		return nil
	}

	fakeStart := toFakeUTC(rangeStart)
	fakeEnd := toFakeUTC(rangeEnd)
	occurrences := parsedRule.Between(fakeStart, fakeEnd, true)
	if len(occurrences) == 0 {
		return nil
	}
	seen := make(map[int64]struct{}, len(occurrences))
	out := make([]time.Time, 0, len(occurrences))
	for _, occurrence := range occurrences {
		ts := fromFakeUTC(occurrence)
		key := ts.UnixNano()
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, ts)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Before(out[j]) })
	return out
}

func buildLunarYearlyOccurrenceStarts(
	anchor time.Time,
	until *time.Time,
	rule *models.RecurrenceRule,
	rangeStart, rangeEnd time.Time,
) []time.Time {
	anchorUTC := anchor.UTC()
	anchorLocal := anchorUTC.In(shanghaiLocation)
	anchorLunarYear, month, day, leapMonth, ok := deriveLunarFromSolarTime(anchorUTC)
	if !ok {
		return nil
	}
	if rule.LunarMonth >= 1 && rule.LunarMonth <= 12 {
		month = rule.LunarMonth
	}
	if rule.LunarDay >= 1 && rule.LunarDay <= 30 {
		day = rule.LunarDay
	}
	leapMonth = rule.LunarIsLeapMonth

	interval := rule.Interval
	if interval <= 0 {
		interval = 1
	}
	count := rule.Count
	if count < 0 {
		count = 0
	}

	endLocal := rangeEnd.UTC().In(shanghaiLocation)
	maxYear := endLocal.Year() + 2
	if until != nil {
		untilYear := until.UTC().In(shanghaiLocation).Year() + 1
		if untilYear < maxYear {
			maxYear = untilYear
		}
	}
	if count > 0 {
		limitByCount := anchorLunarYear + (count+1)*interval
		if limitByCount < maxYear {
			maxYear = limitByCount
		}
	}
	if maxYear < anchorLunarYear {
		maxYear = anchorLunarYear
	}

	seen := map[int64]struct{}{}
	out := make([]time.Time, 0, 16)
	sequence := 0
	for year := anchorLunarYear; year <= maxYear; year += interval {
		occurrenceLocal, ok := resolveLunarOccurrenceLocalTime(year, month, day, leapMonth, anchorLocal)
		if !ok {
			continue
		}
		occurrenceUTC := occurrenceLocal.UTC()
		if occurrenceUTC.Before(anchorUTC) {
			continue
		}
		if until != nil && occurrenceUTC.After(until.UTC()) {
			break
		}
		sequence += 1
		if count > 0 && sequence > count {
			break
		}
		if occurrenceUTC.Before(rangeStart.UTC()) || occurrenceUTC.After(rangeEnd.UTC()) {
			continue
		}
		key := occurrenceUTC.UnixNano()
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, occurrenceUTC)
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Before(out[j]) })
	return out
}

func resolveLunarOccurrenceLocalTime(
	lunarYear, lunarMonth, lunarDay int,
	preferLeapMonth bool,
	anchorLocal time.Time,
) (time.Time, bool) {
	if lunarMonth < 1 || lunarMonth > 12 || lunarDay < 1 {
		return time.Time{}, false
	}
	targetMonth := lunarMonth
	if preferLeapMonth {
		targetMonth = -lunarMonth
	}
	month := lunarcalendar.NewLunarMonthFromYm(lunarYear, targetMonth)
	if month == nil && preferLeapMonth {
		month = lunarcalendar.NewLunarMonthFromYm(lunarYear, lunarMonth)
	}
	if month == nil {
		return time.Time{}, false
	}
	maxDay := month.GetDayCount()
	day := lunarDay
	if day > maxDay {
		day = maxDay
	}
	lunar, ok := safeNewLunar(
		lunarYear,
		month.GetMonth(),
		day,
		anchorLocal.Hour(),
		anchorLocal.Minute(),
		anchorLocal.Second(),
	)
	if !ok || lunar == nil || lunar.GetSolar() == nil {
		return time.Time{}, false
	}
	solar := lunar.GetSolar()
	return time.Date(
		solar.GetYear(),
		time.Month(solar.GetMonth()),
		solar.GetDay(),
		anchorLocal.Hour(),
		anchorLocal.Minute(),
		anchorLocal.Second(),
		0,
		shanghaiLocation,
	), true
}

func deriveLunarFromSolarTime(value time.Time) (year, month, day int, leap bool, ok bool) {
	local := value.UTC().In(shanghaiLocation)
	solar := lunarcalendar.NewSolar(
		local.Year(),
		int(local.Month()),
		local.Day(),
		local.Hour(),
		local.Minute(),
		local.Second(),
	)
	lunar := solar.GetLunar()
	if lunar == nil {
		return 0, 0, 0, false, false
	}
	monthValue := lunar.GetMonth()
	leap = monthValue < 0
	if monthValue < 0 {
		monthValue = -monthValue
	}
	return lunar.GetYear(), monthValue, lunar.GetDay(), leap, true
}

func safeNewLunar(year, month, day, hour, minute, second int) (lunar *lunarcalendar.Lunar, ok bool) {
	ok = true
	defer func() {
		if recover() != nil {
			lunar = nil
			ok = false
		}
	}()
	lunar = lunarcalendar.NewLunar(year, month, day, hour, minute, second)
	return lunar, true
}
