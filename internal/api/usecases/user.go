package usecases

import (
	"fmt"
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// UserUsecase is the usecase for the user routes
type UserUsecase struct {
	Cfg         *config.Config
	Repo        models.UserRepository
	AccountRepo models.AccountRepository
}

// NewUserUsecase creates a new UserUsecase
func NewUserUsecase(cfg *config.Config, repo models.UserRepository, accountRepo models.AccountRepository) models.UserUsecase {
	return &UserUsecase{
		Repo: repo,
		Cfg:  cfg,
	}
}

// GetUser gets a user by email
func (u *UserUsecase) GetUser(email string) (*models.User, error) {
	user, err := u.Repo.GetUserByEmail(email)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// Register registers a new user
func (u *UserUsecase) Register(user *models.User) (int, error) {
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

	err = u.Repo.Register(user, &models.Account{
		UserID:      user.ID,
		Balance:     0,
		AccountType: "savings",
	})
	if err != nil {
		return http.StatusInternalServerError, err
	}

	return http.StatusCreated, nil
}
