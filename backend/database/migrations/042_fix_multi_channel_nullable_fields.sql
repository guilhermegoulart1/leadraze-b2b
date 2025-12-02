-- Migration: 042_fix_multi_channel_nullable_fields.sql
-- Description: Make linkedin_username nullable for non-LinkedIn channels (WhatsApp, Instagram, etc.)
-- Date: 2024-12-02

-- =============================================
-- 1. MAKE LINKEDIN_USERNAME NULLABLE
-- =============================================
-- linkedin_username is required only for LinkedIn accounts
-- WhatsApp uses phone number, Instagram uses handle, etc.

ALTER TABLE linkedin_accounts
ALTER COLUMN linkedin_username DROP NOT NULL;

-- =============================================
-- 2. ADD COMMENT FOR CLARITY
-- =============================================

COMMENT ON COLUMN linkedin_accounts.linkedin_username IS 'LinkedIn username (required for LINKEDIN, optional for other channels)';

-- =============================================
-- 3. UPDATE EXISTING NON-LINKEDIN ACCOUNTS
-- =============================================
-- For non-LinkedIn accounts that might have empty strings, set to null

UPDATE linkedin_accounts
SET linkedin_username = NULL
WHERE provider_type IS NOT NULL
  AND provider_type != 'LINKEDIN'
  AND (linkedin_username = '' OR linkedin_username IS NULL);
