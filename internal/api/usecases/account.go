package usecases

import (
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
)

// AccountUsecase is the usecase for the account routes
type AccountUsecase struct {
	Cfg  *config.Config
	Repo models.AccountRepository
}

// NewAccountUsecase creates a new AccountUsecase
func NewAccountUsecase(cfg *config.Config, repo models.AccountRepository) models.AccountUsecase {
	return &AccountUsecase{
		Cfg:  cfg,
		Repo: repo,
	}
}

// GetAccountByID gets an account by its ID
func (u *AccountUsecase) GetAccountByID(accountID string) (*models.Account, error) {
	id, err := utils.StringToInt(accountID)
	if err != nil {
		return nil, err
	}

	return u.Repo.GetAccountByID(id)
}

// GetAccountByUserID gets an account by its user ID
func (u *AccountUsecase) GetAccountsByUserID(userID string) (*[]models.Account, error) {
	return u.Repo.GetAccountsByUserID(userID)
}

// CreateAccount creates an account for a user
func (u *AccountUsecase) CreateAccount(userID string) error {
	account := &models.CreateAccountRequest{
		UserID:      userID,
		Balance:     0,
		AccountType: "savings",
	}

	return u.Repo.CreateAccount(account)
}
