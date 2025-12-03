-- Migration: 057_add_certifications_languages_to_contacts.sql
-- Description: Add certifications and languages fields to contacts table

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS certifications JSONB,
ADD COLUMN IF NOT EXISTS languages JSONB;

COMMENT ON COLUMN contacts.certifications IS 'Array of certifications {name, issuer, date}';
COMMENT ON COLUMN contacts.languages IS 'Array of languages {name, proficiency}';
