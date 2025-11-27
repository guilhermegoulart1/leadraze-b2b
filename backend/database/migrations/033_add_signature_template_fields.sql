-- Migration: 033_add_signature_template_fields.sql
-- Description: Add template, accent color, and additional fields to email signatures
-- Date: 2024

-- ============================================================================
-- ADD NEW COLUMNS TO EMAIL SIGNATURES
-- ============================================================================

-- Template identifier (e.g., 'classic', 'horizontal', 'modern-minimal')
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS template_id VARCHAR(50);

-- Accent color for the signature (hex color)
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#ec4899';

-- Photo URL (user photo for signature)
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

-- Department
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS department VARCHAR(255);

-- Pronouns (e.g., "He/Him", "She/Her", "They/Them")
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS pronouns VARCHAR(50);

-- Mobile phone (separate from main phone)
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS mobile VARCHAR(50);

-- Address
ALTER TABLE email_signatures
ADD COLUMN IF NOT EXISTS address VARCHAR(500);

-- Add comments for documentation
COMMENT ON COLUMN email_signatures.template_id IS 'ID of the signature template used (classic, horizontal, with-logo, etc.)';
COMMENT ON COLUMN email_signatures.accent_color IS 'Hex color code for signature accent elements';
COMMENT ON COLUMN email_signatures.photo_url IS 'URL to user photo stored in R2';
COMMENT ON COLUMN email_signatures.department IS 'User department or team name';
COMMENT ON COLUMN email_signatures.pronouns IS 'User preferred pronouns';
COMMENT ON COLUMN email_signatures.mobile IS 'Mobile phone number';
COMMENT ON COLUMN email_signatures.address IS 'Business address or location';
