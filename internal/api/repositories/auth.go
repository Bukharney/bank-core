package repositories

import (
	"context"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

// AuthRepository is the repository for the auth routes
type AuthRepository struct {
	Cfg *config.Config
	Db  *pgx.Conn
	Rdb *redis.Client
}

// NewAuthRepository creates a new AuthRepository
func NewAuthRepository(db *pgx.Conn, rdb *redis.Client, cfg *config.Config) *AuthRepository {
	return &AuthRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// Register registers a new user
func (r *AuthRepository) Register(user *models.User) error {
	_, err := r.Db.Exec(context.Background(), "INSERT INTO customers (id, email, password, username, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6)", user.ID, user.Email, user.Password, user.Username, user.FirstName, user.LastName)
	if err != nil {
		return err
	}

	return nil
}

// GetUserByEmail gets a user by email
func (r *AuthRepository) GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	rows, err := r.Db.Query(context.Background(), "SELECT * FROM customers WHERE email = $1", email)
	if err != nil {
		return &user, err
	}

	p, err := pgx.CollectOneRow(rows, pgx.RowToAddrOfStructByName[models.User])
	if err != nil {
		return &user, err
	}

	return p, nil
}

// UpdateRefreshToken updates the refresh token
func (r *AuthRepository) UpdateRefreshToken(userId string, refreshToken string) error {
	_, err := r.Rdb.Set(context.Background(), userId, refreshToken, 0).Result()
	if err != nil {
		return err
	}

	return nil
}
