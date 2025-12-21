-- Migration 089: Add transfer_triggers to ai_agents
-- Purpose: Replace max_messages with intelligent transfer triggers

-- Add transfer_triggers array column
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS transfer_triggers TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN ai_agents.transfer_triggers IS 'Array of transfer trigger IDs: doubt, qualified, price, demo, competitor, urgency, frustration';

-- Create GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_ai_agents_transfer_triggers ON ai_agents USING GIN(transfer_triggers);

-- Note: We keep handoff_after_exchanges for backwards compatibility but it will be deprecated
