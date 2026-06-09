package repository

import (
	"todo-app/internal/models"

	"gorm.io/gorm"
)

type PromptRepository struct {
	db *gorm.DB
}

func NewPromptRepository(db *gorm.DB) *PromptRepository {
	return &PromptRepository{db: db}
}

func (r *PromptRepository) Create(prompt *models.Prompt) error {
	return r.db.Create(prompt).Error
}

func (r *PromptRepository) GetByIDAndUser(id, userID int64) (*models.Prompt, error) {
	var prompt models.Prompt
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&prompt).Error
	if err != nil {
		return nil, err
	}
	return &prompt, nil
}

func (r *PromptRepository) ListByUser(userID int64) ([]models.Prompt, error) {
	var prompts []models.Prompt
	err := r.db.Where("user_id = ?", userID).Order("updated_at DESC, id DESC").Find(&prompts).Error
	return prompts, err
}

func (r *PromptRepository) Update(prompt *models.Prompt) error {
	return r.db.Save(prompt).Error
}

func (r *PromptRepository) Delete(id int64) error {
	return r.db.Delete(&models.Prompt{}, id).Error
}

func (r *PromptRepository) CreateAskHistory(history *models.PromptAskHistory) error {
	return r.db.Create(history).Error
}

func (r *PromptRepository) ListAskHistoryByUser(userID, beforeID int64, limit int) ([]models.PromptAskHistory, bool, error) {
	if limit <= 0 || limit > 100 {
		limit = 100
	}
	var history []models.PromptAskHistory
	query := r.db.Where("user_id = ?", userID)
	if beforeID > 0 {
		query = query.Where("id < ?", beforeID)
	}
	err := query.
		Order("id DESC").
		Limit(limit + 1).
		Find(&history).Error
	if err != nil {
		return nil, false, err
	}
	hasMore := len(history) > limit
	if hasMore {
		history = history[:limit]
	}
	return history, hasMore, nil
}

func (r *PromptRepository) DeleteAskHistoryByUser(id, userID int64) (bool, error) {
	result := r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.PromptAskHistory{})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}
