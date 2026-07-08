package service

import (
	"strings"
	"testing"
	"time"
	"todo-app/internal/config"
	"todo-app/internal/models"
	"todo-app/internal/repository"
	"todo-app/migrations"
	"todo-app/pkg/utils"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newAuthServiceTestContext(t *testing.T) (*AuthService, *repository.UserRepository, int64) {
	t.Helper()

	dsn := "file:auth-service-test-" + strings.NewReplacer("/", "-", " ", "-").Replace(t.Name()) + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := migrations.Migrate(db); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	hash, err := utils.HashPassword("old-password")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	user := &models.User{
		Username:     "auth_service_user",
		Email:        "auth_service_user@example.com",
		PasswordHash: hash,
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	authSvc := NewAuthService(userRepo, &config.JWTConfig{
		Secret: "test-secret",
		Expire: time.Hour,
	})
	return authSvc, userRepo, user.ID
}

func TestUpdateProfileSavesAndClearsAvatarURL(t *testing.T) {
	authSvc, userRepo, userID := newAuthServiceTestContext(t)

	const avatar = "data:image/png;base64,abcd"
	updated, err := authSvc.UpdateProfile(userID, &models.UpdateProfileRequest{AvatarURL: stringPtr(avatar)})
	if err != nil {
		t.Fatalf("update avatar: %v", err)
	}
	if updated.AvatarURL != avatar {
		t.Fatalf("avatar_url=%q want %q", updated.AvatarURL, avatar)
	}

	updated, err = authSvc.UpdateProfile(userID, &models.UpdateProfileRequest{Timezone: "UTC"})
	if err != nil {
		t.Fatalf("update timezone: %v", err)
	}
	if updated.AvatarURL != avatar {
		t.Fatalf("avatar_url after unrelated profile update=%q want %q", updated.AvatarURL, avatar)
	}

	updated, err = authSvc.UpdateProfile(userID, &models.UpdateProfileRequest{AvatarURL: stringPtr("")})
	if err != nil {
		t.Fatalf("clear avatar: %v", err)
	}
	if updated.AvatarURL != "" {
		t.Fatalf("cleared avatar_url=%q want empty", updated.AvatarURL)
	}

	user, err := userRepo.GetByID(userID)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if user.AvatarURL != "" {
		t.Fatalf("persisted avatar_url=%q want empty", user.AvatarURL)
	}
}

func TestUpdateProfileRejectsInvalidAvatarURL(t *testing.T) {
	authSvc, _, userID := newAuthServiceTestContext(t)

	_, err := authSvc.UpdateProfile(userID, &models.UpdateProfileRequest{AvatarURL: stringPtr("javascript:alert(1)")})
	if err == nil {
		t.Fatal("expected invalid avatar_url error")
	}
	if !strings.Contains(err.Error(), "avatar_url") {
		t.Fatalf("error=%q want avatar_url context", err.Error())
	}
}

func TestUpdatePasswordRequiresCurrentPasswordAndUpdatesHash(t *testing.T) {
	authSvc, userRepo, userID := newAuthServiceTestContext(t)

	err := authSvc.UpdatePassword(userID, &models.UpdatePasswordRequest{
		CurrentPassword: "wrong-password",
		NewPassword:     "new-password",
	})
	if err == nil {
		t.Fatal("expected wrong current password error")
	}

	if err := authSvc.UpdatePassword(userID, &models.UpdatePasswordRequest{
		CurrentPassword: "old-password",
		NewPassword:     "new-password",
	}); err != nil {
		t.Fatalf("update password: %v", err)
	}

	user, err := userRepo.GetByID(userID)
	if err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if utils.CheckPassword("old-password", user.PasswordHash) {
		t.Fatal("old password still matches after update")
	}
	if !utils.CheckPassword("new-password", user.PasswordHash) {
		t.Fatal("new password does not match updated hash")
	}
}

func TestRefreshTokenFromRawAcceptsRecentlyExpiredToken(t *testing.T) {
	authSvc, _, userID := newAuthServiceTestContext(t)
	token, err := utils.GenerateToken(userID, "auth_service_user", "test-secret", -time.Hour)
	if err != nil {
		t.Fatalf("generate expired token: %v", err)
	}

	refreshed, err := authSvc.RefreshTokenFromRaw(token)
	if err != nil {
		t.Fatalf("refresh recently expired token: %v", err)
	}

	claims, err := utils.ParseToken(refreshed, "test-secret")
	if err != nil {
		t.Fatalf("parse refreshed token: %v", err)
	}
	if claims.UserID != userID {
		t.Fatalf("refreshed token user_id=%d want=%d", claims.UserID, userID)
	}
}

func TestRefreshTokenFromRawRejectsExpiredTokenOutsideGraceWindow(t *testing.T) {
	authSvc, _, userID := newAuthServiceTestContext(t)
	token, err := utils.GenerateToken(userID, "auth_service_user", "test-secret", -(RefreshGracePeriod + time.Hour))
	if err != nil {
		t.Fatalf("generate expired token: %v", err)
	}

	_, err = authSvc.RefreshTokenFromRaw(token)
	if err == nil {
		t.Fatal("expected refresh window expired error")
	}
	if !strings.Contains(err.Error(), "refresh window expired") {
		t.Fatalf("error=%q want refresh window expired", err.Error())
	}
}

func stringPtr(value string) *string {
	return &value
}
