-- Migration 068: Add target_audience and other missing columns to ai_agents
-- Ensures all columns used by the hire wizard exist

-- Target audience (roles, company sizes)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS target_audience TEXT;

-- Products/services description
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS products_services TEXT;

-- Behavioral profile (consultivo, direto, educativo, amigavel)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS behavioral_profile VARCHAR(50);

-- Initial approach message
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS initial_approach TEXT;

-- LinkedIn variables configuration
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS linkedin_variables JSONB DEFAULT '{}';

-- Auto schedule settings
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS auto_schedule BOOLEAN DEFAULT false;
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS scheduling_link TEXT;

-- Intent detection
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS intent_detection_enabled BOOLEAN DEFAULT true;

-- Response style instructions
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS response_style_instructions TEXT;

-- Account ID for multi-tenancy (if not exists)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;

-- Create index for account_id if not exists
CREATE INDEX IF NOT EXISTS idx_ai_agents_account_id ON ai_agents(account_id);

-- Add comments for documentation
COMMENT ON COLUMN ai_agents.target_audience IS 'Target audience description or JSON with roles and company sizes';
COMMENT ON COLUMN ai_agents.products_services IS 'Products or services the agent sells';
COMMENT ON COLUMN ai_agents.behavioral_profile IS 'Agent personality: consultivo, direto, educativo, amigavel';
