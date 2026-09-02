package models

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Entry Types for Double-Entry
const (
	EntryTypeDebit  = "DEBIT"
	EntryTypeCredit = "CREDIT"
)

// Journal Statuses
const (
	JournalStatusPosted = "POSTED"
	JournalStatusVoided = "VOIDED"
)

// Transaction Types
const (
	TransactionTypeTransfer   = "TRANSFER"
	TransactionTypeDeposit    = "DEPOSIT"
	TransactionTypeWithdrawal = "WITHDRAWAL"
	TransactionTypeFee        = "FEE"
	TransactionTypeReversal   = "REVERSAL"
	TransactionTypeAdjustment = "ADJUSTMENT"
)

var (
	ErrUnbalancedJournal = errors.New("unbalanced journal entry: total debits must equal total credits")
	ErrZeroPostingAmount = errors.New("posting amount must be strictly positive")
	ErrEmptyPostings     = errors.New("journal entry must contain at least two postings")
)

type JournalEntry struct {
	ID              uuid.UUID     `json:"id" db:"id"`
	ReferenceID     string        `json:"reference_id" db:"reference_id"`
	TransactionType string        `json:"transaction_type" db:"transaction_type"`
	Description     string        `json:"description" db:"description"`
	Status          string        `json:"status" db:"status"`
	PostedAt        time.Time     `json:"posted_at" db:"posted_at"`
	CreatedAt       time.Time     `json:"created_at" db:"created_at"`
	Postings        []LedgerEntry `json:"postings,omitempty"`
}

type LedgerEntry struct {
	ID             int64     `json:"id" db:"id"`
	JournalEntryID uuid.UUID `json:"journal_entry_id" db:"journal_entry_id"`
	AccountID      int64     `json:"account_id" db:"account_id"`
	EntryType      string    `json:"entry_type" db:"entry_type"` // DEBIT or CREDIT
	Amount         int64     `json:"amount" db:"amount"`         // Strictly positive in minor units
	BalanceAfter   int64     `json:"balance_after" db:"balance_after"`
	Sequence       int       `json:"sequence" db:"sequence"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type PostingRequest struct {
	AccountID int64  `json:"account_id" validate:"required,gt=0"`
	EntryType string `json:"entry_type" validate:"required,oneof=DEBIT CREDIT"`
	Amount    int64  `json:"amount" validate:"required,gt=0"`
}

type CreateJournalRequest struct {
	ReferenceID     string           `json:"reference_id" validate:"required"`
	TransactionType string           `json:"transaction_type" validate:"required"`
	Description     string           `json:"description" validate:"required"`
	Postings        []PostingRequest `json:"postings" validate:"required,min=2,dive"`
}

// ValidateDoubleEntry validates that sum(Debit) == sum(Credit)
func (r *CreateJournalRequest) ValidateDoubleEntry() error {
	if len(r.Postings) < 2 {
		return ErrEmptyPostings
	}

	var totalDebit, totalCredit int64
	for _, p := range r.Postings {
		if p.Amount <= 0 {
			return ErrZeroPostingAmount
		}
		if p.EntryType == EntryTypeDebit {
			totalDebit += p.Amount
		} else if p.EntryType == EntryTypeCredit {
			totalCredit += p.Amount
		}
	}

	if totalDebit != totalCredit {
		return ErrUnbalancedJournal
	}

	return nil
}

type LedgerRepository interface {
	CreateJournalEntry(tx *sqlx.Tx, journal *JournalEntry) error
	CreateLedgerEntry(tx *sqlx.Tx, entry *LedgerEntry) error
	GetJournalByID(id uuid.UUID) (*JournalEntry, error)
	GetJournalByReferenceID(refID string) (*JournalEntry, error)
	GetLedgerEntriesByAccountID(accountID int64, limit int, offset int) ([]*LedgerEntry, error)
	GetPostingsByJournalID(journalID uuid.UUID) ([]*LedgerEntry, error)
}

type LedgerUsecase interface {
	PostJournal(tx *sqlx.Tx, req *CreateJournalRequest) (*JournalEntry, error)
	GetAccountStatement(accountID int64, limit int, offset int) ([]*LedgerEntry, error)
	GetJournalDetails(journalID uuid.UUID) (*JournalEntry, error)
}
