-- Migration 071: Add website column to contacts table
-- Purpose: Store website URL from Google Maps for email scraping enrichment
-- Date: 2024-12-14

-- Add website column (single URL, not array)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS website VARCHAR(500);

-- Create index for website searches
CREATE INDEX IF NOT EXISTS idx_contacts_website ON contacts(website);

-- Comments
COMMENT ON COLUMN contacts.website IS 'Business website URL from Google Maps (used for email scraping)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 071 completed: website column added to contacts table';
END $$;
