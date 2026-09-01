package models

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Idempotency Statuses
const (
	IdempotencyStatusStarted   = "STARTED"
	IdempotencyStatusCompleted = "COMPLETED"
	IdempotencyStatusFailed    = "FAILED"
)

var (
	ErrIdempotencyConflict    = errors.New("concurrent request in progress with the same idempotency key")
	ErrIdempotencyPayloadDiff = errors.New("idempotency key reused with different request payload")
	ErrIdempotencyKeyRequired = errors.New("idempotency-key header is required for this operation")
)

type IdempotencyKey struct {
	ID             uuid.UUID        `json:"id" db:"id"`
	Key            string           `json:"key" db:"key"`
	UserID         uuid.UUID        `json:"user_id" db:"user_id"`
	RequestPath    string           `json:"request_path" db:"request_path"`
	RequestHash    string           `json:"request_hash" db:"request_hash"` // SHA-256 hash of payload
	ResponseStatus *int             `json:"response_status" db:"response_status"`
	ResponseBody   *json.RawMessage `json:"response_body" db:"response_body"`
	Status         string           `json:"status" db:"status"`
	LockedUntil    time.Time        `json:"locked_until" db:"locked_until"`
	CreatedAt      time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at" db:"updated_at"`
}

type IdempotencyRepository interface {
	// AcquireLock attempts to start/lock an idempotency key. Returns existing record if found.
	AcquireLock(ctx context.Context, key string, userID uuid.UUID, path string, payloadHash string, lockDuration time.Duration) (*IdempotencyKey, bool, error)
	// SaveResponse saves the completed response body and HTTP status code.
	SaveResponse(ctx context.Context, key string, userID uuid.UUID, statusCode int, responseBody []byte) error
	// MarkFailed marks the idempotency key as failed if the operation encountered an unrecoverable error.
	MarkFailed(ctx context.Context, key string, userID uuid.UUID) error
}

type IdempotencyMiddlewareService interface {
	CheckOrLock(ctx context.Context, key string, userID uuid.UUID, path string, payload []byte) (*IdempotencyKey, bool, error)
	Complete(ctx context.Context, key string, userID uuid.UUID, statusCode int, responseBody []byte) error
	Fail(ctx context.Context, key string, userID uuid.UUID) error
}
