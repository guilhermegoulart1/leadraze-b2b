-- Migration 104: Corrigir dados da migração de leads
-- Atualiza location dos contatos e source das oportunidades

BEGIN;

-- =====================================================
-- PASSO 1: Atualizar location dos contatos com city/state do lead
-- =====================================================
UPDATE contacts c
SET location = CASE
    WHEN l.city IS NOT NULL AND l.state IS NOT NULL THEN l.city || ' - ' || l.state
    WHEN l.city IS NOT NULL THEN l.city
    WHEN l.state IS NOT NULL THEN l.state
    ELSE c.location
  END
FROM leads l
WHERE c.linkedin_profile_id = l.linkedin_profile_id
  AND c.linkedin_profile_id IS NOT NULL
  AND c.source = 'lead_migration'
  AND (c.location IS NULL OR c.location = '');

-- Contar contatos atualizados
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Contatos com location atualizado: %', v_updated;
END $$;

-- =====================================================
-- PASSO 2: Atualizar email dos contatos que não tem
-- =====================================================
UPDATE contacts c
SET email = l.email
FROM leads l
WHERE c.linkedin_profile_id = l.linkedin_profile_id
  AND c.linkedin_profile_id IS NOT NULL
  AND c.source = 'lead_migration'
  AND (c.email IS NULL OR c.email = '')
  AND l.email IS NOT NULL;

-- =====================================================
-- PASSO 3: Atualizar custom_fields das oportunidades com source original
-- =====================================================
UPDATE opportunities o
SET custom_fields = o.custom_fields || jsonb_build_object('original_source', l.source)
FROM leads l
WHERE o.source_lead_id = l.id
  AND o.source = 'lead_migration'
  AND l.source IS NOT NULL
  AND (o.custom_fields->>'original_source') IS NULL;

-- Contar oportunidades atualizadas
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Oportunidades com original_source atualizado: %', v_updated;
END $$;

-- =====================================================
-- PASSO 4: Atualizar owner_user_id das oportunidades (primeiro user da conta)
-- =====================================================
UPDATE opportunities o
SET owner_user_id = (
  SELECT u.id
  FROM users u
  WHERE u.account_id = o.account_id
  ORDER BY u.created_at
  LIMIT 1
)
WHERE o.source = 'lead_migration'
  AND o.owner_user_id IS NULL;

-- Contar oportunidades com owner atualizado
DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Oportunidades com owner_user_id atualizado: %', v_updated;
END $$;

-- =====================================================
-- PASSO 5: Relatório final
-- =====================================================
DO $$
DECLARE
  v_contacts_with_location INTEGER;
  v_contacts_with_email INTEGER;
  v_opps_with_source INTEGER;
  v_opps_with_owner INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_contacts_with_location
  FROM contacts
  WHERE source = 'lead_migration' AND location IS NOT NULL AND location != '';

  SELECT COUNT(*) INTO v_contacts_with_email
  FROM contacts
  WHERE source = 'lead_migration' AND email IS NOT NULL AND email != '';

  SELECT COUNT(*) INTO v_opps_with_source
  FROM opportunities
  WHERE source = 'lead_migration' AND (custom_fields->>'original_source') IS NOT NULL;

  SELECT COUNT(*) INTO v_opps_with_owner
  FROM opportunities
  WHERE source = 'lead_migration' AND owner_user_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORREÇÃO CONCLUÍDA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Contatos com location: %', v_contacts_with_location;
  RAISE NOTICE 'Contatos com email: %', v_contacts_with_email;
  RAISE NOTICE 'Oportunidades com source original: %', v_opps_with_source;
  RAISE NOTICE 'Oportunidades com owner: %', v_opps_with_owner;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
