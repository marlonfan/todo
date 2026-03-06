package repository

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"time"
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TaskActivityRepository struct {
	db *gorm.DB
}

func NewTaskActivityRepository(db *gorm.DB) *TaskActivityRepository {
	return &TaskActivityRepository{db: db}
}

func (r *TaskActivityRepository) ListByTask(userID, taskID int64, limit int) ([]models.TaskActivity, error) {
	if limit <= 0 {
		limit = 200
	}
	if limit > 500 {
		limit = 500
	}
	var rows []models.TaskActivity
	err := r.db.
		Where("user_id = ? AND task_id = ?", userID, taskID).
		Order("occurred_at DESC, id DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r *TaskActivityRepository) RecordWithMerge(
	userID, taskID int64,
	occurredAt time.Time,
	submitSource string,
	incoming models.TaskActivityChanges,
	mergeWindow time.Duration,
) error {
	if userID <= 0 || taskID <= 0 {
		return errors.New("invalid task activity identity")
	}
	normalizedIncoming := normalizeActivityChanges(incoming)
	if len(normalizedIncoming) == 0 {
		return nil
	}
	if mergeWindow <= 0 {
		mergeWindow = 15 * time.Minute
	}
	occurred := occurredAt.UTC()
	if occurred.IsZero() {
		occurred = time.Now().UTC()
	}
	source := strings.TrimSpace(submitSource)

	return r.db.Transaction(func(tx *gorm.DB) error {
		var latest models.TaskActivity
		err := tx.
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND task_id = ?", userID, taskID).
			Order("occurred_at DESC, id DESC").
			Limit(1).
			Take(&latest).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if err == nil {
			timeDelta := occurred.Sub(latest.OccurredAt.UTC())
			if timeDelta < 0 {
				timeDelta = -timeDelta
			}
			if timeDelta <= mergeWindow {
				merged := mergeActivityChanges(latest.Changes, normalizedIncoming)
				if len(merged) == 0 {
					return tx.Delete(&models.TaskActivity{}, latest.ID).Error
				}
				nextOccurredAt := occurred
				if nextOccurredAt.Before(latest.OccurredAt.UTC()) {
					nextOccurredAt = latest.OccurredAt.UTC()
				}
				updates := map[string]interface{}{
					"changes":     merged,
					"occurred_at": nextOccurredAt,
				}
				if source != "" {
					updates["submit_source"] = source
				}
				return tx.Model(&models.TaskActivity{}).Where("id = ?", latest.ID).Updates(updates).Error
			}
		}

		row := &models.TaskActivity{
			UserID:       userID,
			TaskID:       taskID,
			Changes:      normalizedIncoming,
			OccurredAt:   occurred,
			SubmitSource: source,
		}
		return tx.Create(row).Error
	})
}

func mergeActivityChanges(base, incoming models.TaskActivityChanges) models.TaskActivityChanges {
	merged := normalizeActivityChanges(base)
	for field, change := range normalizeActivityChanges(incoming) {
		prev, exists := merged[field]
		if exists {
			merged[field] = models.TaskActivityFieldChange{
				From: prev.From,
				To:   change.To,
			}
			continue
		}
		merged[field] = change
	}
	return normalizeActivityChanges(merged)
}

func normalizeActivityChanges(input models.TaskActivityChanges) models.TaskActivityChanges {
	out := make(models.TaskActivityChanges)
	for field, change := range input {
		name := strings.TrimSpace(field)
		if name == "" {
			continue
		}
		clean := models.TaskActivityFieldChange{
			From: canonicalizeJSONValue(change.From),
			To:   canonicalizeJSONValue(change.To),
		}
		if reflect.DeepEqual(clean.From, clean.To) {
			continue
		}
		out[name] = clean
	}
	return out
}

func canonicalizeJSONValue(value interface{}) interface{} {
	raw, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var normalized interface{}
	if err := json.Unmarshal(raw, &normalized); err != nil {
		return value
	}
	return normalized
}
