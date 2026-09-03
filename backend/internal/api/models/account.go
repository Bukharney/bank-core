package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Account Status
const (
	AccountStatusActive = "ACTIVE"
	AccountStatusFrozen = "FROZEN"
	AccountStatusClosed = "CLOSED"
)

// Account Types
const (
	AccountTypeSavings          = "SAVINGS"
	AccountTypeChecking         = "CHECKING"
	AccountTypeSystemSettlement = "SYSTEM_SETTLEMENT"
	AccountTypeInternal         = "INTERNAL"
)

type Account struct {
	ID                int64     `json:"id" db:"id"`
	AccountNumber     string    `json:"account_number" db:"account_number"`
	UserID            uuid.UUID `json:"user_id" db:"user_id"`
	AccountHolderName string    `json:"account_holder_name,omitempty" db:"account_holder_name"`
	Currency          string    `json:"currency" db:"currency"`
	AccountType       string    `json:"account_type" db:"account_type"`
	Status            string    `json:"status" db:"status"`
	Balance           int64     `json:"balance" db:"balance"` // Stored in minor currency unit (e.g., Satang/Cents)
	Version           int64     `json:"version" db:"version"` // For optimistic locking
	LinkedPhone       *string   `json:"linked_phone" db:"linked_phone"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

type CreateAccountRequest struct {
	UserID      uuid.UUID `json:"user_id" validate:"required"`
	AccountType string    `json:"account_type" validate:"required,oneof=SAVINGS CHECKING"`
	Currency    string    `json:"currency" validate:"required,len=3"`
}

type UpdateAccountStatusRequest struct {
	AccountID int64  `json:"account_id" validate:"required,gt=0"`
	Status    string `json:"status" validate:"required,oneof=ACTIVE FROZEN CLOSED"`
	Reason    string `json:"reason"`
}

type LinkPhoneRequest struct {
	AccountID int64 `json:"account_id" validate:"required,gt=0"`
}

type UnlinkPhoneRequest struct {
	AccountID int64 `json:"account_id" validate:"required,gt=0"`
}

type AccountResponse struct {
	ID                int64     `json:"id"`
	AccountNumber     string    `json:"account_number"`
	UserID            uuid.UUID `json:"user_id"`
	AccountHolderName string    `json:"account_holder_name,omitempty"`
	Currency          string    `json:"currency"`
	AccountType       string    `json:"account_type"`
	Status            string    `json:"status"`
	Balance           int64     `json:"balance"` // In minor unit
	Formatted         string    `json:"formatted"` // e.g. "1,250.50 THB"
	LinkedPhone       *string   `json:"linked_phone,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

type AccountPreviewResponse struct {
	ID                int64  `json:"id"`
	AccountNumber     string `json:"account_number"`
	AccountHolderName string `json:"account_holder_name,omitempty"`
	Currency          string `json:"currency"`
	AccountType       string `json:"account_type"`
	Status            string `json:"status"`
}

type AccountRepository interface {
	CreateAccount(tx *sqlx.Tx, account *Account) error
	GetAccountByID(accountID int64) (*Account, error)
	GetAccountByIDForUpdate(tx *sqlx.Tx, accountID int64) (*Account, error)
	GetAccountsByUserID(userID uuid.UUID) ([]*Account, error)
	GetAccountByNumber(accountNumber string) (*Account, error)
	GetAccountByLinkedPhone(phone string) (*Account, error)
	LinkPhone(userID uuid.UUID, accountID int64, phone string) error
	UnlinkPhone(userID uuid.UUID, accountID int64) error
	UpdateBalance(tx *sqlx.Tx, accountID int64, newBalance int64, currentVersion int64) error
	UpdateStatus(accountID int64, status string) error
}

type AccountUsecase interface {
	CreateAccount(req *CreateAccountRequest) (*Account, error)
	GetAccountByID(accountID int64) (*Account, error)
	GetAccountByNumber(accountNumber string) (*Account, error)
	GetAccountsByUserID(userID uuid.UUID) ([]*Account, error)
	GetAccountByLinkedPhone(phone string) (*Account, error)
	LinkPhone(userID uuid.UUID, req *LinkPhoneRequest) (*Account, error)
	UnlinkPhone(userID uuid.UUID, req *UnlinkPhoneRequest) error
	UpdateAccountStatus(req *UpdateAccountStatusRequest) error
}

