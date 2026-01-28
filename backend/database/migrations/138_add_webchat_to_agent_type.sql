-- Migration 138: Add webchat to agent_type constraint
-- Adiciona 'webchat' como tipo válido de agente

-- Drop existing constraint and recreate with webchat
ALTER TABLE ai_agents DROP CONSTRAINT IF EXISTS valid_agent_type;

ALTER TABLE ai_agents
ADD CONSTRAINT valid_agent_type
CHECK (agent_type IN ('linkedin', 'google_maps', 'email', 'whatsapp', 'webchat'));

-- Update comment
COMMENT ON COLUMN ai_agents.agent_type IS 'Type of agent/channel: linkedin, google_maps, email, whatsapp, webchat';
