package usecases_test

import (
	"testing"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/usecases"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type mockAuthRepo struct {
	tokens map[string]string
}

func newMockAuthRepo() *mockAuthRepo {
	return &mockAuthRepo{
		tokens: make(map[string]string),
	}
}

func (m *mockAuthRepo) UpdateRefreshToken(userId string, refreshToken string, ttl time.Duration) error {
	m.tokens[userId] = refreshToken
	return nil
}

func (m *mockAuthRepo) GetRefreshToken(userId string) (string, error) {
	token, ok := m.tokens[userId]
	if !ok {
		return "", nil
	}
	return token, nil
}

func (m *mockAuthRepo) RevokeRefreshToken(userId string) error {
	delete(m.tokens, userId)
	return nil
}

func setupAuthTest() (*config.Config, *mockAuthRepo, *mockUserRepo, models.AuthUsecase) {
	cfg := &config.Config{
		JWTSecret: map[bool]string{
			false: "test-access-secret",
			true:  "test-refresh-secret",
		},
	}
	authRepo := newMockAuthRepo()
	userRepo := &mockUserRepo{
		users: make(map[uuid.UUID]*models.User),
	}
	authUC := usecases.NewAuthUsecase(cfg, authRepo, userRepo)
	return cfg, authRepo, userRepo, authUC
}

func TestAuthUsecase_Login_Success(t *testing.T) {
	cfg, authRepo, userRepo, authUC := setupAuthTest()

	userID := uuid.New()
	password := "SecretPass123"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	user := &models.User{
		ID:           userID,
		Email:        "user@bank.internal",
		PasswordHash: string(hash),
	}
	userRepo.users[userID] = user

	res, err := authUC.Login(&models.UserCredentials{
		Email:    "user@bank.internal",
		Password: password,
	})
	if err != nil {
		t.Fatalf("expected login to succeed, got %v", err)
	}

	if res.AccessToken == "" || res.RefreshToken == "" {
		t.Fatalf("expected access and refresh tokens, got empty")
	}

	// Verify refresh token is saved in auth repo
	storedToken, err := authRepo.GetRefreshToken(userID.String())
	if err != nil {
		t.Fatalf("failed to get refresh token from repo: %v", err)
	}
	if storedToken != res.RefreshToken {
		t.Errorf("expected stored token to match %s, got %s", res.RefreshToken, storedToken)
	}

	// Verify access token contains correct user ID
	parsedUserId, err := utils.GetUserIdFromToken(cfg, res.AccessToken, false)
	if err != nil {
		t.Fatalf("failed to parse access token: %v", err)
	}
	if parsedUserId != userID.String() {
		t.Errorf("expected parsed userId %s, got %s", userID.String(), parsedUserId)
	}
}

func TestAuthUsecase_Login_InvalidPassword(t *testing.T) {
	_, _, userRepo, authUC := setupAuthTest()

	userID := uuid.New()
	hash, _ := bcrypt.GenerateFromPassword([]byte("CorrectPass123"), bcrypt.DefaultCost)
	userRepo.users[userID] = &models.User{
		ID:           userID,
		Email:        "user@bank.internal",
		PasswordHash: string(hash),
	}

	_, err := authUC.Login(&models.UserCredentials{
		Email:    "user@bank.internal",
		Password: "WrongPassword",
	})
	if err == nil {
		t.Fatalf("expected error on invalid password, got nil")
	}
}

func TestAuthUsecase_RefreshToken_Success(t *testing.T) {
	cfg, authRepo, _, authUC := setupAuthTest()

	userID := uuid.New()
	refreshToken, err := utils.GenerateToken(cfg, userID, true)
	if err != nil {
		t.Fatalf("failed to generate refresh token: %v", err)
	}

	// Store initial token in repo
	_ = authRepo.UpdateRefreshToken(userID.String(), refreshToken, 7*24*time.Hour)

	res, err := authUC.RefreshToken(refreshToken)
	if err != nil {
		t.Fatalf("expected RefreshToken to succeed, got %v", err)
	}

	if res.AccessToken == "" || res.RefreshToken == "" {
		t.Fatalf("expected new access and refresh tokens, got empty")
	}

	// Verify repo has been updated with the new refresh token
	storedToken, err := authRepo.GetRefreshToken(userID.String())
	if err != nil {
		t.Fatalf("failed to get refresh token from repo: %v", err)
	}
	if storedToken != res.RefreshToken {
		t.Errorf("expected repo to have updated refresh token %s, got %s", res.RefreshToken, storedToken)
	}
}

func TestAuthUsecase_RefreshToken_RevokedOrMismatched(t *testing.T) {
	cfg, authRepo, _, authUC := setupAuthTest()

	userID := uuid.New()
	refreshToken, err := utils.GenerateToken(cfg, userID, true)
	if err != nil {
		t.Fatalf("failed to generate refresh token: %v", err)
	}

	// Case 1: Token not in repo (revoked / deleted)
	_, err = authUC.RefreshToken(refreshToken)
	if err == nil {
		t.Fatalf("expected error for revoked token, got nil")
	}

	// Case 2: Different token in repo (mismatched)
	_ = authRepo.UpdateRefreshToken(userID.String(), "another-token", 7*24*time.Hour)
	_, err = authUC.RefreshToken(refreshToken)
	if err == nil {
		t.Fatalf("expected error for mismatched token, got nil")
	}
}

func TestAuthUsecase_Logout_Success(t *testing.T) {
	cfg, authRepo, _, authUC := setupAuthTest()

	userID := uuid.New()
	refreshToken, err := utils.GenerateToken(cfg, userID, true)
	if err != nil {
		t.Fatalf("failed to generate refresh token: %v", err)
	}

	_ = authRepo.UpdateRefreshToken(userID.String(), refreshToken, 7*24*time.Hour)

	err = authUC.Logout(refreshToken)
	if err != nil {
		t.Fatalf("expected logout to succeed, got %v", err)
	}

	// Verify token removed from repo
	storedToken, _ := authRepo.GetRefreshToken(userID.String())
	if storedToken != "" {
		t.Errorf("expected token to be revoked/empty, got %s", storedToken)
	}

	// Subsequent refresh should fail
	_, err = authUC.RefreshToken(refreshToken)
	if err == nil {
		t.Fatalf("expected refresh after logout to fail, got nil")
	}
}

func TestAuthUsecase_Me(t *testing.T) {
	cfg, _, userRepo, authUC := setupAuthTest()

	userID := uuid.New()
	user := &models.User{
		ID:        userID,
		Email:     "user@bank.internal",
		Username:  "bankuser",
		FirstName: "Bank",
		LastName:  "User",
	}
	userRepo.users[userID] = user

	token, err := utils.GenerateToken(cfg, userID, false)
	if err != nil {
		t.Fatalf("failed to generate access token: %v", err)
	}

	foundUser, err := authUC.Me(token)
	if err != nil {
		t.Fatalf("expected Me to succeed, got %v", err)
	}
	if foundUser.ID != userID {
		t.Errorf("expected user ID %s, got %s", userID, foundUser.ID)
	}

	// Invalid token
	_, err = authUC.Me("invalid-token")
	if err == nil {
		t.Fatalf("expected error for invalid token, got nil")
	}

	// Non-existent user
	nonExistentID := uuid.New()
	orphanToken, _ := utils.GenerateToken(cfg, nonExistentID, false)
	_, err = authUC.Me(orphanToken)
	if err == nil {
		t.Fatalf("expected error for non-existent user, got nil")
	}
}
