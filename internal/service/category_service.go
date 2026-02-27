package service

import (
	"errors"
	"strings"
	"todo-app/internal/models"
	"todo-app/internal/repository"
)

type CategoryService struct {
	catRepo *repository.CategoryRepository
}

func NewCategoryService(catRepo *repository.CategoryRepository) *CategoryService {
	return &CategoryService{catRepo: catRepo}
}

func (s *CategoryService) Create(userID int64, req *models.CreateCategoryRequest) (*models.Category, error) {
	// Check if name exists
	exists, err := s.catRepo.ExistsByName(userID, req.Name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("category with this name already exists")
	}

	// Default color
	color := req.Color
	if color == "" {
		color = "#3788d8"
	}
	emoji := strings.TrimSpace(req.Emoji)
	if emoji == "" {
		emoji = "📁"
	}

	category := &models.Category{
		UserID: userID,
		Name:   strings.TrimSpace(req.Name),
		Emoji:  emoji,
		Color:  color,
	}

	if err := s.catRepo.Create(category); err != nil {
		return nil, err
	}

	return category, nil
}

func (s *CategoryService) GetByID(userID, catID int64) (*models.Category, error) {
	category, err := s.catRepo.GetByIDAndUser(catID, userID)
	if err != nil {
		return nil, errors.New("category not found")
	}
	return category, nil
}

func (s *CategoryService) ListByUser(userID int64) ([]models.Category, error) {
	return s.catRepo.ListByUser(userID)
}

func (s *CategoryService) Update(userID, catID int64, req *models.UpdateCategoryRequest) (*models.Category, error) {
	category, err := s.catRepo.GetByIDAndUser(catID, userID)
	if err != nil {
		return nil, errors.New("category not found")
	}

	if req.Name != "" {
		// Check if new name conflicts with existing
		if req.Name != category.Name {
			exists, err := s.catRepo.ExistsByName(userID, req.Name)
			if err != nil {
				return nil, err
			}
			if exists {
				return nil, errors.New("category with this name already exists")
			}
		}
		category.Name = strings.TrimSpace(req.Name)
	}

	if req.Color != "" {
		category.Color = req.Color
	}
	if req.Emoji != "" {
		category.Emoji = strings.TrimSpace(req.Emoji)
	}

	if err := s.catRepo.Update(category); err != nil {
		return nil, err
	}

	return category, nil
}

func (s *CategoryService) Delete(userID, catID int64) error {
	_, err := s.catRepo.GetByIDAndUser(catID, userID)
	if err != nil {
		return errors.New("category not found")
	}
	return s.catRepo.Delete(catID)
}
