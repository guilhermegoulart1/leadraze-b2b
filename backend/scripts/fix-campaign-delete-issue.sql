-- Script para diagnosticar e corrigir o erro "missing FROM-clause entry for table c"
-- Execute com: psql -U postgres -d sua_database -f backend/scripts/fix-campaign-delete-issue.sql

\echo '===================================='
\echo 'DIAGNOSTIC: Campaign Delete Issue'
\echo '===================================='
\echo ''

-- 1. Verificar VIEWs que usam o alias 'c' para campaigns
\echo '1. Checking VIEWs that use alias "c"...'
\echo ''

SELECT
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%campaigns c%'
ORDER BY viewname;

\echo ''
\echo '2. Checking triggers on campaigns table...'
\echo ''

SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'campaigns'::regclass
  AND tgisinternal = false
ORDER BY tgname;

\echo ''
\echo '3. Checking triggers on related tables (leads, conversations, bulk_collection_jobs)...'
\echo ''

SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid IN ('leads'::regclass, 'conversations'::regclass, 'bulk_collection_jobs'::regclass)
  AND tgisinternal = false
ORDER BY tgrelid, tgname;

\echo ''
\echo '4. Checking foreign key constraints referencing campaigns...'
\echo ''

SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_name IN (
    SELECT constraint_name
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'campaigns'
  )
ORDER BY tc.table_name;

\echo ''
\echo '5. Checking CHECK constraints on related tables...'
\echo ''

SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('campaigns', 'leads', 'conversations', 'bulk_collection_jobs')
ORDER BY tc.table_name;

\echo ''
\echo '6. Testing a DELETE (will rollback)...'
\echo ''

DO $$
DECLARE
  test_campaign_id UUID;
BEGIN
  -- Get a campaign
  SELECT id INTO test_campaign_id
  FROM campaigns
  LIMIT 1;

  IF test_campaign_id IS NULL THEN
    RAISE NOTICE 'No campaigns found to test';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing DELETE for campaign: %', test_campaign_id;

  BEGIN
    -- Try to delete
    DELETE FROM campaigns WHERE id = test_campaign_id;

    -- If we get here, it worked
    RAISE NOTICE '✅ DELETE would succeed';

    -- Rollback
    RAISE EXCEPTION 'Rollback for safety';

  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM != 'Rollback for safety' THEN
      RAISE NOTICE '❌ DELETE FAILED with error: %', SQLERRM;
      RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
    ELSE
      RAISE NOTICE 'Test complete (rolled back)';
    END IF;
  END;
END$$;

\echo ''
\echo '===================================='
\echo 'POTENTIAL FIX:'
\echo ''
\echo 'If the issue is with the account_stats VIEW,'
\echo 'try recreating it with this command:'
\echo '===================================='
\echo ''

-- Potential fix: Recreate the account_stats VIEW
-- Commented out for safety - uncomment to apply
/*
DROP VIEW IF EXISTS account_stats CASCADE;

CREATE OR REPLACE VIEW account_stats AS
SELECT
  a.id as account_id,
  a.name as account_name,
  a.slug,
  a.plan,
  a.is_active,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT c.id) as total_campaigns,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT ct.id) as total_contacts,
  COUNT(DISTINCT cn.id) as total_conversations,
  a.created_at
FROM accounts a
LEFT JOIN users u ON u.account_id = a.id
LEFT JOIN campaigns c ON c.account_id = a.id
LEFT JOIN leads l ON l.account_id = a.id
LEFT JOIN contacts ct ON ct.account_id = a.id
LEFT JOIN conversations cn ON cn.account_id = a.id
GROUP BY a.id, a.name, a.slug, a.plan, a.is_active, a.created_at;
*/

\echo ''
\echo '✅ Diagnostic complete'
\echo ''
