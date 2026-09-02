-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255) NULL,
    pin_failed_attempts INT NOT NULL DEFAULT 0,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- ============================================================================
-- 2. ACCOUNTS TABLE (Account Management)
-- ============================================================================
-- Balance is stored in minor units (e.g., Satang/Cents) using BIGINT to prevent floating-point errors
CREATE TABLE IF NOT EXISTS accounts (
    id BIGSERIAL PRIMARY KEY,
    account_number VARCHAR(32) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('SAVINGS', 'CHECKING', 'SYSTEM_SETTLEMENT', 'INTERNAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    balance BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_account_balance_positive CHECK (
        (account_type = 'SYSTEM_SETTLEMENT') OR (balance >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- ============================================================================
-- 3. JOURNAL ENTRIES TABLE (Ledger Header - Double-Entry Engine)
-- ============================================================================
-- Represents an atomic financial transaction consisting of balanced debits & credits
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(100) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (
        transaction_type IN ('TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'REVERSAL', 'ADJUSTMENT')
    ),
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
    posted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_id ON journal_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted_at ON journal_entries(posted_at DESC);

-- ============================================================================
-- 4. LEDGER ENTRIES / POSTINGS TABLE (Double-Entry Line Items - Append-Only)
-- ============================================================================
-- Rule: MUST BE STRICTLY APPEND-ONLY (No UPDATE or DELETE allowed)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    balance_after BIGINT NOT NULL,
    sequence INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id_created ON ledger_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal_id ON ledger_entries(journal_entry_id);

-- Enforce Immutability (Append-only) on ledger_entries via trigger
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are append-only and cannot be modified or deleted. Operation: %', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation ON ledger_entries;
CREATE TRIGGER trg_prevent_ledger_mutation
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_mutation();

-- ============================================================================
-- 5. IDEMPOTENCY KEYS TABLE (Idempotency Gateway/Middleware)
-- ============================================================================
-- Tracks API idempotency keys, request hashes, and cached responses for safe retries
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(128) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    request_path VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NULL,
    response_body JSONB NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED')),
    locked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_idempotency_user_key UNIQUE (key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(key, user_id, status);
CREATE INDEX IF NOT EXISTS idx_idempotency_locked_until ON idempotency_keys(locked_until);

-- ============================================================================
-- 6. TRANSACTIONAL OUTBOX TABLE (Outbox Pattern for Async Events)
-- ============================================================================
-- Ensures dual-write safety by persisting domain events in the same DB transaction
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    last_error TEXT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index optimized for worker polling with `FOR UPDATE SKIP LOCKED`
CREATE INDEX IF NOT EXISTS idx_outbox_events_poll ON outbox_events(status, scheduled_at) 
WHERE status IN ('PENDING', 'FAILED');

-- ============================================================================
-- 7. CARDLESS WITHDRAWALS TABLE (Mobile OTP ATM Reservations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cardless_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    phone_number VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'THB',
    atm_id INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'COMPLETED', 'EXPIRED', 'FAILED', 'CANCELLED')),
    failed_attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cardless_claim ON cardless_withdrawals(phone_number, code, status);
CREATE INDEX IF NOT EXISTS idx_cardless_expires ON cardless_withdrawals(expires_at);

-- ============================================================================
-- 8. SYSTEM SEED (ATM Vaults & Central Settlement)
-- ============================================================================
INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, status)
VALUES ('00000000-0000-0000-0000-000000000000', 'system_core', 'system@bank.internal', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'System', 'Core', 'admin', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, account_number, user_id, currency, account_type, status, balance)
VALUES 
    (100, 'SYS-CASH-SETTLE', '00000000-0000-0000-0000-000000000000', 'THB', 'SYSTEM_SETTLEMENT', 'ACTIVE', 10000000000),
    (101, 'ATM-VAULT-001',   '00000000-0000-0000-0000-000000000000', 'THB', 'SYSTEM_SETTLEMENT', 'ACTIVE', 500000000),
    (102, 'ATM-VAULT-002',   '00000000-0000-0000-0000-000000000000', 'THB', 'SYSTEM_SETTLEMENT', 'ACTIVE', 500000000),
    (103, 'ATM-VAULT-003',   '00000000-0000-0000-0000-000000000000', 'THB', 'SYSTEM_SETTLEMENT', 'ACTIVE', 500000000)
ON CONFLICT (id) DO NOTHING;