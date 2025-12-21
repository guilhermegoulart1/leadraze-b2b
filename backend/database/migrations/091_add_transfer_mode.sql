-- Migration 091: Add transfer mode and conversation steps fields
-- Purpose: Allow users to configure how transfers are communicated and define conversation steps

-- Add transfer_mode column
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS transfer_mode VARCHAR(20) DEFAULT 'notify';

-- Add transfer_message column
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS transfer_message TEXT;

-- Add conversation_steps if not exists (some installations may not have it)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS conversation_steps JSONB;

-- Add objective_instructions if not exists
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS objective_instructions TEXT;

-- Add comments for documentation
COMMENT ON COLUMN ai_agents.transfer_mode IS 'How to transfer: silent (no message) or notify (send message first)';
COMMENT ON COLUMN ai_agents.transfer_message IS 'Custom message to send when transferring (if transfer_mode = notify)';
COMMENT ON COLUMN ai_agents.conversation_steps IS 'Sequential steps the AI should follow during conversation';
COMMENT ON COLUMN ai_agents.objective_instructions IS 'Custom instructions added to the AI prompt';
