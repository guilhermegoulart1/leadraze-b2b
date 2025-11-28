-- Migration 036: Add Connection Activation Fields
-- This migration adds fields for connection activation feature:
-- 1. Daily limit for connection activations in users table
-- 2. Campaign type field in activation_campaigns table to distinguish connection campaigns

-- =====================================================
-- 1. ADD CONNECTION ACTIVATION FIELDS TO USERS TABLE
-- =====================================================

-- Daily limit for connection activations (default 100)
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_connection_activation_limit INTEGER DEFAULT 100;

-- Counter for today's activations
ALTER TABLE users ADD COLUMN IF NOT EXISTS today_connection_activations INTEGER DEFAULT 0;

-- Last activation date (to reset counter daily)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_connection_activation_date TIMESTAMP;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_connection_activation_date ON users(last_connection_activation_date);

-- =====================================================
-- 2. ADD CAMPAIGN TYPE TO ACTIVATION_CAMPAIGNS TABLE
-- =====================================================

-- Add campaign_type column to distinguish between regular list campaigns and connection campaigns
ALTER TABLE activation_campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50) DEFAULT 'list';

-- Add check constraint for valid campaign types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activation_campaigns_campaign_type_check'
  ) THEN
    ALTER TABLE activation_campaigns ADD CONSTRAINT activation_campaigns_campaign_type_check
      CHECK (campaign_type IN ('list', 'connections'));
  END IF;
END $$;

-- Create index for campaign type queries
CREATE INDEX IF NOT EXISTS idx_activation_campaigns_type_v2 ON activation_campaigns(campaign_type);

-- =====================================================
-- 3. ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON COLUMN users.daily_connection_activation_limit IS 'Maximum number of connection activations per day (default 100, max 500)';
COMMENT ON COLUMN users.today_connection_activations IS 'Number of connection activations sent today (resets daily)';
COMMENT ON COLUMN users.last_connection_activation_date IS 'Date of last connection activation (used to reset daily counter)';
COMMENT ON COLUMN activation_campaigns.campaign_type IS 'Type of campaign: list (from contact list) or connections (from LinkedIn connections)';
