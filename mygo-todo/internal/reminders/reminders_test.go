package reminders

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"todo-native/internal/api"
	"todo-native/internal/storage"
	"todo-native/internal/syncer"
)

func fixture() Input {
	start := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	return Input{Server: "https://todo.test", User: api.User{ID: 1, Timezone: "Asia/Shanghai", DefaultReminderEnabled: true, DefaultReminderMinutes: 5}, Enabled: true, Cache: storage.Cache{Server: "https://todo.test", UserID: 1, Tasks: []api.Task{{ID: 1, Title: "测试提醒", Status: "pending", StartTime: &start}}}}
}

func TestPlanPoliciesAndAllDayTimezone(t *testing.T) {
	in := fixture()
	zero, five, invalid := 0, 5, 10081
	for _, tc := range []struct {
		name, policy string
		enabled      bool
		minutes      *int
		want         int
	}{
		{"inherit", "inherit", true, nil, 1}, {"disabled", "inherit", false, nil, 0}, {"none", "none", true, nil, 0},
		{"offset-zero", "offset", false, &zero, 1}, {"offset", "offset", false, &five, 1}, {"invalid", "offset", true, &invalid, 0}, {"missing", "offset", true, nil, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := in
			input.Cache = syncer.Clone(in.Cache)
			input.User.DefaultReminderEnabled = tc.enabled
			input.Cache.Tasks[0].ReminderPolicy, input.Cache.Tasks[0].ReminderMinutesBefore = tc.policy, tc.minutes
			if got := Plan(input); len(got) != tc.want {
				t.Fatalf("plan=%+v", got)
			}
		})
	}
	// UTC date differs from local date. The morning belongs to the user's local day.
	start := time.Date(2026, 11, 8, 16, 0, 0, 0, time.UTC)
	in.Cache.Tasks[0].StartTime, in.Cache.Tasks[0].AllDay = &start, true
	in.User.DefaultMorningTime = "08:30"
	got := Plan(in)
	want := time.Date(2026, 11, 9, 0, 25, 0, 0, time.UTC)
	if len(got) != 1 || !got[0].At.Equal(want) {
		t.Fatalf("all day=%+v want %s", got, want)
	}
	in.User.Timezone = "America/New_York"
	in.User.DefaultMorningTime = "09:00"
	start = time.Date(2026, 3, 8, 5, 0, 0, 0, time.UTC)
	got = Plan(in)
	if !got[0].At.Equal(time.Date(2026, 3, 8, 12, 55, 0, 0, time.UTC)) {
		t.Fatalf("DST morning=%s", got[0].At)
	}
}

func TestPlanIdentityAndOfflineRemoval(t *testing.T) {
	in := fixture()
	before := Plan(in)[0]
	in.Cache.Tasks[0].Title = "只修改标题"
	in.Cache.Tasks[0].Revision = 4
	if Plan(in)[0].ID != before.ID {
		t.Fatal("metadata caused repeat")
	}
	start := in.Cache.Tasks[0].StartTime.Add(time.Hour)
	in.Cache.Tasks[0].StartTime = &start
	if Plan(in)[0].ID == before.ID {
		t.Fatal("reschedule reused ID")
	}
	for _, status := range []string{"completed", "cancelled", "skipped"} {
		input := fixture()
		input.Cache.Tasks[0].Status = status
		if len(Plan(input)) != 0 {
			t.Fatal(status)
		}
	}
	for _, method := range []string{"DELETE", "PATCH"} {
		input := fixture()
		path := "/tasks/1"
		if method == "PATCH" {
			path += "/status"
		}
		state, err := syncer.Enqueue(input.Cache, method, path, map[string]string{"status": "completed"}, 1)
		if err != nil {
			t.Fatal(err)
		}
		input.Cache = state
		if len(Plan(input)) != 0 {
			t.Fatal("offline completion/deletion still scheduled")
		}
	}
	in = fixture()
	in.User.ID = 2
	if len(Plan(in)) != 0 {
		t.Fatal("account mismatch")
	}
	in = fixture()
	in.Server = "https://elsewhere.test"
	if len(Plan(in)) != 0 {
		t.Fatal("server mismatch")
	}
	in = fixture()
	in.User.ID = 2
	in.Cache.UserID = 2
	if Plan(in)[0].ID == before.ID {
		t.Fatal("cross account identity")
	}
}

func TestRecurringFutureInstancesAndOfflineSuppression(t *testing.T) {
	in := fixture()
	in.Cache.Tasks[0].RecurrenceRule = json.RawMessage("{\"freq\":\"daily\"}")
	for i := 0; i < 3; i++ {
		event := api.CalendarEvent{ID: fmt.Sprint(i), Title: "重复", Start: in.Cache.Tasks[0].StartTime.AddDate(0, 0, i).Format(time.RFC3339)}
		event.ExtendedProps.TaskID = 1
		event.ExtendedProps.IsRecurring = true
		event.ExtendedProps.InstanceID = fmt.Sprintf("1_%d", i)
		event.ExtendedProps.Status = "pending"
		in.Cache.ReminderEvents = append(in.Cache.ReminderEvents, event)
	}
	start := *in.Cache.Tasks[0].StartTime
	in.Cache.Next = []api.Occurrence{{TaskID: 1, InstanceID: "1_0", StartTime: start, Status: "pending"}}
	if len(Plan(in)) != 3 {
		t.Fatalf("duplicate next or missing future: %+v", Plan(in))
	}
	var err error
	in.Cache, err = syncer.Enqueue(in.Cache, "PATCH", "/tasks/1/status", map[string]string{"status": "completed", "instance_id": "1_0", "occurrence_date": "2026-11-09"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(Plan(in)) != 2 {
		t.Fatal("completed instance was not suppressed")
	}
	in.Cache = syncer.View(in.Cache)
	in.Cache.Outbox = nil
	if len(Plan(in)) != 2 {
		t.Fatal("confirmed instance returned from stale calendar")
	}
	in.Cache, err = syncer.Enqueue(in.Cache, "PUT", "/tasks/1", map[string]string{"title": "离线修改系列"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(Plan(in)) != 0 {
		t.Fatal("unconfirmed recurrence expansion used")
	}
}

func TestOfflineOccurrenceDescriptionKeepsReminderSchedule(t *testing.T) {
	in := fixture()
	in.Cache.Tasks[0].RecurrenceRule = json.RawMessage(`{"freq":"daily"}`)
	start := *in.Cache.Tasks[0].StartTime
	in.Cache.Next = []api.Occurrence{{TaskID: 1, InstanceID: "1_20261109", StartTime: start, OriginalDate: start, Status: "pending", Description: "原描述"}}
	before := Plan(in)
	var err error
	in.Cache, err = syncer.Enqueue(in.Cache, "PUT", "/tasks/1", map[string]string{"instance_id": "1_20261109", "occurrence_date": "2026-11-09", "description": "离线本次描述"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	after := Plan(in)
	if len(before) != 1 || len(after) != 1 || before[0].ID != after[0].ID || !before[0].At.Equal(after[0].At) || after[0].Body != "离线本次描述" {
		t.Fatal("description changed reminder identity/schedule", before, after)
	}
}

func runAt(t *testing.T, r *Runner, now time.Time, in Input) (context.CancelFunc, <-chan struct{}) {
	t.Helper()
	r.now = func() time.Time { return now }
	r.interval = 2 * time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	r.Update(in)
	go func() { defer close(done); r.Run(ctx) }()
	t.Cleanup(func() { cancel(); <-done })
	return cancel, done
}
func await(t *testing.T, ch <-chan Candidate) Candidate {
	t.Helper()
	select {
	case c := <-ch:
		return c
	case <-time.After(3 * time.Second):
		t.Fatal("notification was not delivered")
		return Candidate{}
	}
}

func TestRunnerRestartAndDueWindow(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	in := fixture()
	at := Plan(in)[0].At
	delivered := make(chan Candidate, 10)
	sink := func(ctx context.Context, c Candidate) error { delivered <- c; return nil }
	first := New(store, sink, nil)
	cancel, done := runAt(t, first, at, in)
	await(t, delivered)
	cancel()
	<-done
	ledger, err := store.ReminderLedger()
	if err != nil || len(ledger.Records) != 1 {
		t.Fatalf("%+v %v", ledger, err)
	}
	second := New(store, sink, nil)
	runAt(t, second, at.Add(time.Minute), in)
	select {
	case <-delivered:
		t.Fatal("restart duplicate")
	case <-time.After(30 * time.Millisecond):
	}
	changed := in.Cache.Tasks[0].StartTime.Add(time.Minute)
	in.Cache.Tasks[0].StartTime = &changed
	second.Update(in)
	await(t, delivered)
	// A different task older than the catch-up window is never sent.
	in.Cache.Tasks[0].ID = 99
	changed = at.Add(-time.Hour)
	in.Cache.Tasks[0].StartTime = &changed
	second.Update(in)
	select {
	case <-delivered:
		t.Fatal("stale catchup")
	case <-time.After(30 * time.Millisecond):
	}
}

func TestRunnerCancellationReleasesReservation(t *testing.T) {
	store := storage.Store{Dir: t.TempDir()}
	in := fixture()
	at := Plan(in)[0].At
	started := make(chan Candidate, 1)
	stopped := make(chan Candidate, 1)
	r := New(store, func(ctx context.Context, c Candidate) error {
		started <- c
		<-ctx.Done()
		stopped <- c
		return ctx.Err()
	}, nil)
	cancel, done := runAt(t, r, at, in)
	await(t, started)
	in.Enabled = false
	r.Update(in)
	await(t, stopped)
	cancel()
	<-done
	ledger, err := store.ReminderLedger()
	if err != nil || len(ledger.Records) != 0 {
		t.Fatalf("canceled receipt not released: %+v %v", ledger, err)
	}
	// Re-enable the same task after cancellation, with a successful sink.
	in.Enabled = true
	got := make(chan Candidate, 1)
	r = New(store, func(ctx context.Context, c Candidate) error { got <- c; return nil }, nil)
	runAt(t, r, at, in)
	await(t, got)
}

func TestRunnerDiskAndPermissionFailures(t *testing.T) {
	in := fixture()
	at := Plan(in)[0].At
	t.Run("corrupt ledger", func(t *testing.T) {
		store := storage.Store{Dir: t.TempDir()}
		path := filepath.Join(store.Dir, "reminders.json")
		_ = os.WriteFile(path, []byte("broken"), 0600)
		var calls atomic.Int32
		statuses := make(chan Status, 8)
		r := New(store, func(context.Context, Candidate) error { calls.Add(1); return nil }, func(s Status) { statuses <- s })
		cancel, done := runAt(t, r, at, in)
		select {
		case status := <-statuses:
			if !status.Failed {
				t.Fatal(status)
			}
		case <-time.After(time.Second):
			t.Fatal("missing error")
		}
		cancel()
		<-done
		bytes, _ := os.ReadFile(path)
		if string(bytes) != "broken" || calls.Load() != 0 {
			t.Fatal("corrupt ledger overwritten or sent")
		}
	})
	t.Run("unwritable receipt", func(t *testing.T) {
		store := storage.Store{Dir: t.TempDir()}
		_ = os.Mkdir(filepath.Join(store.Dir, "reminders.json"), 0700)
		calls := make(chan Candidate, 1)
		r := New(store, func(ctx context.Context, c Candidate) error { calls <- c; return nil }, nil)
		runAt(t, r, at, in)
		select {
		case <-calls:
			t.Fatal("sent without reservation")
		case <-time.After(30 * time.Millisecond):
		}
	})
	t.Run("permission denied", func(t *testing.T) {
		store := storage.Store{Dir: t.TempDir()}
		called := make(chan Candidate, 2)
		r := New(store, func(ctx context.Context, c Candidate) error { called <- c; return errors.New("denied") }, nil)
		cancel, done := runAt(t, r, at, in)
		await(t, called)
		cancel()
		<-done
		ledger, err := store.ReminderLedger()
		if err != nil || len(ledger.Records) != 0 {
			t.Fatalf("failed delivery consumed receipt: %+v %v", ledger, err)
		}
	})
}

func TestOfflineCreationKeepsReminderIdentityAfterAcknowledgement(t *testing.T) {
	in := fixture()
	in.Cache.Tasks = nil
	start := time.Date(2026, 11, 9, 10, 0, 0, 0, time.UTC)
	state, err := syncer.Enqueue(in.Cache, "POST", "/tasks", map[string]any{"title": "离线创建", "start_time": start}, 0)
	if err != nil {
		t.Fatal(err)
	}
	in.Cache = state
	first := Plan(in)
	if len(first) != 1 {
		t.Fatal(first)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(api.Task{ID: 100, Title: "离线创建", Status: "pending", StartTime: &start, Revision: 1})
	}))
	defer server.Close()
	client, _ := api.New(server.URL, "jwt")
	store := storage.Store{Dir: t.TempDir()}
	in.Cache, err = syncer.Flush(context.Background(), client, store, state)
	if err != nil {
		t.Fatal(err)
	}
	if len(in.Cache.Outbox) != 0 || len(in.Cache.Tasks) != 1 || in.Cache.Tasks[0].ID != 100 {
		t.Fatal(in.Cache)
	}
	if got := Plan(in); len(got) != 1 || got[0].ID != first[0].ID {
		t.Fatalf("acknowledgement changed reminder identity: %+v vs %+v", first, got)
	}
}
