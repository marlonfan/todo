package service

import (
	"errors"
	"strconv"
	"strings"
	"time"
)

const maxCalendarDurationSeconds = uint64(1<<63-1) / uint64(time.Second)

// parseICalDuration parses the RFC 5545 positive duration forms that can be
// represented by a Todo event. Calendar months and years are deliberately not
// accepted because their elapsed length depends on the DTSTART calendar.
func parseICalDuration(raw string) (time.Duration, error) {
	s := strings.ToUpper(strings.TrimSpace(raw))
	if s == "" || s[0] != 'P' || strings.ContainsAny(s, "+-") {
		return 0, errors.New("invalid calendar duration")
	}
	i := 1
	var total uint64
	hasDate, hasWeeks, hasTime, hasTimePart := false, false, false, false
	lastTimeRank := 0
	add := func(value, multiplier uint64) error {
		if multiplier == 0 || value > (maxCalendarDurationSeconds-total)/multiplier {
			return errors.New("calendar duration is too large")
		}
		total += value * multiplier
		return nil
	}
	for i < len(s) {
		if s[i] == 'T' {
			if hasTime || i == len(s)-1 {
				return 0, errors.New("invalid calendar duration")
			}
			hasTime = true
			i++
			continue
		}
		start := i
		for i < len(s) && s[i] >= '0' && s[i] <= '9' {
			i++
		}
		if start == i || i >= len(s) {
			return 0, errors.New("invalid calendar duration")
		}
		value, err := strconv.ParseUint(s[start:i], 10, 64)
		if err != nil {
			return 0, errors.New("invalid calendar duration")
		}
		unit := s[i]
		i++
		if !hasTime {
			switch unit {
			case 'W':
				if hasDate || hasWeeks || i != len(s) {
					return 0, errors.New("invalid calendar duration")
				}
				if err := add(value, 7*24*60*60); err != nil {
					return 0, err
				}
				hasWeeks = true
			case 'D':
				if hasDate || hasWeeks {
					return 0, errors.New("invalid calendar duration")
				}
				if err := add(value, 24*60*60); err != nil {
					return 0, err
				}
				hasDate = true
			default:
				return 0, errors.New("calendar duration must use weeks or days before T")
			}
			continue
		}
		rank, multiplier := 0, uint64(0)
		switch unit {
		case 'H':
			rank, multiplier = 1, 60*60
		case 'M':
			rank, multiplier = 2, 60
		case 'S':
			rank, multiplier = 3, 1
		default:
			return 0, errors.New("calendar duration contains an unsupported unit")
		}
		if rank <= lastTimeRank {
			return 0, errors.New("calendar duration units are out of order")
		}
		if err := add(value, multiplier); err != nil {
			return 0, err
		}
		lastTimeRank = rank
		hasTimePart = true
	}
	if (!hasDate && !hasWeeks && !hasTimePart) || (hasTime && !hasTimePart) {
		return 0, errors.New("invalid calendar duration")
	}
	if total == 0 {
		return 0, errors.New("calendar duration must be positive")
	}
	return time.Duration(total) * time.Second, nil
}
