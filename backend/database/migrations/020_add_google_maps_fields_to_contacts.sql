-- Migration 020: Add Google Maps fields to contacts table
-- Adds place_id, data_cid, google_maps_url to support Google Maps scraping

-- Add Google Maps specific fields to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS place_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS data_cid VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Create indexes for Google Maps fields
CREATE INDEX IF NOT EXISTS idx_contacts_place_id ON contacts(place_id);
CREATE INDEX IF NOT EXISTS idx_contacts_data_cid ON contacts(data_cid);

-- Add unique constraint to prevent duplicate Google Maps contacts
ALTER TABLE contacts
ADD CONSTRAINT unique_place_id_per_account UNIQUE (account_id, place_id);

-- Comments
COMMENT ON COLUMN contacts.place_id IS 'Google Maps Place ID (unique identifier from Google)';
COMMENT ON COLUMN contacts.data_cid IS 'Google Maps CID (Customer ID)';
COMMENT ON COLUMN contacts.google_maps_url IS 'Direct link to Google Maps business page';
