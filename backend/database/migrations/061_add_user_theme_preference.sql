-- Migration: Add user theme preference support
-- Created: 2025-12-05
-- Description: Adds preferred_theme column to users table to support dark/light mode selection

-- Add preferred_theme column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_theme VARCHAR(20) DEFAULT 'light';

-- Add constraint to ensure valid values
ALTER TABLE users
ADD CONSTRAINT check_preferred_theme
CHECK (preferred_theme IN ('light', 'dark', 'system'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_preferred_theme ON users(preferred_theme);

-- Update existing users to have default theme
UPDATE users
SET preferred_theme = 'light'
WHERE preferred_theme IS NULL;
