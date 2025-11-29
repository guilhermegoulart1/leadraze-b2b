-- Migration: 038_multi_channel_support.sql
-- Description: Add multi-channel support (WhatsApp, Instagram, etc.)
-- Date: 2024-11-28

-- =============================================
-- 1. ADD PROVIDER_TYPE TO LINKEDIN_ACCOUNTS
-- =============================================
-- We keep the table name as linkedin_accounts for backward compatibility
-- but add provider_type to support multiple channels

ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'LINKEDIN';

-- Update existing records to have LINKEDIN as provider
UPDATE linkedin_accounts
SET provider_type = 'LINKEDIN'
WHERE provider_type IS NULL;

-- Add channel-specific settings (JSON)
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS channel_settings JSONB DEFAULT '{
  "ignore_groups": true,
  "auto_read": false,
  "ai_enabled": true,
  "notify_on_message": true,
  "business_hours_only": false
}'::jsonb;

-- Add channel display name (for non-LinkedIn channels)
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS channel_name VARCHAR(255);

-- Add channel identifier (phone number for WhatsApp, username for others)
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS channel_identifier VARCHAR(255);

-- =============================================
-- 2. ADD IS_GROUP TO CONVERSATIONS
-- =============================================

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 2;

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);

-- =============================================
-- 3. ADD PROVIDER_TYPE TO CONVERSATIONS
-- =============================================

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'LINKEDIN';

-- =============================================
-- 4. CREATE INDEX FOR FASTER QUERIES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_provider_type
ON linkedin_accounts(provider_type);

CREATE INDEX IF NOT EXISTS idx_conversations_is_group
ON conversations(is_group);

CREATE INDEX IF NOT EXISTS idx_conversations_provider_type
ON conversations(provider_type);

-- =============================================
-- 5. CREATE VIEW FOR BACKWARD COMPATIBILITY
-- =============================================
-- This view allows old code to still work while we migrate

CREATE OR REPLACE VIEW v_linkedin_accounts AS
SELECT * FROM linkedin_accounts WHERE provider_type = 'LINKEDIN';

CREATE OR REPLACE VIEW v_whatsapp_accounts AS
SELECT * FROM linkedin_accounts WHERE provider_type = 'WHATSAPP';

CREATE OR REPLACE VIEW v_instagram_accounts AS
SELECT * FROM linkedin_accounts WHERE provider_type = 'INSTAGRAM';

-- =============================================
-- 6. ADD PROVIDER_TYPE TO MESSAGES (for tracking)
-- =============================================

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50);

-- =============================================
-- 7. CREATE CHANNEL_SETTINGS TABLE (optional, for more complex settings)
-- =============================================

CREATE TABLE IF NOT EXISTS channel_type_defaults (
  id SERIAL PRIMARY KEY,
  provider_type VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  icon_name VARCHAR(50) NOT NULL,
  default_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  supports_groups BOOLEAN DEFAULT true,
  supports_voice BOOLEAN DEFAULT false,
  supports_video BOOLEAN DEFAULT false,
  supports_files BOOLEAN DEFAULT true,
  supports_reactions BOOLEAN DEFAULT true,
  supports_read_receipts BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default channel types
INSERT INTO channel_type_defaults (provider_type, display_name, icon_name, default_settings, supports_groups, supports_voice, supports_video)
VALUES
  ('LINKEDIN', 'LinkedIn', 'Linkedin', '{"ignore_groups": true, "ai_enabled": true}', false, false, false),
  ('WHATSAPP', 'WhatsApp', 'MessageCircle', '{"ignore_groups": true, "ai_enabled": true}', true, true, true),
  ('INSTAGRAM', 'Instagram', 'Instagram', '{"ignore_groups": true, "ai_enabled": true}', true, false, false),
  ('MESSENGER', 'Messenger', 'Facebook', '{"ignore_groups": true, "ai_enabled": true}', true, true, true),
  ('TELEGRAM', 'Telegram', 'Send', '{"ignore_groups": true, "ai_enabled": true}', true, true, true),
  ('TWITTER', 'X (Twitter)', 'Twitter', '{"ignore_groups": false, "ai_enabled": true}', false, false, false),
  ('GOOGLE', 'Google Chat', 'Mail', '{"ignore_groups": true, "ai_enabled": true}', true, true, true),
  ('OUTLOOK', 'Outlook', 'Mail', '{"ignore_groups": false, "ai_enabled": true}', false, false, false),
  ('MAIL', 'Email', 'Mail', '{"ignore_groups": false, "ai_enabled": true}', false, false, false)
ON CONFLICT (provider_type) DO NOTHING;

-- =============================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN linkedin_accounts.provider_type IS 'Channel provider: LINKEDIN, WHATSAPP, INSTAGRAM, MESSENGER, TELEGRAM, TWITTER, GOOGLE, OUTLOOK, MAIL';
COMMENT ON COLUMN linkedin_accounts.channel_settings IS 'JSON settings: ignore_groups, auto_read, ai_enabled, notify_on_message, business_hours_only';
COMMENT ON COLUMN linkedin_accounts.channel_name IS 'Display name for the channel (e.g., "Work WhatsApp")';
COMMENT ON COLUMN linkedin_accounts.channel_identifier IS 'Channel-specific identifier (phone for WhatsApp, username for others)';
COMMENT ON COLUMN conversations.is_group IS 'Whether this conversation is a group chat';
COMMENT ON COLUMN conversations.attendee_count IS 'Number of participants in the conversation';
COMMENT ON COLUMN conversations.group_name IS 'Name of the group (if is_group = true)';
