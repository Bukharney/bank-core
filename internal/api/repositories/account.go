package repositories

import (
	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// AccountRepository is the repository for the account routes
type AccountRepository struct {
	Db  *sqlx.DB
	Rdb *redis.Client
	Cfg *config.Config
}

// NewAccountRepository creates a new AccountRepository
func NewAccountRepository(pg *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.AccountRepository {
	return &AccountRepository{
		Db:  pg,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// CreateAccount creates a new account
func (r *AccountRepository) CreateAccount(userID string) error {
	_, err := r.Db.Exec("INSERT INTO accounts (user_id, balance) VALUES ($1, $2)", userID, 0)
	if err != nil {
		return err
	}

	return nil
}

// GetAccountByID gets an account by ID
func (r *AccountRepository) GetAccountByID(accountID int) (*models.Account, error) {
	account := &models.Account{}
	err := r.Db.Get(account, "SELECT * FROM accounts WHERE id = $1", accountID)
	if err != nil {
		return nil, err
	}

	return account, nil
}

// GetAccount gets an account by user ID
func (r *AccountRepository) GetAccountByUserID(userID string) (*models.Account, error) {
	account := &models.Account{}
	err := r.Db.Get(account, "SELECT * FROM accounts WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}

	return account, nil
}
