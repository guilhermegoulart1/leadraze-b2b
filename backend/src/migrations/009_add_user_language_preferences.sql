-- Migration: Add language and timezone preferences to users table
-- Created: 2025-01-25

-- Add preferred_language column (default to English)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Add timezone column (default to America/Sao_Paulo for Brazilian users)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo';

-- Add index for faster language-based queries (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language);

-- Update existing users to Portuguese (since the app was in Portuguese)
UPDATE users
SET preferred_language = 'pt'
WHERE preferred_language = 'en'
  AND created_at < NOW();

-- Add comment to document the columns
COMMENT ON COLUMN users.preferred_language IS 'User preferred language: en (English), pt (Portuguese), es (Spanish)';
COMMENT ON COLUMN users.timezone IS 'User timezone for date/time formatting (IANA timezone format)';
