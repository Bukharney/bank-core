package models

import (
	"time"

	"github.com/google/uuid"
)

type TransferRequest struct {
	SenderAccountID   int64  `json:"sender_account_id" validate:"required,gt=0"`
	ReceiverAccountID int64  `json:"receiver_account_id" validate:"required,gt=0,necsfield=SenderAccountID"`
	Amount            int64  `json:"amount" validate:"required,gt=0"` // In minor units (Satang)
	Currency          string `json:"currency" validate:"required,len=3"`
	Description       string `json:"description" validate:"max=255"`
	PIN               string `json:"pin" validate:"required,len=6,numeric"`
}

type DepositRequest struct {
	AccountID   int64  `json:"account_id" validate:"required,gt=0"`
	Amount      int64  `json:"amount" validate:"required,gt=0"` // In minor units (Satang)
	Currency    string `json:"currency" validate:"required,len=3"`
	DepositRef  string `json:"deposit_ref" validate:"required"`
	Description string `json:"description" validate:"max=255"`
}

type WithdrawalRequest struct {
	AccountID     int64  `json:"account_id" validate:"required,gt=0"`
	Amount        int64  `json:"amount" validate:"required,gt=0"` // In minor units (Satang)
	Currency      string `json:"currency" validate:"required,len=3"`
	ATMID         int    `json:"atm_id" validate:"required"`
	WithdrawalRef string `json:"withdrawal_ref" validate:"required"`
	Description   string `json:"description" validate:"max=255"`
}

// Cardless Withdrawal Models
type CardlessWithdrawal struct {
	ID             uuid.UUID `json:"id" db:"id"`
	UserID         uuid.UUID `json:"user_id" db:"user_id"`
	AccountID      int64     `json:"account_id" db:"account_id"`
	PhoneNumber    string    `json:"phone_number" db:"phone_number"`
	Code           string    `json:"code" db:"code"`
	Amount         int64     `json:"amount" db:"amount"`
	Currency       string    `json:"currency" db:"currency"`
	ATMID          int       `json:"atm_id" db:"atm_id"`
	Status         string    `json:"status" db:"status"`
	FailedAttempts int       `json:"failed_attempts" db:"failed_attempts"`
	MaxAttempts    int       `json:"max_attempts" db:"max_attempts"`
	ExpiresAt      time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

type RequestCardlessWithdrawalRequest struct {
	AccountID   int64  `json:"account_id" validate:"required,gt=0"`
	Amount      int64  `json:"amount" validate:"required,gt=0"`
	Currency    string `json:"currency"`
	ATMID       int    `json:"atm_id"`
	PhoneNumber string `json:"phone_number"`
	PIN         string `json:"pin" validate:"required,len=6,numeric"`
}

type CardlessWithdrawalTicket struct {
	OrderID          uuid.UUID `json:"order_id"`
	AccountID        int64     `json:"account_id"`
	PhoneNumber      string    `json:"phone_number"`
	Code             string    `json:"code"`
	Amount           int64     `json:"amount"`
	Currency         string    `json:"currency"`
	ATMID            int       `json:"atm_id"`
	ExpiresInSeconds int       `json:"expires_in_seconds"`
	ExpiresAt        time.Time `json:"expires_at"`
}

type VerifyCardlessWithdrawalRequest struct {
	PhoneNumber string `json:"phone_number" validate:"required"`
	Code        string `json:"code" validate:"required,len=6"`
	ATMID       int    `json:"atm_id"`
}

type VerifyCardlessWithdrawalResponse struct {
	OrderID      uuid.UUID `json:"order_id"`
	CustomerName string    `json:"customer_name"`
	Amount       int64     `json:"amount"`
	Currency     string    `json:"currency"`
	ATMID        int       `json:"atm_id"`
	Status       string    `json:"status"`
}

type ConfirmCardlessWithdrawalRequest struct {
	OrderID uuid.UUID `json:"order_id" validate:"required"`
	ATMID   int       `json:"atm_id"`
}

type TransferReceipt struct {
	JournalID         uuid.UUID `json:"journal_id"`
	ReferenceID       string    `json:"reference_id"`
	SenderAccountID   int64     `json:"sender_account_id"`
	ReceiverAccountID int64     `json:"receiver_account_id"`
	Amount            int64     `json:"amount"`
	Currency          string    `json:"currency"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
}

type TransferUsecase interface {
	Transfer(userID uuid.UUID, req *TransferRequest, idempotencyKey string) (*TransferReceipt, error)
	Deposit(userID uuid.UUID, req *DepositRequest, idempotencyKey string) (*TransferReceipt, error)
	Withdrawal(userID uuid.UUID, req *WithdrawalRequest, idempotencyKey string) (*TransferReceipt, error)
	RequestCardlessWithdrawal(userID uuid.UUID, req *RequestCardlessWithdrawalRequest) (*CardlessWithdrawalTicket, error)
	VerifyCardlessWithdrawal(req *VerifyCardlessWithdrawalRequest) (*VerifyCardlessWithdrawalResponse, error)
	ConfirmCardlessWithdrawal(req *ConfirmCardlessWithdrawalRequest) (*TransferReceipt, error)
}
