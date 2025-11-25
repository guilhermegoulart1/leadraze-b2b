-- Migration 024: Update AI Agents to Unified System
-- Atualiza a tabela ai_agents existente para suportar múltiplos tipos

-- ==========================================
-- 1. ADD NEW COLUMNS
-- ==========================================

-- Add agent_type column (default 'linkedin' for existing agents)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) DEFAULT 'linkedin' NOT NULL;

-- Add response_length column
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS response_length VARCHAR(20) DEFAULT 'medium';

-- Add avatar_url column (migrating from avatar_base64)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add config JSONB for type-specific configuration
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Add sector_id for multi-tenancy (using UUID to match sectors table)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

-- Add statistics columns
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS total_interactions INTEGER DEFAULT 0;

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS successful_interactions INTEGER DEFAULT 0;

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS failed_interactions INTEGER DEFAULT 0;

-- Add scheduling columns
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 50;

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS execution_time TIME DEFAULT '09:00:00';

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMP;

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMP;

-- ==========================================
-- 2. MIGRATE EXISTING DATA TO CONFIG
-- ==========================================

-- Migrate LinkedIn agents data to config JSONB
UPDATE ai_agents SET config = jsonb_build_object(
  'products_services', COALESCE(products_services, ''),
  'company_description', COALESCE(company_description, ''),
  'value_proposition', COALESCE(value_proposition, ''),
  'key_differentiators', COALESCE(key_differentiators, ARRAY[]::TEXT[]),
  'behavioral_profile', COALESCE(behavioral_profile, ''),
  'escalation_rules', COALESCE(escalation_rules, '{}'::jsonb),
  'initial_approach', COALESCE(initial_approach, ''),
  'auto_schedule', COALESCE(auto_schedule, false),
  'scheduling_link', COALESCE(scheduling_link, ''),
  'linkedin_variables', COALESCE(linkedin_variables, '{}'::jsonb),
  'success_cases', COALESCE(success_cases, '{}'::jsonb),
  'product_details', COALESCE(product_details, '{}'::jsonb)
)
WHERE agent_type = 'linkedin' AND config = '{}';

-- ==========================================
-- 3. ADD CONSTRAINTS
-- ==========================================

-- Add check constraint for agent_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_agent_type'
  ) THEN
    ALTER TABLE ai_agents
    ADD CONSTRAINT valid_agent_type
    CHECK (agent_type IN ('linkedin', 'google_maps', 'email', 'whatsapp'));
  END IF;
END $$;

-- Add check constraint for response_length
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_response_length'
  ) THEN
    ALTER TABLE ai_agents
    ADD CONSTRAINT valid_response_length
    CHECK (response_length IN ('short', 'medium', 'long'));
  END IF;
END $$;

-- ==========================================
-- 4. CREATE NEW INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_ai_agents_agent_type_new ON ai_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_sector_id ON ai_agents(sector_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_next_execution ON ai_agents(next_execution_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_agents_config ON ai_agents USING GIN (config);

-- ==========================================
-- 5. UPDATE COMMENTS
-- ==========================================

COMMENT ON TABLE ai_agents IS 'Unified table for all AI agent types: LinkedIn, Google Maps, Email, WhatsApp';
COMMENT ON COLUMN ai_agents.agent_type IS 'Type of agent: linkedin, google_maps, email, whatsapp';
COMMENT ON COLUMN ai_agents.response_length IS 'Length of responses: short, medium, long';
COMMENT ON COLUMN ai_agents.config IS 'Type-specific configuration stored as JSONB. Structure varies by agent_type';

-- ==========================================
-- 6. FUTURE CLEANUP (Optional - commented out for safety)
-- ==========================================

-- After confirming migration works, you can drop old columns:
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS products_services;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS behavioral_profile;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS initial_approach;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS linkedin_variables;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS auto_schedule;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS scheduling_link;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS company_description;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS value_proposition;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS key_differentiators;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS success_cases;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS product_details;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS escalation_rules;
-- ALTER TABLE ai_agents DROP COLUMN IF EXISTS avatar_base64;
