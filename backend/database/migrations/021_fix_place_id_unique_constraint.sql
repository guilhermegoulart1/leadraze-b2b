-- Migration 021: Fix duplicate UNIQUE constraints on place_id
-- Problem: Migration 017 added "place_id UNIQUE" and Migration 020 tried to add "UNIQUE (account_id, place_id)"
-- This creates a conflict and can cause SQL errors
-- Date: 2025-01-23

BEGIN;

-- Drop the old single-column UNIQUE constraint on place_id (from migration 017)
-- This constraint is too restrictive - same place_id should be allowed across different accounts
ALTER TABLE contacts
DROP CONSTRAINT IF EXISTS contacts_place_id_key;

-- Make sure the composite UNIQUE constraint exists (from migration 020)
-- This is the correct constraint: unique place_id per account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'unique_place_id_per_account'
      AND table_name = 'contacts'
  ) THEN
    ALTER TABLE contacts
    ADD CONSTRAINT unique_place_id_per_account UNIQUE (account_id, place_id);
  END IF;
END$$;

-- Verify the fix
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_name = 'contacts'
    AND constraint_type = 'UNIQUE'
    AND (constraint_name LIKE '%place_id%');

  RAISE NOTICE '✅ Migration 021 completed: place_id UNIQUE constraint fixed';
  RAISE NOTICE '   Found % UNIQUE constraints on place_id columns', constraint_count;
  RAISE NOTICE '   Expected: 1 constraint (unique_place_id_per_account)';
END$$;

COMMIT;
