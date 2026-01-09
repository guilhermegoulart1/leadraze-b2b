-- Migration: 114_extend_opportunity_checklist_items.sql
-- Description: Adicionar campos faltantes em opportunity_checklist_items para suportar o sistema de tasks
-- Date: 2025-01-08

BEGIN;

-- ============================================
-- 1. Adicionar campos faltantes
-- ============================================

-- Adicionar title (em vez de content para compatibilidade com tasks)
ALTER TABLE opportunity_checklist_items ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- Migrar content para title se title estiver vazio
UPDATE opportunity_checklist_items
SET title = content
WHERE title IS NULL AND content IS NOT NULL;

-- Adicionar description
ALTER TABLE opportunity_checklist_items ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar task_type
ALTER TABLE opportunity_checklist_items ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'call';

-- Adicionar status
ALTER TABLE opportunity_checklist_items ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Adicionar priority
ALTER TABLE opportunity_checklist_items ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';

-- ============================================
-- 2. Re-migrar dados de checklist_items que tenham esses campos
-- ============================================
UPDATE opportunity_checklist_items oci
SET
  title = COALESCE(ci.title, oci.content),
  description = ci.description,
  task_type = COALESCE(ci.task_type, 'call'),
  status = COALESCE(ci.status, CASE WHEN ci.is_completed THEN 'completed' ELSE 'pending' END),
  priority = COALESCE(ci.priority, 'medium')
FROM checklist_items ci
WHERE oci.id = ci.id;

-- ============================================
-- 3. Criar tabela opportunity_checklist_item_assignees
-- (migrar de checklist_item_assignees)
-- ============================================
CREATE TABLE IF NOT EXISTS opportunity_checklist_item_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES opportunity_checklist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(checklist_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_opp_checklist_item_assignees_item
  ON opportunity_checklist_item_assignees(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_opp_checklist_item_assignees_user
  ON opportunity_checklist_item_assignees(user_id);

-- ============================================
-- 4. Migrar dados de checklist_item_assignees
-- ============================================
INSERT INTO opportunity_checklist_item_assignees (checklist_item_id, user_id, assigned_by, assigned_at)
SELECT cia.checklist_item_id, cia.user_id, cia.assigned_by, cia.assigned_at
FROM checklist_item_assignees cia
WHERE EXISTS (
  SELECT 1 FROM opportunity_checklist_items oci WHERE oci.id = cia.checklist_item_id
)
AND NOT EXISTS (
  SELECT 1 FROM opportunity_checklist_item_assignees ocia
  WHERE ocia.checklist_item_id = cia.checklist_item_id AND ocia.user_id = cia.user_id
);

-- ============================================
-- 5. Indices adicionais
-- ============================================
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_task_type ON opportunity_checklist_items(task_type);
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_status ON opportunity_checklist_items(status);
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_due_date ON opportunity_checklist_items(due_date);
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_completed ON opportunity_checklist_items(is_completed);

COMMIT;
