-- Migration 005: Correct Ledger Double-Entry Invariant (Idempotent)
-- Description:
--   Before commit ecbfb6f (2026-09-02), the Deposit handler wrote only a CREDIT leg
--   to the customer account without the corresponding DEBIT leg to the Central Cash
--   Settlement account (id=100). Similarly, one ATM Withdrawal wrote only a DEBIT
--   without the matching CREDIT to the vault account.
--
--   This migration inserts the 14 missing compensating ledger entries.
--   It is fully idempotent: it checks for the missing leg before inserting,
--   so re-running on restart will be a no-op.
--
--   After this migration: SUM(DEBIT) == SUM(CREDIT) across all ledger_entries,
--   restoring the double-entry conservation invariant.

-- ============================================================
-- PART 1: Insert missing DEBIT legs for the 13 single-legged DEPOSIT journals.
-- Guard: only insert when no DEBIT already exists for that journal (idempotent).
-- Each deposit credited the customer but never debited Settlement Account (id=100).
-- ============================================================
INSERT INTO ledger_entries (journal_entry_id, account_id, entry_type, amount, balance_after, sequence, created_at)
SELECT
    le.journal_entry_id,
    100         AS account_id,        -- Central Cash Settlement account
    'DEBIT'     AS entry_type,
    le.amount,
    0           AS balance_after,     -- append-only; settlement snapshot balance N/A for correction
    0           AS sequence,          -- sequence 0 marks a correction entry
    le.created_at
FROM ledger_entries le
JOIN journal_entries je ON je.id = le.journal_entry_id
WHERE le.journal_entry_id IN (
    '6b930e5a-f885-4613-bb19-81518acd947d',
    'c94410df-5af6-4dbb-9c97-1da60c7e264b',
    '0ec7458d-9f4b-46dd-9e95-a4f22f3a7177',
    'bdef5c92-ade6-447e-9c46-8e6dc3b0df04',
    '7dbfceb6-f833-46d1-b1f1-440f9a3e1dcd',
    '214052fe-fcce-4b56-8544-6c1d5adc15c6',
    '490283f0-6110-47cf-949a-a6123f7ee92c',
    '70ede0ab-3612-42ae-91f5-68193f451f89',
    '6ba3c26e-a42d-4593-9987-27a8d2cdf3b4',
    'ae9c731d-8269-4e67-a264-4dac280e785b',
    'b0b7e02d-2554-4b0b-ada3-06da4369d454',
    '82ba40ee-2e3b-4723-b9f4-ec4d43a407e2',
    '93f9ea96-cff9-4f17-966f-04de48159e8d'
)
AND le.entry_type = 'CREDIT'
AND je.transaction_type = 'DEPOSIT'
-- Idempotency guard: skip if a DEBIT already exists for this journal
AND NOT EXISTS (
    SELECT 1 FROM ledger_entries x
    WHERE x.journal_entry_id = le.journal_entry_id
      AND x.entry_type = 'DEBIT'
);

-- ============================================================
-- PART 2: Insert missing CREDIT leg for the single-legged WITHDRAWAL journal.
-- Guard: only insert when no CREDIT already exists for that journal (idempotent).
-- ============================================================
INSERT INTO ledger_entries (journal_entry_id, account_id, entry_type, amount, balance_after, sequence, created_at)
SELECT
    le.journal_entry_id,
    100         AS account_id,        -- Central Cash Settlement (pre-fix withdrawal fallback)
    'CREDIT'    AS entry_type,
    le.amount,
    0           AS balance_after,
    2           AS sequence,
    le.created_at
FROM ledger_entries le
WHERE le.journal_entry_id = 'fc4177ac-5ac8-4643-bb40-5a13ef9c3758'
AND   le.entry_type = 'DEBIT'
-- Idempotency guard
AND NOT EXISTS (
    SELECT 1 FROM ledger_entries x
    WHERE x.journal_entry_id = le.journal_entry_id
      AND x.entry_type = 'CREDIT'
);
