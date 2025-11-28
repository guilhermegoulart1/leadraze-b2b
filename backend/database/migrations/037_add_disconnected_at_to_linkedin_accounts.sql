-- Migration 037: Add disconnected_at field to linkedin_accounts
-- This migration adds the disconnected_at timestamp for account disconnect feature

-- Add disconnected_at column
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMP;

-- Create index for querying disconnected accounts
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_disconnected_at ON linkedin_accounts(disconnected_at);

-- Add comment
COMMENT ON COLUMN linkedin_accounts.disconnected_at IS 'Timestamp when the account was disconnected from Unipile (null if active)';
