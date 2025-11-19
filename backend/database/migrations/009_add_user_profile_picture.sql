-- Migration 009: Add profile picture to users table
-- Adds profile_picture field to store base64 encoded images

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

COMMENT ON COLUMN users.profile_picture IS 'Base64 encoded profile picture';
