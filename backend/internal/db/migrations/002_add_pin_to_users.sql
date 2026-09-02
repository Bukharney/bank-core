-- Add PIN hash and PIN failed attempts tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_failed_attempts INT NOT NULL DEFAULT 0;
