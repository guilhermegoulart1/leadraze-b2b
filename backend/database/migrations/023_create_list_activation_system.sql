-- Migration 023: Create List Activation System
-- This migration creates tables for:
-- 1. Activation Agents (AI agents specific for list activation)
-- 2. Contact Lists (lists of contacts to be activated)
-- 3. Contact List Items (contacts in each list)
-- 4. Activation Campaigns (campaigns created from lists)
-- 5. Activation Campaign Contacts (contacts in activation campaigns)

-- =====================================================
-- 1. ACTIVATION AGENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS activation_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Agent configuration
  activation_type VARCHAR(50) NOT NULL CHECK (activation_type IN ('email', 'whatsapp', 'linkedin')),
  personality TEXT,
  tone VARCHAR(50) DEFAULT 'professional' CHECK (tone IN ('formal', 'casual', 'professional', 'friendly')),
  language VARCHAR(10) DEFAULT 'pt-BR',

  -- Message templates
  initial_message TEXT,
  follow_up_message TEXT,
  custom_instructions TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activation_agents_account ON activation_agents(account_id);
CREATE INDEX idx_activation_agents_user ON activation_agents(user_id);
CREATE INDEX idx_activation_agents_sector ON activation_agents(sector_id);
CREATE INDEX idx_activation_agents_type ON activation_agents(activation_type);

-- =====================================================
-- 2. CONTACT LISTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- List metadata
  list_type VARCHAR(50) DEFAULT 'manual' CHECK (list_type IN ('manual', 'import', 'linkedin', 'google_maps', 'crm')),
  total_contacts INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Import information (if imported from CSV)
  import_file_name VARCHAR(255),
  import_date TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contact_lists_account ON contact_lists(account_id);
CREATE INDEX idx_contact_lists_user ON contact_lists(user_id);
CREATE INDEX idx_contact_lists_sector ON contact_lists(sector_id);
CREATE INDEX idx_contact_lists_type ON contact_lists(list_type);

-- =====================================================
-- 3. CONTACT LIST ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,

  -- Contact information (can link to existing contact or store directly)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Direct contact data (for imported contacts not yet in CRM)
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url VARCHAR(500),
  company VARCHAR(255),
  position VARCHAR(255),

  -- Status in list
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'failed', 'skipped')),

  -- Activation tracking
  activated_at TIMESTAMP,
  activation_campaign_id UUID,

  -- Timestamps
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contact_list_items_list ON contact_list_items(list_id);
CREATE INDEX idx_contact_list_items_contact ON contact_list_items(contact_id);
CREATE INDEX idx_contact_list_items_status ON contact_list_items(status);
CREATE INDEX idx_contact_list_items_campaign ON contact_list_items(activation_campaign_id);

-- Unique constraint to prevent duplicate contacts in same list
CREATE UNIQUE INDEX idx_contact_list_items_unique_contact ON contact_list_items(list_id, contact_id)
  WHERE contact_id IS NOT NULL;

-- =====================================================
-- 4. ACTIVATION CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS activation_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,

  -- Campaign basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Linked resources
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES activation_agents(id) ON DELETE RESTRICT,

  -- Campaign configuration
  activation_type VARCHAR(50) NOT NULL CHECK (activation_type IN ('email', 'whatsapp', 'linkedin')),
  daily_limit INTEGER DEFAULT 50 CHECK (daily_limit > 0 AND daily_limit <= 1000),

  -- Account configuration (for LinkedIn/WhatsApp)
  linkedin_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  whatsapp_account_id UUID, -- Future: references whatsapp_accounts
  email_account_id UUID, -- Future: references email_accounts

  -- Campaign status
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'stopped')),

  -- Statistics
  total_contacts INTEGER DEFAULT 0,
  contacts_activated INTEGER DEFAULT 0,
  contacts_pending INTEGER DEFAULT 0,
  contacts_failed INTEGER DEFAULT 0,
  contacts_responded INTEGER DEFAULT 0,

  -- Scheduling
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  last_activation_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activation_campaigns_account ON activation_campaigns(account_id);
CREATE INDEX idx_activation_campaigns_user ON activation_campaigns(user_id);
CREATE INDEX idx_activation_campaigns_sector ON activation_campaigns(sector_id);
CREATE INDEX idx_activation_campaigns_list ON activation_campaigns(list_id);
CREATE INDEX idx_activation_campaigns_agent ON activation_campaigns(agent_id);
CREATE INDEX idx_activation_campaigns_status ON activation_campaigns(status);
CREATE INDEX idx_activation_campaigns_type ON activation_campaigns(activation_type);

-- =====================================================
-- 5. ACTIVATION CAMPAIGN CONTACTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS activation_campaign_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES activation_campaigns(id) ON DELETE CASCADE,
  list_item_id UUID NOT NULL REFERENCES contact_list_items(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Activation details
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'delivered', 'failed', 'responded', 'skipped')),

  -- Message tracking
  message_sent_at TIMESTAMP,
  message_delivered_at TIMESTAMP,
  message_read_at TIMESTAMP,
  response_received_at TIMESTAMP,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activation_campaign_contacts_campaign ON activation_campaign_contacts(campaign_id);
CREATE INDEX idx_activation_campaign_contacts_list_item ON activation_campaign_contacts(list_item_id);
CREATE INDEX idx_activation_campaign_contacts_contact ON activation_campaign_contacts(contact_id);
CREATE INDEX idx_activation_campaign_contacts_status ON activation_campaign_contacts(status);

-- Unique constraint to prevent duplicate contacts in same campaign
CREATE UNIQUE INDEX idx_activation_campaign_contacts_unique ON activation_campaign_contacts(campaign_id, list_item_id);

-- =====================================================
-- 6. TRIGGERS FOR updated_at
-- =====================================================

CREATE TRIGGER trigger_update_activation_agents_updated_at
  BEFORE UPDATE ON activation_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_contact_lists_updated_at
  BEFORE UPDATE ON contact_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_contact_list_items_updated_at
  BEFORE UPDATE ON contact_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_activation_campaigns_updated_at
  BEFORE UPDATE ON activation_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_activation_campaign_contacts_updated_at
  BEFORE UPDATE ON activation_campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. FUNCTION TO UPDATE LIST CONTACT COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION update_contact_list_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contact_lists
    SET total_contacts = total_contacts + 1
    WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contact_lists
    SET total_contacts = GREATEST(0, total_contacts - 1)
    WHERE id = OLD.list_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_list_count_insert
  AFTER INSERT ON contact_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_list_count();

CREATE TRIGGER trigger_update_contact_list_count_delete
  AFTER DELETE ON contact_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_list_count();

-- =====================================================
-- 8. FUNCTION TO UPDATE CAMPAIGN STATISTICS
-- =====================================================
CREATE OR REPLACE FUNCTION update_activation_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE activation_campaigns
    SET
      total_contacts = (
        SELECT COUNT(*) FROM activation_campaign_contacts WHERE campaign_id = NEW.campaign_id
      ),
      contacts_activated = (
        SELECT COUNT(*) FROM activation_campaign_contacts
        WHERE campaign_id = NEW.campaign_id AND status IN ('sent', 'delivered', 'responded')
      ),
      contacts_pending = (
        SELECT COUNT(*) FROM activation_campaign_contacts
        WHERE campaign_id = NEW.campaign_id AND status IN ('pending', 'scheduled')
      ),
      contacts_failed = (
        SELECT COUNT(*) FROM activation_campaign_contacts
        WHERE campaign_id = NEW.campaign_id AND status = 'failed'
      ),
      contacts_responded = (
        SELECT COUNT(*) FROM activation_campaign_contacts
        WHERE campaign_id = NEW.campaign_id AND status = 'responded'
      )
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_activation_campaign_stats
  AFTER INSERT OR UPDATE ON activation_campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_activation_campaign_stats();

-- =====================================================
-- 9. PERMISSIONS NOTE
-- =====================================================
-- Permissions for this system should be added manually using the permissions UI
-- or by running a separate permissions script after ensuring the permissions
-- system is properly configured for your account.
