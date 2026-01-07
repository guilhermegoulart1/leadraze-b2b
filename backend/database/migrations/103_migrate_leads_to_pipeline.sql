-- Migration 103: Migrar leads para pipeline de oportunidades
-- Pipeline alvo: a1e77e4f-e9eb-47bf-b353-260db81af38d

BEGIN;

-- =====================================================
-- PASSO 1: Verificar e obter informações da pipeline alvo
-- =====================================================
DO $$
DECLARE
  v_pipeline_id UUID := 'a1e77e4f-e9eb-47bf-b353-260db81af38d';
  v_account_id UUID;
  v_first_stage_id UUID;
  v_stage_count INTEGER;
BEGIN
  -- Verificar se a pipeline existe e obter account_id
  SELECT account_id INTO v_account_id
  FROM pipelines
  WHERE id = v_pipeline_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline % não encontrada', v_pipeline_id;
  END IF;

  -- Contar etapas
  SELECT COUNT(*) INTO v_stage_count
  FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id;

  -- Obter primeira etapa
  SELECT id INTO v_first_stage_id
  FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY position
  LIMIT 1;

  IF v_stage_count = 0 THEN
    RAISE EXCEPTION 'Pipeline % não possui etapas', v_pipeline_id;
  END IF;

  RAISE NOTICE 'Pipeline encontrada. Account ID: %, Primeira etapa: %, Total etapas: %',
    v_account_id, v_first_stage_id, v_stage_count;
END $$;

-- =====================================================
-- PASSO 2: Criar contatos a partir dos leads (se não existirem)
-- =====================================================
INSERT INTO contacts (
  id,
  account_id,
  user_id,
  name,
  first_name,
  last_name,
  company,
  title,
  location,
  profile_url,
  profile_picture,
  linkedin_profile_id,
  headline,
  industry,
  connections_count,
  source,
  notes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.account_id,
  p.user_id,
  l.name,
  SPLIT_PART(l.name, ' ', 1),
  CASE
    WHEN POSITION(' ' IN l.name) > 0 THEN SUBSTRING(l.name FROM POSITION(' ' IN l.name) + 1)
    ELSE NULL
  END,
  l.company,
  l.title,
  l.location,
  l.profile_url,
  l.profile_picture,
  l.linkedin_profile_id,
  l.headline,
  l.industry,
  l.connections,
  'lead_migration',
  'Migrado de lead ID: ' || l.id::TEXT,
  l.created_at,
  NOW()
FROM leads l
CROSS JOIN (
  SELECT
    pl.account_id,
    (SELECT u.id FROM users u WHERE u.account_id = pl.account_id ORDER BY u.created_at LIMIT 1) AS user_id
  FROM pipelines pl
  WHERE pl.id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d'
) p
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c
  WHERE c.linkedin_profile_id = l.linkedin_profile_id
    AND c.account_id = p.account_id
    AND l.linkedin_profile_id IS NOT NULL
)
AND l.linkedin_profile_id IS NOT NULL;

-- Contar contatos criados
DO $$
DECLARE
  v_created INTEGER;
BEGIN
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RAISE NOTICE 'Contatos criados: %', v_created;
END $$;

-- =====================================================
-- PASSO 3: Criar oportunidades a partir dos leads
-- =====================================================
INSERT INTO opportunities (
  id,
  account_id,
  contact_id,
  pipeline_id,
  stage_id,
  title,
  value,
  currency,
  probability,
  expected_close_date,
  won_at,
  lost_at,
  loss_notes,
  source_lead_id,
  source,
  custom_fields,
  display_order,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.account_id,
  c.id AS contact_id,
  'a1e77e4f-e9eb-47bf-b353-260db81af38d'::UUID AS pipeline_id,
  -- Mapear status do lead para stage_id
  COALESCE(
    (SELECT ps.id FROM pipeline_stages ps
     WHERE ps.pipeline_id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d'
     AND (
       (l.status = 'lead' AND ps.position = 0)
       OR (l.status = 'invite_sent' AND ps.position = 1)
       OR (l.status = 'qualifying' AND ps.position = 2)
       OR (l.status = 'scheduled' AND ps.position = 3)
       OR (l.status = 'won' AND ps.is_win_stage = true)
       OR (l.status = 'lost' AND ps.is_loss_stage = true)
     )
     ORDER BY
       CASE WHEN l.status = 'won' AND ps.is_win_stage THEN 0
            WHEN l.status = 'lost' AND ps.is_loss_stage THEN 0
            ELSE 1 END,
       ps.position
     LIMIT 1
    ),
    -- Fallback para primeira etapa se não encontrar mapeamento
    (SELECT ps.id FROM pipeline_stages ps
     WHERE ps.pipeline_id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d'
     ORDER BY ps.position LIMIT 1)
  ) AS stage_id,
  -- Título: nome do lead + empresa
  CASE
    WHEN l.company IS NOT NULL AND l.company != ''
    THEN l.name || ' - ' || l.company
    ELSE l.name
  END AS title,
  0 AS value,
  'BRL' AS currency,
  CASE l.status
    WHEN 'won' THEN 100
    WHEN 'lost' THEN 0
    WHEN 'scheduled' THEN 75
    WHEN 'qualifying' THEN 50
    WHEN 'invite_sent' THEN 25
    ELSE 10
  END AS probability,
  NULL AS expected_close_date,
  l.won_at,
  l.lost_at,
  l.lost_reason AS loss_notes,
  l.id AS source_lead_id,
  'lead_migration' AS source,
  jsonb_build_object(
    'original_status', l.status,
    'score', l.score,
    'notes', l.notes,
    'campaign_id', l.campaign_id,
    'sent_at', l.sent_at,
    'accepted_at', l.accepted_at,
    'qualifying_started_at', l.qualifying_started_at,
    'qualified_at', l.qualified_at,
    'scheduled_at', l.scheduled_at
  ) AS custom_fields,
  ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY l.created_at) AS display_order,
  l.created_at,
  NOW()
FROM leads l
CROSS JOIN (
  SELECT account_id FROM pipelines WHERE id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d'
) p
INNER JOIN contacts c ON c.linkedin_profile_id = l.linkedin_profile_id AND c.account_id = p.account_id
WHERE l.linkedin_profile_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM opportunities o
  WHERE o.source_lead_id = l.id
);

-- Contar oportunidades criadas
DO $$
DECLARE
  v_created INTEGER;
BEGIN
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RAISE NOTICE 'Oportunidades criadas: %', v_created;
END $$;

-- =====================================================
-- PASSO 4: Relatório final
-- =====================================================
DO $$
DECLARE
  v_total_leads INTEGER;
  v_total_contacts INTEGER;
  v_total_opportunities INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_leads FROM leads;

  SELECT COUNT(*) INTO v_total_contacts
  FROM contacts
  WHERE account_id = (SELECT account_id FROM pipelines WHERE id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d');

  SELECT COUNT(*) INTO v_total_opportunities
  FROM opportunities
  WHERE pipeline_id = 'a1e77e4f-e9eb-47bf-b353-260db81af38d';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de leads na base: %', v_total_leads;
  RAISE NOTICE 'Total de contatos na conta: %', v_total_contacts;
  RAISE NOTICE 'Total de oportunidades na pipeline: %', v_total_opportunities;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
