-- Migration: 032_add_email_branding_settings.sql
-- Description: Add email branding, signatures, templates, and attachments support
-- Date: 2024

-- ============================================================================
-- EMAIL SIGNATURES TABLE
-- ============================================================================
-- Stores email signatures for accounts and users
-- If user_id is NULL, it's an account-level default signature

CREATE TABLE IF NOT EXISTS email_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = account default

  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,

  -- Signature content (rendered)
  html_content TEXT,
  text_content TEXT,

  -- Structured components (for editor UI)
  full_name VARCHAR(255),
  title VARCHAR(255),
  company VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Logo/Image (URL from R2)
  logo_url VARCHAR(500),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_signatures_account ON email_signatures(account_id);
CREATE INDEX idx_email_signatures_user ON email_signatures(user_id);
CREATE INDEX idx_email_signatures_default ON email_signatures(account_id, is_default) WHERE is_default = true;

-- ============================================================================
-- EMAIL TEMPLATES CUSTOM TABLE
-- ============================================================================
-- Stores custom email templates created by users for AI agents

CREATE TABLE IF NOT EXISTS email_templates_custom (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'initial_outreach', 'follow_up', 'proposal', 'thank_you', 'custom'

  -- Template content
  subject_template VARCHAR(500),
  html_template TEXT NOT NULL,
  text_template TEXT,

  -- Available variables (documentation for UI)
  available_variables JSONB DEFAULT '["{{nome}}", "{{empresa}}", "{{cargo}}", "{{industria}}"]'::jsonb,

  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_template_slug_per_account UNIQUE (account_id, slug)
);

CREATE INDEX idx_email_templates_account ON email_templates_custom(account_id);
CREATE INDEX idx_email_templates_category ON email_templates_custom(category);

-- ============================================================================
-- EMAIL ATTACHMENTS TABLE
-- ============================================================================
-- Stores email attachments metadata (files stored in R2)

CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID, -- Reference to the message containing this attachment

  -- File information
  original_filename VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL, -- Path in R2
  file_url VARCHAR(500), -- Public URL or signed URL
  mime_type VARCHAR(100),
  file_size INTEGER, -- Size in bytes

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_attachments_account ON email_attachments(account_id);
CREATE INDEX idx_email_attachments_conversation ON email_attachments(conversation_id);
CREATE INDEX idx_email_attachments_message ON email_attachments(message_id);

-- ============================================================================
-- ADD EMAIL SETTINGS TO USERS TABLE
-- ============================================================================
-- User-level email preferences

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'::jsonb;

-- Structure:
-- {
--   "signature_id": "uuid",           -- Selected signature ID
--   "email_format_preference": "html", -- "html" or "text"
--   "use_account_signature": true      -- If true, use account default
-- }

COMMENT ON COLUMN users.email_settings IS 'User email preferences: signature_id, email_format_preference (html/text), use_account_signature';

-- ============================================================================
-- ADD EMAIL CONFIG TO AI_AGENTS TABLE
-- ============================================================================
-- Per-agent email behavior configuration

ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS email_config JSONB DEFAULT '{}'::jsonb;

-- Structure:
-- {
--   "include_signature": true,
--   "include_logo": true,
--   "signature_id": "uuid",           -- Specific signature or null for account default
--   "template_id": "uuid",            -- Default template for responses
--   "tone": "professional",           -- professional, casual, formal, friendly
--   "response_length": "medium",      -- short, medium, long
--   "greeting_style": "name",         -- name, title, generic
--   "closing_style": "best_regards",  -- best_regards, thanks, sincerely, custom
--   "custom_closing": "",
--   "personalization_level": "high"   -- low, medium, high
-- }

COMMENT ON COLUMN ai_agents.email_config IS 'AI agent email behavior: tone, signature, greeting/closing style, personalization level';

-- ============================================================================
-- UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================================================

-- Trigger for email_signatures
CREATE OR REPLACE FUNCTION update_email_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_signatures_updated_at
  BEFORE UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_email_signatures_updated_at();

-- Trigger for email_templates_custom
CREATE OR REPLACE FUNCTION update_email_templates_custom_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_templates_custom_updated_at
  BEFORE UPDATE ON email_templates_custom
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_custom_updated_at();

-- ============================================================================
-- INSERT DEFAULT TEMPLATES
-- ============================================================================
-- These will be available as starting points for all accounts

-- Note: These templates will be inserted via seed script or application code
-- since they need account_id which varies per tenant

-- ============================================================================
-- GRANTS (if using separate database users)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON email_signatures TO getraze_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates_custom TO getraze_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON email_attachments TO getraze_app;
