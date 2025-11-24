-- Migration 022: Fix contacts_check constraint to allow Google Maps contacts
-- Problem: Constraint requires email, phone, or linkedin_profile_id
-- But Google Maps contacts may only have place_id
-- Date: 2025-01-23

BEGIN;

-- Drop the old constraint
ALTER TABLE contacts
DROP CONSTRAINT IF EXISTS contacts_check;

-- Add new constraint that includes place_id as a valid identifier
ALTER TABLE contacts
ADD CONSTRAINT contacts_check CHECK (
  email IS NOT NULL
  OR phone IS NOT NULL
  OR linkedin_profile_id IS NOT NULL
  OR place_id IS NOT NULL
);

-- Verify
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 022 completed: contacts_check constraint updated';
  RAISE NOTICE '   Now allows contacts with: email, phone, linkedin_profile_id, OR place_id';
END$$;

COMMIT;
