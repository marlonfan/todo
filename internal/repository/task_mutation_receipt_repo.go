package repository

import (
	"todo-app/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TaskMutationReceiptRepository struct {
	db *gorm.DB
}

func NewTaskMutationReceiptRepository(db *gorm.DB) *TaskMutationReceiptRepository {
	return &TaskMutationReceiptRepository{db: db}
}

func (r *TaskMutationReceiptRepository) GetByUserAndOpID(userID int64, opID string) (*models.TaskMutationReceipt, error) {
	var receipt models.TaskMutationReceipt
	err := r.db.Where("user_id = ? AND op_id = ?", userID, opID).First(&receipt).Error
	if err != nil {
		return nil, err
	}
	return &receipt, nil
}

func (r *TaskMutationReceiptRepository) CreateOrIgnore(receipt *models.TaskMutationReceipt) error {
	if receipt == nil {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "user_id"},
			{Name: "op_id"},
		},
		DoNothing: true,
	}).Create(receipt).Error
}
