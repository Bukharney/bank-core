package repositories

import (
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
)

type AdminRepository struct {
	Db  *sqlx.DB
	Cfg *config.Config
}

func NewAdminRepository(db *sqlx.DB, cfg *config.Config) models.AdminRepository {
	return &AdminRepository{
		Db:  db,
		Cfg: cfg,
	}
}

func (r *AdminRepository) GetSystemAccounts() ([]models.SystemAccountOverview, error) {
	query := `
		SELECT id, account_number, currency, status, balance
		FROM accounts
		WHERE account_type = 'SYSTEM_SETTLEMENT'
		ORDER BY id ASC
	`
	var accounts []models.SystemAccountOverview
	err := r.Db.Select(&accounts, query)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}

func (r *AdminRepository) GetCustomerAggregates() (int64, int64, error) {
	query := `
		SELECT COALESCE(SUM(balance), 0) AS total_deposits, COUNT(*) AS active_accounts
		FROM accounts
		WHERE account_type != 'SYSTEM_SETTLEMENT' AND status = 'ACTIVE'
	`
	var result struct {
		TotalDeposits  int64 `db:"total_deposits"`
		ActiveAccounts int64 `db:"active_accounts"`
	}
	err := r.Db.Get(&result, query)
	if err != nil {
		return 0, 0, err
	}
	return result.TotalDeposits, result.ActiveAccounts, nil
}

func (r *AdminRepository) GetTotalUsersCount() (int64, error) {
	query := `SELECT COUNT(*) FROM users`
	var count int64
	err := r.Db.Get(&count, query)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *AdminRepository) GetTransactions24hMetrics() (int64, int64, error) {
	query := `
		SELECT COUNT(*) AS tx_count, COALESCE(SUM(amount), 0) AS tx_volume
		FROM ledger_entries
		WHERE created_at >= NOW() - INTERVAL '24 hours' AND entry_type = 'DEBIT'
	`
	var result struct {
		TxCount  int64 `db:"tx_count"`
		TxVolume int64 `db:"tx_volume"`
	}
	err := r.Db.Get(&result, query)
	if err != nil {
		return 0, 0, err
	}
	return result.TxCount, result.TxVolume, nil
}

func (r *AdminRepository) GetLedgerHealth() (models.LedgerHealthStatus, error) {
	querySums := `
		SELECT 
			COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_debits,
			COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credits
		FROM ledger_entries
	`
	var sums struct {
		TotalDebits  int64 `db:"total_debits"`
		TotalCredits int64 `db:"total_credits"`
	}
	if err := r.Db.Get(&sums, querySums); err != nil {
		return models.LedgerHealthStatus{}, err
	}

	queryOutbox := `
		SELECT COUNT(*) 
		FROM outbox_events 
		WHERE status IN ('PENDING', 'FAILED')
	`
	var pendingOutbox int64
	if err := r.Db.Get(&pendingOutbox, queryOutbox); err != nil {
		return models.LedgerHealthStatus{}, err
	}

	leakage := sums.TotalDebits - sums.TotalCredits
	return models.LedgerHealthStatus{
		InvariantOK:         leakage == 0,
		TotalDebits:         sums.TotalDebits,
		TotalCredits:        sums.TotalCredits,
		LeakageSatang:       leakage,
		PendingOutboxEvents: pendingOutbox,
	}, nil
}
