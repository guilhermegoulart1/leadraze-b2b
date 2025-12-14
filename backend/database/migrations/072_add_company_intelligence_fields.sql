-- Migration 072: Add company intelligence fields to contacts table
-- Purpose: Store GPT-analyzed company description, services, and pain points
-- Date: 2024-12-14

-- Add company_description column (text for longer descriptions)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company_description TEXT;

-- Add company_services as JSONB array
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company_services JSONB DEFAULT '[]';

-- Add pain_points as JSONB array (useful for prospecting)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS pain_points JSONB DEFAULT '[]';

-- Create index for full-text search on company_description
CREATE INDEX IF NOT EXISTS idx_contacts_company_description
  ON contacts USING gin(to_tsvector('portuguese', COALESCE(company_description, '')));

-- Comments
COMMENT ON COLUMN contacts.company_description IS 'AI-generated company description for prospecting (from website scraping)';
COMMENT ON COLUMN contacts.company_services IS 'Array of main services/products offered by the company';
COMMENT ON COLUMN contacts.pain_points IS 'Identified pain points that could be addressed by B2B sales';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 072 completed: company intelligence fields added to contacts table';
END $$;
