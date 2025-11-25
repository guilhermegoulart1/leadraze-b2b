-- Migration 024: Multi-Channel Activation Campaigns
-- This migration modifies activation_campaigns to support multiple agents (one per channel)
-- allowing simultaneous activation via Email, WhatsApp, and LinkedIn

-- =====================================================
-- 1. ADD NEW COLUMNS FOR MULTI-CHANNEL SUPPORT
-- =====================================================

-- Add separate agent columns for each channel
ALTER TABLE activation_campaigns
  ADD COLUMN IF NOT EXISTS email_agent_id UUID REFERENCES activation_agents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS whatsapp_agent_id UUID REFERENCES activation_agents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS linkedin_agent_id UUID REFERENCES activation_agents(id) ON DELETE RESTRICT;

-- Add activation flags for each channel
ALTER TABLE activation_campaigns
  ADD COLUMN IF NOT EXISTS activate_email BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS activate_whatsapp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS activate_linkedin BOOLEAN DEFAULT false;

-- =====================================================
-- 2. MIGRATE EXISTING DATA
-- =====================================================

-- Migrate existing campaigns to use the new structure
-- Map the old agent_id to the appropriate new agent_id based on activation_type
UPDATE activation_campaigns
SET
  email_agent_id = CASE WHEN activation_type = 'email' THEN agent_id ELSE NULL END,
  whatsapp_agent_id = CASE WHEN activation_type = 'whatsapp' THEN agent_id ELSE NULL END,
  linkedin_agent_id = CASE WHEN activation_type = 'linkedin' THEN agent_id ELSE NULL END,
  activate_email = CASE WHEN activation_type = 'email' THEN true ELSE false END,
  activate_whatsapp = CASE WHEN activation_type = 'whatsapp' THEN true ELSE false END,
  activate_linkedin = CASE WHEN activation_type = 'linkedin' THEN true ELSE false END
WHERE agent_id IS NOT NULL;

-- =====================================================
-- 3. DROP OLD COLUMNS (after data migration)
-- =====================================================

-- Drop the old single-agent columns
ALTER TABLE activation_campaigns
  DROP COLUMN IF EXISTS agent_id,
  DROP COLUMN IF EXISTS activation_type;

-- =====================================================
-- 4. ADD INDEXES FOR NEW COLUMNS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_activation_campaigns_email_agent ON activation_campaigns(email_agent_id);
CREATE INDEX IF NOT EXISTS idx_activation_campaigns_whatsapp_agent ON activation_campaigns(whatsapp_agent_id);
CREATE INDEX IF NOT EXISTS idx_activation_campaigns_linkedin_agent ON activation_campaigns(linkedin_agent_id);

-- =====================================================
-- 5. ADD CHECK CONSTRAINT
-- =====================================================

-- Ensure at least one channel is activated
ALTER TABLE activation_campaigns
  ADD CONSTRAINT chk_at_least_one_channel CHECK (
    activate_email = true OR activate_whatsapp = true OR activate_linkedin = true
  );

-- =====================================================
-- 6. UPDATE ACTIVATION_CAMPAIGN_CONTACTS TABLE
-- =====================================================

-- Add a column to track which channel was used for each contact
ALTER TABLE activation_campaign_contacts
  ADD COLUMN IF NOT EXISTS activation_channel VARCHAR(50) CHECK (activation_channel IN ('email', 'whatsapp', 'linkedin'));

CREATE INDEX IF NOT EXISTS idx_activation_campaign_contacts_channel ON activation_campaign_contacts(activation_channel);

-- =====================================================
-- NOTES:
-- =====================================================
-- After running this migration:
-- 1. Campaigns can now have multiple agents (one per channel)
-- 2. Each campaign must have at least one channel activated
-- 3. Existing campaigns will be preserved with their data migrated
-- 4. The activation_campaign_contacts table now tracks which channel was used
