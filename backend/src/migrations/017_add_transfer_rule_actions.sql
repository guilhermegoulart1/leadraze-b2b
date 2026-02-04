-- Migration: Add actions to agent_transfer_rules
-- Created: 2026-02-04
-- Description: Adds JSONB actions column for automations executed during transfer

ALTER TABLE agent_transfer_rules
  ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]';

COMMENT ON COLUMN agent_transfer_rules.actions IS 'Array of automation actions to execute on transfer: [{type, config}]';

COMMIT;
