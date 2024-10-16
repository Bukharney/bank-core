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
	UserRepo    models.UserRepository
}

// NewTransactionUsecase creates a new TransactionUsecase
func NewTransactionUsecase(cfg *config.Config, repo models.TransactionRepository, accountRepo models.AccountRepository, userRepo models.UserRepository) models.TransactionUsecase {
	return &TransactionUsecase{
		Cfg:         cfg,
		Repo:        repo,
		AccountRepo: accountRepo,
		UserRepo:    userRepo,
	}
}

// Transfer transfers money from one account to another
func (u *TransactionUsecase) Transfer(req *models.TransferRequest) error {
	accounts, err := u.AccountRepo.GetAccountByID(req.FromAccountID)
	if err != nil {
		return err
	}

	if accounts.UserID.String() != req.UserID {
		return errors.New("account does not belong to user")
	}

	if accounts.Balance < req.Amount {
		return errors.New("insufficient funds")
	}

	err = u.Repo.Transfer(accounts.ID, req.ToAccountID, req.Amount)
	if err != nil {
		return err
	}

	return nil
}

// Deposit deposits money into an account
func (u *TransactionUsecase) Deposit(req *models.DepositRequest) error {
	account, err := u.AccountRepo.GetAccountsByUserID(req.UserID)
	if err != nil {
		return err
	}

	if (*account)[0].AccountType != "atm" {
		return errors.New("only ATM accounts can deposit money")
	}

	err = u.Repo.Deposit(req.AccountID, req.Amount)
	if err != nil {
		return err
	}

	return nil
}

// Withdraw withdraws money from an account
func (u *TransactionUsecase) Withdrawal(req *models.WithdrawalRequest) error {
	atm, err := u.AccountRepo.GetAccountByID(req.AtmID)
	if err != nil {
		return err
	}

	if atm.AccountType != "atm" {
		return errors.New("invalid ATM account")
	}

	account, err := u.AccountRepo.GetAccountByID(req.AccountID)
	if err != nil {
		return err
	}

	if account.UserID.String() != req.UserID {
		return errors.New("account does not belong to user")
	}

	if account.Balance < req.Amount {
		return errors.New("insufficient funds")
	}

	err = u.Repo.Withdrawal(req.AccountID, req.AtmID, req.Amount)
	if err != nil {
		return err
	}

	return nil
}

// UpdateTransactionStatus updates the status of a transaction
func (u *TransactionUsecase) UpdateTransactionStatus(req *models.UpdateTransactionStatusRequest) error {
	user, err := u.UserRepo.GetUserById(req.UserID)
	if err != nil {
		return err
	}

	if user.Role != "admin" {
		return errors.New("unauthorized")
	}

	_, err = u.Repo.GetTransactionByID(req.ID)
	if err != nil {
		return err
	}

	err = u.Repo.UpdateTransactionStatus(req.ID, req.Status)
	if err != nil {
		return err
	}

	return nil
}

// GetTransactionsByAccountID gets all transactions by account ID
func (u *TransactionUsecase) GetTransactionsByAccountID(accountID int) ([]*models.Transaction, error) {
	return u.Repo.GetTransactionsByAccountID(accountID)
}

// GetTransactionByID gets a transaction by ID
func (u *TransactionUsecase) GetTransactionByID(id int) (*models.Transaction, error) {
	return u.Repo.GetTransactionByID(id)
}
