-- Migration: Update conversations table for minimal cache architecture
-- Date: 2025-01-18

BEGIN;

-- Add new columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Update status column to have specific values
ALTER TABLE conversations
  ALTER COLUMN status TYPE VARCHAR(20),
  ALTER COLUMN status SET DEFAULT 'ai_active';

-- Make unipile_chat_id UNIQUE and NOT NULL
ALTER TABLE conversations
  ALTER COLUMN unipile_chat_id SET NOT NULL;

-- Add unique constraint to unipile_chat_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_unipile_chat_id_unique'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_unipile_chat_id_unique UNIQUE (unipile_chat_id);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id ON conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversations_linkedin_account_id ON conversations(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_unipile_chat_id ON conversations(unipile_chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Update existing conversations to have default status FIRST
UPDATE conversations
SET status = 'ai_active'
WHERE status NOT IN ('ai_active', 'manual') OR status IS NULL;

-- Then add check constraint for status values
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS check_conversation_status;

ALTER TABLE conversations
  ADD CONSTRAINT check_conversation_status
  CHECK (status IN ('ai_active', 'manual'));

COMMIT;
