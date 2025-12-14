-- Migration 075: Add structured address fields
-- Purpose: Store address components separately for better filtering and display
-- Date: 2024-12-14

-- Add address component fields to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS street_address VARCHAR(500);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS city VARCHAR(100);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS state VARCHAR(50);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Brazil';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city);
CREATE INDEX IF NOT EXISTS idx_contacts_state ON contacts(state);
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country);
CREATE INDEX IF NOT EXISTS idx_contacts_city_state ON contacts(city, state);

-- Add same fields to leads table for consistency
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS city VARCHAR(100);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS state VARCHAR(50);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Create indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);

-- Comments
COMMENT ON COLUMN contacts.street_address IS 'Street address extracted from full address';
COMMENT ON COLUMN contacts.city IS 'City name extracted from address';
COMMENT ON COLUMN contacts.state IS 'State abbreviation (e.g., SP, RJ, MG)';
COMMENT ON COLUMN contacts.country IS 'Country name, defaults to Brazil';
COMMENT ON COLUMN contacts.postal_code IS 'Postal/ZIP code (CEP in Brazil)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 075 completed: address fields added to contacts and leads';
END $$;
