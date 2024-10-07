package usecases

import (
	"fmt"
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AuthUsecase is the usecase for the auth routes
type AuthUsecase struct {
	Cfg  *config.Config
	Repo models.AuthRepository
}

// NewAuthUsecase creates a new AuthUsecase
func NewAuthUsecase(cfg *config.Config, repo models.AuthRepository) *AuthUsecase {
	return &AuthUsecase{
		Repo: repo,
		Cfg:  cfg,
	}
}

// Register registers a new user
func (u *AuthUsecase) Register(user *models.User) (int, error) {
	_, err := u.Repo.GetUserByEmail(user.Email)
	if err == nil {
		return http.StatusConflict, fmt.Errorf("user with email %s already exists", user.Email)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	user.ID = uuid.New()
	user.Password = string(hashedPassword)

	err = u.Repo.Register(user)
	if err != nil {
		return http.StatusInternalServerError, err
	}

	return http.StatusCreated, nil
}

func (u *AuthUsecase) Login(user *models.UserCredentials) (models.LoginResponse, error) {
	dbUser, err := u.Repo.GetUserByEmail(user.Email)
	if err != nil {
		return models.LoginResponse{}, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(dbUser.Password), []byte(user.Password))
	if err != nil {
		return models.LoginResponse{}, err
	}

	refreshToken, err := utils.GenerateToken(u.Cfg, dbUser.ID, true)
	if err != nil {
		return models.LoginResponse{}, err
	}

	strId := dbUser.ID.String()
	err = u.Repo.UpdateRefreshToken(strId, refreshToken)
	if err != nil {
		return models.LoginResponse{}, err
	}

	accessToken, err := utils.GenerateToken(u.Cfg, dbUser.ID, false)
	if err != nil {
		return models.LoginResponse{}, err
	}

	return models.LoginResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
	}, nil
}
