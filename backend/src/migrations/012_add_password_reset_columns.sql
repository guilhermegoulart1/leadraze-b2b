-- Migration: Add password reset columns to users table
-- For storing password reset tokens for new users from guest checkout

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Add comments
COMMENT ON COLUMN users.password_reset_token IS 'Hashed token for password reset/setup';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiry timestamp for password reset token';
