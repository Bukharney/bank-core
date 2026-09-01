---
name: banking-core-patterns
description: Architectural standards and patterns for core banking, double-entry ledger, concurrency controls, idempotency, and transactional outbox.
---

# Banking Core Engineering Patterns

This skill documents production-grade architectural patterns and engineering standards for financial systems, double-entry ledgers, high-concurrency transfers, and distributed event delivery.

---

## 1. Monetary Representation & Arithmetic Safety
- **Strict Prohibition**: Never use floating-point types (`float32`, `float64`, `REAL`, `FLOAT`, `DOUBLE`) for financial balances, fees, or transaction amounts due to IEEE 754 precision issues.
- **Standard**: Always store and calculate monetary amounts as **minor integer units** (`int64` / `BIGINT`), e.g., Satang (THB) or Cents (USD).
- **Database Schema**: Enforce non-negative balance constraints via check constraints:
  ```sql
  balance BIGINT NOT NULL DEFAULT 0 CHECK ((account_type = 'SYSTEM_SETTLEMENT') OR (balance >= 0))
  ```

---

## 2. Double-Entry Accounting & Append-Only Ledger
- **Core Principle**: Every financial operation must create a `JournalEntry` (header) with balanced `LedgerEntry` postings.
- **Mathematical Balance**: Enforce $\sum \text{Debit} = \sum \text{Credit}$ before committing any transaction.
- **Deposit Account Conventions**:
  - `DEBIT`: Decrease customer liability / withdraw funds / fee.
  - `CREDIT`: Increase customer liability / deposit funds / incoming transfer.
- **Immutability (Append-Only)**: Ledger postings must NEVER be updated or deleted. Enforce this using database triggers:
  ```sql
  CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
      RAISE EXCEPTION 'Ledger entries are append-only and cannot be modified or deleted. Operation: %', TG_OP;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_prevent_ledger_mutation
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
  ```

---

## 3. High-Concurrency Money Transfer & Deadlock Prevention
- **The Problem**: Concurrent bidirectional transfers ($A \rightarrow B$ and $B \rightarrow A$) can cause PostgreSQL deadlocks (`40P01`) if locks are acquired in arbitrary request order.
- **Solution - Deterministic Lock Ordering**: Always sort account IDs and lock the smaller ID first:
  ```go
  firstLockID := req.SenderAccountID
  secondLockID := req.ReceiverAccountID
  if firstLockID > secondLockID {
      firstLockID, secondLockID = secondLockID, firstLockID
  }

  // Always acquire locks in ascending order: min(ID) -> max(ID)
  firstAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, firstLockID)
  secondAcc, err := u.AccountRepo.GetAccountByIDForUpdate(tx, secondLockID)
  ```
- **Atomicity**: Balances, Journal headers, Ledger postings, and Outbox events MUST be executed within the same atomic `sqlx.Tx`.

---

## 4. Concurrency-Safe Idempotency Gateway
- **Workflow**:
  1. Extract `Idempotency-Key` and compute SHA-256 hash of the request payload.
  2. Attempt atomic lock acquisition (`status = STARTED`, lease `locked_until`).
  3. **Replay Cache**: If key is already `COMPLETED`, immediately return the cached status and payload with `X-Idempotent-Replayed: true`.
  4. **In-Flight Conflict**: If key is currently being processed, return `409 Conflict`.
  5. **Payload Mismatch**: If the same key is reused with a different payload hash, return `422 Unprocessable Entity`.
  6. **Completion**: If downstream returns 2xx/4xx, mark `COMPLETED` and save response body. If 5xx/panic, mark `FAILED` to enable retry.

---

## 5. Transactional Outbox Pattern (Zero Lost Events)
- **Dual-Write Prevention**: Persist domain events (`outbox_events`) in the exact same database transaction as financial state changes.
- **Concurrent Polling**: Background workers must poll pending events using `SELECT ... FOR UPDATE SKIP LOCKED` so multiple worker instances can scale horizontally without lock contention:
  ```sql
  SELECT id, aggregate_type, aggregate_id, event_type, payload, status, retry_count
  FROM outbox_events
  WHERE status IN ('PENDING', 'FAILED') AND scheduled_at <= NOW() AND retry_count < max_retries
  ORDER BY scheduled_at ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED;
  ```
- **Resilience**: Implement exponential backoff ($T_{\text{next}} = \text{NOW}() + (5\text{s} \times 2^{\text{retry}})$) on broker failures, marking as `FAILED` (Dead-letter) only when `retry_count >= max_retries`.
