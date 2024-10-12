package usecases

import (
	"errors"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
)

// TransactionUsecase is the usecase for the transaction routes
type TransactionUsecase struct {
	Cfg         *config.Config
	Repo        models.TransactionRepository
	AccountRepo models.AccountRepository
}

// NewTransactionUsecase creates a new TransactionUsecase
func NewTransactionUsecase(cfg *config.Config, repo models.TransactionRepository, accountRepo models.AccountRepository) models.TransactionUsecase {
	return &TransactionUsecase{
		Cfg:         cfg,
		Repo:        repo,
		AccountRepo: accountRepo,
	}
}

// Transfer transfers money from one account to another
func (u *TransactionUsecase) Transfer(req *models.TransferRequest) error {
	account, err := u.AccountRepo.GetAccountByUserID(req.UserID)
	if err != nil {
		return err
	}

	if account.Balance < req.Amount {
		return errors.New("insufficient funds")
	}

	err = u.Repo.Transfer(account.ID, req.ToAccountID, req.Amount)
	if err != nil {
		return err
	}

	return nil
}
