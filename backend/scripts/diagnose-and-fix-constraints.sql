-- Diagnostic and fix script for google_maps_agents delete issue
-- Run this with: psql -U postgres -d your_database -f diagnose-and-fix-constraints.sql

\echo '================================'
\echo 'DIAGNOSTIC: google_maps_agents constraints'
\echo '================================'
\echo ''

\echo '1. Checking UNIQUE constraints on contacts.place_id:'
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'contacts'
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%place_id%';

\echo ''
\echo '2. Checking all constraints on contacts table:'
SELECT
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'contacts'
  AND (tc.constraint_name LIKE '%place_id%' OR tc.constraint_type = 'UNIQUE')
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

\echo ''
\echo '3. Checking triggers on google_maps_agents:'
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgtype AS trigger_type,
  tgenabled AS trigger_enabled
FROM pg_trigger
WHERE tgrelid = 'google_maps_agents'::regclass
  AND tgisinternal = false;

\echo ''
\echo '4. Checking foreign keys from google_maps_agent_contacts:'
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'google_maps_agent_contacts';

\echo ''
\echo '================================'
\echo 'APPLYING FIX'
\echo '================================'
\echo ''

BEGIN;

\echo 'Step 1: Dropping duplicate UNIQUE constraint on contacts.place_id (if exists)...'
ALTER TABLE contacts
DROP CONSTRAINT IF EXISTS contacts_place_id_key CASCADE;

\echo 'Step 2: Ensuring composite UNIQUE constraint exists...'
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
    RAISE NOTICE 'Created unique_place_id_per_account constraint';
  ELSE
    RAISE NOTICE 'unique_place_id_per_account constraint already exists';
  END IF;
END$$;

COMMIT;

\echo ''
\echo '================================'
\echo 'VERIFICATION'
\echo '================================'
\echo ''

\echo 'Final check - UNIQUE constraints on contacts.place_id:'
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'contacts'
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%place_id%';

\echo ''
\echo '✅ Done! Try deleting the agent again.'
\echo ''
