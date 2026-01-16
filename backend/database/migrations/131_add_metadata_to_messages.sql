-- Migration: Add metadata column to messages table
-- This column stores channel-specific metadata for messages

ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add comment for documentation
COMMENT ON COLUMN messages.metadata IS 'Channel-specific metadata (attachments, reactions, etc)';
