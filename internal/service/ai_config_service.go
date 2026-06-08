package service

import (
	"errors"
	"strings"
	"todo-app/internal/models"
	"todo-app/internal/repository"

	"gorm.io/gorm"
)

type AIConfigService struct {
	aiConfigRepo *repository.AIConfigRepository
}

func NewAIConfigService(aiConfigRepo *repository.AIConfigRepository) *AIConfigService {
	return &AIConfigService{aiConfigRepo: aiConfigRepo}
}

func (s *AIConfigService) GetConfig(userID int64) (*models.AIConfigResponse, error) {
	config, err := s.aiConfigRepo.GetByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	resp := config.ToResponse()
	return &resp, nil
}

func (s *AIConfigService) SaveConfig(userID int64, req *models.AIConfigRequest) (*models.AIConfigResponse, error) {
	protocol := models.NormalizeAIProtocol(req.Protocol)
	allowTaskContext := true
	if req.AllowTaskContext != nil {
		allowTaskContext = *req.AllowTaskContext
	}

	config := &models.UserAIConfig{
		UserID:           userID,
		Protocol:         protocol,
		BaseURL:          models.NormalizeAIBaseURL(req.BaseURL, protocol),
		APIKey:           strings.TrimSpace(req.APIKey),
		ModelID:          strings.TrimSpace(req.ModelID),
		SystemPrompt:     strings.TrimSpace(req.SystemPrompt),
		UserProfile:      req.UserProfile,
		AllowTaskContext: allowTaskContext,
	}

	if err := s.aiConfigRepo.Upsert(config); err != nil {
		return nil, err
	}

	saved, err := s.aiConfigRepo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}
	resp := saved.ToResponse()
	return &resp, nil
}
