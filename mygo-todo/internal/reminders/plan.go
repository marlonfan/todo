// Package reminders schedules desktop notifications without owning UI or network state.
package reminders

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

const Grace = 15 * time.Minute

type Input struct {
	Server  string
	User    api.User
	Cache   storage.Cache
	Enabled bool
}

type Candidate struct {
	ID, Scope, TaskKey, InstanceID string
	Title, Body                    string
	At, Start                      time.Time
}

func digest(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
func Scope(server string, userID int64) string { return digest(fmt.Sprintf("%s|%d", server, userID)) }
func TaskKey(state storage.Cache, id int64) string {
	if key := state.ReminderKeys[id]; key != "" {
		return key
	}
	return fmt.Sprintf("task:%d", id)
}

func offset(t api.Task, u api.User) (int, bool) {
	if t.Status != "pending" || t.ReadOnly {
		return 0, false
	}
	switch t.ReminderPolicy {
	case "none":
		return 0, false
	case "offset":
		if t.ReminderMinutesBefore == nil || *t.ReminderMinutesBefore < 0 || *t.ReminderMinutesBefore > 10080 {
			return 0, false
		}
		return *t.ReminderMinutesBefore, true
	default:
		if !u.DefaultReminderEnabled {
			return 0, false
		}
		if u.DefaultReminderMinutes <= 0 {
			return 5, true
		}
		return u.DefaultReminderMinutes, u.DefaultReminderMinutes <= 10080
	}
}

func location(u api.User) *time.Location {
	if loc, err := time.LoadLocation(u.Timezone); err == nil && u.Timezone != "" {
		return loc
	}
	return time.Local
}

func reminderStart(start time.Time, allDay bool, u api.User) time.Time {
	if !allDay {
		return start
	}
	clock, err := time.Parse("15:04", u.DefaultMorningTime)
	if err != nil {
		clock, _ = time.Parse("15:04", "09:00")
	}
	day := start.In(location(u))
	return time.Date(day.Year(), day.Month(), day.Day(), clock.Hour(), clock.Minute(), 0, 0, day.Location())
}

// Plan includes already-due entries; the runner applies a bounded catch-up window.
// Recurrence expansion stays on the server, including complex/lunar rules and overrides.
func Plan(in Input) []Candidate {
	if !in.Enabled || in.User.ID == 0 || in.Cache.Server != in.Server || in.Cache.UserID != in.User.ID {
		return nil
	}
	view := syncer.View(in.Cache)
	tasks := make(map[int64]api.Task)
	dirtySeries := make(map[int64]bool)
	suppressed := make(map[string]bool)
	for _, op := range in.Cache.Outbox {
		var scope struct {
			InstanceID string `json:"instance_id"`
		}
		_ = json.Unmarshal(op.Body, &scope)
		if op.Method == "PUT" && scope.InstanceID == "" {
			dirtySeries[op.TaskID] = true
		}
		if op.Suffix == "/status" {
			var fields struct {
				InstanceID string `json:"instance_id"`
				Status     string `json:"status"`
			}
			_ = json.Unmarshal(op.Body, &fields)
			if fields.InstanceID != "" {
				suppressed[fmt.Sprintf("%d/%s", op.TaskID, fields.InstanceID)] = fields.Status != "pending"
			}
		}
	}
	var result []Candidate
	seen := make(map[string]bool)
	add := func(t api.Task, instance string) {
		minutes, enabled := offset(t, in.User)
		if !enabled || t.StartTime == nil || t.StartTime.IsZero() {
			return
		}
		start := reminderStart(*t.StartTime, t.AllDay, in.User)
		at := start.Add(-time.Duration(minutes) * time.Minute)
		scope, taskKey := Scope(in.Server, in.User.ID), TaskKey(in.Cache, t.ID)
		id := "todo-" + digest(fmt.Sprintf("%s|%s|%s|%s", scope, taskKey, instance, at.UTC().Format(time.RFC3339Nano)))
		if seen[id] {
			return
		}
		seen[id] = true
		result = append(result, Candidate{ID: id, Scope: scope, TaskKey: taskKey, InstanceID: instance, Title: t.Title, Body: t.Description, At: at, Start: start.In(location(in.User))})
	}
	for _, t := range view.Tasks {
		tasks[t.ID] = t
		if !t.Recurring() {
			add(t, "")
		}
	}
	seenInstances := make(map[string]bool)
	for _, event := range view.ReminderEvents {
		props := event.ExtendedProps
		t, ok := tasks[props.TaskID]
		key := fmt.Sprintf("%d/%s", props.TaskID, props.InstanceID)
		if !ok || !t.Recurring() || t.Status != "pending" || dirtySeries[t.ID] || props.ReadOnly || props.InstanceID == "" || suppressed[key] {
			continue
		}
		if props.Status != "" && props.Status != "pending" {
			continue
		}
		start, err := time.Parse(time.RFC3339Nano, event.Start)
		if err != nil {
			start, err = time.ParseInLocation("2006-01-02", event.Start, location(in.User))
		}
		if err != nil {
			continue
		}
		t.StartTime, t.AllDay, t.Title = &start, event.AllDay, event.Title
		t.Description = props.Description
		add(t, props.InstanceID)
		seenInstances[key] = true
	}
	// Backward-compatible caches contain only the next instance.
	for _, o := range view.Next {
		t, ok := tasks[o.TaskID]
		key := fmt.Sprintf("%d/%s", o.TaskID, o.InstanceID)
		if !ok || !t.Recurring() || t.Status != "pending" || dirtySeries[t.ID] || seenInstances[key] || suppressed[key] || o.Status != "pending" || o.InstanceID == "" {
			continue
		}
		t.StartTime, t.AllDay = &o.StartTime, o.AllDay
		if o.Title != "" {
			t.Title = o.Title
		}
		t.Description = o.Description
		add(t, o.InstanceID)
	}
	slices.SortFunc(result, func(a, b Candidate) int {
		if cmp := a.At.Compare(b.At); cmp != 0 {
			return cmp
		}
		if a.ID < b.ID {
			return -1
		}
		if a.ID > b.ID {
			return 1
		}
		return 0
	})
	return result
}
