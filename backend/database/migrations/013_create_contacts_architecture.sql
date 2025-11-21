-- Migration 013: Create Contacts Architecture
-- Separates Contacts (unified contact base) from Leads (sales opportunities)
-- Supports multi-channel communication and tags

-- ============================================
-- CONTACTS TABLE
-- Base unified contact database
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Information
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  title VARCHAR(255),
  location VARCHAR(255),

  -- Profile Data
  profile_url TEXT,
  profile_picture TEXT,
  linkedin_profile_id VARCHAR(255),
  headline TEXT,
  about TEXT,
  industry VARCHAR(255),

  -- Social Data
  connections_count INTEGER,
  is_premium BOOLEAN DEFAULT FALSE,

  -- Rich Data (JSONB)
  experience JSONB,      -- Work history
  education JSONB,       -- Education background
  skills JSONB,          -- Skills list
  websites JSONB,        -- Array of website URLs
  social_profiles JSONB, -- Other social media profiles
  custom_fields JSONB,   -- Extensible custom data

  -- Metadata
  source VARCHAR(50),    -- 'linkedin', 'manual', 'import', 'campaign'
  notes TEXT,
  last_interaction_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CHECK (email IS NOT NULL OR phone IS NOT NULL OR linkedin_profile_id IS NOT NULL)
);

-- ============================================
-- TAGS TABLE
-- Global tags (shared across all users in account)
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(50) DEFAULT 'blue',  -- blue, green, yellow, red, purple, pink, gray
  category VARCHAR(50),               -- 'status', 'priority', 'type', 'custom'
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CONTACT_TAGS TABLE
-- Junction table for contacts and tags (N:N)
-- ============================================
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contact_id, tag_id)
);

-- ============================================
-- CONTACT_CHANNELS TABLE
-- Multi-channel support for each contact
-- ============================================
CREATE TABLE IF NOT EXISTS contact_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Channel info
  channel_type VARCHAR(50) NOT NULL,  -- 'whatsapp', 'instagram', 'email', 'linkedin', 'telegram', 'phone'
  channel_id VARCHAR(255),             -- External ID (phone number, Instagram handle, etc.)
  channel_username VARCHAR(255),       -- Display name/username for the channel

  -- Status
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Activity tracking
  last_interaction_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB,  -- Channel-specific data

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CONTACT_LEADS TABLE
-- N:N relationship between contacts and leads (opportunities)
-- A contact can have multiple deals/opportunities
-- ============================================
CREATE TABLE IF NOT EXISTS contact_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Relationship role
  role VARCHAR(50) DEFAULT 'primary',  -- 'primary', 'decision_maker', 'influencer', 'champion'

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contact_id, lead_id)
);

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_profile_id ON contacts(linkedin_profile_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- Full-text search on contacts
CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING gin(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(title, ''))
);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- Contact tags indexes
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);

-- Contact channels indexes
CREATE INDEX IF NOT EXISTS idx_contact_channels_contact_id ON contact_channels(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_channels_type ON contact_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_contact_channels_channel_id ON contact_channels(channel_id);

-- Contact leads indexes
CREATE INDEX IF NOT EXISTS idx_contact_leads_contact_id ON contact_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_leads_lead_id ON contact_leads(lead_id);

-- ============================================
-- SEED DEFAULT TAGS
-- ============================================

INSERT INTO tags (name, color, category, description) VALUES
  ('Cliente VIP', 'purple', 'priority', 'Clientes de alta prioridade'),
  ('Lead Qualificado', 'green', 'status', 'Lead validado e qualificado para vendas'),
  ('Negociação', 'yellow', 'status', 'Em processo de negociação'),
  ('Aguardando Resposta', 'gray', 'status', 'Aguardando retorno do contato'),
  ('Follow-up', 'blue', 'action', 'Necessita acompanhamento'),
  ('Interessado', 'green', 'status', 'Demonstrou interesse'),
  ('Não Qualificado', 'red', 'status', 'Não atende aos critérios'),
  ('Cliente Ativo', 'purple', 'type', 'Cliente atual ativo'),
  ('Cliente Inativo', 'gray', 'type', 'Cliente que parou de usar o serviço'),
  ('Prospect', 'blue', 'type', 'Prospecto ainda não convertido')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ADD TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp for contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Auto-update updated_at timestamp for contact_channels
CREATE OR REPLACE FUNCTION update_contact_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_channels_updated_at
  BEFORE UPDATE ON contact_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_channels_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE contacts IS 'Unified contact database - the single source of truth for all people';
COMMENT ON TABLE tags IS 'Global tags system for categorizing contacts';
COMMENT ON TABLE contact_tags IS 'Many-to-many relationship between contacts and tags';
COMMENT ON TABLE contact_channels IS 'Multi-channel communication tracking per contact';
COMMENT ON TABLE contact_leads IS 'Links contacts to sales opportunities (leads in pipeline)';

COMMENT ON COLUMN contacts.source IS 'How the contact was added: linkedin, manual, import, campaign';
COMMENT ON COLUMN contacts.last_interaction_at IS 'Last time any interaction happened on any channel';
COMMENT ON COLUMN contact_channels.channel_type IS 'Communication channel: whatsapp, instagram, email, linkedin, telegram, phone';
COMMENT ON COLUMN contact_channels.is_primary IS 'Primary channel for this contact';
COMMENT ON COLUMN contact_leads.role IS 'Contact role in the deal: primary, decision_maker, influencer, champion';
