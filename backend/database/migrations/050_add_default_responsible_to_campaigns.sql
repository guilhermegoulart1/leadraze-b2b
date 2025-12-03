-- Migration: 050_add_default_responsible_to_campaigns.sql
-- Description: Add default_responsible_user_id to campaigns for centralized lead assignment
-- When round-robin is disabled, leads will be assigned to this user

-- Add default_responsible_user_id column to campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS default_responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add comment explaining the field
COMMENT ON COLUMN campaigns.default_responsible_user_id IS
'Default user to assign leads when round-robin is disabled for the sector. If NULL and round-robin is off, leads remain unassigned.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_default_responsible
ON campaigns(default_responsible_user_id)
WHERE default_responsible_user_id IS NOT NULL;
