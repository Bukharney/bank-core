package repositories

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
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

func parseStatementDate(val string, isEnd bool) (*time.Time, error) {
	val = strings.TrimSpace(val)
	if val == "" {
		return nil, nil
	}
	if t, err := time.Parse(time.RFC3339, val); err == nil {
		return &t, nil
	}
	if t, err := time.Parse("2006-01-02", val); err == nil {
		if isEnd {
			t = t.Add(23*time.Hour + 59*time.Minute + 59*time.Second + 999*time.Millisecond)
		}
		return &t, nil
	}
	return nil, fmt.Errorf("invalid date format: %s", val)
}

func buildStatementFilterWhere(accountID int64, filter models.LedgerStatementFilter) (string, string, []interface{}, error) {
	joinClause := ""
	whereClause := "WHERE le.account_id = $1"
	args := []interface{}{accountID}
	argIdx := 2

	entryType := strings.ToUpper(strings.TrimSpace(filter.EntryType))
	if entryType == "DEBIT" || entryType == "CREDIT" {
		whereClause += fmt.Sprintf(" AND le.entry_type = $%d", argIdx)
		args = append(args, entryType)
		argIdx++
	}

	if filter.StartDate != "" {
		st, err := parseStatementDate(filter.StartDate, false)
		if err == nil && st != nil {
			whereClause += fmt.Sprintf(" AND le.created_at >= $%d", argIdx)
			args = append(args, *st)
			argIdx++
		}
	}

	if filter.EndDate != "" {
		et, err := parseStatementDate(filter.EndDate, true)
		if err == nil && et != nil {
			whereClause += fmt.Sprintf(" AND le.created_at <= $%d", argIdx)
			args = append(args, *et)
			argIdx++
		}
	}

	query := strings.TrimSpace(filter.Query)
	if query != "" {
		joinClause = "LEFT JOIN journal_entries j ON j.id = le.journal_entry_id"
		whereClause += fmt.Sprintf(" AND (le.journal_entry_id::text ILIKE $%d OR j.reference_id ILIKE $%d OR j.description ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+query+"%")
		argIdx++
	}

	return joinClause, whereClause, args, nil
}

func (r *LedgerRepository) GetLedgerEntriesByAccountID(accountID int64, filter models.LedgerStatementFilter, limit int, offset int) ([]*models.LedgerEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	joinClause, whereClause, args, _ := buildStatementFilterWhere(accountID, filter)
	argIdx := len(args) + 1
	selectQuery := fmt.Sprintf(`
		SELECT le.id, le.journal_entry_id, le.account_id, le.entry_type, le.amount, le.balance_after, le.sequence, le.created_at
		FROM ledger_entries le
		%s
		%s
		ORDER BY le.created_at DESC, le.id DESC
		LIMIT $%d OFFSET $%d
	`, joinClause, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	entries := make([]*models.LedgerEntry, 0)
	err := r.Db.Select(&entries, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

func (r *LedgerRepository) CountLedgerEntriesByAccountID(accountID int64, filter models.LedgerStatementFilter) (int64, error) {
	joinClause, whereClause, args, _ := buildStatementFilterWhere(accountID, filter)
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM ledger_entries le %s %s", joinClause, whereClause)
	var count int64
	err := r.Db.Get(&count, countQuery, args...)
	if err != nil {
		return 0, err
	}
	return count, nil
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
