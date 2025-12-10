-- Migration 066: Add priority_rules column to ai_agents
-- Stores agent behavioral rules as JSONB array
-- Format: [{"prefix": "NUNCA", "instruction": "falar sobre concorrentes"}, ...]

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS priority_rules JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN ai_agents.priority_rules IS 'Array of behavioral rules with prefix (NUNCA, EVITE, SEMPRE, etc.) and instruction text';

-- Create index for faster queries on rules
CREATE INDEX IF NOT EXISTS idx_ai_agents_priority_rules ON ai_agents USING GIN (priority_rules);
