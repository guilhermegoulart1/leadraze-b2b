-- Migration 142: Add extracted_contacts column to contacts table
-- Stores contact info extracted from LinkedIn/Instagram bios (emails, phones, websites)
-- Used by Chrome Extension when adding profiles to campaigns

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS extracted_contacts JSONB DEFAULT NULL;

COMMENT ON COLUMN contacts.extracted_contacts IS 'Contact info extracted from profile bios: {emails: [], phones: [], websites: []}';
