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
	ErrAccountNotFound      = errors.New("account not found")
	ErrOptimisticLockFailed = errors.New("account was modified concurrently, please retry")
)

type AccountRepository struct {
	Db  *sqlx.DB
	Rdb *redis.Client
	Cfg *config.Config
}

func NewAccountRepository(pg *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.AccountRepository {
	return &AccountRepository{
		Db:  pg,
		Rdb: rdb,
		Cfg: cfg,
	}
}

func (r *AccountRepository) CreateAccount(tx *sqlx.Tx, account *models.Account) error {
	query := `
		INSERT INTO accounts (account_number, user_id, currency, account_type, status, balance, version, created_at, updated_at)
		VALUES (:account_number, :user_id, :currency, :account_type, :status, :balance, :version, :created_at, :updated_at)
		RETURNING id
	`
	if account.Currency == "" {
		account.Currency = "THB"
	}
	if account.Status == "" {
		account.Status = models.AccountStatusActive
	}
	if account.Version == 0 {
		account.Version = 1
	}
	now := time.Now().UTC()
	account.CreatedAt = now
	account.UpdatedAt = now

	var runner sqlx.Ext = r.Db
	if tx != nil {
		runner = tx
	}

	rows, err := sqlx.NamedQuery(runner, query, account)
	if err != nil {
		return err
	}
	defer rows.Close()

	if rows.Next() {
		return rows.Scan(&account.ID)
	}
	return nil
}

func (r *AccountRepository) GetAccountByID(accountID int64) (*models.Account, error) {
	account := &models.Account{}
	query := `
		SELECT 
			a.id, a.account_number, a.user_id, a.currency, a.account_type, a.status, a.balance, a.version, a.linked_phone, a.created_at, a.updated_at,
			COALESCE(u.first_name || ' ' || u.last_name, '') AS account_holder_name
		FROM accounts a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.id = $1
	`
	err := r.Db.Get(account, query, accountID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return account, nil
}

// GetAccountByIDForUpdate acquires a pessimistic row-level lock (SELECT ... FOR UPDATE)
func (r *AccountRepository) GetAccountByIDForUpdate(tx *sqlx.Tx, accountID int64) (*models.Account, error) {
	if tx == nil {
		return nil, errors.New("transaction context required for SELECT FOR UPDATE")
	}
	account := &models.Account{}
	query := `SELECT id, account_number, user_id, currency, account_type, status, balance, version, linked_phone, created_at, updated_at FROM accounts WHERE id = $1 FOR UPDATE`
	err := tx.Get(account, query, accountID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return account, nil
}

func (r *AccountRepository) GetAccountsByUserID(userID uuid.UUID) ([]*models.Account, error) {
	var accounts []*models.Account
	query := `
		SELECT 
			a.id, a.account_number, a.user_id, a.currency, a.account_type, a.status, a.balance, a.version, a.linked_phone, a.created_at, a.updated_at,
			COALESCE(u.first_name || ' ' || u.last_name, '') AS account_holder_name
		FROM accounts a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.user_id = $1 
		ORDER BY a.id ASC
	`
	err := r.Db.Select(&accounts, query, userID)
	if err != nil {
		return nil, err
	}
	return accounts, nil
}

func (r *AccountRepository) GetAccountByNumber(accountNumber string) (*models.Account, error) {
	account := &models.Account{}
	query := `
		SELECT 
			a.id, a.account_number, a.user_id, a.currency, a.account_type, a.status, a.balance, a.version, a.linked_phone, a.created_at, a.updated_at,
			COALESCE(u.first_name || ' ' || u.last_name, '') AS account_holder_name
		FROM accounts a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.account_number = $1
	`
	err := r.Db.Get(account, query, accountNumber)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return account, nil
}

func (r *AccountRepository) GetAccountByLinkedPhone(phone string) (*models.Account, error) {
	account := &models.Account{}
	query := `
		SELECT 
			a.id, a.account_number, a.user_id, a.currency, a.account_type, a.status, a.balance, a.version, a.linked_phone, a.created_at, a.updated_at,
			COALESCE(u.first_name || ' ' || u.last_name, '') AS account_holder_name
		FROM accounts a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.linked_phone = $1
	`
	err := r.Db.Get(account, query, phone)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrAccountNotFound
		}
		return nil, err
	}
	return account, nil
}

func (r *AccountRepository) LinkPhone(userID uuid.UUID, accountID int64, phone string) error {
	tx, err := r.Db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Unlink any currently linked account for this user or phone
	unlinkQuery := `UPDATE accounts SET linked_phone = NULL, updated_at = NOW() WHERE (user_id = $1 OR linked_phone = $2) AND linked_phone IS NOT NULL`
	if _, err := tx.Exec(unlinkQuery, userID, phone); err != nil {
		return err
	}

	// 2. Link this specific account (ensuring it belongs to the user)
	linkQuery := `UPDATE accounts SET linked_phone = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`
	res, err := tx.Exec(linkQuery, phone, accountID, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAccountNotFound
	}

	return tx.Commit()
}

func (r *AccountRepository) UnlinkPhone(userID uuid.UUID, accountID int64) error {
	query := `UPDATE accounts SET linked_phone = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2`
	res, err := r.Db.Exec(query, accountID, userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAccountNotFound
	}
	return nil
}

// UpdateBalance updates balance using optimistic lock check (version) if version > 0
func (r *AccountRepository) UpdateBalance(tx *sqlx.Tx, accountID int64, newBalance int64, currentVersion int64) error {
	var res sql.Result
	var err error

	if currentVersion > 0 {
		query := `UPDATE accounts SET balance = $1, version = version + 1, updated_at = NOW() WHERE id = $2 AND version = $3`
		if tx != nil {
			res, err = tx.Exec(query, newBalance, accountID, currentVersion)
		} else {
			res, err = r.Db.Exec(query, newBalance, accountID, currentVersion)
		}
	} else {
		query := `UPDATE accounts SET balance = $1, version = version + 1, updated_at = NOW() WHERE id = $2`
		if tx != nil {
			res, err = tx.Exec(query, newBalance, accountID)
		} else {
			res, err = r.Db.Exec(query, newBalance, accountID)
		}
	}

	if err != nil {
		return err
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		if currentVersion > 0 {
			return ErrOptimisticLockFailed
		}
		return ErrAccountNotFound
	}
	return nil
}

func (r *AccountRepository) UpdateStatus(accountID int64, status string) error {
	query := `UPDATE accounts SET status = $1, updated_at = NOW() WHERE id = $2`
	res, err := r.Db.Exec(query, status, accountID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAccountNotFound
	}
	return nil
}

