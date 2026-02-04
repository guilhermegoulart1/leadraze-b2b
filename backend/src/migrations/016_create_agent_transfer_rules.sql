-- Migration: Create agent_transfer_rules table
-- Created: 2026-02-03
-- Description: Centralizes transfer rules for AI agents with per-rule destinations

-- ================================
-- 1. CREATE AGENT_TRANSFER_RULES TABLE
-- ================================
CREATE TABLE IF NOT EXISTS agent_transfer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Rule identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Trigger configuration
  trigger_type VARCHAR(50) NOT NULL,
  -- 'keyword' | 'preset' | 'exchange_limit' | 'ai_detected' | 'sentiment'
  trigger_config JSONB NOT NULL DEFAULT '{}',

  -- Destination configuration
  destination_type VARCHAR(50) NOT NULL DEFAULT 'default',
  -- 'default' | 'sector_round_robin' | 'sector_specific' | 'user'
  destination_config JSONB NOT NULL DEFAULT '{}',

  -- Transfer behavior
  transfer_mode VARCHAR(20) DEFAULT 'notify',
  transfer_message TEXT,
  notify_on_handoff BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- 2. INDEXES
-- ================================
CREATE INDEX IF NOT EXISTS idx_transfer_rules_agent ON agent_transfer_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_transfer_rules_active ON agent_transfer_rules(agent_id, is_active, priority);
CREATE INDEX IF NOT EXISTS idx_transfer_rules_account ON agent_transfer_rules(account_id);

-- ================================
-- 3. ADD DEFAULT TRANSFER CONFIG TO AI_AGENTS
-- ================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS default_transfer_config JSONB DEFAULT '{}';

-- ================================
-- 4. ADD HANDOFF RULE ID TO CONVERSATIONS
-- ================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handoff_rule_id UUID REFERENCES agent_transfer_rules(id) ON DELETE SET NULL;

-- ================================
-- 5. COMMENTS
-- ================================
COMMENT ON TABLE agent_transfer_rules IS 'Global transfer rules for AI agents - evaluated on every incoming message';
COMMENT ON COLUMN agent_transfer_rules.priority IS 'Evaluation order: lower values are checked first';
COMMENT ON COLUMN agent_transfer_rules.trigger_type IS 'Rule type: keyword, preset, exchange_limit, ai_detected, sentiment';
COMMENT ON COLUMN agent_transfer_rules.destination_type IS 'Where to transfer: default, sector_round_robin, sector_specific, user';
COMMENT ON COLUMN ai_agents.default_transfer_config IS 'Default transfer destination config: { sector_id, transfer_mode, transfer_message, notify_on_handoff }';

COMMIT;
