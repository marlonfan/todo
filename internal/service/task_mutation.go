package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"todo-app/internal/models"
)

var ErrMutationPersistence = errors.New("task operation persistence failed")
var ErrOperationMismatch = errors.New("operation ID was already used for a different request")

// ExecuteMutation commits the task, reminder policy, journal and retry receipt
// together. The user lock makes concurrent retries observe the committed receipt.
func (s *TaskService) ExecuteMutation(userID int64, opID, opType string, taskID int64, payloadHash string, mutate func(*TaskService) (*models.Task, error)) (*models.Task, bool, error) {
	if opID == "" {
		task, err := mutate(s)
		return task, false, err
	}
	var task *models.Task
	replayed := false
	err := s.withTaskTransaction(userID, func(scoped *TaskService) error {
		scoped.changeNotifier = nil
		receipts := scoped.taskRepo.MutationReceipts()
		receipt, err := receipts.GetByUserAndOpID(userID, opID)
		if err == nil {
			if receipt.OpType != opType || (taskID > 0 && receipt.TaskID != taskID) || (receipt.PayloadHash != "" && receipt.PayloadHash != payloadHash) {
				return ErrOperationMismatch
			}
			replayed = true
			if opType == "delete" {
				return nil
			}
			if receipt.TaskSnapshot != "" {
				task = &models.Task{}
				return json.Unmarshal([]byte(receipt.TaskSnapshot), task)
			}
			task, err = scoped.GetByID(userID, receipt.TaskID)
			return err // Never re-create a task if a legacy receipt's task was deleted.
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("%w: %w", ErrMutationPersistence, err)
		}
		task, err = mutate(scoped)
		if err != nil {
			return err
		}
		snapshot := ""
		if task != nil {
			taskID = task.ID
			raw, err := json.Marshal(task)
			if err != nil {
				return err
			}
			snapshot = string(raw)
		}
		err = receipts.Create(&models.TaskMutationReceipt{UserID: userID, OpID: opID, TaskID: taskID, OpType: opType, PayloadHash: payloadHash, TaskSnapshot: snapshot})
		if err != nil {
			return fmt.Errorf("%w: %w", ErrMutationPersistence, err)
		}
		return nil
	})
	if err == nil && !replayed {
		s.notifyTaskChanged(userID)
	}
	return task, replayed, err
}
