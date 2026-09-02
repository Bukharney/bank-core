package repositories

import (
	"database/sql"
	"errors"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

var (
	ErrJournalNotFound = errors.New("journal entry not found")
)

type LedgerRepository struct {
	Db  *sqlx.DB
	Rdb *redis.Client
	Cfg *config.Config
}

func NewLedgerRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.LedgerRepository {
	return &LedgerRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

func (r *LedgerRepository) CreateJournalEntry(tx *sqlx.Tx, journal *models.JournalEntry) error {
	query := `
		INSERT INTO journal_entries (id, reference_id, transaction_type, description, status, posted_at, created_at)
		VALUES (:id, :reference_id, :transaction_type, :description, :status, :posted_at, :created_at)
	`
	if journal.ID == uuid.Nil {
		journal.ID = uuid.New()
	}
	if journal.Status == "" {
		journal.Status = models.JournalStatusPosted
	}
	now := time.Now().UTC()
	if journal.PostedAt.IsZero() {
		journal.PostedAt = now
	}
	journal.CreatedAt = now

	var runner sqlx.Ext = r.Db
	if tx != nil {
		runner = tx
	}

	_, err := sqlx.NamedExec(runner, query, journal)
	return err
}

func (r *LedgerRepository) CreateLedgerEntry(tx *sqlx.Tx, entry *models.LedgerEntry) error {
	query := `
		INSERT INTO ledger_entries (journal_entry_id, account_id, entry_type, amount, balance_after, sequence, created_at)
		VALUES (:journal_entry_id, :account_id, :entry_type, :amount, :balance_after, :sequence, :created_at)
		RETURNING id
	`
	entry.CreatedAt = time.Now().UTC()

	var runner sqlx.Ext = r.Db
	if tx != nil {
		runner = tx
	}

	rows, err := sqlx.NamedQuery(runner, query, entry)
	if err != nil {
		return err
	}
	defer rows.Close()

	if rows.Next() {
		return rows.Scan(&entry.ID)
	}
	return nil
}

func (r *LedgerRepository) GetJournalByID(id uuid.UUID) (*models.JournalEntry, error) {
	journal := &models.JournalEntry{}
	query := `SELECT id, reference_id, transaction_type, description, status, posted_at, created_at FROM journal_entries WHERE id = $1`
	err := r.Db.Get(journal, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrJournalNotFound
		}
		return nil, err
	}
	return journal, nil
}

func (r *LedgerRepository) GetJournalByReferenceID(refID string) (*models.JournalEntry, error) {
	journal := &models.JournalEntry{}
	query := `SELECT id, reference_id, transaction_type, description, status, posted_at, created_at FROM journal_entries WHERE reference_id = $1`
	err := r.Db.Get(journal, query, refID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrJournalNotFound
		}
		return nil, err
	}
	return journal, nil
}

func (r *LedgerRepository) GetLedgerEntriesByAccountID(accountID int64, limit int, offset int) ([]*models.LedgerEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var entries []*models.LedgerEntry
	query := `
		SELECT id, journal_entry_id, account_id, entry_type, amount, balance_after, sequence, created_at
		FROM ledger_entries
		WHERE account_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2 OFFSET $3
	`
	err := r.Db.Select(&entries, query, accountID, limit, offset)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

func (r *LedgerRepository) GetPostingsByJournalID(journalID uuid.UUID) ([]*models.LedgerEntry, error) {
	var entries []*models.LedgerEntry
	query := `
		SELECT id, journal_entry_id, account_id, entry_type, amount, balance_after, sequence, created_at
		FROM ledger_entries
		WHERE journal_entry_id = $1
		ORDER BY sequence ASC, id ASC
	`
	err := r.Db.Select(&entries, query, journalID)
	if err != nil {
		return nil, err
	}
	return entries, nil
}
