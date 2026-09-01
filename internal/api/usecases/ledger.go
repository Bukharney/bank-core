package usecases

import (
	"errors"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type LedgerUsecase struct {
	Cfg         *config.Config
	Db          *sqlx.DB
	LedgerRepo  models.LedgerRepository
	AccountRepo models.AccountRepository
}

func NewLedgerUsecase(
	cfg *config.Config,
	db *sqlx.DB,
	ledgerRepo models.LedgerRepository,
	accountRepo models.AccountRepository,
) models.LedgerUsecase {
	return &LedgerUsecase{
		Cfg:         cfg,
		Db:          db,
		LedgerRepo:  ledgerRepo,
		AccountRepo: accountRepo,
	}
}

// PostJournal performs double-entry validation and inserts balanced ledger entries
func (u *LedgerUsecase) PostJournal(tx *sqlx.Tx, req *models.CreateJournalRequest) (*models.JournalEntry, error) {
	if err := req.ValidateDoubleEntry(); err != nil {
		return nil, err
	}

	shouldCommit := false
	if tx == nil {
		var err error
		tx, err = u.Db.Beginx()
		if err != nil {
			return nil, err
		}
		shouldCommit = true
		defer func() {
			if shouldCommit {
				tx.Rollback()
			}
		}()
	}

	journalID := uuid.New()
	journal := &models.JournalEntry{
		ID:              journalID,
		ReferenceID:     req.ReferenceID,
		TransactionType: req.TransactionType,
		Description:     req.Description,
		Status:          models.JournalStatusPosted,
	}

	err := u.LedgerRepo.CreateJournalEntry(tx, journal)
	if err != nil {
		return nil, err
	}

	for i, posting := range req.Postings {
		// Acquire lock on the account to update its running balance
		account, err := u.AccountRepo.GetAccountByIDForUpdate(tx, posting.AccountID)
		if err != nil {
			return nil, err
		}

		var newBalance int64
		if posting.EntryType == models.EntryTypeDebit {
			// For Assets/Customer deposits: Debit decreases customer liability/balance (or increases asset)
			// Standard Banking Core Convention for Customer Deposit Accounts (Liability to Bank):
			// DEBIT = Withdrawal / Money Out
			// CREDIT = Deposit / Money In
			if account.AccountType != models.AccountTypeSystemSettlement && account.Balance < posting.Amount {
				return nil, errors.New("insufficient balance for debit posting")
			}
			newBalance = account.Balance - posting.Amount
		} else {
			newBalance = account.Balance + posting.Amount
		}

		err = u.AccountRepo.UpdateBalance(tx, account.ID, newBalance, 0)
		if err != nil {
			return nil, err
		}

		ledgerEntry := &models.LedgerEntry{
			JournalEntryID: journalID,
			AccountID:      account.ID,
			EntryType:      posting.EntryType,
			Amount:         posting.Amount,
			BalanceAfter:   newBalance,
			Sequence:       i + 1,
		}

		err = u.LedgerRepo.CreateLedgerEntry(tx, ledgerEntry)
		if err != nil {
			return nil, err
		}
	}

	if shouldCommit {
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		shouldCommit = false
	}

	return journal, nil
}

func (u *LedgerUsecase) GetAccountStatement(accountID int64, limit int, offset int) ([]*models.LedgerEntry, error) {
	return u.LedgerRepo.GetLedgerEntriesByAccountID(accountID, limit, offset)
}

func (u *LedgerUsecase) GetJournalDetails(journalID uuid.UUID) (*models.JournalEntry, error) {
	journal, err := u.LedgerRepo.GetJournalByID(journalID)
	if err != nil {
		return nil, err
	}
	postings, err := u.LedgerRepo.GetPostingsByJournalID(journalID)
	if err != nil {
		return nil, err
	}
	entries := make([]models.LedgerEntry, len(postings))
	for i, p := range postings {
		entries[i] = *p
	}
	journal.Postings = entries
	return journal, nil
}
