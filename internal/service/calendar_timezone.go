package service

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// Include historical observances and the tzdb's future annual rules. Keeping
// the cutoff fixed makes object ETags independent of the day a client polls.
func calendarTimezoneComponent(loc *time.Location) string {
	if loc == time.UTC {
		return ""
	}
	type phase struct {
		kind, name string
		from, to   int
		dates      []time.Time
	}
	phases := map[string]*phase{}
	add := func(at time.Time, from, to int, name string, dst bool) {
		kind := "STANDARD"
		if dst {
			kind = "DAYLIGHT"
		}
		key := fmt.Sprintf("%s|%s|%d|%d", kind, name, from, to)
		if phases[key] == nil {
			phases[key] = &phase{kind: kind, name: name, from: from, to: to}
		}
		// Observance DTSTART is local wall time immediately before the change.
		phases[key].dates = append(phases[key].dates, at.UTC().Add(time.Duration(from)*time.Second))
	}
	cursor := time.Date(1, 1, 1, 0, 0, 0, 0, loc).UTC()
	name, offset := cursor.In(loc).Zone()
	add(cursor, offset, offset, name, cursor.In(loc).IsDST())
	stop := time.Date(2105, 1, 1, 0, 0, 0, 0, time.UTC)
	for cursor.Before(stop) {
		_, next := cursor.In(loc).ZoneBounds()
		if next.IsZero() || !next.Before(stop) {
			break
		}
		if !next.After(cursor) {
			// Go's POSIX extension can report a stale year-end bound on the
			// last day of a leap year. Advance without losing a real change.
			next = cursor.Add(24 * time.Hour)
			nextName, nextOffset := next.In(loc).Zone()
			if nextName == name && nextOffset == offset && next.In(loc).IsDST() == cursor.In(loc).IsDST() {
				cursor = next
				continue
			}
			low, high := cursor.Unix(), next.Unix()
			for high-low > 1 {
				mid := low + (high-low)/2
				tm := time.Unix(mid, 0).In(loc)
				n, off := tm.Zone()
				if n == name && off == offset && tm.IsDST() == cursor.In(loc).IsDST() {
					low = mid
				} else {
					high = mid
				}
			}
			next = time.Unix(high, 0).UTC()
		}
		nextName, after := next.In(loc).Zone()
		if after != offset || nextName != name || next.In(loc).IsDST() != cursor.In(loc).IsDST() {
			add(next, offset, after, nextName, next.In(loc).IsDST())
		}
		name = nextName
		offset, cursor = after, next
	}
	keys := make([]string, 0, len(phases))
	for key := range phases {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	lines := []string{"BEGIN:VTIMEZONE", "TZID:" + loc.String()}
	for _, key := range keys {
		p := phases[key]
		tail, rule := calendarTimezoneTailRule(p.dates)
		parts := [][]time.Time{p.dates}
		if rule != "" {
			parts = [][]time.Time{p.dates[:tail], p.dates[tail : tail+1]}
		}
		for part, dates := range parts {
			if len(dates) == 0 {
				continue
			}
			lines = append(lines, "BEGIN:"+p.kind, "DTSTART:"+dates[0].Format("20060102T150405"), "TZOFFSETFROM:"+calendarUTCOffset(p.from), "TZOFFSETTO:"+calendarUTCOffset(p.to), "TZNAME:"+escapeICalText(p.name))
			if part == 1 {
				lines = append(lines, "RRULE:"+rule)
			} else if len(dates) > 1 {
				values := make([]string, 0, len(dates)-1)
				for _, date := range dates[1:] {
					values = append(values, date.Format("20060102T150405"))
				}
				lines = append(lines, "RDATE:"+strings.Join(values, ","))
			}
			lines = append(lines, "END:"+p.kind)
		}
	}
	return strings.Join(append(lines, "END:VTIMEZONE"), "\r\n")
}

func calendarUTCOffset(seconds int) string {
	sign := "+"
	if seconds < 0 {
		sign, seconds = "-", -seconds
	}
	value := fmt.Sprintf("%s%02d%02d", sign, seconds/3600, seconds%3600/60)
	if seconds%60 != 0 {
		value += fmt.Sprintf("%02d", seconds%60)
	}
	return value
}

// At the end of the tzdb table Go expands its POSIX future rule. Infer the
// RFC 5545 equivalent only from four consecutive, matching annual changes.
func calendarTimezoneTailRule(dates []time.Time) (int, string) {
	if len(dates) < 4 {
		return 0, ""
	}
	i := len(dates) - 4
	tail, first := dates[i:], dates[i]
	if first.Year() != 2101 {
		return 0, ""
	}
	day, week, yearDay := true, true, true
	ordinal := func(v time.Time) int {
		if v.AddDate(0, 0, 7).Month() != v.Month() {
			return -1
		}
		return (v.Day()-1)/7 + 1
	}
	for j, date := range tail {
		if date.Year() != first.Year()+j || date.Format("15:04:05") != first.Format("15:04:05") {
			return 0, ""
		}
		day = day && date.Month() == first.Month() && date.Day() == first.Day()
		week = week && date.Month() == first.Month() && date.Weekday() == first.Weekday() && ordinal(date) == ordinal(first)
		yearDay = yearDay && date.YearDay() == first.YearDay()
	}
	base := fmt.Sprintf("FREQ=YEARLY;BYMONTH=%d;", first.Month())
	if day {
		return i, base + fmt.Sprintf("BYMONTHDAY=%d", first.Day())
	}
	if week {
		return i, base + fmt.Sprintf("BYDAY=%d%s", ordinal(first), []string{"SU", "MO", "TU", "WE", "TH", "FR", "SA"}[first.Weekday()])
	}
	if yearDay {
		return i, fmt.Sprintf("FREQ=YEARLY;BYYEARDAY=%d", first.YearDay())
	}
	return 0, ""
}
