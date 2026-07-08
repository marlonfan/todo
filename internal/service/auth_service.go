package service

import (
	"errors"
	"strings"
	"time"
	"todo-app/internal/config"
	"todo-app/internal/models"
	"todo-app/internal/repository"
	"todo-app/pkg/utils"

	"gorm.io/gorm"
)

func isAllowedGranularity(minutes int) bool {
	switch minutes {
	case 5, 10, 15, 30, 60:
		return true
	default:
		return false
	}
}

type AuthService struct {
	userRepo  *repository.UserRepository
	jwtSecret string
	jwtExpire time.Duration
}

const RefreshGracePeriod = 30 * 24 * time.Hour

func NewAuthService(userRepo *repository.UserRepository, cfg *config.JWTConfig) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: cfg.Secret,
		jwtExpire: cfg.Expire,
	}
}

func (s *AuthService) Register(req *models.UserRegisterRequest) (*models.UserResponse, error) {
	// Check if username exists
	_, err := s.userRepo.GetByUsername(req.Username)
	if err == nil {
		return nil, errors.New("username already exists")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Check if email exists
	_, err = s.userRepo.GetByEmail(req.Email)
	if err == nil {
		return nil, errors.New("email already exists")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Hash password
	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &models.User{
		Username:               req.Username,
		Email:                  req.Email,
		PasswordHash:           hash,
		CalendarDefaultView:    "timeGridDay",
		DefaultReminderEnabled: false,
		DefaultReminderMinutes: 5,
		DefaultTimeGranularity: 15,
		DefaultTaskStartTime:   "09:00",
		DefaultMorningTime:     "09:00",
		DefaultNoonTime:        "12:00",
		DefaultAfternoonTime:   "15:00",
		DefaultEveningTime:     "20:00",
		MobileDefaultTab:       "tasks",
		MobileTabPreset:        "tasks_calendar_settings",
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	resp := user.ToResponse()
	return &resp, nil
}

func (s *AuthService) Login(req *models.UserLoginRequest) (string, *models.UserResponse, error) {
	// Get user by username
	user, err := s.userRepo.GetByUsername(req.Username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.New("invalid credentials")
		}
		return "", nil, err
	}

	// Verify password
	if !utils.CheckPassword(req.Password, user.PasswordHash) {
		return "", nil, errors.New("invalid credentials")
	}

	// Generate token
	token, err := utils.GenerateToken(user.ID, user.Username, s.jwtSecret, s.jwtExpire)
	if err != nil {
		return "", nil, err
	}

	resp := user.ToResponse()
	return token, &resp, nil
}

func (s *AuthService) GetUserByID(userID int64) (*models.UserResponse, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	resp := user.ToResponse()
	return &resp, nil
}

func (s *AuthService) RefreshToken(userID int64, username string) (string, error) {
	return utils.GenerateToken(userID, username, s.jwtSecret, s.jwtExpire)
}

func (s *AuthService) RefreshTokenFromRaw(rawToken string) (string, error) {
	claims, err := utils.ParseTokenWithoutTimeValidation(rawToken, s.jwtSecret)
	if err != nil {
		return "", errors.New("invalid token")
	}
	if claims == nil || claims.UserID <= 0 || strings.TrimSpace(claims.Username) == "" {
		return "", errors.New("invalid token")
	}
	now := time.Now()
	if claims.NotBefore != nil && now.Before(claims.NotBefore.Time) {
		return "", errors.New("invalid token")
	}
	if claims.ExpiresAt == nil {
		return "", errors.New("invalid token")
	}
	if now.After(claims.ExpiresAt.Time.Add(RefreshGracePeriod)) {
		return "", errors.New("refresh window expired")
	}

	user, err := s.userRepo.GetByID(claims.UserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("invalid token")
		}
		return "", err
	}
	return utils.GenerateToken(user.ID, user.Username, s.jwtSecret, s.jwtExpire)
}

func (s *AuthService) UpdateProfile(userID int64, req *models.UpdateProfileRequest) (*models.UserResponse, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}

	if req.AvatarURL != nil {
		avatarURL := strings.TrimSpace(*req.AvatarURL)
		if avatarURL != "" && !strings.HasPrefix(avatarURL, "data:image/") && !strings.HasPrefix(avatarURL, "http://") && !strings.HasPrefix(avatarURL, "https://") {
			return nil, errors.New("avatar_url must be an image data URL or http(s) URL")
		}
		user.AvatarURL = avatarURL
	}
	if req.Timezone != "" {
		tz := strings.TrimSpace(req.Timezone)
		if _, err := time.LoadLocation(tz); err != nil {
			return nil, errors.New("invalid timezone")
		}
		user.Timezone = tz
	}
	if req.CalendarDefaultView != "" {
		user.CalendarDefaultView = strings.TrimSpace(req.CalendarDefaultView)
	}
	if req.DefaultReminderEnabled != nil {
		user.DefaultReminderEnabled = *req.DefaultReminderEnabled
	}
	if req.DefaultReminderMinutes != nil {
		if *req.DefaultReminderMinutes < 1 || *req.DefaultReminderMinutes > 10080 {
			return nil, errors.New("default_reminder_minutes must be between 1 and 10080")
		}
		user.DefaultReminderMinutes = *req.DefaultReminderMinutes
	}
	if req.DefaultTimeGranularity != nil {
		if !isAllowedGranularity(*req.DefaultTimeGranularity) {
			return nil, errors.New("default_time_granularity must be one of 5, 10, 15, 30, 60")
		}
		user.DefaultTimeGranularity = *req.DefaultTimeGranularity
	}
	if req.DefaultTaskStartTime != "" {
		startTime := strings.TrimSpace(req.DefaultTaskStartTime)
		if _, err := time.Parse("15:04", startTime); err != nil {
			return nil, errors.New("default_task_start_time must use HH:mm format")
		}
		user.DefaultTaskStartTime = startTime
	}
	if req.DefaultMorningTime != "" {
		timeValue := strings.TrimSpace(req.DefaultMorningTime)
		if _, err := time.Parse("15:04", timeValue); err != nil {
			return nil, errors.New("default_morning_time must use HH:mm format")
		}
		user.DefaultMorningTime = timeValue
	}
	if req.DefaultNoonTime != "" {
		timeValue := strings.TrimSpace(req.DefaultNoonTime)
		if _, err := time.Parse("15:04", timeValue); err != nil {
			return nil, errors.New("default_noon_time must use HH:mm format")
		}
		user.DefaultNoonTime = timeValue
	}
	if req.DefaultAfternoonTime != "" {
		timeValue := strings.TrimSpace(req.DefaultAfternoonTime)
		if _, err := time.Parse("15:04", timeValue); err != nil {
			return nil, errors.New("default_afternoon_time must use HH:mm format")
		}
		user.DefaultAfternoonTime = timeValue
	}
	if req.DefaultEveningTime != "" {
		timeValue := strings.TrimSpace(req.DefaultEveningTime)
		if _, err := time.Parse("15:04", timeValue); err != nil {
			return nil, errors.New("default_evening_time must use HH:mm format")
		}
		user.DefaultEveningTime = timeValue
	}
	if req.MobileDefaultTab != "" {
		user.MobileDefaultTab = strings.TrimSpace(req.MobileDefaultTab)
	}
	if req.MobileDefaultTaskView != "" {
		user.MobileDefaultTaskView = models.NormalizeMobileDefaultTaskView(req.MobileDefaultTaskView)
	}
	if req.MobileTabPreset != "" {
		user.MobileTabPreset = strings.TrimSpace(req.MobileTabPreset)
	}
	if user.DefaultReminderMinutes <= 0 {
		user.DefaultReminderMinutes = 5
	}
	if !isAllowedGranularity(user.DefaultTimeGranularity) {
		user.DefaultTimeGranularity = 15
	}
	if user.DefaultTaskStartTime == "" {
		user.DefaultTaskStartTime = "09:00"
	}
	if user.DefaultMorningTime == "" {
		user.DefaultMorningTime = "09:00"
	}
	if user.DefaultNoonTime == "" {
		user.DefaultNoonTime = "12:00"
	}
	if user.DefaultAfternoonTime == "" {
		user.DefaultAfternoonTime = "15:00"
	}
	if user.DefaultEveningTime == "" {
		user.DefaultEveningTime = "20:00"
	}
	switch user.CalendarDefaultView {
	case "dayGridMonth", "timeGridWeek", "timeGridDay":
	default:
		user.CalendarDefaultView = "timeGridDay"
	}
	if user.MobileDefaultTab != "tasks" && user.MobileDefaultTab != "calendar" && user.MobileDefaultTab != "settings" {
		user.MobileDefaultTab = "tasks"
	}
	user.MobileDefaultTaskView = models.NormalizeMobileDefaultTaskView(user.MobileDefaultTaskView)
	switch user.MobileTabPreset {
	case "tasks_calendar_settings", "tasks_calendar_categories_settings", "tasks_inbox_calendar_settings":
	default:
		user.MobileTabPreset = "tasks_calendar_settings"
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	resp := user.ToResponse()
	return &resp, nil
}

func (s *AuthService) UpdatePassword(userID int64, req *models.UpdatePasswordRequest) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if !utils.CheckPassword(req.CurrentPassword, user.PasswordHash) {
		return errors.New("current password is incorrect")
	}
	hash, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return err
	}
	user.PasswordHash = hash
	return s.userRepo.Update(user)
}
