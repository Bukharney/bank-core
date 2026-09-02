package usecases

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
)

type AccountUsecase struct {
	Cfg  *config.Config
	Repo models.AccountRepository
}

func NewAccountUsecase(cfg *config.Config, repo models.AccountRepository) models.AccountUsecase {
	return &AccountUsecase{
		Cfg:  cfg,
		Repo: repo,
	}
}

func (u *AccountUsecase) CreateAccount(req *models.CreateAccountRequest) (*models.Account, error) {
	randGen := rand.New(rand.NewSource(time.Now().UnixNano()))
	accNumber := fmt.Sprintf("%010d", randGen.Int63n(10000000000))

	currency := req.Currency
	if currency == "" {
		currency = "THB"
	}
	accType := req.AccountType
	if accType == "" {
		accType = models.AccountTypeSavings
	}

	// Enforce limit of maximum 5 accounts per customer
	existing, err := u.Repo.GetAccountsByUserID(req.UserID)
	if err == nil && len(existing) >= 5 {
		return nil, fmt.Errorf("maximum limit of 5 accounts reached (currently have %d)", len(existing))
	}

	account := &models.Account{
		AccountNumber: accNumber,
		UserID:        req.UserID,
		Currency:      currency,
		AccountType:   accType,
		Status:        models.AccountStatusActive,
		Balance:       0,
		Version:       1,
	}

	err = u.Repo.CreateAccount(nil, account)
	if err != nil {
		return nil, err
	}

	return account, nil
}

func (u *AccountUsecase) GetAccountByID(accountID int64) (*models.Account, error) {
	return u.Repo.GetAccountByID(accountID)
}

func (u *AccountUsecase) GetAccountByNumber(accountNumber string) (*models.Account, error) {
	return u.Repo.GetAccountByNumber(accountNumber)
}

func (u *AccountUsecase) GetAccountsByUserID(userID uuid.UUID) ([]*models.Account, error) {
	accounts, err := u.Repo.GetAccountsByUserID(userID)
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		acc, err := u.CreateAccount(&models.CreateAccountRequest{
			UserID:      userID,
			AccountType: models.AccountTypeSavings,
			Currency:    "THB",
		})
		if err == nil && acc != nil {
			return []*models.Account{acc}, nil
		}
	}
	return accounts, nil
}

func (u *AccountUsecase) UpdateAccountStatus(req *models.UpdateAccountStatusRequest) error {
	return u.Repo.UpdateStatus(req.AccountID, req.Status)
}
