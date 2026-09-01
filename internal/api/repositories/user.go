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

type UserRepository struct {
	Cfg *config.Config
	Db  *sqlx.DB
	Rdb *redis.Client
}

func NewUserRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.UserRepository {
	return &UserRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

func (r *UserRepository) CreateUser(user *models.User) error {
	query := `
		INSERT INTO users (id, username, email, phone_number, password_hash, first_name, last_name, role, status, created_at, updated_at)
		VALUES (:id, :username, :email, :phone_number, :password_hash, :first_name, :last_name, :role, :status, :created_at, :updated_at)
	`
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	if user.Status == "" {
		user.Status = models.UserStatusActive
	}
	if user.Role == "" {
		user.Role = models.UserRoleUser
	}
	now := time.Now().UTC()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := r.Db.NamedExec(query, user)
	return err
}

func (r *UserRepository) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, username, email, phone_number, password_hash, first_name, last_name, role, status, created_at, updated_at FROM users WHERE email = $1`
	err := r.Db.Get(user, query, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) GetUserByID(id uuid.UUID) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, username, email, phone_number, password_hash, first_name, last_name, role, status, created_at, updated_at FROM users WHERE id = $1`
	err := r.Db.Get(user, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) GetUserByUsername(username string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, username, email, phone_number, password_hash, first_name, last_name, role, status, created_at, updated_at FROM users WHERE username = $1`
	err := r.Db.Get(user, query, username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) GetUserByPhone(phone string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, username, email, phone_number, password_hash, first_name, last_name, role, status, created_at, updated_at FROM users WHERE phone_number = $1`
	err := r.Db.Get(user, query, phone)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) UpdateUserStatus(id uuid.UUID, status string) error {
	query := `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`
	res, err := r.Db.Exec(query, status, id)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("user not found")
	}
	return nil
}
