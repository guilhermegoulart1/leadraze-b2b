-- Migration: 113_update_notifications_to_opportunities.sql
-- Description: Migrar notifications de lead_id para opportunity_id
-- Date: 2025-01-08

-- ============================================
-- 1. Adicionar coluna opportunity_id
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'notifications' AND column_name = 'opportunity_id') THEN
    ALTER TABLE notifications ADD COLUMN opportunity_id UUID;
  END IF;
END $$;

-- ============================================
-- 2. Migrar dados de lead_id para opportunity_id
-- (leads foram migrados para opportunities com mesmo ID)
-- ============================================
UPDATE notifications
SET opportunity_id = lead_id
WHERE opportunity_id IS NULL AND lead_id IS NOT NULL;

-- ============================================
-- 3. Adicionar foreign key para opportunities
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_opportunity_id_fkey'
  ) THEN
    ALTER TABLE notifications
    ADD CONSTRAINT notifications_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 4. Remover foreign key de lead_id (se existir)
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_lead_id_fkey'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_lead_id_fkey;
  END IF;
END $$;

-- ============================================
-- 5. Remover coluna lead_id
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'notifications' AND column_name = 'lead_id') THEN
    ALTER TABLE notifications DROP COLUMN lead_id;
  END IF;
END $$;

-- ============================================
-- 6. Criar índice para opportunity_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_opportunity ON notifications(opportunity_id);
