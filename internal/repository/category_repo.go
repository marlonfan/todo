package repository

import (
	"todo-app/internal/models"

	"gorm.io/gorm"
)

type CategoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) Create(category *models.Category) error {
	return r.db.Create(category).Error
}

func (r *CategoryRepository) GetByID(id int64) (*models.Category, error) {
	var category models.Category
	err := r.db.First(&category, id).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *CategoryRepository) GetByIDAndUser(id, userID int64) (*models.Category, error) {
	var category models.Category
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&category).Error
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *CategoryRepository) ListByUser(userID int64) ([]models.Category, error) {
	var categories []models.Category
	err := r.db.Where("user_id = ?", userID).Find(&categories).Error
	return categories, err
}

func (r *CategoryRepository) Update(category *models.Category) error {
	return r.db.Save(category).Error
}

func (r *CategoryRepository) Delete(id int64) error {
	return r.db.Delete(&models.Category{}, id).Error
}

func (r *CategoryRepository) ExistsByName(userID int64, name string) (bool, error) {
	var count int64
	err := r.db.Model(&models.Category{}).Where("user_id = ? AND name = ?", userID, name).Count(&count).Error
	return count > 0, err
}
