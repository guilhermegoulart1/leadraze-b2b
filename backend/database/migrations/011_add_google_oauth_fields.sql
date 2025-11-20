-- Migration 011: Add Google OAuth fields to users table
-- This enables users to login with Google and stores OAuth profile data

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';

-- Create index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create index for active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Make password_hash optional (Google users won't have password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN users.google_id IS 'Google OAuth user ID for authentication';
COMMENT ON COLUMN users.avatar_url IS 'Profile picture URL from OAuth provider';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.role IS 'User role: user, admin, etc.';
COMMENT ON COLUMN users.subscription_tier IS 'Subscription tier: free, pro, enterprise';
