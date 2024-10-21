package usecases

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/api/repositories"
	"github.com/bukharney/bank-core/internal/config"
)

// TransactionUsecase is the usecase for the transaction routes
type TransactionUsecase struct {
	Cfg         *config.Config
	Repo        *repositories.TransactionRepository
	AccountRepo *repositories.AccountRepository
	UserRepo    *repositories.UserRepository
}

// NewTransactionUsecase creates a new TransactionUsecase
func NewTransactionUsecase(cfg *config.Config, repo *repositories.TransactionRepository, accountRepo *repositories.AccountRepository, userRepo *repositories.UserRepository) *TransactionUsecase {
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
	atm, err := u.UserRepo.GetUserById(req.UserID)
	if err != nil {
		return err
	}

	if atm.Role != "atm" {
		return errors.New("only ATMs can deposit money")
	}

	err = u.Repo.Deposit(req.AccountID, req.Amount)
	if err != nil {
		return err
	}

	return nil
}

// Withdraw withdraws money from an account
func (u *TransactionUsecase) Withdrawal(req *models.WithdrawalRequest) error {
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

	err = u.Repo.Withdraw(account.ID, req.ATMID, req.Amount)
	if err != nil {
		return err
	}

	t := struct {
		SessionID string  `json:"session_id"`
		Amount    float64 `json:"amount"`
	}{
		SessionID: req.SessionID,
		Amount:    req.Amount,
	}

	jsonData, err := json.Marshal(t)
	if err != nil {
		return err
	}

	// Send signal to ATM to dispense cash
	// This is a simulation and will not actually dispense cash
	// The ATM server is running on a separate port
	// But in a real-world scenario, the ATM server would be running on a separate machine
	// and the request would be sent over the network
	res, err := http.Post(fmt.Sprintf("http://localhost:808%d/atm/dispense", req.ATMID), "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return errors.New("could not send signal to ATM")
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
