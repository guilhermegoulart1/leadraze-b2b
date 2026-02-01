-- Migration 141: Create Instagram Agents system
-- Phase 1: Google search via Serper.dev to find Instagram profiles by niche + location

CREATE TABLE IF NOT EXISTS instagram_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),

  -- Agent config
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'error')),

  -- Search parameters (automatic query: site:instagram.com "niche" "location")
  search_niche VARCHAR(255) NOT NULL,
  search_location VARCHAR(255) NOT NULL,
  search_country VARCHAR(100) DEFAULT 'Brazil',

  -- Pagination state (persists across pause/resume)
  current_page INTEGER DEFAULT 0,
  total_profiles_found INTEGER DEFAULT 0,
  has_more_results BOOLEAN DEFAULT true,

  -- Results stored as JSONB array
  found_profiles JSONB DEFAULT '[]'::jsonb,

  -- Limits
  profiles_per_execution INTEGER DEFAULT 50,
  total_limit INTEGER DEFAULT 500,

  -- Execution tracking
  total_api_calls INTEGER DEFAULT 0,
  last_execution_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_instagram_agents_account ON instagram_agents(account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_agents_sector ON instagram_agents(sector_id);
CREATE INDEX IF NOT EXISTS idx_instagram_agents_user ON instagram_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_agents_status ON instagram_agents(status);
CREATE INDEX IF NOT EXISTS idx_instagram_agents_created_at ON instagram_agents(created_at DESC);
