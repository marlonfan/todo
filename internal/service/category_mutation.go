package service

import (
	"encoding/json"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"todo-app/internal/models"
	"todo-app/internal/repository"
)

var ErrCategoryNotFound = errors.New("category not found")

func (s *CategoryService) ExecuteMutation(userID int64, opID, method string, categoryID int64, payloadHash string, values *models.CreateCategoryRequest) (*models.Category, bool, error) {
	var category *models.Category
	replayed := false
	err := s.catRepo.WithTransaction(func(tx *gorm.DB) error {
		if err := repository.LockTaskUser(tx, userID); err != nil {
			return err
		}
		var receipt models.CategoryMutationReceipt
		err := tx.Where("user_id = ? AND op_id = ?", userID, opID).First(&receipt).Error
		if err == nil {
			if receipt.Method != method || (method != "POST" && receipt.CategoryID != categoryID) || receipt.PayloadHash != payloadHash {
				return ErrOperationMismatch
			}
			replayed = true
			if receipt.Snapshot != "" {
				category = &models.Category{}
				return json.Unmarshal([]byte(receipt.Snapshot), category)
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("%w: %w", ErrMutationPersistence, err)
		}
		scoped := NewCategoryService(repository.NewCategoryRepository(tx))
		if method != "POST" {
			if _, err := scoped.GetByID(userID, categoryID); err != nil {
				return ErrCategoryNotFound
			}
		}
		switch method {
		case "POST":
			category, err = scoped.Create(userID, values)
		case "PUT":
			category, err = scoped.Update(userID, categoryID, &models.UpdateCategoryRequest{Name: values.Name, Emoji: values.Emoji, Color: values.Color})
		case "DELETE":
			if err = tx.Where("category_id = ?", categoryID).Delete(&models.TaskCategory{}).Error; err == nil {
				err = scoped.Delete(userID, categoryID)
			}
		default:
			return errors.New("invalid category mutation method")
		}
		if err != nil {
			return err
		}
		snapshot := ""
		if category != nil {
			categoryID = category.ID
			raw, err := json.Marshal(category)
			if err != nil {
				return err
			}
			snapshot = string(raw)
		}
		if err := tx.Create(&models.CategoryMutationReceipt{UserID: userID, OpID: opID, Method: method, CategoryID: categoryID, PayloadHash: payloadHash, Snapshot: snapshot}).Error; err != nil {
			return fmt.Errorf("%w: %w", ErrMutationPersistence, err)
		}
		return nil
	})
	return category, replayed, err
}
