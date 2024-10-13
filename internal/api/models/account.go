package models

import (
	"time"

	"github.com/google/uuid"
)

type AccountRepository interface {
	GetAccountByID(accountID int) (*Account, error)
	GetAccountByUserID(userID string) (*Account, error)
	CreateAccount(userID string) error
}

type Account struct {
	ID          int       `json:"id" db:"id"`
	UserID      uuid.UUID `json:"user_id" db:"user_id"`
	Balance     float64   `json:"balance" db:"balance"`
	AccountType string    `json:"account_type" db:"account_type"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}
