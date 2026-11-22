package domain

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"nsgo-todo/internal/api"
)

type Filter string

const (
	FilterToday     Filter = "today"
	FilterInbox     Filter = "inbox"
	FilterUpcoming  Filter = "upcoming"
	FilterAll       Filter = "all"
	FilterCompleted Filter = "completed"
	FilterCancelled Filter = "cancelled"
	FilterSkipped   Filter = "skipped"
)

type FilterCounts struct {
	Today     int
	Inbox     int
	Upcoming  int
	All       int
	Completed int
	Cancelled int
	Skipped   int
	Overdue   int
	Category  map[int64]int
}

// Location resolves a user's configured IANA timezone, falling back to time.Local.
func Location(tz string) *time.Location {
	tz = strings.TrimSpace(tz)
	if tz == "" {
		return time.Local
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.Local
	}
	return loc
}

// ProjectTasks overlays next occurrence dates onto recurring tasks so mobile
// list rows display the next pending occurrence accurately.
func ProjectTasks(tasks []api.Task, next []api.Occurrence) []api.Task {
	nextByTask := make(map[int64]api.Occurrence, len(next))
	for _, occ := range next {
		if existing, ok := nextByTask[occ.TaskID]; !ok || occ.StartTime.Before(existing.StartTime) {
			nextByTask[occ.TaskID] = occ
		}
	}
	out := make([]api.Task, 0, len(tasks))
	for _, t := range tasks {
		if t.Recurring() {
			if occ, ok := nextByTask[t.ID]; ok {
				t.InstanceID = occ.InstanceID
				t.OccurrenceDate = occ.OriginalDate.UTC().Format("2006-01-02")
				st := occ.StartTime
				t.StartTime = &st
				t.EndTime = occ.EndTime
				t.AllDay = occ.AllDay
				if strings.TrimSpace(occ.Title) != "" {
					t.Title = occ.Title
				}
			}
		}
		out = append(out, t)
	}
	return out
}

// IsActive reports whether a task is still open (pending or in_progress).
func IsActive(status string) bool {
	return status == "" || status == "pending" || status == "in_progress"
}

// EffectiveDate returns the task's primary scheduling timestamp (DueDate if set, else StartTime).
func EffectiveDate(t api.Task) *time.Time {
	if t.DueDate != nil {
		return t.DueDate
	}
	return t.StartTime
}

func startOfDay(t time.Time, loc *time.Location) time.Time {
	l := t.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, loc)
}

// IsOverdue reports whether an active task's schedule lies strictly before today (or before now if timed).
func IsOverdue(t api.Task, now time.Time, loc *time.Location) bool {
	if !IsActive(t.Status) {
		return false
	}
	ref := EffectiveDate(t)
	if ref == nil {
		return false
	}
	today := startOfDay(now, loc)
	if t.AllDay || (ref.In(loc).Hour() == 0 && ref.In(loc).Minute() == 0 && ref.In(loc).Second() == 0) {
		return startOfDay(*ref, loc).Before(today)
	}
	return ref.In(loc).Before(now.In(loc))
}

func isTodayOrOverdue(t api.Task, now time.Time, loc *time.Location) bool {
	if !IsActive(t.Status) {
		return false
	}
	ref := EffectiveDate(t)
	if ref == nil {
		return false
	}
	tomorrow := startOfDay(now, loc).AddDate(0, 0, 1)
	return ref.In(loc).Before(tomorrow)
}

func isUpcoming(t api.Task, now time.Time, loc *time.Location) bool {
	if !IsActive(t.Status) {
		return false
	}
	ref := EffectiveDate(t)
	if ref == nil {
		return false
	}
	horizon := startOfDay(now, loc).AddDate(0, 0, 7)
	return ref.In(loc).Before(horizon)
}

func isInbox(t api.Task) bool {
	return IsActive(t.Status) && t.StartTime == nil && t.DueDate == nil && len(t.Categories) == 0
}

// HasCategory reports whether task belongs to categoryID.
func HasCategory(t api.Task, categoryID int64) bool {
	for _, c := range t.Categories {
		if c.ID == categoryID {
			return true
		}
	}
	return false
}

// MatchesFilter evaluates filter + optional categoryID + optional search query.
func MatchesFilter(t api.Task, filter Filter, categoryID int64, query string, now time.Time, loc *time.Location) bool {
	if categoryID != 0 {
		if !IsActive(t.Status) || !HasCategory(t, categoryID) {
			return false
		}
	} else {
		switch filter {
		case FilterToday:
			if !isTodayOrOverdue(t, now, loc) {
				return false
			}
		case FilterInbox:
			if !isInbox(t) {
				return false
			}
		case FilterUpcoming:
			if !isUpcoming(t, now, loc) {
				return false
			}
		case FilterCompleted:
			if t.Status != "completed" {
				return false
			}
		case FilterCancelled:
			if t.Status != "cancelled" {
				return false
			}
		case FilterSkipped:
			if t.Status != "skipped" {
				return false
			}
		case FilterAll:
			if !IsActive(t.Status) {
				return false
			}
		default:
			if !IsActive(t.Status) {
				return false
			}
		}
	}
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		return true
	}
	if strings.Contains(strings.ToLower(t.Title), q) || strings.Contains(strings.ToLower(t.Description), q) {
		return true
	}
	for _, c := range t.Categories {
		if strings.Contains(strings.ToLower(c.Name), q) {
			return true
		}
	}
	return false
}

// FilterAndSort filters projected tasks and sorts them for mobile readability:
// active before closed, overdue/earlier dates first, higher priority first, newer updated first.
func FilterAndSort(tasks []api.Task, filter Filter, categoryID int64, query string, now time.Time, loc *time.Location) []api.Task {
	out := make([]api.Task, 0, len(tasks))
	for _, t := range tasks {
		if MatchesFilter(t, filter, categoryID, query, now, loc) {
			out = append(out, t)
		}
	}
	slices.SortStableFunc(out, func(a, b api.Task) int {
		// Completed/archived lists sort newest completion/update first.
		if filter == FilterCompleted || filter == FilterCancelled || filter == FilterSkipped {
			ta, tb := a.UpdatedAt, b.UpdatedAt
			if a.CompletedAt != nil {
				ta = *a.CompletedAt
			}
			if b.CompletedAt != nil {
				tb = *b.CompletedAt
			}
			if !ta.Equal(tb) {
				if ta.After(tb) {
					return -1
				}
				return 1
			}
		}
		// Active tasks: overdue first, then dated tasks chronologically, then undated.
		oa, ob := IsOverdue(a, now, loc), IsOverdue(b, now, loc)
		if oa != ob {
			if oa {
				return -1
			}
			return 1
		}
		da, db := EffectiveDate(a), EffectiveDate(b)
		if (da != nil) != (db != nil) {
			if da != nil {
				return -1
			}
			return 1
		}
		if da != nil && db != nil && !da.Equal(*db) {
			if da.Before(*db) {
				return -1
			}
			return 1
		}
		if a.Priority != b.Priority {
			if a.Priority > b.Priority {
				return -1
			}
			return 1
		}
		if !a.UpdatedAt.Equal(b.UpdatedAt) {
			if a.UpdatedAt.After(b.UpdatedAt) {
				return -1
			}
			return 1
		}
		if a.ID < b.ID {
			return 1
		}
		if a.ID > b.ID {
			return -1
		}
		return 0
	})
	return out
}

// Counts computes filter & category counts from projected tasks.
func Counts(tasks []api.Task, now time.Time, loc *time.Location) FilterCounts {
	c := FilterCounts{Category: make(map[int64]int)}
	for _, t := range tasks {
		if IsActive(t.Status) {
			c.All++
			if IsOverdue(t, now, loc) {
				c.Overdue++
			}
			if isTodayOrOverdue(t, now, loc) {
				c.Today++
			}
			if isInbox(t) {
				c.Inbox++
			}
			if isUpcoming(t, now, loc) {
				c.Upcoming++
			}
			for _, cat := range t.Categories {
				c.Category[cat.ID]++
			}
		} else {
			switch t.Status {
			case "completed":
				c.Completed++
			case "cancelled":
				c.Cancelled++
			case "skipped":
				c.Skipped++
			}
		}
	}
	return c
}

// FormatTaskDate returns a compact Chinese date label and whether it is overdue.
func FormatTaskDate(t api.Task, now time.Time, loc *time.Location) (string, bool) {
	ref := EffectiveDate(t)
	if ref == nil {
		return "", false
	}
	overdue := IsOverdue(t, now, loc)
	localRef := ref.In(loc)
	today := startOfDay(now, loc)
	refDay := startOfDay(*ref, loc)
	diffDays := int(refDay.Sub(today).Hours() / 24)

	hasTime := !t.AllDay && (localRef.Hour() != 0 || localRef.Minute() != 0)
	timeSuffix := ""
	if hasTime {
		timeSuffix = " " + localRef.Format("15:04")
	}

	switch diffDays {
	case 0:
		return "今天" + timeSuffix, overdue
	case 1:
		return "明天" + timeSuffix, overdue
	case -1:
		return "昨天" + timeSuffix, overdue
	}
	if localRef.Year() == now.In(loc).Year() {
		return fmt.Sprintf("%d月%d日%s", int(localRef.Month()), localRef.Day(), timeSuffix), overdue
	}
	return fmt.Sprintf("%d/%d/%d%s", localRef.Year(), int(localRef.Month()), localRef.Day(), timeSuffix), overdue
}

func PriorityLabel(priority int) string {
	switch priority {
	case 1:
		return "低"
	case 2:
		return "中"
	case 3:
		return "高"
	default:
		return "无"
	}
}

func StatusLabel(status string) string {
	switch status {
	case "in_progress":
		return "进行中"
	case "completed":
		return "已完成"
	case "cancelled":
		return "已取消"
	case "skipped":
		return "已跳过"
	default:
		return "待办"
	}
}

func FilterLabel(filter Filter) string {
	switch filter {
	case FilterToday:
		return "今天"
	case FilterInbox:
		return "收件箱"
	case FilterUpcoming:
		return "即将到来"
	case FilterCompleted:
		return "已完成"
	case FilterCancelled:
		return "已取消"
	case FilterSkipped:
		return "已跳过"
	default:
		return "全部任务"
	}
}

// ParseHexRGB parses "#RRGGBB" into 0xRRGGBB.
func ParseHexRGB(raw string) (uint32, bool) {
	s := strings.TrimPrefix(strings.TrimSpace(raw), "#")
	if len(s) != 6 {
		return 0, false
	}
	v, err := strconv.ParseUint(s, 16, 32)
	if err != nil {
		return 0, false
	}
	return uint32(v), true
}
