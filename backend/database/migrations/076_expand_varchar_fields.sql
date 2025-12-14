-- Migration 076: Expand VARCHAR fields that may exceed 255 characters
-- Purpose: Fix "value too long for type character varying(255)" errors
-- Date: 2024-12-14

-- Expand location field (full addresses from Google Maps can be long)
ALTER TABLE contacts
  ALTER COLUMN location TYPE TEXT;

-- Expand company field (some company names are very long)
ALTER TABLE contacts
  ALTER COLUMN company TYPE VARCHAR(500);

-- Expand name field (some names can be long)
ALTER TABLE contacts
  ALTER COLUMN name TYPE VARCHAR(500);

-- Expand title field (job titles can be long)
ALTER TABLE contacts
  ALTER COLUMN title TYPE TEXT;

-- Expand industry field
ALTER TABLE contacts
  ALTER COLUMN industry TYPE VARCHAR(500);

-- Expand address field if it exists (might have been added in other migrations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'address'
  ) THEN
    ALTER TABLE contacts ALTER COLUMN address TYPE TEXT;
  END IF;
END $$;

-- Also expand fields in leads table for consistency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'location'
  ) THEN
    ALTER TABLE leads ALTER COLUMN location TYPE TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'company'
  ) THEN
    ALTER TABLE leads ALTER COLUMN company TYPE VARCHAR(500);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'name'
  ) THEN
    ALTER TABLE leads ALTER COLUMN name TYPE VARCHAR(500);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'title'
  ) THEN
    ALTER TABLE leads ALTER COLUMN title TYPE TEXT;
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN contacts.location IS 'Full address from Google Maps (expanded to TEXT for long addresses)';
COMMENT ON COLUMN contacts.company IS 'Company name (expanded to VARCHAR(500))';
COMMENT ON COLUMN contacts.name IS 'Contact name (expanded to VARCHAR(500))';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 076 completed: VARCHAR fields expanded to prevent length errors';
END $$;
