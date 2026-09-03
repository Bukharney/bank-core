-- Add linked_phone to accounts table for phone-to-account linking (PromptPay / Phone ATM Deposit)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS linked_phone VARCHAR(20) UNIQUE NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_linked_phone ON accounts(linked_phone) WHERE linked_phone IS NOT NULL;
