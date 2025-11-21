-- Migration 015: Add Sectors and Custom User Permissions
-- Description: Implements department/sector-based access control and per-user custom permissions

-- ============================================
-- 1. CREATE SECTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure unique sector names per account
  CONSTRAINT unique_sector_name_per_account UNIQUE (account_id, name)
);

CREATE INDEX idx_sectors_account ON sectors(account_id);
CREATE INDEX idx_sectors_active ON sectors(is_active);

-- ============================================
-- 2. USER SECTORS (Many-to-Many)
-- ============================================
-- Users can have access to multiple sectors
CREATE TABLE IF NOT EXISTS user_sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate assignments
  CONSTRAINT unique_user_sector UNIQUE (user_id, sector_id)
);

CREATE INDEX idx_user_sectors_user ON user_sectors(user_id);
CREATE INDEX idx_user_sectors_sector ON user_sectors(sector_id);

-- ============================================
-- 3. SUPERVISOR SECTORS (Many-to-Many)
-- ============================================
-- Supervisors can supervise multiple sectors
CREATE TABLE IF NOT EXISTS supervisor_sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate assignments
  CONSTRAINT unique_supervisor_sector UNIQUE (supervisor_id, sector_id)
);

CREATE INDEX idx_supervisor_sectors_supervisor ON supervisor_sectors(supervisor_id);
CREATE INDEX idx_supervisor_sectors_sector ON supervisor_sectors(sector_id);

-- ============================================
-- 4. USER CUSTOM PERMISSIONS
-- ============================================
-- Individual permissions per user (override role permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true, -- true = grant, false = revoke (explicit deny)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate permission assignments
  CONSTRAINT unique_user_permission UNIQUE (user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission_id);

-- ============================================
-- 5. ADD SECTOR_ID TO EXISTING TABLES
-- ============================================

-- Add sector to campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_sector ON campaigns(sector_id);

-- Add sector to leads (inherited from campaign, but can be overridden)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_sector ON leads(sector_id);

-- Add sector to conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_sector ON conversations(sector_id);

-- Add sector to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_sector ON contacts(sector_id);

-- ============================================
-- 6. CREATE DEFAULT SECTORS PER ACCOUNT
-- ============================================
-- Create a default "Geral" sector for each existing account
DO $$
DECLARE
  account_record RECORD;
  default_sector_id UUID;
BEGIN
  FOR account_record IN SELECT id, name FROM accounts LOOP
    -- Create default sector
    INSERT INTO sectors (account_id, name, description, color, is_active)
    VALUES (
      account_record.id,
      'Geral',
      'Setor padrão',
      '#6366f1',
      true
    )
    RETURNING id INTO default_sector_id;

    RAISE NOTICE 'Created default sector "Geral" for account: %', account_record.name;

    -- Assign all users from this account to the default sector
    INSERT INTO user_sectors (user_id, sector_id)
    SELECT u.id, default_sector_id
    FROM users u
    WHERE u.account_id = account_record.id;

    -- Assign all supervisors to supervise the default sector
    INSERT INTO supervisor_sectors (supervisor_id, sector_id)
    SELECT u.id, default_sector_id
    FROM users u
    WHERE u.account_id = account_record.id AND u.role = 'supervisor';

    RAISE NOTICE 'Assigned users and supervisors to default sector for account: %', account_record.name;
  END LOOP;
END $$;

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE sectors IS 'Departments/Sectors for organizing work and access control';
COMMENT ON TABLE user_sectors IS 'Sectors that each user has access to (many-to-many)';
COMMENT ON TABLE supervisor_sectors IS 'Sectors that each supervisor supervises (many-to-many)';
COMMENT ON TABLE user_permissions IS 'Custom permissions per user (overrides role permissions)';

COMMENT ON COLUMN campaigns.sector_id IS 'Sector this campaign belongs to';
COMMENT ON COLUMN leads.sector_id IS 'Sector this lead belongs to (inherited from campaign)';
COMMENT ON COLUMN conversations.sector_id IS 'Sector this conversation belongs to';
COMMENT ON COLUMN contacts.sector_id IS 'Sector this contact belongs to';
