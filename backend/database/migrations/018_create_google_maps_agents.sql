-- Migration 018: Create Google Maps Agents table
-- Purpose: Automated daily lead generation from Google Maps searches
-- Date: 2025-01-23

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create google_maps_agents table
CREATE TABLE IF NOT EXISTS google_maps_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Multi-tenancy
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Agent configuration
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),

  -- Action configuration (what to do with each lead)
  action_type VARCHAR(50) DEFAULT 'crm_only' CHECK (action_type IN ('crm_only', 'crm_email', 'crm_email_whatsapp')),

  -- Search filters (saved to repeat daily searches)
  search_country VARCHAR(100) DEFAULT 'Brazil',
  search_location VARCHAR(255) NOT NULL,
  search_query VARCHAR(255) NOT NULL,
  search_radius INTEGER DEFAULT 5000,  -- in meters
  min_rating DECIMAL(2,1),
  min_reviews INTEGER,
  require_phone BOOLEAN DEFAULT FALSE,
  require_email BOOLEAN DEFAULT FALSE,

  -- Pagination control
  current_page INTEGER DEFAULT 0,
  last_page_fetched INTEGER DEFAULT -1,
  total_pages_available INTEGER,
  last_fetch_at TIMESTAMP,

  -- Statistics
  total_leads_found INTEGER DEFAULT 0,
  leads_inserted INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,  -- duplicates or filtered out
  leads_pending_email INTEGER DEFAULT 0,
  leads_pending_whatsapp INTEGER DEFAULT 0,

  -- Email & WhatsApp templates (for future phases)
  email_template_id UUID,
  whatsapp_template_id UUID,

  -- Scheduling
  daily_limit INTEGER DEFAULT 20,
  next_execution_at TIMESTAMP,
  last_execution_at TIMESTAMP,
  execution_time VARCHAR(5) DEFAULT '09:00',  -- HH:MM format

  -- Cost tracking
  total_api_calls INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_account_id ON google_maps_agents(account_id);
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_sector_id ON google_maps_agents(sector_id);
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_user_id ON google_maps_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_status ON google_maps_agents(status);
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_next_execution ON google_maps_agents(next_execution_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_created_at ON google_maps_agents(created_at);

-- Create junction table: contacts linked to agents (for tracking which agent found which contact)
CREATE TABLE IF NOT EXISTS google_maps_agent_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES google_maps_agents(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Tracking info
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  page_number INTEGER,  -- which pagination page this contact was on
  position INTEGER,     -- position in the page (1-20)

  -- Action status
  inserted_to_crm BOOLEAN DEFAULT TRUE,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint: one contact per agent
  UNIQUE(agent_id, contact_id)
);

-- Create indexes for junction table
CREATE INDEX IF NOT EXISTS idx_agent_contacts_agent_id ON google_maps_agent_contacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_contacts_contact_id ON google_maps_agent_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_agent_contacts_fetched_at ON google_maps_agent_contacts(fetched_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_maps_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_google_maps_agents_updated_at
  BEFORE UPDATE ON google_maps_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_google_maps_agents_updated_at();

-- Comments for documentation
COMMENT ON TABLE google_maps_agents IS 'Automated agents that fetch leads from Google Maps daily';
COMMENT ON COLUMN google_maps_agents.action_type IS 'Action to perform with each lead: crm_only, crm_email, or crm_email_whatsapp';
COMMENT ON COLUMN google_maps_agents.current_page IS 'Next page to fetch (0-indexed, increments by 1 each day)';
COMMENT ON COLUMN google_maps_agents.daily_limit IS 'Number of leads to fetch per execution (typically 20 due to SerpApi pagination)';
COMMENT ON COLUMN google_maps_agents.estimated_cost IS 'Estimated total cost in USD based on API calls ($0.00275 per query)';

COMMENT ON TABLE google_maps_agent_contacts IS 'Junction table tracking which contacts were found by which agents';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 018 completed: Google Maps Agents system created';
  RAISE NOTICE '   - google_maps_agents table created';
  RAISE NOTICE '   - google_maps_agent_contacts junction table created';
  RAISE NOTICE '   - Indexes and triggers configured';
END $$;
