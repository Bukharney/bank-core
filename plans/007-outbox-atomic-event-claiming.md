# Plan 007: Outbox Atomic Event Claiming & Concurrency Safety

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b98f775..HEAD -- internal/api/repositories/outbox.go internal/worker/outbox.go internal/worker/outbox_test.go`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness / bug
- **Planned at**: commit `b98f775`, 2026-09-02

## Why this matters

The Transactional Outbox pattern guarantees at-least-once message delivery without dual-write risks. However, the current `FetchPendingEvents` query issues `SELECT ... FOR UPDATE SKIP LOCKED` on the general connection pool without an enclosing transaction. Consequently, PostgreSQL releases the row locks immediately upon query completion.

In horizontal scaling scenarios with multiple worker instances, multiple workers select the identical batch of pending events and publish duplicate messages to Redis/message bus. Transitioning claimed events to `status = 'PROCESSING'` atomically within a single SQL statement prevents race conditions and ensures each event is claimed exclusively by one worker.

## Current state

- `internal/api/repositories/outbox.go:61-80` — `FetchPendingEvents` runs a standalone SELECT:
  ```go
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
  	return events, err
  }
  ```
- `internal/db/migrations/init.sql:135` — `status` check constraint already supports `'PROCESSING'`:
  ```sql
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
  ```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Build     | `go build ./cmd/...`     | exit 0              |
| Unit Test | `go test -v ./internal/worker` | exit 0, all pass |
| Full Test | `go test ./...`          | exit 0              |

## Scope

**In scope**:
- `internal/api/repositories/outbox.go`
- `internal/worker/outbox.go`
- `internal/worker/outbox_test.go`

**Out of scope**:
- Modifications to Redis publisher implementation (`internal/worker/publisher.go`).
- Database schema changes (the `'PROCESSING'` status is already allowed by check constraints).

## Git workflow

- Branch: `advisor/007-outbox-atomic-claiming`
- Commit style: `fix(outbox): claim pending events atomically with status transition to PROCESSING`

---

## Steps

### Step 1: Update `FetchPendingEvents` to Atomically Claim Events

Open [internal/api/repositories/outbox.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/repositories/outbox.go). Replace `FetchPendingEvents` with an atomic UPDATE CTE that locks rows, marks them as `'PROCESSING'`, and returns the claimed records:

```go
// FetchPendingEvents atomically locks and claims a batch of events by updating their status to PROCESSING
func (r *OutboxRepository) FetchPendingEvents(ctx context.Context, batchSize int) ([]*models.OutboxEvent, error) {
	if batchSize <= 0 {
		batchSize = 20
	}
	var events []*models.OutboxEvent
	query := `
		WITH claimable AS (
			SELECT id
			FROM outbox_events
			WHERE (
				(status IN ('PENDING', 'FAILED') AND scheduled_at <= NOW() AND retry_count < max_retries)
				OR (status = 'PROCESSING' AND scheduled_at <= NOW() - INTERVAL '2 minutes')
			)
			ORDER BY scheduled_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE outbox_events e
		SET status = 'PROCESSING',
		    scheduled_at = NOW()
		FROM claimable c
		WHERE e.id = c.id
		RETURNING e.id, e.aggregate_type, e.aggregate_id, e.event_type, e.payload, e.status, e.retry_count, e.max_retries, e.last_error, e.scheduled_at, e.processed_at, e.created_at
	`
	err := r.Db.SelectContext(ctx, &events, query, batchSize)
	if err != nil {
		return nil, err
	}
	return events, nil
}
```

> Note: The stale lease condition `(status = 'PROCESSING' AND scheduled_at <= NOW() - INTERVAL '2 minutes')` guarantees that if a worker process crashes mid-flight, another worker will safely reclaim and process the event after 2 minutes.

**Verify**: `go build ./cmd/...` → exit 0.

---

### Step 2: Ensure `MarkFailed` Resets Status to `FAILED` or `PENDING`

In [internal/api/repositories/outbox.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/api/repositories/outbox.go), verify `MarkFailed` schedules exponential backoff:

```go
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
```

**Verify**: `go test ./internal/worker` → exit 0.

---

### Step 3: Add Outbox Claiming & Worker Concurrency Tests

Open [internal/worker/outbox_test.go](file:///c:/Users/JuneP/Documents/Dev/bank-core/internal/worker/outbox_test.go) and add tests verifying:
1. `ProcessBatch` successfully claims and dispatches pending events.
2. Failed publishes invoke `MarkFailed` with incremented retry count.
3. Empty queue returns 0 without errors.

**Verify**: `go test -v ./internal/worker` → exit 0, all pass.

---

## Test plan

- Execute unit tests in `internal/worker/outbox_test.go`:
  - `go test -v ./internal/worker -run TestOutboxWorker_ProcessBatch`
- Run full suite: `go test ./...` → all pass.

## Done criteria

- [ ] `go build ./cmd/...` exits 0.
- [ ] `go test ./...` exits 0.
- [ ] `FetchPendingEvents` updates status to `'PROCESSING'` atomically via CTE.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- If PostgreSQL version does not support CTE with `FOR UPDATE SKIP LOCKED`, stop and use a transaction-wrapped SELECT FOR UPDATE instead.
