-- LeadRaze B2B - Database Schema
-- PostgreSQL Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- 1. USERS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- 2. LINKEDIN ACCOUNTS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unipile_account_id VARCHAR(255) UNIQUE NOT NULL,
  linkedin_username VARCHAR(255) NOT NULL,
  profile_name VARCHAR(255),
  profile_url TEXT,
  profile_picture TEXT,
  daily_limit INTEGER DEFAULT 50,
  today_sent INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  organizations JSONB,
  premium_features JSONB,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_linkedin_accounts_user_id ON linkedin_accounts(user_id);
CREATE INDEX idx_linkedin_accounts_unipile_id ON linkedin_accounts(unipile_account_id);

-- ================================
-- 3. AI AGENTS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  personality TEXT,
  tone VARCHAR(100),
  language VARCHAR(50) DEFAULT 'pt-BR',
  response_style VARCHAR(100),
  custom_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_agents_user_id ON ai_agents(user_id);

-- ================================
-- 4. CAMPAIGNS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',

  -- Lead counters
  total_leads INTEGER DEFAULT 0,
  leads_pending INTEGER DEFAULT 0,
  leads_sent INTEGER DEFAULT 0,
  leads_accepted INTEGER DEFAULT 0,
  leads_qualifying INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  leads_scheduled INTEGER DEFAULT 0,
  leads_won INTEGER DEFAULT 0,
  leads_lost INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- ================================
-- 5. LEADS TABLE (PIPELINE CRM)
-- ================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- LinkedIn Profile Data
  linkedin_profile_id VARCHAR(255),
  provider_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  company VARCHAR(255),
  location VARCHAR(255),
  profile_url TEXT,
  profile_picture TEXT,
  headline TEXT,
  summary TEXT,
  industry VARCHAR(255),
  connections INTEGER,

  -- Pipeline Status
  -- Estágios: LEAD → CONVITE ENVIADO → QUALIFICAÇÃO → AGENDAMENTO → GANHO/PERDIDO
  status VARCHAR(50) DEFAULT 'lead',

  -- Score (0-100)
  score INTEGER DEFAULT 0,

  -- Timestamps do pipeline
  sent_at TIMESTAMP,              -- Quando convite foi enviado
  accepted_at TIMESTAMP,           -- Quando aceitou convite
  qualifying_started_at TIMESTAMP, -- Quando iniciou qualificação
  qualified_at TIMESTAMP,          -- Quando foi qualificado
  scheduled_at TIMESTAMP,          -- Quando foi agendado
  won_at TIMESTAMP,                -- Quando ganhou (converteu)
  lost_at TIMESTAMP,               -- Quando perdeu

  -- Reason for lost
  lost_reason TEXT,

  -- Notes
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_linkedin_profile_id ON leads(linkedin_profile_id);
CREATE INDEX idx_leads_provider_id ON leads(provider_id);

-- Status constraint
ALTER TABLE leads ADD CONSTRAINT check_status
  CHECK (status IN ('lead', 'invite_sent', 'qualifying', 'scheduled', 'won', 'lost'));

-- ================================
-- 6. CONVERSATIONS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  ai_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active',
  last_message_at TIMESTAMP,
  unipile_chat_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_ai_agent_id ON conversations(ai_agent_id);
CREATE INDEX idx_conversations_status ON conversations(status);

-- ================================
-- 7. MESSAGES TABLE
-- ================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL, -- 'lead', 'ai', 'user'
  content TEXT NOT NULL,
  unipile_message_id VARCHAR(255),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);

-- ================================
-- 8. BULK COLLECTION JOBS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS bulk_collection_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  target_count INTEGER NOT NULL,
  collected_count INTEGER DEFAULT 0,

  api_type VARCHAR(50) DEFAULT 'classic',
  status VARCHAR(50) DEFAULT 'pending',

  search_filters JSONB,

  unipile_account_id VARCHAR(255),
  current_cursor TEXT,

  error_count INTEGER DEFAULT 0,
  error_message TEXT,

  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_processed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bulk_jobs_user_id ON bulk_collection_jobs(user_id);
CREATE INDEX idx_bulk_jobs_status ON bulk_collection_jobs(status);
CREATE INDEX idx_bulk_jobs_campaign_id ON bulk_collection_jobs(campaign_id);

-- ================================
-- 9. WEBHOOK LOGS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_processed ON webhook_logs(processed);

-- ================================
-- 10. ACTIVITY LOGS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ================================
-- 11. DAILY ANALYTICS TABLE
-- ================================
CREATE TABLE IF NOT EXISTS daily_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  invites_sent INTEGER DEFAULT 0,
  invites_accepted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  leads_scheduled INTEGER DEFAULT 0,
  leads_won INTEGER DEFAULT 0,
  leads_lost INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_analytics_user_date ON daily_analytics(user_id, date DESC);

-- ================================
-- TRIGGERS
-- ================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_accounts_updated_at BEFORE UPDATE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- RELEASES TABLE (Changelog)
-- ================================

CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  content TEXT NOT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_releases_published_at ON releases(published_at DESC);

CREATE TRIGGER update_releases_updated_at BEFORE UPDATE ON releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- INITIAL DATA
-- ================================

-- Create default AI agent for demo
-- (Will be populated via seeder script)

COMMIT;
