package usecases

import (
	"github.com/bukharney/bank-core/internal/api/models"
)

// AuthUsecase is the usecase for the auth routes
type AuthUsecase struct {
	repo models.AuthRepository
}

// NewAuthUsecase creates a new AuthUsecase
func NewAuthUsecase(repo models.AuthRepository) *AuthUsecase {
	return &AuthUsecase{
		repo: repo,
	}
}

// Register registers a new user
func (u *AuthUsecase) Register(user *models.User) error {
	return u.repo.Register(user)
}
