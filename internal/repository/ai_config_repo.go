package repository

import (
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AIConfigRepository struct {
	db *gorm.DB
}

func NewAIConfigRepository(db *gorm.DB) *AIConfigRepository {
	return &AIConfigRepository{db: db}
}

func (r *AIConfigRepository) GetByUserID(userID int64) (*models.UserAIConfig, error) {
	var config models.UserAIConfig
	err := r.db.Where("user_id = ?", userID).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *AIConfigRepository) Upsert(config *models.UserAIConfig) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"protocol",
			"base_url",
			"api_key",
			"model_id",
			"system_prompt",
			"user_profile",
			"allow_task_context",
			"updated_at",
		}),
	}).Create(config).Error
}
