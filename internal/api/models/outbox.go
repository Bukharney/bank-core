package models

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Outbox Statuses
const (
	OutboxStatusPending    = "PENDING"
	OutboxStatusProcessing = "PROCESSING"
	OutboxStatusPublished  = "PUBLISHED"
	OutboxStatusFailed     = "FAILED"
)

// Domain Event Names
const (
	EventMoneyTransferred     = "money.transferred"
	EventMoneyWithdrawn       = "money.withdrawn"
	EventATMDispenseFailed    = "atm.dispense_failed"
	EventAccountCreated       = "account.created"
	EventAccountStatusChanged = "account.status_changed"
)

type OutboxEvent struct {
	ID            uuid.UUID       `json:"id" db:"id"`
	AggregateType string          `json:"aggregate_type" db:"aggregate_type"`
	AggregateID   string          `json:"aggregate_id" db:"aggregate_id"`
	EventType     string          `json:"event_type" db:"event_type"`
	Payload       json.RawMessage `json:"payload" db:"payload"`
	Status        string          `json:"status" db:"status"`
	RetryCount    int             `json:"retry_count" db:"retry_count"`
	MaxRetries    int             `json:"max_retries" db:"max_retries"`
	LastError     *string         `json:"last_error" db:"last_error"`
	ScheduledAt   time.Time       `json:"scheduled_at" db:"scheduled_at"`
	ProcessedAt   *time.Time      `json:"processed_at" db:"processed_at"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
}

// Domain Event Payloads
type MoneyTransferredEventPayload struct {
	JournalID         uuid.UUID `json:"journal_id"`
	ReferenceID       string    `json:"reference_id"`
	SenderAccountID   int64     `json:"sender_account_id"`
	ReceiverAccountID int64     `json:"receiver_account_id"`
	Amount            int64     `json:"amount"` // in minor units
	Currency          string    `json:"currency"`
	TransferredAt     time.Time `json:"transferred_at"`
}

type AccountCreatedEventPayload struct {
	AccountID     int64     `json:"account_id"`
	AccountNumber string    `json:"account_number"`
	UserID        uuid.UUID `json:"user_id"`
	Currency      string    `json:"currency"`
	AccountType   string    `json:"account_type"`
	CreatedAt     time.Time `json:"created_at"`
}

type OutboxRepository interface {
	// InsertOutboxEvent inserts a new outbox event directly without ongoing transaction
	InsertOutboxEvent(event *OutboxEvent) error
	// InsertOutboxEventTx inserts a new outbox event within the ongoing DB transaction
	InsertOutboxEventTx(tx *sqlx.Tx, event *OutboxEvent) error
	// FetchPendingEvents locks and retrieves a batch of pending events for processing (SKIP LOCKED)
	FetchPendingEvents(ctx context.Context, batchSize int) ([]*OutboxEvent, error)
	// MarkPublished updates the status of an event to PUBLISHED
	MarkPublished(ctx context.Context, eventID uuid.UUID) error
	// MarkFailed records a failure and retries/fails the event
	MarkFailed(ctx context.Context, eventID uuid.UUID, errMsg string) error
}

type OutboxPublisher interface {
	Publish(ctx context.Context, event *OutboxEvent) error
}
