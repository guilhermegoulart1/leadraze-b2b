-- Migration: 111_update_campaign_invite_queue_to_opportunities.sql
-- Description: Migrar campaign_invite_queue de lead_id para opportunity_id
-- Date: 2025-01-08

-- ============================================
-- 1. Adicionar coluna opportunity_id
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'campaign_invite_queue' AND column_name = 'opportunity_id') THEN
    ALTER TABLE campaign_invite_queue ADD COLUMN opportunity_id UUID;
  END IF;
END $$;

-- ============================================
-- 2. Migrar dados de lead_id para opportunity_id
-- Como as opportunities foram criadas com os mesmos IDs dos leads,
-- simplesmente copiamos os valores
-- ============================================
UPDATE campaign_invite_queue
SET opportunity_id = lead_id
WHERE opportunity_id IS NULL AND lead_id IS NOT NULL;

-- ============================================
-- 3. Adicionar foreign key para opportunities
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'campaign_invite_queue_opportunity_id_fkey'
  ) THEN
    ALTER TABLE campaign_invite_queue
    ADD CONSTRAINT campaign_invite_queue_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 4. Remover foreign key de lead_id
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'campaign_invite_queue_lead_id_fkey'
  ) THEN
    ALTER TABLE campaign_invite_queue DROP CONSTRAINT campaign_invite_queue_lead_id_fkey;
  END IF;
END $$;

-- ============================================
-- 5. Remover coluna lead_id
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'campaign_invite_queue' AND column_name = 'lead_id') THEN
    ALTER TABLE campaign_invite_queue DROP COLUMN lead_id;
  END IF;
END $$;

-- ============================================
-- 6. Criar índice para opportunity_id
-- ============================================
DROP INDEX IF EXISTS idx_invite_queue_lead;
CREATE INDEX IF NOT EXISTS idx_invite_queue_opportunity ON campaign_invite_queue(opportunity_id);

-- ============================================
-- 7. Atualizar comentários
-- ============================================
COMMENT ON TABLE campaign_invite_queue IS 'Fila de convites pendentes para campanhas de LinkedIn (vinculada a opportunities)';
