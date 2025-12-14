-- Migration 077: Expand VARCHAR fields in leads table
-- Purpose: Fix "value too long for type character varying(255)" errors for leads
-- Date: 2024-12-14

-- Expand leads table fields that can exceed 255 characters
ALTER TABLE leads
  ALTER COLUMN linkedin_profile_id TYPE TEXT,
  ALTER COLUMN provider_id TYPE TEXT,
  ALTER COLUMN name TYPE VARCHAR(500),
  ALTER COLUMN title TYPE TEXT,
  ALTER COLUMN company TYPE VARCHAR(500),
  ALTER COLUMN location TYPE TEXT,
  ALTER COLUMN industry TYPE VARCHAR(500);

-- Also expand google_maps_agents fields if they have limits
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_maps_agents' AND column_name = 'query'
    AND character_maximum_length IS NOT NULL AND character_maximum_length < 1000
  ) THEN
    ALTER TABLE google_maps_agents ALTER COLUMN query TYPE TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_maps_agents' AND column_name = 'location'
    AND character_maximum_length IS NOT NULL AND character_maximum_length < 1000
  ) THEN
    ALTER TABLE google_maps_agents ALTER COLUMN location TYPE TEXT;
  END IF;
END $$;

-- Expand business_category in contacts if it exists and is limited
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'business_category'
    AND character_maximum_length IS NOT NULL AND character_maximum_length < 500
  ) THEN
    ALTER TABLE contacts ALTER COLUMN business_category TYPE VARCHAR(500);
  END IF;
END $$;

-- Expand headline in contacts if it's VARCHAR
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'headline'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE contacts ALTER COLUMN headline TYPE TEXT;
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN leads.linkedin_profile_id IS 'LinkedIn profile ID or Google Maps place_id (expanded to TEXT)';
COMMENT ON COLUMN leads.name IS 'Lead name (expanded to VARCHAR(500))';
COMMENT ON COLUMN leads.company IS 'Company name (expanded to VARCHAR(500))';
COMMENT ON COLUMN leads.location IS 'Location/address (expanded to TEXT)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 077 completed: leads VARCHAR fields expanded';
END $$;
