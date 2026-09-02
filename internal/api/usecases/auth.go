package usecases

import (
	"fmt"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase struct {
	Cfg      *config.Config
	Repo     models.AuthRepository
	UserRepo models.UserRepository
}

func NewAuthUsecase(cfg *config.Config, repo models.AuthRepository, userRepo models.UserRepository) models.AuthUsecase {
	return &AuthUsecase{
		UserRepo: userRepo,
		Repo:     repo,
		Cfg:      cfg,
	}
}

func (u *AuthUsecase) Login(user *models.UserCredentials) (*models.LoginResponse, error) {
	dbUser, err := u.UserRepo.GetUserByEmail(user.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	err = bcrypt.CompareHashAndPassword([]byte(dbUser.PasswordHash), []byte(user.Password))
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	refreshToken, err := utils.GenerateToken(u.Cfg, dbUser.ID, true)
	if err != nil {
		return nil, err
	}

	err = u.Repo.UpdateRefreshToken(dbUser.ID.String(), refreshToken, 7*24*time.Hour)
	if err != nil {
		return nil, err
	}

	accessToken, err := utils.GenerateToken(u.Cfg, dbUser.ID, false)
	if err != nil {
		return nil, err
	}

	return &models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (u *AuthUsecase) Logout(refreshToken string) error {
	userId, err := utils.ParseToken(u.Cfg, refreshToken, true)
	if err != nil {
		return fmt.Errorf("invalid refresh token")
	}

	return u.Repo.RevokeRefreshToken(userId)
}

func (u *AuthUsecase) RefreshToken(refreshToken string) (*models.LoginResponse, error) {
	userIdStr, err := utils.ParseToken(u.Cfg, refreshToken, true)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	// Verify token is active in Redis and has not been revoked/rotated
	storedToken, err := u.Repo.GetRefreshToken(userIdStr)
	if err != nil || storedToken == "" || storedToken != refreshToken {
		return nil, fmt.Errorf("refresh token has been revoked or expired")
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		return nil, fmt.Errorf("invalid user id in token")
	}

	accessToken, err := utils.GenerateToken(u.Cfg, userID, false)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := utils.GenerateToken(u.Cfg, userID, true)
	if err != nil {
		return nil, err
	}

	_ = u.Repo.UpdateRefreshToken(userIdStr, newRefreshToken, 7*24*time.Hour)

	return &models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

func (u *AuthUsecase) Me(token string) (*models.User, error) {
	userIdStr, err := utils.GetUserIdFromToken(u.Cfg, token, false)
	if err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(userIdStr)
	if err != nil {
		return nil, err
	}

	user, err := u.UserRepo.GetUserByID(userID)
	if err != nil {
		return nil, err
	}

	return user, nil
}
