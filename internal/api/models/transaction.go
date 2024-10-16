package models

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type TransactionRepository interface {
	CreateTransaction(tx *sqlx.Tx, transaction *Transaction) error
	GetTransactionsByUserID(userID string) ([]*Transaction, error)
	Transfer(fromAccountID int, toAccountID int, amount float64) error
	Deposit(accountID int, amount float64) error
	Withdrawal(accountID int, atmId int, amount float64) error
	UpdateTransactionStatus(id int, status string) error
	GetTransactionByID(id int) (*Transaction, error)
	GetTransactionsByAccountID(accountID int) ([]*Transaction, error)
}

type TransactionUsecase interface {
	Transfer(req *TransferRequest) error
	Deposit(req *DepositRequest) error
	Withdrawal(req *WithdrawalRequest) error
	UpdateTransactionStatus(req *UpdateTransactionStatusRequest) error
	GetTransactionByID(id int) (*Transaction, error)
	GetTransactionsByAccountID(accountID int) ([]*Transaction, error)
}

type Transaction struct {
	ID                   int       `json:"id" db:"id"`
	AccountID            int       `json:"account_id" db:"account_id"`
	ReceiverAccountID    int       `json:"receiver_account_id" db:"receiver_account_id"`
	Amount               float64   `json:"amount" db:"amount"`
	TransactionType      string    `json:"transaction_type" db:"transaction_type"`
	TransactionReference string    `json:"transaction_reference" db:"transaction_reference"`
	TransactionStatus    string    `json:"transaction_status" db:"transaction_status"`
	TransactionDate      time.Time `json:"transaction_date" db:"transaction_date"`
}

type TransferRequest struct {
	UserID        string  `json:"user_id"`
	FromAccountID int     `json:"from_account_id"`
	ToAccountID   int     `json:"to_account_id" validate:"required"`
	Amount        float64 `json:"amount" validate:"required"`
}

type DepositRequest struct {
	UserID     string  `json:"user_id"`
	AccountID  int     `json:"account_id" validate:"required"`
	Amount     float64 `json:"amount" validate:"required"`
	DepositRef string  `json:"deposit_ref"`
}

type WithdrawalRequest struct {
	UserID        string  `json:"user_id"`
	AtmID         int     `json:"atm_id" validate:"required"`
	AccountID     int     `json:"account_id" validate:"required"`
	Amount        float64 `json:"amount" validate:"required"`
	WithdrawalRef string  `json:"withdrawal_ref"`
}

type UpdateTransactionStatusRequest struct {
	UserID string `json:"user_id"`
	ID     int    `json:"id" validate:"required"`
	Status string `json:"status" validate:"required"`
}
