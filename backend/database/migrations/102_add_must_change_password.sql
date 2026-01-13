-- Migration: Add must_change_password flag for magic link login
-- For team member welcome emails with forced password change

BEGIN;

-- Add must_change_password flag to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying of users who need password change
CREATE INDEX IF NOT EXISTS idx_users_must_change_password
ON users(must_change_password) WHERE must_change_password = TRUE;

-- Add comment
COMMENT ON COLUMN users.must_change_password IS 'When true, user must change password before accessing the system (used for magic link login)';

COMMIT;
