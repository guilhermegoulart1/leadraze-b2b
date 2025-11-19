-- Migration: Add is_system field to campaigns table
-- Date: 2025-01-19
-- Purpose: Identify system-created campaigns (like Organic Conversations) to hide from user campaign list

BEGIN;

-- Add is_system column to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Mark existing "Organic Conversations" campaign as system campaign
UPDATE campaigns
SET is_system = true
WHERE name = 'Organic Conversations';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_is_system ON campaigns(is_system);

-- Add comment to explain the column
COMMENT ON COLUMN campaigns.is_system IS 'Indicates if this is a system-created campaign (e.g., Organic Conversations) that should be hidden from user campaign list';

COMMIT;
