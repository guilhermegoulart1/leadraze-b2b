-- Migration 110: Migrar leads para opportunities
-- Fase 2 do plano de migração LEADS -> OPPORTUNITIES
-- IMPORTANTE: Executar APÓS migrations 106-109

BEGIN;

-- =====================================================
-- PASSO 1: Criar pipeline "LinkedIn Campaigns" para accounts com campaigns
-- =====================================================
DO $$
DECLARE
  v_account RECORD;
  v_pipeline_id UUID;
  v_created_count INTEGER := 0;
BEGIN
  -- Para cada account que tem campaigns
  FOR v_account IN
    SELECT DISTINCT a.id as account_id
    FROM accounts a
    JOIN campaigns c ON c.account_id = a.id
    WHERE NOT EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.account_id = a.id
      AND p.name = 'Campanhas LinkedIn'
    )
  LOOP
    -- Criar pipeline para campanhas LinkedIn
    INSERT INTO pipelines (account_id, name, description, color, icon, is_default, is_active)
    VALUES (
      v_account.account_id,
      'Campanhas LinkedIn',
      'Pipeline para oportunidades de campanhas LinkedIn',
      'blue',
      'linkedin',
      false,  -- Não é default
      true
    )
    RETURNING id INTO v_pipeline_id;

    -- Criar etapas que correspondem aos status de leads
    INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_win_stage, is_loss_stage)
    VALUES
      (v_pipeline_id, 'Novos Leads', 'slate', 0, false, false),
      (v_pipeline_id, 'Convite Enviado', 'blue', 1, false, false),
      (v_pipeline_id, 'Aceito', 'cyan', 2, false, false),
      (v_pipeline_id, 'Qualificando', 'purple', 3, false, false),
      (v_pipeline_id, 'Qualificado', 'violet', 4, false, false),
      (v_pipeline_id, 'Agendado', 'amber', 5, false, false),
      (v_pipeline_id, 'Ganho', 'emerald', 6, true, false),
      (v_pipeline_id, 'Perdido', 'red', 7, false, true),
      (v_pipeline_id, 'Descartado', 'gray', 8, false, true);

    v_created_count := v_created_count + 1;
    RAISE NOTICE 'Pipeline LinkedIn criada para conta: %', v_account.account_id;
  END LOOP;

  RAISE NOTICE 'Total de pipelines LinkedIn criadas: %', v_created_count;
END $$;

-- =====================================================
-- PASSO 2: Migrar leads para opportunities
-- =====================================================
DO $$
DECLARE
  v_lead RECORD;
  v_contact_id UUID;
  v_opportunity_id UUID;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_migrated_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  -- Iterar sobre leads que ainda não foram migrados
  FOR v_lead IN
    SELECT l.*, c.id as existing_contact_id
    FROM leads l
    LEFT JOIN contact_leads cl ON cl.lead_id = l.id
    LEFT JOIN contacts c ON c.id = cl.contact_id
    WHERE NOT EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.source_lead_id = l.id
    )
    ORDER BY l.created_at
  LOOP
    BEGIN
      -- 1. Encontrar ou criar CONTACT
      IF v_lead.existing_contact_id IS NOT NULL THEN
        v_contact_id := v_lead.existing_contact_id;
      ELSE
        -- Tentar encontrar contato por linkedin_profile_id
        SELECT id INTO v_contact_id
        FROM contacts
        WHERE linkedin_profile_id = v_lead.linkedin_profile_id
          AND account_id = v_lead.account_id
        LIMIT 1;

        -- Se não encontrou, criar novo contato
        IF v_contact_id IS NULL THEN
          INSERT INTO contacts (
            account_id, sector_id, user_id,
            name, company, title, location,
            profile_picture, linkedin_profile_id,
            headline, industry, city, state, country,
            source, created_at
          )
          VALUES (
            v_lead.account_id, v_lead.sector_id, v_lead.responsible_user_id,
            v_lead.name, v_lead.company, v_lead.title, v_lead.location,
            v_lead.profile_picture, v_lead.linkedin_profile_id,
            v_lead.headline, v_lead.industry, v_lead.city, v_lead.state, v_lead.country,
            'lead_migration', v_lead.created_at
          )
          RETURNING id INTO v_contact_id;
        END IF;
      END IF;

      -- 2. Encontrar pipeline e stage
      -- Se tem campaign_id, usar pipeline "Campanhas LinkedIn"
      IF v_lead.campaign_id IS NOT NULL THEN
        SELECT p.id INTO v_pipeline_id
        FROM pipelines p
        WHERE p.account_id = v_lead.account_id
          AND p.name = 'Campanhas LinkedIn'
        LIMIT 1;
      END IF;

      -- Se não encontrou pipeline de campanha, usar pipeline default
      IF v_pipeline_id IS NULL THEN
        SELECT p.id INTO v_pipeline_id
        FROM pipelines p
        WHERE p.account_id = v_lead.account_id
          AND p.is_default = true
        LIMIT 1;
      END IF;

      -- Se ainda não tem pipeline, pular este lead
      IF v_pipeline_id IS NULL THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- Mapear status do lead para stage
      SELECT ps.id INTO v_stage_id
      FROM pipeline_stages ps
      WHERE ps.pipeline_id = v_pipeline_id
        AND (
          (v_lead.status IN ('leads', 'lead') AND ps.position = 0)
          OR (v_lead.status = 'invite_sent' AND ps.name ILIKE '%convite%')
          OR (v_lead.status = 'accepted' AND ps.name ILIKE '%aceito%')
          OR (v_lead.status = 'qualifying' AND ps.name ILIKE '%qualificando%')
          OR (v_lead.status = 'qualified' AND ps.name ILIKE '%qualificado%')
          OR (v_lead.status = 'scheduled' AND ps.name ILIKE '%agendado%')
          OR (v_lead.status = 'won' AND ps.is_win_stage = true)
          OR (v_lead.status = 'lost' AND ps.is_loss_stage = true AND ps.name ILIKE '%perdido%')
          OR (v_lead.status = 'discarded' AND ps.name ILIKE '%descartado%')
        )
      ORDER BY ps.position
      LIMIT 1;

      -- Fallback para primeira etapa
      IF v_stage_id IS NULL THEN
        SELECT ps.id INTO v_stage_id
        FROM pipeline_stages ps
        WHERE ps.pipeline_id = v_pipeline_id
        ORDER BY ps.position
        LIMIT 1;
      END IF;

      -- 3. Criar OPPORTUNITY
      INSERT INTO opportunities (
        account_id, contact_id, pipeline_id, stage_id,
        campaign_id, sector_id,
        title, value, currency, probability,
        expected_close_date, won_at, lost_at,
        loss_reason_id, loss_notes,
        owner_user_id, source_lead_id, source,
        sent_at, accepted_at, qualifying_started_at, qualified_at, scheduled_at,
        invite_queued_at, invite_expires_at, invite_expired_at,
        company_size, budget, timeline,
        discard_reason_id, discard_notes, discarded_at, previous_status,
        score, notes, closure_notes,
        linkedin_profile_id, provider_id,
        custom_fields, created_at, updated_at
      )
      VALUES (
        v_lead.account_id,
        v_contact_id,
        v_pipeline_id,
        v_stage_id,
        v_lead.campaign_id,
        v_lead.sector_id,
        COALESCE(v_lead.name, 'Oportunidade') || CASE WHEN v_lead.company IS NOT NULL THEN ' - ' || v_lead.company ELSE '' END,
        COALESCE(v_lead.deal_value, 0),
        COALESCE(v_lead.deal_currency, 'BRL'),
        CASE v_lead.status
          WHEN 'won' THEN 100
          WHEN 'qualified' THEN 80
          WHEN 'scheduled' THEN 70
          WHEN 'qualifying' THEN 50
          WHEN 'accepted' THEN 30
          WHEN 'invite_sent' THEN 15
          ELSE 10
        END,
        v_lead.expected_close_date,
        v_lead.won_at,
        v_lead.lost_at,
        v_lead.discard_reason_id,  -- loss_reason_id = discard_reason_id
        v_lead.discard_notes,  -- loss_notes = discard_notes
        v_lead.responsible_user_id,
        v_lead.id,  -- source_lead_id
        COALESCE(v_lead.source, 'linkedin'),
        v_lead.sent_at,
        v_lead.accepted_at,
        v_lead.qualifying_started_at,
        v_lead.qualified_at,
        v_lead.scheduled_at,
        v_lead.invite_queued_at,
        v_lead.invite_expires_at,
        v_lead.invite_expired_at,
        v_lead.company_size,
        v_lead.budget,
        v_lead.timeline,
        v_lead.discard_reason_id,
        v_lead.discard_notes,
        v_lead.discarded_at,
        v_lead.previous_status,
        COALESCE(v_lead.score, 0),
        v_lead.notes,
        v_lead.closure_notes,
        v_lead.linkedin_profile_id,
        v_lead.provider_id,
        COALESCE(v_lead.custom_fields, '{}'),
        v_lead.created_at,
        NOW()
      )
      RETURNING id INTO v_opportunity_id;

      v_migrated_count := v_migrated_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other leads
      RAISE WARNING 'Erro ao migrar lead %: %', v_lead.id, SQLERRM;
      v_skipped_count := v_skipped_count + 1;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO DE LEADS CONCLUÍDA';
  RAISE NOTICE 'Leads migrados: %', v_migrated_count;
  RAISE NOTICE 'Leads ignorados: %', v_skipped_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASSO 3: Migrar lead_comments para opportunity_comments
-- =====================================================
INSERT INTO opportunity_comments (id, opportunity_id, user_id, account_id, content, mentions, attachments, created_at, updated_at, deleted_at)
SELECT
  lc.id,
  o.id as opportunity_id,
  lc.user_id,
  lc.account_id,
  lc.content,
  lc.mentions,
  lc.attachments,
  lc.created_at,
  lc.updated_at,
  lc.deleted_at
FROM lead_comments lc
JOIN opportunities o ON o.source_lead_id = lc.lead_id
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_comments oc WHERE oc.id = lc.id
);

-- =====================================================
-- PASSO 4: Migrar lead_checklists para opportunity_checklists
-- =====================================================
INSERT INTO opportunity_checklists (id, account_id, opportunity_id, name, position, created_by, created_at, updated_at)
SELECT
  lc.id,
  lc.account_id,
  o.id as opportunity_id,
  lc.name,
  lc.position,
  lc.created_by,
  lc.created_at,
  lc.updated_at
FROM lead_checklists lc
JOIN opportunities o ON o.source_lead_id = lc.lead_id
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_checklists oc WHERE oc.id = lc.id
);

-- =====================================================
-- PASSO 5: Migrar checklist_items para opportunity_checklist_items
-- =====================================================
INSERT INTO opportunity_checklist_items (id, checklist_id, content, is_completed, completed_by, completed_at, position, due_date, assigned_to, created_at, updated_at)
SELECT
  ci.id,
  ci.checklist_id,
  ci.content,
  ci.is_completed,
  ci.completed_by,
  ci.completed_at,
  ci.position,
  ci.due_date,
  ci.assigned_to,
  ci.created_at,
  ci.updated_at
FROM checklist_items ci
JOIN opportunity_checklists oc ON oc.id = ci.checklist_id
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_checklist_items oci WHERE oci.id = ci.id
);

-- =====================================================
-- PASSO 6: Migrar lead_products para opportunity_products
-- =====================================================
INSERT INTO opportunity_products (id, opportunity_id, product_id, quantity, unit_price, total_price, payment_conditions, notes, created_at)
SELECT
  lp.id,
  o.id as opportunity_id,
  lp.product_id,
  lp.quantity,
  lp.unit_price,
  lp.total_price,
  lp.payment_conditions,
  lp.notes,
  lp.created_at
FROM lead_products lp
JOIN opportunities o ON o.source_lead_id = lp.lead_id
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_products op WHERE op.id = lp.id
);

-- =====================================================
-- PASSO 7: Atualizar conversations para usar opportunity_id
-- =====================================================
UPDATE conversations c
SET opportunity_id = o.id
FROM opportunities o
WHERE o.source_lead_id = c.lead_id
  AND c.lead_id IS NOT NULL
  AND c.opportunity_id IS NULL;

-- =====================================================
-- PASSO 8: Atualizar tasks para usar opportunity_id
-- =====================================================
UPDATE tasks t
SET opportunity_id = o.id
FROM opportunities o
WHERE o.source_lead_id = t.lead_id
  AND t.lead_id IS NOT NULL
  AND t.opportunity_id IS NULL;

-- =====================================================
-- PASSO 9: Atualizar notifications para usar opportunity_id
-- =====================================================
UPDATE notifications n
SET opportunity_id = o.id
FROM opportunities o
WHERE o.source_lead_id = n.lead_id
  AND n.lead_id IS NOT NULL
  AND n.opportunity_id IS NULL;

-- =====================================================
-- PASSO 10: Relatório final
-- =====================================================
DO $$
DECLARE
  v_total_leads INTEGER;
  v_migrated_opportunities INTEGER;
  v_migrated_comments INTEGER;
  v_migrated_checklists INTEGER;
  v_migrated_products INTEGER;
  v_updated_conversations INTEGER;
  v_updated_tasks INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_leads FROM leads;
  SELECT COUNT(*) INTO v_migrated_opportunities FROM opportunities WHERE source_lead_id IS NOT NULL;
  SELECT COUNT(*) INTO v_migrated_comments FROM opportunity_comments;
  SELECT COUNT(*) INTO v_migrated_checklists FROM opportunity_checklists;
  SELECT COUNT(*) INTO v_migrated_products FROM opportunity_products;
  SELECT COUNT(*) INTO v_updated_conversations FROM conversations WHERE opportunity_id IS NOT NULL;
  SELECT COUNT(*) INTO v_updated_tasks FROM tasks WHERE opportunity_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RELATÓRIO FINAL DE MIGRAÇÃO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de leads na base: %', v_total_leads;
  RAISE NOTICE 'Opportunities criadas: %', v_migrated_opportunities;
  RAISE NOTICE 'Comentários migrados: %', v_migrated_comments;
  RAISE NOTICE 'Checklists migrados: %', v_migrated_checklists;
  RAISE NOTICE 'Produtos migrados: %', v_migrated_products;
  RAISE NOTICE 'Conversas atualizadas: %', v_updated_conversations;
  RAISE NOTICE 'Tasks atualizadas: %', v_updated_tasks;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
