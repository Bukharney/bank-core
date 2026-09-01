package repositories

import (
	"context"
	"time"

	"github.com/bukharney/bank-core/internal/api/models"
	"github.com/bukharney/bank-core/internal/config"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
)

type OutboxRepository struct {
	Db  *sqlx.DB
	Rdb *redis.Client
	Cfg *config.Config
}

func NewOutboxRepository(db *sqlx.DB, rdb *redis.Client, cfg *config.Config) models.OutboxRepository {
	return &OutboxRepository{
		Db:  db,
		Rdb: rdb,
		Cfg: cfg,
	}
}

func (r *OutboxRepository) InsertOutboxEvent(event *models.OutboxEvent) error {
	return r.InsertOutboxEventTx(nil, event)
}

func (r *OutboxRepository) InsertOutboxEventTx(tx *sqlx.Tx, event *models.OutboxEvent) error {
	query := `
		INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, max_retries, scheduled_at, created_at)
		VALUES (:id, :aggregate_type, :aggregate_id, :event_type, :payload, :status, :retry_count, :max_retries, :scheduled_at, :created_at)
	`
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	if event.Status == "" {
		event.Status = models.OutboxStatusPending
	}
	if event.MaxRetries <= 0 {
		event.MaxRetries = 5
	}
	now := time.Now().UTC()
	if event.ScheduledAt.IsZero() {
		event.ScheduledAt = now
	}
	event.CreatedAt = now

	var runner sqlx.Ext = r.Db
	if tx != nil {
		runner = tx
	}

	_, err := sqlx.NamedExec(runner, query, event)
	return err
}

// FetchPendingEvents locks a batch of events using FOR UPDATE SKIP LOCKED
func (r *OutboxRepository) FetchPendingEvents(ctx context.Context, batchSize int) ([]*models.OutboxEvent, error) {
	if batchSize <= 0 {
		batchSize = 20
	}
	var events []*models.OutboxEvent
	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, max_retries, last_error, scheduled_at, processed_at, created_at
		FROM outbox_events
		WHERE status IN ('PENDING', 'FAILED') AND scheduled_at <= NOW() AND retry_count < max_retries
		ORDER BY scheduled_at ASC
		LIMIT $1
		FOR UPDATE SKIP LOCKED
	`
	err := r.Db.SelectContext(ctx, &events, query, batchSize)
	if err != nil {
		return nil, err
	}
	return events, nil
}

func (r *OutboxRepository) MarkPublished(ctx context.Context, eventID uuid.UUID) error {
	query := `
		UPDATE outbox_events
		SET status = $1, processed_at = NOW()
		WHERE id = $2
	`
	_, err := r.Db.ExecContext(ctx, query, models.OutboxStatusPublished, eventID)
	return err
}

func (r *OutboxRepository) MarkFailed(ctx context.Context, eventID uuid.UUID, errMsg string) error {
	query := `
		UPDATE outbox_events
		SET retry_count = retry_count + 1,
		    last_error = $1,
		    status = CASE WHEN retry_count + 1 >= max_retries THEN 'FAILED' ELSE 'PENDING' END,
		    scheduled_at = NOW() + (INTERVAL '5 seconds' * POWER(2, retry_count))
		WHERE id = $2
	`
	_, err := r.Db.ExecContext(ctx, query, errMsg, eventID)
	return err
}
