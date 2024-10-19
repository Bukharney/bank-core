package repositories

import (
	"errors"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/bukharney/bank-core/internal/utils"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// TransactionRepository is the repository for the transaction routes
type TransactionRepository struct {
	Db  *sqlx.DB
	Rdb *redis.Client
	Cfg *config.Config
}

// NewTransactionRepository creates a new TransactionRepository
func NewTransactionRepository(pg *sqlx.DB, rdb *redis.Client, cfg *config.Config) *TransactionRepository {
	return &TransactionRepository{
		Db:  pg,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// CreateTransaction creates a new transaction
func (r *TransactionRepository) CreateTransaction(tx *sqlx.Tx, transaction *models.Transaction) error {
	_, err := tx.NamedExec(`INSERT INTO transactions (account_id, receiver_account_id, amount, transaction_type, transaction_reference, transaction_status)
	VALUES (:account_id, :receiver_account_id, :amount, :transaction_type, :transaction_reference, :transaction_status)`, transaction)
	if err != nil {
		tx.Rollback()
		return err
	}

	return nil
}

// UpdateTransactionStatus updates the status of a transaction
func (r *TransactionRepository) UpdateTransactionStatus(id int, status string) error {
	res, err := r.Db.Exec("UPDATE transactions SET transaction_status = $1 WHERE id = $2", status, id)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return errors.New("transaction not found")
	}

	return nil
}

// GetTransactionsByAccountID gets transactions by account ID
func (r *TransactionRepository) GetTransactionsByAccountID(accountID int) ([]*models.Transaction, error) {
	transactions := []*models.Transaction{}
	err := r.Db.Select(&transactions, "SELECT * FROM transactions WHERE account_id = $1", accountID)
	if err != nil {
		return nil, err
	}

	return transactions, nil
}

// GetTransactionByID gets a transaction by ID
func (r *TransactionRepository) GetTransactionByID(id int) (*models.Transaction, error) {
	transaction := &models.Transaction{}
	err := r.Db.Get(transaction, "SELECT * FROM transactions WHERE id = $1", id)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil, errors.New("transaction not found")
		}
		return nil, err
	}

	return transaction, nil
}

// Transfer transfers money from one account to another
func (r *TransactionRepository) Transfer(fromAccountID int, toAccountID int, amount float64) error {
	tx, err := r.Db.Beginx()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, fromAccountID)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, toAccountID)
	if err != nil {
		tx.Rollback()
		return err
	}

	transaction := &models.Transaction{
		AccountID:            fromAccountID,
		ReceiverAccountID:    toAccountID,
		Amount:               amount,
		TransactionType:      "transfer",
		TransactionStatus:    "success",
		TransactionReference: utils.TransactionReference(),
	}

	err = r.CreateTransaction(tx, transaction)
	if err != nil {
		tx.Rollback()
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

// GetTransactionsByAccountID gets transactions by account ID
func (r *TransactionRepository) GetTransactionsByUserID(userID string) ([]*models.Transaction, error) {
	transactions := []*models.Transaction{}
	err := r.Db.Select(&transactions, "SELECT * FROM transactions WHERE account_id = $1", userID)
	if err != nil {
		return nil, err
	}

	return transactions, nil
}

// Deposit deposits money into an account
func (r *TransactionRepository) Deposit(accountID int, amount float64) error {
	tx, err := r.Db.Beginx()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, accountID)
	if err != nil {
		tx.Rollback()
		return err
	}

	transaction := &models.Transaction{
		AccountID:            accountID,
		ReceiverAccountID:    accountID,
		Amount:               amount,
		TransactionType:      "deposit",
		TransactionStatus:    "success",
		TransactionReference: utils.TransactionReference(),
	}

	err = r.CreateTransaction(tx, transaction)
	if err != nil {
		tx.Rollback()
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

// Withdrawal withdraws money from an account
func (r *TransactionRepository) Withdraw(accountID int, atmId int, amount float64) error {
	tx, err := r.Db.Beginx()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amount, accountID)
	if err != nil {
		tx.Rollback()
		return err
	}

	transaction := &models.Transaction{
		AccountID:            accountID,
		ReceiverAccountID:    atmId,
		Amount:               amount,
		TransactionType:      "withdraw",
		TransactionStatus:    "pending",
		TransactionReference: utils.TransactionReference(),
	}

	err = r.CreateTransaction(tx, transaction)
	if err != nil {
		tx.Rollback()
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}
