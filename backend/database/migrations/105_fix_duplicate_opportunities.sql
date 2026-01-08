-- Migration 105: Remover oportunidades duplicadas
-- Remove duplicatas mantendo apenas a primeira opportunity por source_lead_id

BEGIN;

-- =====================================================
-- PASSO 1: Identificar e deletar duplicatas
-- Mantém apenas a opportunity mais antiga (menor created_at) por source_lead_id
-- =====================================================

-- Contar duplicatas antes
DO $$
DECLARE
  v_total_opps INTEGER;
  v_unique_leads INTEGER;
  v_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_opps
  FROM opportunities
  WHERE source = 'lead_migration';

  SELECT COUNT(DISTINCT source_lead_id) INTO v_unique_leads
  FROM opportunities
  WHERE source = 'lead_migration' AND source_lead_id IS NOT NULL;

  v_duplicates := v_total_opps - v_unique_leads;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ANTES DA LIMPEZA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de oportunidades migradas: %', v_total_opps;
  RAISE NOTICE 'Leads únicos: %', v_unique_leads;
  RAISE NOTICE 'Duplicatas a remover: %', v_duplicates;
  RAISE NOTICE '========================================';
END $$;

-- Deletar duplicatas (manter a mais antiga por source_lead_id)
DELETE FROM opportunities
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY source_lead_id
        ORDER BY created_at ASC, id ASC
      ) as rn
    FROM opportunities
    WHERE source = 'lead_migration'
      AND source_lead_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Contar após limpeza
DO $$
DECLARE
  v_total_opps INTEGER;
  v_deleted INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT COUNT(*) INTO v_total_opps
  FROM opportunities
  WHERE source = 'lead_migration';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'LIMPEZA CONCLUÍDA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Oportunidades removidas: %', v_deleted;
  RAISE NOTICE 'Total de oportunidades restantes: %', v_total_opps;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASSO 2: Identificar e deletar contatos duplicados
-- Mantém apenas o contato mais antigo por linkedin_profile_id + account_id
-- =====================================================

-- Contar contatos duplicados antes
DO $$
DECLARE
  v_total_contacts INTEGER;
  v_unique_profiles INTEGER;
  v_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_contacts
  FROM contacts
  WHERE source = 'lead_migration';

  SELECT COUNT(*) INTO v_unique_profiles
  FROM (
    SELECT DISTINCT linkedin_profile_id, account_id
    FROM contacts
    WHERE source = 'lead_migration' AND linkedin_profile_id IS NOT NULL
  ) sub;

  v_duplicates := v_total_contacts - v_unique_profiles;

  IF v_duplicates > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'CONTATOS DUPLICADOS: %', v_duplicates;
  END IF;
END $$;

-- Primeiro, atualizar opportunities para apontar para o contato que será mantido
UPDATE opportunities o
SET contact_id = (
  SELECT c2.id
  FROM contacts c2
  WHERE c2.linkedin_profile_id = (
    SELECT c3.linkedin_profile_id FROM contacts c3 WHERE c3.id = o.contact_id
  )
  AND c2.account_id = o.account_id
  AND c2.linkedin_profile_id IS NOT NULL
  ORDER BY c2.created_at ASC, c2.id ASC
  LIMIT 1
)
WHERE o.source = 'lead_migration'
AND EXISTS (
  SELECT 1 FROM contacts c
  WHERE c.id = o.contact_id
  AND c.linkedin_profile_id IS NOT NULL
);

-- Deletar contatos duplicados (manter o mais antigo por linkedin_profile_id + account_id)
DELETE FROM contacts
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY linkedin_profile_id, account_id
        ORDER BY created_at ASC, id ASC
      ) as rn
    FROM contacts
    WHERE source = 'lead_migration'
      AND linkedin_profile_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- =====================================================
-- PASSO 3: Verificar contagem por stage
-- =====================================================
DO $$
DECLARE
  rec RECORD;
  v_total INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'OPORTUNIDADES POR ETAPA:';

  SELECT SUM(count) INTO v_total
  FROM (
    SELECT COUNT(o.id) as count
    FROM pipeline_stages ps
    LEFT JOIN opportunities o ON o.stage_id = ps.id
    WHERE ps.pipeline_id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d'
    GROUP BY ps.id
  ) sub;

  FOR rec IN
    SELECT ps.name, COUNT(o.id) as count
    FROM pipeline_stages ps
    LEFT JOIN opportunities o ON o.stage_id = ps.id
    WHERE ps.pipeline_id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d'
    GROUP BY ps.id, ps.name, ps.position
    ORDER BY ps.position
  LOOP
    RAISE NOTICE '  %: %', rec.name, rec.count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'TOTAL DE OPORTUNIDADES: %', v_total;
END $$;

COMMIT;
