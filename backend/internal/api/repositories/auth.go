package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

const RefreshTokenPrefix = "auth:refresh:"

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
func (r *AuthRepository) UpdateRefreshToken(userId string, refreshToken string, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	key := RefreshTokenPrefix + userId
	return r.Rdb.Set(context.Background(), key, refreshToken, ttl).Err()
}

func (r *AuthRepository) GetRefreshToken(userId string) (string, error) {
	key := RefreshTokenPrefix + userId
	val, err := r.Rdb.Get(context.Background(), key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", nil
		}
		return "", err
	}
	return val, nil
}

func (r *AuthRepository) RevokeRefreshToken(userId string) error {
	key := RefreshTokenPrefix + userId
	return r.Rdb.Del(context.Background(), key).Err()
}
