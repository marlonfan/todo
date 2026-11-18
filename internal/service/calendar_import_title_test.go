package service

import (
	"strings"
	"testing"
	"time"

	"todo-app/internal/models"
)

func TestCalendarImportDetachedSummaryPreservesTitleInheritance(t *testing.T) {
	for _, title := range []string{"", "Series", "Explicit title"} {
		t.Run("override="+title, func(t *testing.T) {
			s, repo, userID := newTestTaskService(t)
			calendar := NewCalendarExportService(s, s.userRepo, "test")
			master := importCalendarEvent("title-inheritance@example", "SUMMARY:Series\nDTSTART:20260310T090000Z\nDTEND:20260310T100000Z\nRRULE:FREQ=DAILY;COUNT=3")
			object, _, err := calendar.UpsertObject(userID, "title-inheritance.ics", importCalendarDocument(master))
			if err != nil {
				t.Fatal(err)
			}
			date := time.Date(2026, 3, 11, 0, 0, 0, 0, time.UTC)
			completedAt := date.Add(10 * time.Hour)
			if err := repo.UpsertTaskOccurrence(&models.TaskOccurrence{UserID: userID, TaskID: object.Task.ID, OccurrenceDate: date, Title: title, Status: models.TaskStatusCompleted, CompletedAt: &completedAt}); err != nil {
				t.Fatal(err)
			}
			object, err = calendar.GetObject(userID, object.Href)
			if err != nil {
				t.Fatal(err)
			}
			// Both inherited and explicit titles equal to the series export
			// SUMMARY:Series. Reimport must preserve the stored distinction.
			for i := 0; i < 2; i++ {
				object, _, err = calendar.UpsertObject(userID, object.Href, []byte(object.Data))
				if err != nil {
					t.Fatal(err)
				}
				row, err := repo.GetTaskOccurrence(userID, object.Task.ID, date)
				if err != nil || row.Title != title || row.Status != models.TaskStatusCompleted || row.CompletedAt == nil || !row.CompletedAt.Equal(completedAt) {
					t.Fatalf("roundtrip %d: row=%+v err=%v, want title %q and original completion", i, row, err, title)
				}
			}
			// Replace only the master and retain the completed instance. Its
			// stored title alone must determine whether it inherits the rename.
			master = strings.Replace(master, "SUMMARY:Series", "SUMMARY:Renamed series", 1)
			object, _, err = calendar.UpsertObject(userID, object.Href, importCalendarDocument(master))
			if err != nil {
				t.Fatal(err)
			}
			want := title
			if want == "" {
				want = "Renamed series"
			}
			wantCount := 1
			if title == "" {
				wantCount = 2 // Master and inherited detached component.
			}
			if strings.Count(object.Data, "SUMMARY:"+want+"\r\n") != wantCount {
				t.Fatalf("wrong effective detached title after series rename: want %q, data=%s", want, object.Data)
			}
		})
	}
}

func TestCalendarImportDetachedTitleRepeatedUpdatesAndClear(t *testing.T) {
	s, repo, userID := newTestTaskService(t)
	calendar := NewCalendarExportService(s, s.userRepo, "test")
	master := importCalendarEvent("title-updates@example", "SUMMARY:Series\nDTSTART:20260310T090000Z\nDTEND:20260310T100000Z\nRRULE:FREQ=DAILY;COUNT=3")
	date := time.Date(2026, 3, 11, 0, 0, 0, 0, time.UTC)
	for _, step := range []struct{ summary, want string }{
		{"Series", ""}, // A new detached event can repeat the effective series title.
		{"First title", "First title"},
		{"Second title", "Second title"},
		{"Series", "Series"}, // An existing explicit title remains explicit.
		{"", ""},
	} {
		detached := importCalendarEvent("title-updates@example", "SUMMARY:"+step.summary+"\nRECURRENCE-ID:20260311T090000Z\nDTSTART:20260311T110000Z\nDTEND:20260311T120000Z\nDESCRIPTION:Instance description")
		object, _, err := calendar.UpsertObject(userID, "title-updates.ics", importCalendarDocument(master, detached))
		if err != nil {
			t.Fatal(err)
		}
		row, err := repo.GetTaskOccurrence(userID, object.Task.ID, date)
		if err != nil || row.Title != step.want || row.Description != "Instance description" || !row.ScheduleOverride || object.Task.Title != "Series" {
			t.Fatalf("summary=%q: row=%+v err=%v, want title=%q with description and schedule preserved", step.summary, row, err, step.want)
		}
	}
}
