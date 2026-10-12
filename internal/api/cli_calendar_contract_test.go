package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"todo-app/internal/models"
)

// Exercise the CLI against real handler/service/JSON output, so fixtures cannot
// hide changes to extendedProps, UTC timestamps, or recurring tombstones.
func TestCLIDayTasksCalendarContract(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node is required for the CLI calendar contract test")
	}
	cliPath, err := filepath.Abs("../../cli/todo-cli.mjs")
	if err != nil {
		t.Fatal(err)
	}
	router, db := setupE2ERouterWithDB(t)
	username := fmt.Sprintf("cli_contract_%d", time.Now().UnixNano())
	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username, "email": username + "@example.com", "password": "secret123",
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register: status=%d body=%s", registerResp.Code, registerResp.Body.String())
	}
	user := decodeJSON[models.UserResponse](t, registerResp)
	if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
		"timezone": "Asia/Shanghai", "default_reminder_enabled": false,
	}).Error; err != nil {
		t.Fatal(err)
	}
	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username, "password": "secret123",
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login: status=%d body=%s", loginResp.Code, loginResp.Body.String())
	}
	token, _ := decodeJSON[map[string]any](t, loginResp)["token"].(string)
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().In(loc)
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	date := day.Format("2006-01-02")
	tasks := make(map[models.TaskStatus]models.Task)
	for index, status := range []models.TaskStatus{
		models.TaskStatusPending, models.TaskStatusCompleted, models.TaskStatusSkipped, models.TaskStatusCancelled,
	} {
		start := day.Add(time.Duration(index+1) * time.Hour)
		createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
			"title": "CLI contract " + string(status), "priority": 1,
			"start_time": start.Format(time.RFC3339), "end_time": start.Add(30 * time.Minute).Format(time.RFC3339),
			"recurrence_rule": map[string]any{"freq": "daily", "interval": 1},
		}, nil)
		if createResp.Code != http.StatusCreated {
			t.Fatalf("create %s: status=%d body=%s", status, createResp.Code, createResp.Body.String())
		}
		task := decodeJSON[models.Task](t, createResp)
		tasks[status] = task
		if status != models.TaskStatusPending {
			updateResp := doJSON(t, router, http.MethodPut, fmt.Sprintf("/api/tasks/%d", task.ID), token, map[string]any{
				"occurrence_date": date, "status": status,
			}, map[string]string{"If-Match": fmt.Sprint(task.Revision)})
			if updateResp.Code != http.StatusOK {
				t.Fatalf("update %s: status=%d body=%s", status, updateResp.Code, updateResp.Body.String())
			}
		}
	}

	query := url.Values{"start": {day.Format(time.RFC3339)}, "end": {day.AddDate(0, 0, 1).Format(time.RFC3339)}}
	calendarResp := doJSON(t, router, http.MethodGet, "/api/calendar?"+query.Encode(), token, nil, nil)
	if calendarResp.Code != http.StatusOK {
		t.Fatalf("calendar: status=%d body=%s", calendarResp.Code, calendarResp.Body.String())
	}
	events := decodeJSON[[]models.CalendarEvent](t, calendarResp)
	if len(events) != 4 {
		t.Fatalf("calendar must include all four states, including tombstones: %s", calendarResp.Body.String())
	}
	for _, event := range events {
		if event.ExtendedProps.TaskID == tasks[models.TaskStatusPending].ID && event.Start != day.Add(time.Hour).UTC().Format(time.RFC3339) {
			t.Fatalf("expected UTC morning event, got %q", event.Start)
		}
	}

	server := httptest.NewServer(router)
	defer server.Close()
	for _, command := range []string{"today", "+today", "tomorrow"} {
		t.Run(command, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			args := []string{cliPath, "--base-url", server.URL, "--token", token, "--config", filepath.Join(t.TempDir(), "config.json")}
			if command == "+today" {
				args = append(args, command)
			} else {
				args = append(args, "task", command)
			}
			cmd := exec.CommandContext(ctx, node, args...)
			cmd.Env = append(os.Environ(), "TZ=Asia/Shanghai")
			output, err := cmd.CombinedOutput()
			if err != nil {
				t.Fatalf("CLI: %v output=%s", err, output)
			}
			var rows []struct {
				InstanceID   string            `json:"instance_id"`
				TaskID       int64             `json:"task_id"`
				Status       models.TaskStatus `json:"status"`
				Priority     models.Priority   `json:"priority"`
				StartTime    string            `json:"start_time"`
				EndTime      string            `json:"end_time"`
				OriginalDate string            `json:"original_date"`
				IsRecurring  bool              `json:"is_recurring"`
				Source       string            `json:"source"`
			}
			if err := json.Unmarshal(output, &rows); err != nil {
				t.Fatalf("decode CLI output: %v output=%s", err, output)
			}
			expected := make(map[int64]models.TaskStatus)
			expectedDay := day
			for status, task := range tasks {
				if command == "tomorrow" {
					expected[task.ID] = models.TaskStatusPending
				} else if status == models.TaskStatusPending || status == models.TaskStatusCompleted {
					expected[task.ID] = status
				}
			}
			if command == "tomorrow" {
				expectedDay = day.AddDate(0, 0, 1)
			}
			if len(rows) != len(expected) {
				t.Fatalf("expected %d visible instances, got %s", len(expected), output)
			}
			for _, row := range rows {
				status, ok := expected[row.TaskID]
				if !ok || row.Status != status || row.Source != "occurrence" || !row.IsRecurring || row.Priority != models.PriorityHigh {
					t.Fatalf("invalid occurrence mapping or leaked series/tombstone: %s", output)
				}
				if row.OriginalDate != expectedDay.Format("2006-01-02") || row.InstanceID != fmt.Sprintf("%d_%s", row.TaskID, expectedDay.Format("20060102")) {
					t.Fatalf("invalid original date/instance identity: %s", output)
				}
				start, err := time.Parse(time.RFC3339, row.StartTime)
				if err != nil || start.In(loc).Format("2006-01-02") != row.OriginalDate {
					t.Fatalf("invalid local day: %s", output)
				}
				end, err := time.Parse(time.RFC3339, row.EndTime)
				if err != nil || end.Sub(start) != 30*time.Minute {
					t.Fatalf("invalid event duration: %s", output)
				}
				delete(expected, row.TaskID)
			}
		})
	}
}
