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
func NewAuthRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.AuthRepository {
	return &AuthRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// UpdateRefreshToken updates the refresh token
func (r *AuthRepository) UpdateRefreshToken(userId string, refreshToken string) error {
	_, err := r.Rdb.Set(context.Background(), userId, refreshToken, 0).Result()
	if err != nil {
		return err
	}

	return nil
}
