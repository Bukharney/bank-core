package usecases

import (
	"fmt"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AuthUsecase is the usecase for the auth routes
type AuthUsecase struct {
	Cfg      *config.Config
	Repo     models.AuthRepository
	UserRepo models.UserRepository
}

// NewAuthUsecase creates a new AuthUsecase
func NewAuthUsecase(cfg *config.Config, repo models.AuthRepository, userRepo models.UserRepository) models.AuthUsecase {
	return &AuthUsecase{
		UserRepo: userRepo,
		Repo:     repo,
		Cfg:      cfg,
	}
}

// Login logs in a user
func (u *AuthUsecase) Login(user *models.UserCredentials) (*models.LoginResponse, error) {
	dbUser, err := u.UserRepo.GetUserByEmail(user.Email)
	if err != nil {
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(dbUser.Password), []byte(user.Password))
	if err != nil {
		return nil, fmt.Errorf("invalid password")
	}

	refreshToken, err := utils.GenerateToken(u.Cfg, dbUser.ID, true)
	if err != nil {
		return nil, err
	}

	strId := dbUser.ID.String()
	err = u.Repo.UpdateRefreshToken(strId, refreshToken)
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

// Logout logs out a user
func (u *AuthUsecase) Logout(refreshToken string) error {
	userId, err := utils.ParseToken(u.Cfg, refreshToken, true)
	if err != nil {
		return fmt.Errorf("invalid refresh token")
	}

	return u.Repo.UpdateRefreshToken(userId, "")
}

// RefreshToken refreshes the access token
func (u *AuthUsecase) RefreshToken(refreshToken string) (*models.LoginResponse, error) {
	userId, err := utils.ParseToken(u.Cfg, refreshToken, true)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	accessToken, err := utils.GenerateToken(u.Cfg, uuid.MustParse(userId), false)
	if err != nil {
		return nil, err
	}

	refreshToken, err = utils.GenerateToken(u.Cfg, uuid.MustParse(userId), true)
	if err != nil {
		return nil, err
	}

	return &models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (u *AuthUsecase) Me(token string) (*models.User, error) {
	userId, err := utils.GetUserIdFromToken(u.Cfg, token, false)
	if err != nil {
		return nil, err
	}

	user, err := u.UserRepo.GetUserById(userId)
	if err != nil {
		return nil, err
	}

	return user, nil
}
