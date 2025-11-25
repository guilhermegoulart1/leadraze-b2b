-- Migration 024: Unified AI Agents System
-- Cria uma tabela unificada para todos os tipos de agentes de IA
-- Tipos: linkedin, google_maps, email, whatsapp

-- ==========================================
-- 1. CREATE UNIFIED AGENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS ai_agents (
  id SERIAL PRIMARY KEY,

  -- Multi-tenancy
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,

  -- Agent Type: linkedin, google_maps, email, whatsapp
  agent_type VARCHAR(50) NOT NULL,

  -- Common Configuration
  response_length VARCHAR(20) DEFAULT 'medium', -- short, medium, long

  -- Type-specific configuration (JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Statistics
  total_interactions INTEGER DEFAULT 0,
  successful_interactions INTEGER DEFAULT 0,
  failed_interactions INTEGER DEFAULT 0,

  -- Scheduling (for automated agents like Google Maps)
  daily_limit INTEGER DEFAULT 50,
  execution_time TIME DEFAULT '09:00:00',
  last_execution_at TIMESTAMP,
  next_execution_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_agent_type CHECK (agent_type IN ('linkedin', 'google_maps', 'email', 'whatsapp')),
  CONSTRAINT valid_response_length CHECK (response_length IN ('short', 'medium', 'long'))
);

-- ==========================================
-- 2. CREATE INDEXES
-- ==========================================

CREATE INDEX idx_ai_agents_account_id ON ai_agents(account_id);
CREATE INDEX idx_ai_agents_user_id ON ai_agents(user_id);
CREATE INDEX idx_ai_agents_sector_id ON ai_agents(sector_id);
CREATE INDEX idx_ai_agents_agent_type ON ai_agents(agent_type);
CREATE INDEX idx_ai_agents_is_active ON ai_agents(is_active);
CREATE INDEX idx_ai_agents_next_execution ON ai_agents(next_execution_at) WHERE is_active = true;

-- GIN index for JSONB config field
CREATE INDEX idx_ai_agents_config ON ai_agents USING GIN (config);

-- ==========================================
-- 3. CREATE TRIGGER FOR UPDATED_AT
-- ==========================================

CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 4. COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE ai_agents IS 'Unified table for all AI agent types: LinkedIn, Google Maps, Email, WhatsApp';
COMMENT ON COLUMN ai_agents.agent_type IS 'Type of agent: linkedin, google_maps, email, whatsapp';
COMMENT ON COLUMN ai_agents.response_length IS 'Length of responses: short, medium, long';
COMMENT ON COLUMN ai_agents.config IS 'Type-specific configuration stored as JSONB. Structure varies by agent_type';

-- ==========================================
-- 5. CONFIG FIELD STRUCTURE BY TYPE
-- ==========================================

-- LinkedIn Agent Config:
-- {
--   "products_services": "string",
--   "company_description": "string",
--   "value_proposition": "string",
--   "key_differentiators": ["string"],
--   "behavioral_profile": "consultivo|direto|educativo|amigavel",
--   "escalation_rules": {
--     "escalate_on_price_question": boolean,
--     "escalate_on_specific_feature": boolean,
--     "escalate_keywords": ["string"],
--     "max_messages_before_escalation": number
--   },
--   "initial_approach": "string",
--   "auto_schedule": boolean,
--   "scheduling_link": "string"
-- }

-- Google Maps Agent Config:
-- {
--   "location": {
--     "lat": number,
--     "lng": number,
--     "radius": number,
--     "address": "string",
--     "city": "string",
--     "country": "string"
--   },
--   "business_category": "string",
--   "business_specification": "string",
--   "search_query": "string",
--   "filters": {
--     "min_rating": number,
--     "min_reviews": number,
--     "require_phone": boolean,
--     "require_email": boolean
--   },
--   "action_type": "crm_only|crm_email|crm_email_whatsapp",
--   "pagination": {
--     "current_page": number,
--     "last_page_fetched": number
--   },
--   "stats": {
--     "total_leads_found": number,
--     "leads_inserted": number,
--     "leads_skipped": number
--   }
-- }

-- Email Agent Config:
-- {
--   "personality": "string",
--   "tone": "formal|casual|professional|friendly",
--   "language": "string",
--   "initial_message": "string",
--   "follow_up_message": "string",
--   "custom_instructions": "string",
--   "variables": ["string"]
-- }

-- WhatsApp Agent Config:
-- {
--   "personality": "string",
--   "tone": "formal|casual|professional|friendly",
--   "language": "string",
--   "initial_message": "string",
--   "follow_up_message": "string",
--   "custom_instructions": "string",
--   "variables": ["string"]
-- }

-- ==========================================
-- 6. GRANT PERMISSIONS
-- ==========================================

-- Note: Adjust permissions based on your database users
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ai_agents TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE ai_agents_id_seq TO your_app_user;
