-- Migration: Add phone column to users table
-- For storing phone numbers collected during Stripe checkout

ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add comment
COMMENT ON COLUMN users.phone IS 'User phone number (collected during Stripe checkout)';
