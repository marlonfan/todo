package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"todo-app/internal/models"

	"github.com/gin-gonic/gin"
)

var reminderUserSequence atomic.Int64

func registerAndLoginReminderUser(t *testing.T, router *gin.Engine) (string, models.UserResponse) {
	t.Helper()
	sequence := reminderUserSequence.Add(1)
	username := fmt.Sprintf("reminder_contract_%d", sequence)
	email := fmt.Sprintf("reminder-contract-%d@example.com", sequence)

	registerResp := doJSON(t, router, http.MethodPost, "/api/auth/register", "", map[string]any{
		"username": username,
		"email":    email,
		"password": "secret123",
	}, nil)
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register status = %d body=%s", registerResp.Code, registerResp.Body.String())
	}
	user := decodeJSON[models.UserResponse](t, registerResp)

	loginResp := doJSON(t, router, http.MethodPost, "/api/auth/login", "", map[string]any{
		"username": username,
		"password": "secret123",
	}, nil)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResp.Code, loginResp.Body.String())
	}
	loginData := decodeJSON[map[string]any](t, loginResp)
	token, _ := loginData["token"].(string)
	if token == "" {
		t.Fatal("missing login token")
	}
	return token, user
}

func TestCreateTaskWithAtStartReminderIsAtomicAndVisible(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)

	if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
		"default_reminder_enabled": true,
		"default_reminder_minutes": 5,
	}).Error; err != nil {
		t.Fatalf("enable default reminders: %v", err)
	}
	setting := models.UserNotifySetting{
		UserID:    user.ID,
		Channel:   models.NotifyChannelTelegram,
		Config:    models.NotifyConfigMap{"bot_token": "telegram-secret", "chat_id": "private-chat"},
		IsDefault: true,
	}
	if err := db.Create(&setting).Error; err != nil {
		t.Fatalf("create notify setting: %v", err)
	}

	start := time.Now().UTC().Add(2 * time.Hour).Truncate(time.Second)
	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":                   "20:37 打熊",
		"start_time":              start.Format(time.RFC3339),
		"reminder_policy":         "offset",
		"reminder_minutes_before": 0,
	}, map[string]string{"X-Client-Op-Id": "at-start-reminder"})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", createResp.Code, createResp.Body.String())
	}
	created := decodeJSON[struct {
		models.Task
		ReminderSummary []models.NotificationResponse `json:"reminder_summary"`
	}](t, createResp)
	if created.StartTime == nil || !created.StartTime.Equal(start) {
		t.Fatalf("visible start_time = %v, want %v", created.StartTime, start)
	}
	if created.ReminderPolicy != models.TaskReminderOffset || created.ReminderMinutesBefore == nil || *created.ReminderMinutesBefore != 0 {
		t.Fatalf("reminder policy = %q minutes=%v", created.ReminderPolicy, created.ReminderMinutesBefore)
	}
	if len(created.ReminderSummary) != 1 {
		t.Fatalf("reminder_summary = %#v, want one reminder", created.ReminderSummary)
	}
	if !created.ReminderSummary[0].NotifyAt.Equal(start) || created.ReminderSummary[0].Source != models.NotificationSourceDefaultAuto {
		t.Fatalf("reminder = %#v, want default_auto at task start", created.ReminderSummary[0])
	}

	replayResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":                   "20:37 打熊",
		"start_time":              start.Format(time.RFC3339),
		"reminder_policy":         "offset",
		"reminder_minutes_before": 0,
	}, map[string]string{"X-Client-Op-Id": "at-start-reminder"})
	if replayResp.Code != http.StatusOK {
		t.Fatalf("replay status = %d body=%s", replayResp.Code, replayResp.Body.String())
	}
	replayed := decodeJSON[struct {
		models.Task
		ReminderSummary []models.NotificationResponse `json:"reminder_summary"`
	}](t, replayResp)
	if replayed.ID != created.ID || len(replayed.ReminderSummary) != 1 || replayed.ReminderSummary[0].ID != created.ReminderSummary[0].ID {
		t.Fatalf("replayed task/reminder differs: %#v", replayed)
	}
}

func TestExplicitReminderCreationRollsBackWithoutDeliverySetting(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)

	start := time.Now().UTC().Add(2 * time.Hour).Truncate(time.Second)
	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":                   "Cannot silently lose reminder",
		"start_time":              start.Format(time.RFC3339),
		"reminder_policy":         "offset",
		"reminder_minutes_before": 0,
	}, map[string]string{"X-Client-Op-Id": "missing-delivery-setting"})
	if createResp.Code != http.StatusBadRequest {
		t.Fatalf("create status = %d, want 400 body=%s", createResp.Code, createResp.Body.String())
	}

	var count int64
	if err := db.Model(&models.Task{}).Where("user_id = ? AND title = ?", user.ID, "Cannot silently lose reminder").Count(&count).Error; err != nil {
		t.Fatalf("count tasks: %v", err)
	}
	if count != 0 {
		t.Fatalf("task count = %d, want rollback", count)
	}
}

func TestExplicitReminderUpdateRollsBackWithoutDeliverySetting(t *testing.T) {
	router, _ := setupE2ERouterWithDB(t)
	token, _ := registerAndLoginReminderUser(t, router)
	start := time.Now().UTC().Add(2 * time.Hour).Truncate(time.Second)

	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":           "Keep reminder policy consistent",
		"start_time":      start.Format(time.RFC3339),
		"reminder_policy": "none",
	}, map[string]string{"X-Client-Op-Id": "create-without-reminder"})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", createResp.Code, createResp.Body.String())
	}
	created := decodeJSON[models.Task](t, createResp)

	updateResp := doJSON(t, router, http.MethodPut, "/api/tasks/"+strconv.FormatInt(created.ID, 10), token, map[string]any{
		"reminder_policy":         "offset",
		"reminder_minutes_before": 0,
	}, map[string]string{"X-Client-Op-Id": "enable-explicit-reminder"})
	if updateResp.Code != http.StatusBadRequest {
		t.Fatalf("update status = %d, want 400 body=%s", updateResp.Code, updateResp.Body.String())
	}

	getResp := doJSON(t, router, http.MethodGet, "/api/tasks/"+strconv.FormatInt(created.ID, 10), token, nil, nil)
	if getResp.Code != http.StatusOK {
		t.Fatalf("get status = %d body=%s", getResp.Code, getResp.Body.String())
	}
	stored := decodeJSON[models.Task](t, getResp)
	if stored.ReminderPolicy != models.TaskReminderNone || stored.ReminderMinutesBefore != nil {
		t.Fatalf("stored reminder policy changed after failed update: policy=%q minutes=%v", stored.ReminderPolicy, stored.ReminderMinutesBefore)
	}
}

func TestManualReminderCreateIsIdempotentAndAllowsMultipleTimes(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)
	setting := models.UserNotifySetting{
		UserID:    user.ID,
		Channel:   models.NotifyChannelTelegram,
		Config:    models.NotifyConfigMap{"bot_token": "telegram-secret", "chat_id": "private-chat"},
		IsDefault: true,
	}
	if err := db.Create(&setting).Error; err != nil {
		t.Fatalf("create notify setting: %v", err)
	}

	start := time.Now().UTC().Add(3 * time.Hour).Truncate(time.Second)
	createResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":           "Multiple manual reminders",
		"start_time":      start.Format(time.RFC3339),
		"reminder_policy": "none",
	}, map[string]string{"X-Client-Op-Id": "manual-reminder-task"})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d body=%s", createResp.Code, createResp.Body.String())
	}
	task := decodeJSON[models.Task](t, createResp)
	path := "/api/tasks/" + strconv.FormatInt(task.ID, 10) + "/notifications"

	firstAt := start.Add(-time.Hour)
	firstResp := doJSON(t, router, http.MethodPost, path, token, map[string]any{
		"notify_at": firstAt.Format(time.RFC3339),
	}, map[string]string{"X-Client-Op-Id": "manual-reminder-first"})
	if firstResp.Code != http.StatusCreated {
		t.Fatalf("first reminder status = %d body=%s", firstResp.Code, firstResp.Body.String())
	}
	first := decodeJSON[models.NotificationResponse](t, firstResp)

	replayResp := doJSON(t, router, http.MethodPost, path, token, map[string]any{
		"notify_at": firstAt.Format(time.RFC3339),
	}, map[string]string{"X-Client-Op-Id": "manual-reminder-first"})
	if replayResp.Code != http.StatusOK {
		t.Fatalf("replay reminder status = %d body=%s", replayResp.Code, replayResp.Body.String())
	}
	replayed := decodeJSON[models.NotificationResponse](t, replayResp)
	if replayed.ID != first.ID {
		t.Fatalf("replay id = %d, want %d", replayed.ID, first.ID)
	}

	secondResp := doJSON(t, router, http.MethodPost, path, token, map[string]any{
		"notify_at": start.Format(time.RFC3339),
	}, map[string]string{"X-Client-Op-Id": "manual-reminder-second"})
	if secondResp.Code != http.StatusCreated {
		t.Fatalf("second reminder status = %d body=%s", secondResp.Code, secondResp.Body.String())
	}

	listResp := doJSON(t, router, http.MethodGet, path, token, nil, nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("list reminders status = %d body=%s", listResp.Code, listResp.Body.String())
	}
	reminders := decodeJSON[[]models.NotificationResponse](t, listResp)
	if len(reminders) != 2 {
		t.Fatalf("reminders = %#v, want two manual reminders", reminders)
	}
}

func TestManualReminderCanBeUpdatedAndDeletedWithoutRecreatingTask(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)
	setting := models.UserNotifySetting{
		UserID:    user.ID,
		Channel:   models.NotifyChannelTelegram,
		Config:    models.NotifyConfigMap{"bot_token": "telegram-secret", "chat_id": "private-chat"},
		IsDefault: true,
	}
	if err := db.Create(&setting).Error; err != nil {
		t.Fatalf("create notify setting: %v", err)
	}

	start := time.Now().UTC().Add(3 * time.Hour).Truncate(time.Second)
	createTaskResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title":           "Edit reminder in place",
		"start_time":      start.Format(time.RFC3339),
		"reminder_policy": "none",
	}, map[string]string{"X-Client-Op-Id": "editable-reminder-task"})
	if createTaskResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d body=%s", createTaskResp.Code, createTaskResp.Body.String())
	}
	task := decodeJSON[models.Task](t, createTaskResp)
	collectionPath := "/api/tasks/" + strconv.FormatInt(task.ID, 10) + "/notifications"

	createReminderResp := doJSON(t, router, http.MethodPost, collectionPath, token, map[string]any{
		"notify_at": start.Add(-time.Hour).Format(time.RFC3339),
	}, map[string]string{"X-Client-Op-Id": "editable-reminder"})
	if createReminderResp.Code != http.StatusCreated {
		t.Fatalf("create reminder status = %d body=%s", createReminderResp.Code, createReminderResp.Body.String())
	}
	reminder := decodeJSON[models.NotificationResponse](t, createReminderResp)
	itemPath := collectionPath + "/" + strconv.FormatInt(reminder.ID, 10)

	updatedAt := start.Add(-30 * time.Minute)
	updateResp := doJSON(t, router, http.MethodPatch, itemPath, token, map[string]any{
		"notify_at": updatedAt.Format(time.RFC3339),
	}, map[string]string{"X-Client-Op-Id": "update-editable-reminder"})
	if updateResp.Code != http.StatusOK {
		t.Fatalf("update reminder status = %d body=%s", updateResp.Code, updateResp.Body.String())
	}
	updated := decodeJSON[models.NotificationResponse](t, updateResp)
	if updated.ID != reminder.ID || !updated.NotifyAt.Equal(updatedAt) {
		t.Fatalf("updated reminder = %#v", updated)
	}

	deleteResp := doJSON(t, router, http.MethodDelete, itemPath, token, nil, map[string]string{
		"X-Client-Op-Id": "delete-editable-reminder",
	})
	if deleteResp.Code != http.StatusNoContent {
		t.Fatalf("delete reminder status = %d body=%s", deleteResp.Code, deleteResp.Body.String())
	}

	listResp := doJSON(t, router, http.MethodGet, collectionPath, token, nil, nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("list reminders status = %d body=%s", listResp.Code, listResp.Body.String())
	}
	reminders := decodeJSON[[]models.NotificationResponse](t, listResp)
	if len(reminders) != 0 {
		t.Fatalf("reminders after delete = %#v", reminders)
	}
}

func TestReminderReadAPIsNeverExposeDeliveryCredentials(t *testing.T) {
	router, db := setupE2ERouterWithDB(t)
	token, user := registerAndLoginReminderUser(t, router)

	setting := models.UserNotifySetting{
		UserID:    user.ID,
		Channel:   models.NotifyChannelTelegram,
		Config:    models.NotifyConfigMap{"bot_token": "telegram-secret", "chat_id": "private-chat"},
		IsDefault: true,
	}
	if err := db.Create(&setting).Error; err != nil {
		t.Fatalf("create notify setting: %v", err)
	}

	taskResp := doJSON(t, router, http.MethodPost, "/api/tasks", token, map[string]any{
		"title": "Credential-safe reminder",
	}, map[string]string{"X-Client-Op-Id": "safe-reminder-task"})
	if taskResp.Code != http.StatusCreated {
		t.Fatalf("create task status = %d body=%s", taskResp.Code, taskResp.Body.String())
	}
	task := decodeJSON[models.Task](t, taskResp)

	notifyAt := time.Now().UTC().Add(time.Hour)
	notification := models.Notification{
		TaskID:       task.ID,
		Source:       models.NotificationSourceManual,
		DeliveryMode: models.NotificationDeliveryLockedSnapshot,
		Channel:      models.NotifyChannelTelegram,
		Config:       models.NotifyConfigMap{"bot_token": "notification-secret", "avatar": "data:image/png;base64,secret"},
		NotifyAt:     notifyAt,
		NextRetryAt:  &notifyAt,
		Status:       models.NotifyStatusPending,
	}
	if err := db.Create(&notification).Error; err != nil {
		t.Fatalf("create notification: %v", err)
	}

	settingsResp := doJSON(t, router, http.MethodGet, "/api/notify/settings", token, nil, nil)
	if settingsResp.Code != http.StatusOK {
		t.Fatalf("settings status = %d body=%s", settingsResp.Code, settingsResp.Body.String())
	}
	assertSafeReminderBody(t, settingsResp.Body.String())

	notificationsResp := doJSON(t, router, http.MethodGet, "/api/tasks/"+strconv.FormatInt(task.ID, 10)+"/notifications", token, nil, nil)
	if notificationsResp.Code != http.StatusOK {
		t.Fatalf("notifications status = %d body=%s", notificationsResp.Code, notificationsResp.Body.String())
	}
	assertSafeReminderBody(t, notificationsResp.Body.String())
}

func assertSafeReminderBody(t *testing.T, body string) {
	t.Helper()
	for _, forbidden := range []string{
		"telegram-secret",
		"private-chat",
		"notification-secret",
		"data:image/",
		`"config"`,
	} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("response contains sensitive value %q: %s", forbidden, body)
		}
	}
}
