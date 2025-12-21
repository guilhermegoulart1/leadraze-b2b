-- Migration 094: Add conversation step tracking
-- Purpose: Persist current_step in conversations to fix stage progression bug
-- Issue: Agents were "getting lost" because current_step was never saved

-- Add current_step column to track which stage the conversation is in
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;

-- Add step_history to track progression through stages
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS step_history JSONB DEFAULT '[]';

-- Add step_advanced_at to know when last step change happened
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS step_advanced_at TIMESTAMP WITH TIME ZONE;

-- Create index for querying by step
CREATE INDEX IF NOT EXISTS idx_conversations_current_step ON conversations(current_step);

-- Add comments
COMMENT ON COLUMN conversations.current_step IS 'Current conversation stage (0-indexed). Persisted after each AI response.';
COMMENT ON COLUMN conversations.step_history IS 'Array of step transitions: [{step, advanced_at, trigger}]';
COMMENT ON COLUMN conversations.step_advanced_at IS 'Timestamp when the current step was reached';
