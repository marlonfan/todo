package service

import (
	"testing"
	"todo-app/internal/models"
	"todo-app/internal/repository"
)

func TestPostgresJSONRoundTrip(t *testing.T) {
	svc, db, uid := consistencyTestService(t, "postgres")
	task, err := svc.Create(uid, &models.CreateTaskRequest{Title: "json", RecurrenceRule: &models.RecurrenceRule{Freq: "daily", Interval: 2}})
	if err != nil {
		t.Fatal(err)
	}
	saved, err := svc.GetByID(uid, task.ID)
	if err != nil || saved.RecurrenceRule == nil || saved.RecurrenceRule.Interval != 2 {
		t.Fatalf("recurrence decode: %+v %v", saved, err)
	}
	repo := repository.NewNotificationRepository(db)
	setting := &models.UserNotifySetting{UserID: uid, Channel: models.NotifyChannelNtfy, Config: models.NotifyConfigMap{"topic": "roundtrip"}, IsDefault: true}
	if err = repo.CreateUserSetting(setting); err != nil {
		t.Fatal(err)
	}
	read, err := repo.GetDefaultSetting(uid)
	if err != nil || read.Config["topic"] != "roundtrip" {
		t.Fatalf("notification config decode: %+v %v", read, err)
	}
}
