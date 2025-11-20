-- Migration: Add closed status to conversations
-- Date: 2025-01-19

BEGIN;

-- Add closed_at column to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- Drop existing status check constraint
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS check_conversation_status;

-- Add new constraint that includes 'closed' status
ALTER TABLE conversations
  ADD CONSTRAINT check_conversation_status
  CHECK (status IN ('ai_active', 'manual', 'closed'));

-- Create index for closed_at for better query performance on closed conversations
CREATE INDEX IF NOT EXISTS idx_conversations_closed_at ON conversations(closed_at);

COMMIT;
