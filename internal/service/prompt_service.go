package service

import (
	"errors"
	"strings"
	"todo-app/internal/models"
	"todo-app/internal/repository"
)

type PromptService struct {
	promptRepo *repository.PromptRepository
}

func NewPromptService(promptRepo *repository.PromptRepository) *PromptService {
	return &PromptService{promptRepo: promptRepo}
}

func (s *PromptService) Create(userID int64, req *models.CreatePromptRequest) (*models.Prompt, error) {
	title := strings.TrimSpace(req.Title)
	content := strings.TrimSpace(req.Content)
	if title == "" {
		return nil, errors.New("prompt title is required")
	}
	if content == "" {
		return nil, errors.New("prompt content is required")
	}

	prompt := &models.Prompt{
		UserID:  userID,
		Title:   title,
		Content: content,
	}
	if err := s.promptRepo.Create(prompt); err != nil {
		return nil, err
	}
	return prompt, nil
}

func (s *PromptService) GetByID(userID, promptID int64) (*models.Prompt, error) {
	prompt, err := s.promptRepo.GetByIDAndUser(promptID, userID)
	if err != nil {
		return nil, errors.New("prompt not found")
	}
	return prompt, nil
}

func (s *PromptService) ListByUser(userID int64) ([]models.Prompt, error) {
	return s.promptRepo.ListByUser(userID)
}

func (s *PromptService) Update(userID, promptID int64, req *models.UpdatePromptRequest) (*models.Prompt, error) {
	prompt, err := s.promptRepo.GetByIDAndUser(promptID, userID)
	if err != nil {
		return nil, errors.New("prompt not found")
	}

	if req.Title != "" {
		title := strings.TrimSpace(req.Title)
		if title == "" {
			return nil, errors.New("prompt title is required")
		}
		prompt.Title = title
	}
	if req.Content != "" {
		content := strings.TrimSpace(req.Content)
		if content == "" {
			return nil, errors.New("prompt content is required")
		}
		prompt.Content = content
	}

	if err := s.promptRepo.Update(prompt); err != nil {
		return nil, err
	}
	return prompt, nil
}

func (s *PromptService) Delete(userID, promptID int64) error {
	_, err := s.promptRepo.GetByIDAndUser(promptID, userID)
	if err != nil {
		return errors.New("prompt not found")
	}
	return s.promptRepo.Delete(promptID)
}

func (s *PromptService) CreateAskHistory(userID int64, req *models.CreatePromptAskHistoryRequest) (*models.PromptAskHistory, error) {
	input := strings.TrimSpace(req.Input)
	output := strings.TrimSpace(req.Output)
	if input == "" {
		return nil, errors.New("prompt ask input is required")
	}
	if output == "" {
		return nil, errors.New("prompt ask output is required")
	}

	prompt, err := s.promptRepo.GetByIDAndUser(req.PromptID, userID)
	if err != nil {
		return nil, errors.New("prompt not found")
	}

	status := strings.TrimSpace(req.Status)
	switch status {
	case "stopped":
	default:
		status = "completed"
	}

	history := &models.PromptAskHistory{
		UserID:        userID,
		PromptID:      &prompt.ID,
		PromptTitle:   prompt.Title,
		PromptContent: prompt.Content,
		Input:         input,
		Output:        output,
		Status:        status,
	}
	if err := s.promptRepo.CreateAskHistory(history); err != nil {
		return nil, err
	}
	return history, nil
}

func (s *PromptService) ListAskHistory(userID int64, limit int) ([]models.PromptAskHistory, error) {
	return s.promptRepo.ListAskHistoryByUser(userID, limit)
}
