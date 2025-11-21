-- Migration 012: Create Permissions System
-- Creates tables for role-based permissions and team management

-- ============================================
-- PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'campaigns:view:own'
  resource VARCHAR(50) NOT NULL,       -- e.g., 'campaigns', 'contacts', 'conversations'
  action VARCHAR(50) NOT NULL,         -- e.g., 'view', 'create', 'edit', 'delete'
  scope VARCHAR(50) NOT NULL,          -- e.g., 'own', 'team', 'all'
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ROLE PERMISSIONS TABLE
-- Junction table mapping roles to permissions
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,  -- 'admin', 'supervisor', 'user'
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, permission_id)
);

-- ============================================
-- USER TEAMS TABLE
-- Manages supervisor-member relationships
-- ============================================
CREATE TABLE IF NOT EXISTS user_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(supervisor_id, member_id),
  -- Prevent self-supervision
  CHECK (supervisor_id != member_id)
);

-- ============================================
-- ADD ASSIGNMENT FIELDS
-- Allow supervisors to assign work
-- ============================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

-- ============================================
-- CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_supervisor ON user_teams(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_member ON user_teams(member_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_assigned_to ON campaigns(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE permissions IS 'Defines all available permissions in the system';
COMMENT ON TABLE role_permissions IS 'Maps permissions to roles (admin, supervisor, user)';
COMMENT ON TABLE user_teams IS 'Maps supervisors to their team members';
COMMENT ON COLUMN campaigns.assigned_to IS 'User assigned to this campaign (for team management)';
COMMENT ON COLUMN conversations.assigned_to IS 'User assigned to this conversation (for team management)';
