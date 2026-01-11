-- Migration 119: Add phone_country_code to contacts table
-- Stores the ISO country code for phone number formatting (e.g., 'BR', 'US', 'PT')

-- Add phone_country_code column to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(5);

-- Add comment
COMMENT ON COLUMN contacts.phone_country_code IS 'ISO country code for phone number format (e.g., BR, US, PT, ES)';

-- Create index for potential filtering by country
CREATE INDEX IF NOT EXISTS idx_contacts_phone_country_code ON contacts(phone_country_code) WHERE phone_country_code IS NOT NULL;
