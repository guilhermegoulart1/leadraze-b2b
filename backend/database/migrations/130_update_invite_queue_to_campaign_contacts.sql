-- Migration: Update campaign_invite_queue to use campaign_contacts instead of opportunities
-- This migration adds campaign_contact_id column and makes opportunity_id optional

-- Add campaign_contact_id column
ALTER TABLE campaign_invite_queue
ADD COLUMN IF NOT EXISTS campaign_contact_id UUID REFERENCES campaign_contacts(id) ON DELETE CASCADE;

-- Make opportunity_id nullable (for backward compatibility during transition)
ALTER TABLE campaign_invite_queue
ALTER COLUMN opportunity_id DROP NOT NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_campaign_invite_queue_campaign_contact
ON campaign_invite_queue(campaign_contact_id);

-- Comment for documentation
COMMENT ON COLUMN campaign_invite_queue.campaign_contact_id IS 'Reference to campaign_contacts table - new approach where agent creates opportunities';
COMMENT ON COLUMN campaign_invite_queue.opportunity_id IS 'Legacy - kept for backward compatibility, will be NULL for new invites';
