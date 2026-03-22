package main

import (
	"flag"
	"fmt"
	"log"

	"todo-app/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	dbPath := flag.String("db", "./todo.db", "sqlite db path")
	usernamePrefix := flag.String("prefix", "e2e_pw_", "username prefix to cleanup")
	flag.Parse()

	db, err := gorm.Open(sqlite.Open(*dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("open db failed: %v", err)
	}

	var users []models.User
	if err := db.Where("username LIKE ?", fmt.Sprintf("%s%%", *usernamePrefix)).Find(&users).Error; err != nil {
		log.Fatalf("query users failed: %v", err)
	}
	if len(users) == 0 {
		log.Printf("no users matched prefix %q", *usernamePrefix)
		return
	}

	userIDs := make([]int64, 0, len(users))
	for _, u := range users {
		userIDs = append(userIDs, u.ID)
	}

	var taskIDs []int64
	if err := db.Model(&models.Task{}).Where("user_id IN ?", userIDs).Pluck("id", &taskIDs).Error; err != nil {
		log.Fatalf("query task ids failed: %v", err)
	}
	var categoryIDs []int64
	if err := db.Model(&models.Category{}).Where("user_id IN ?", userIDs).Pluck("id", &categoryIDs).Error; err != nil {
		log.Fatalf("query category ids failed: %v", err)
	}

	tx := db.Begin()
	if tx.Error != nil {
		log.Fatalf("begin tx failed: %v", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			_ = tx.Rollback()
			panic(r)
		}
	}()

	if len(taskIDs) > 0 {
		if err := tx.Where("task_id IN ?", taskIDs).Delete(&models.TaskCategory{}).Error; err != nil {
			_ = tx.Rollback()
			log.Fatalf("cleanup task_categories by task failed: %v", err)
		}
		if err := tx.Where("task_id IN ?", taskIDs).Delete(&models.Notification{}).Error; err != nil {
			_ = tx.Rollback()
			log.Fatalf("cleanup notifications failed: %v", err)
		}
	}
	if len(categoryIDs) > 0 {
		if err := tx.Where("category_id IN ?", categoryIDs).Delete(&models.TaskCategory{}).Error; err != nil {
			_ = tx.Rollback()
			log.Fatalf("cleanup task_categories by category failed: %v", err)
		}
	}

	deleteByUser := []struct {
		model interface{}
		name  string
	}{
		{&models.TaskActivity{}, "task_activities"},
		{&models.TaskDeleteLog{}, "task_delete_logs"},
		{&models.TaskOccurrence{}, "task_occurrences"},
		{&models.TaskOccurrenceStatus{}, "task_occurrence_statuses"},
		{&models.TaskOccurrenceOverride{}, "task_occurrence_overrides"},
		{&models.Task{}, "tasks"},
		{&models.Category{}, "categories"},
		{&models.UserNotifySetting{}, "user_notify_settings"},
		{&models.CaldavEventCache{}, "caldav_event_caches"},
		{&models.CaldavCalendar{}, "caldav_calendars"},
		{&models.CaldavSource{}, "caldav_sources"},
	}
	for _, item := range deleteByUser {
		if err := tx.Where("user_id IN ?", userIDs).Delete(item.model).Error; err != nil {
			_ = tx.Rollback()
			log.Fatalf("cleanup %s failed: %v", item.name, err)
		}
	}

	if err := tx.Where("id IN ?", userIDs).Delete(&models.User{}).Error; err != nil {
		_ = tx.Rollback()
		log.Fatalf("cleanup users failed: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		log.Fatalf("commit cleanup failed: %v", err)
	}
	log.Printf("cleanup done, removed users=%d prefix=%q", len(userIDs), *usernamePrefix)
}
