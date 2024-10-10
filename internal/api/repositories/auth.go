package repositories

import (
	"context"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

// AuthRepository is the repository for the auth routes
type AuthRepository struct {
	Cfg *config.Config
	Db  *sqlx.DB
	Rdb *redis.Client
}

// NewAuthRepository creates a new AuthRepository
func NewAuthRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) *AuthRepository {
	return &AuthRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// Register registers a new user
func (r *AuthRepository) Register(user *models.User) error {
	_, err := r.Db.NamedExec(`
	INSERT INTO customers (id, email, password, created_at, first_name, last_name, username) 
	VALUES (:id, :email, :password, :created_at, :first_name, :last_name, :username)
	`, user)
	if err != nil {
		return err
	}

	return nil
}

// GetUserByEmail gets a user by email
func (r *AuthRepository) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	err := r.Db.Get(user, "SELECT * FROM customers WHERE email = $1", email)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// UpdateRefreshToken updates the refresh token
func (r *AuthRepository) UpdateRefreshToken(userId string, refreshToken string) error {
	_, err := r.Rdb.Set(context.Background(), userId, refreshToken, 0).Result()
	if err != nil {
		return err
	}

	return nil
}
