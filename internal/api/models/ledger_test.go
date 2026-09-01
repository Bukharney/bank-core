package models_test

import (
	"testing"

	"github.com/bukharney/bank-core/internal/api/models"
)

func TestValidateDoubleEntry_Success(t *testing.T) {
	req := &models.CreateJournalRequest{
		ReferenceID:     "REF-001",
		TransactionType: models.TransactionTypeTransfer,
		Description:     "Transfer 500 THB",
		Postings: []models.PostingRequest{
			{AccountID: 1, EntryType: models.EntryTypeDebit, Amount: 50000},
			{AccountID: 2, EntryType: models.EntryTypeCredit, Amount: 50000},
		},
	}

	err := req.ValidateDoubleEntry()
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

func TestValidateDoubleEntry_MultiLegSuccess(t *testing.T) {
	// Transfer with 20 THB Fee
	// Account 1 (Sender): Debit 1020 THB (102000 satang)
	// Account 2 (Receiver): Credit 1000 THB (100000 satang)
	// Account 3 (Fee Revenue): Credit 20 THB (2000 satang)
	// Sum(Debit) = 102000, Sum(Credit) = 100000 + 2000 = 102000
	req := &models.CreateJournalRequest{
		ReferenceID:     "REF-002",
		TransactionType: models.TransactionTypeTransfer,
		Description:     "Transfer with Fee",
		Postings: []models.PostingRequest{
			{AccountID: 1, EntryType: models.EntryTypeDebit, Amount: 102000},
			{AccountID: 2, EntryType: models.EntryTypeCredit, Amount: 100000},
			{AccountID: 3, EntryType: models.EntryTypeCredit, Amount: 2000},
		},
	}

	err := req.ValidateDoubleEntry()
	if err != nil {
		t.Fatalf("expected multi-leg balanced journal to pass, got: %v", err)
	}
}

func TestValidateDoubleEntry_UnbalancedError(t *testing.T) {
	req := &models.CreateJournalRequest{
		ReferenceID:     "REF-UNBALANCED",
		TransactionType: models.TransactionTypeTransfer,
		Description:     "Unbalanced transfer",
		Postings: []models.PostingRequest{
			{AccountID: 1, EntryType: models.EntryTypeDebit, Amount: 50000},
			{AccountID: 2, EntryType: models.EntryTypeCredit, Amount: 40000}, // Missing 10000
		},
	}

	err := req.ValidateDoubleEntry()
	if err != models.ErrUnbalancedJournal {
		t.Fatalf("expected ErrUnbalancedJournal, got %v", err)
	}
}

func TestValidateDoubleEntry_ZeroOrNegativeAmount(t *testing.T) {
	req := &models.CreateJournalRequest{
		ReferenceID:     "REF-ZERO",
		TransactionType: models.TransactionTypeTransfer,
		Description:     "Zero amount",
		Postings: []models.PostingRequest{
			{AccountID: 1, EntryType: models.EntryTypeDebit, Amount: 0},
			{AccountID: 2, EntryType: models.EntryTypeCredit, Amount: 0},
		},
	}

	err := req.ValidateDoubleEntry()
	if err != models.ErrZeroPostingAmount {
		t.Fatalf("expected ErrZeroPostingAmount, got %v", err)
	}
}

func TestValidateDoubleEntry_LessThanTwoPostings(t *testing.T) {
	req := &models.CreateJournalRequest{
		ReferenceID:     "REF-SINGLE",
		TransactionType: models.TransactionTypeDeposit,
		Description:     "Single leg",
		Postings: []models.PostingRequest{
			{AccountID: 1, EntryType: models.EntryTypeCredit, Amount: 50000},
		},
	}

	err := req.ValidateDoubleEntry()
	if err != models.ErrEmptyPostings {
		t.Fatalf("expected ErrEmptyPostings, got %v", err)
	}
}
