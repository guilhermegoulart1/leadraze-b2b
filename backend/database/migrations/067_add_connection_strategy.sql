-- Migration 067: Add Connection Strategy to AI Agents
-- Suporta 3 estratégias de conexão LinkedIn:
-- 1. silent - Convite sem mensagem, IA inicia após 5min
-- 2. with-intro - Convite com mensagem, IA inicia após 1h
-- 3. icebreaker - Convite com mensagem simples, só continua se lead responder

-- Add connection_strategy column
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS connection_strategy VARCHAR(20) DEFAULT 'with-intro';

-- Add wait_time_after_accept (in minutes)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS wait_time_after_accept INTEGER DEFAULT 5;

-- Add require_lead_reply (for icebreaker strategy)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS require_lead_reply BOOLEAN DEFAULT false;

-- Add invite_message (separate from initial_approach for flexibility)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS invite_message TEXT;

-- Add constraint for valid connection strategies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_connection_strategy'
  ) THEN
    ALTER TABLE ai_agents
    ADD CONSTRAINT valid_connection_strategy
    CHECK (connection_strategy IN ('silent', 'with-intro', 'icebreaker'));
  END IF;
END $$;

-- Also add to campaigns table for campaign-level override
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS connection_strategy VARCHAR(20);

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS wait_time_after_accept INTEGER;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS require_lead_reply BOOLEAN;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS invite_message TEXT;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ai_agents_connection_strategy ON ai_agents(connection_strategy);

-- Add comments
COMMENT ON COLUMN ai_agents.connection_strategy IS 'Connection strategy: silent (no message), with-intro (with message, wait 1h), icebreaker (only if lead replies)';
COMMENT ON COLUMN ai_agents.wait_time_after_accept IS 'Minutes to wait after connection accepted before AI starts conversation';
COMMENT ON COLUMN ai_agents.require_lead_reply IS 'If true, AI only responds after lead sends first message';
COMMENT ON COLUMN ai_agents.invite_message IS 'Custom message to send with LinkedIn connection invite';

-- Update existing agents with sensible defaults based on existing data
UPDATE ai_agents
SET
  connection_strategy = CASE
    WHEN initial_approach IS NULL OR initial_approach = '' THEN 'silent'
    ELSE 'with-intro'
  END,
  wait_time_after_accept = CASE
    WHEN initial_approach IS NULL OR initial_approach = '' THEN 5
    ELSE 60
  END,
  require_lead_reply = false
WHERE connection_strategy IS NULL OR connection_strategy = 'with-intro';
