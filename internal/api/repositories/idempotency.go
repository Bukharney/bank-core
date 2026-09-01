package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

type IdempotencyRepository struct {
	Db  *sqlx.DB
	Rdb *redis.Client
	Cfg *config.Config
}

func NewIdempotencyRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.IdempotencyRepository {
	return &IdempotencyRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

// AcquireLock checks if the idempotency key exists. If not, creates one with status STARTED.
// If it exists and is COMPLETED, returns the existing record (isNew = false).
// If it exists and is STARTED but still locked, returns ErrIdempotencyConflict.
func (r *IdempotencyRepository) AcquireLock(
	ctx context.Context,
	key string,
	userID uuid.UUID,
	path string,
	payloadHash string,
	lockDuration time.Duration,
) (*models.IdempotencyKey, bool, error) {
	now := time.Now().UTC()
	lockedUntil := now.Add(lockDuration)

	// Try atomic INSERT first
	queryInsert := `
		INSERT INTO idempotency_keys (id, key, user_id, request_path, request_hash, status, locked_until, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		ON CONFLICT (key, user_id) DO NOTHING
		RETURNING id, key, user_id, request_path, request_hash, response_status, response_body, status, locked_until, created_at, updated_at
	`
	newRecord := &models.IdempotencyKey{}
	err := r.Db.GetContext(ctx, newRecord, queryInsert, uuid.New(), key, userID, path, payloadHash, models.IdempotencyStatusStarted, lockedUntil, now)
	if err == nil {
		return newRecord, true, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return nil, false, err
	}

	// Record exists, fetch it
	existing := &models.IdempotencyKey{}
	querySelect := `
		SELECT id, key, user_id, request_path, request_hash, response_status, response_body, status, locked_until, created_at, updated_at
		FROM idempotency_keys
		WHERE key = $1 AND user_id = $2
	`
	err = r.Db.GetContext(ctx, existing, querySelect, key, userID)
	if err != nil {
		return nil, false, err
	}

	// Payload mismatch detection
	if existing.RequestHash != payloadHash {
		return nil, false, models.ErrIdempotencyPayloadDiff
	}

	// If already completed, return cached response
	if existing.Status == models.IdempotencyStatusCompleted {
		return existing, false, nil
	}

	// If in progress and lock has not expired, report conflict
	if existing.Status == models.IdempotencyStatusStarted && existing.LockedUntil.After(now) {
		return nil, false, models.ErrIdempotencyConflict
	}

	// Otherwise, lock expired or failed previously, re-acquire lease
	queryReacquire := `
		UPDATE idempotency_keys
		SET status = $1, locked_until = $2, updated_at = $3
		WHERE key = $4 AND user_id = $5
		RETURNING id, key, user_id, request_path, request_hash, response_status, response_body, status, locked_until, created_at, updated_at
	`
	reacquired := &models.IdempotencyKey{}
	err = r.Db.GetContext(ctx, reacquired, queryReacquire, models.IdempotencyStatusStarted, lockedUntil, now, key, userID)
	if err != nil {
		return nil, false, err
	}

	return reacquired, true, nil
}

func (r *IdempotencyRepository) SaveResponse(ctx context.Context, key string, userID uuid.UUID, statusCode int, responseBody []byte) error {
	raw := json.RawMessage(responseBody)
	query := `
		UPDATE idempotency_keys
		SET response_status = $1, response_body = $2, status = $3, updated_at = NOW()
		WHERE key = $4 AND user_id = $5
	`
	_, err := r.Db.ExecContext(ctx, query, statusCode, raw, models.IdempotencyStatusCompleted, key, userID)
	return err
}

func (r *IdempotencyRepository) MarkFailed(ctx context.Context, key string, userID uuid.UUID) error {
	query := `
		UPDATE idempotency_keys
		SET status = $1, updated_at = NOW()
		WHERE key = $2 AND user_id = $3
	`
	_, err := r.Db.ExecContext(ctx, query, models.IdempotencyStatusFailed, key, userID)
	return err
}
