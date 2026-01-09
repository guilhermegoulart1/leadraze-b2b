-- Migration: 112_update_linkedin_invite_logs_to_opportunities.sql
-- Description: Migrar linkedin_invite_logs de lead_id para opportunity_id
-- Date: 2025-01-08

-- ============================================
-- 1. Adicionar coluna opportunity_id
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'linkedin_invite_logs' AND column_name = 'opportunity_id') THEN
    ALTER TABLE linkedin_invite_logs ADD COLUMN opportunity_id UUID;
  END IF;
END $$;

-- ============================================
-- 2. Migrar dados de lead_id para opportunity_id
-- (leads foram migrados para opportunities com mesmo ID)
-- ============================================
UPDATE linkedin_invite_logs
SET opportunity_id = lead_id
WHERE opportunity_id IS NULL AND lead_id IS NOT NULL;

-- ============================================
-- 3. Adicionar foreign key para opportunities
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'linkedin_invite_logs_opportunity_id_fkey'
  ) THEN
    ALTER TABLE linkedin_invite_logs
    ADD CONSTRAINT linkedin_invite_logs_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 4. Remover foreign key de lead_id (se existir)
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'linkedin_invite_logs_lead_id_fkey'
  ) THEN
    ALTER TABLE linkedin_invite_logs DROP CONSTRAINT linkedin_invite_logs_lead_id_fkey;
  END IF;
END $$;

-- ============================================
-- 5. Remover coluna lead_id
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'linkedin_invite_logs' AND column_name = 'lead_id') THEN
    ALTER TABLE linkedin_invite_logs DROP COLUMN lead_id;
  END IF;
END $$;

-- ============================================
-- 6. Criar índice para opportunity_id
-- ============================================
DROP INDEX IF EXISTS idx_invite_logs_lead;
CREATE INDEX IF NOT EXISTS idx_invite_logs_opportunity ON linkedin_invite_logs(opportunity_id);
