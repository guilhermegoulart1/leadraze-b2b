-- Migration 087: Add paused fields to campaigns
-- Purpose: Track why a campaign was paused (e.g., agent deleted)

-- Add paused_reason column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS paused_reason VARCHAR(50);

-- Add paused_at timestamp
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN campaigns.paused_reason IS 'Reason for pause: agent_deleted, manual, limit_reached, etc.';
COMMENT ON COLUMN campaigns.paused_at IS 'Timestamp when campaign was paused';

-- Create index for querying paused campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_paused_reason ON campaigns(paused_reason) WHERE paused_reason IS NOT NULL;
