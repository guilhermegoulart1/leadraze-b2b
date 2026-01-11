-- Migration 124: Create user_channel_permissions table
-- Allows configuring which channels each user can access and with what level

-- Create user_channel_permissions table
CREATE TABLE IF NOT EXISTS user_channel_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  -- 'all' = can see all conversations in this channel
  -- 'assigned_only' = can only see conversations assigned to them
  -- 'none' = no access to this channel
  access_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (access_type IN ('all', 'assigned_only', 'none')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- Each user can only have one permission per channel
  UNIQUE(user_id, linkedin_account_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_account ON user_channel_permissions(account_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_user ON user_channel_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_channel ON user_channel_permissions(linkedin_account_id);

-- Comments
COMMENT ON TABLE user_channel_permissions IS 'Controls which channels each user can access and their permission level';
COMMENT ON COLUMN user_channel_permissions.access_type IS 'all = see all conversations, assigned_only = only assigned to user, none = no access';
