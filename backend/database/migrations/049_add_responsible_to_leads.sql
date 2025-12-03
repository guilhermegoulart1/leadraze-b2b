-- ================================================
-- Migration 049: Add Responsible User to Leads
-- ================================================
-- Adds responsible_user_id to leads table
-- Adds round-robin configuration to sectors table

BEGIN;

-- ================================
-- 1. ADD RESPONSIBLE TO LEADS
-- ================================

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast lookups by responsible user
CREATE INDEX IF NOT EXISTS idx_leads_responsible_user_id ON leads(responsible_user_id);

-- ================================
-- 2. ADD ROUND-ROBIN CONFIG TO SECTORS
-- ================================

-- Enable/disable round-robin for the sector
ALTER TABLE sectors
ADD COLUMN IF NOT EXISTS enable_round_robin BOOLEAN DEFAULT false;

-- Track the last user who was assigned (for round-robin rotation)
ALTER TABLE sectors
ADD COLUMN IF NOT EXISTS last_assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ================================
-- 3. CREATE SECTOR USERS TABLE
-- ================================
-- Associates users with sectors for round-robin assignment

CREATE TABLE IF NOT EXISTS sector_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(sector_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sector_users_sector_id ON sector_users(sector_id);
CREATE INDEX IF NOT EXISTS idx_sector_users_user_id ON sector_users(user_id);

-- ================================
-- 4. ADD COMMENTS
-- ================================

COMMENT ON COLUMN leads.responsible_user_id IS 'User responsible for this lead';
COMMENT ON COLUMN sectors.enable_round_robin IS 'When true, auto-assigns leads to sector users in rotation';
COMMENT ON COLUMN sectors.last_assigned_user_id IS 'Last user assigned via round-robin (for rotation tracking)';
COMMENT ON TABLE sector_users IS 'Users associated with sectors for round-robin assignment';

COMMIT;

-- ================================
-- SUCCESS MESSAGE
-- ================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE ' Migration 049 completed successfully!';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  - Added leads.responsible_user_id';
  RAISE NOTICE '  - Added sectors.enable_round_robin';
  RAISE NOTICE '  - Added sectors.last_assigned_user_id';
  RAISE NOTICE '  - Created sector_users table';
  RAISE NOTICE '';
END $$;
