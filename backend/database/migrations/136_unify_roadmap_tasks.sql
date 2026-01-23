-- Migration 136: Unificar tarefas de roadmap com sistema de tarefas existente
-- Description: Ao invés de ter roadmap_execution_tasks separado,
--              usar opportunity_checklist_items para todas as tarefas
-- Benefício: Tarefas de roadmap aparecem na TasksPage automaticamente

BEGIN;

-- =====================================================
-- 1. Adicionar contact_id em opportunity_checklists
--    Permitir checklists sem oportunidade (direto no contato)
-- =====================================================
ALTER TABLE opportunity_checklists
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;

-- Tornar opportunity_id nullable (pode ter só contact_id)
ALTER TABLE opportunity_checklists
  ALTER COLUMN opportunity_id DROP NOT NULL;

-- Index para buscar checklists por contato
CREATE INDEX IF NOT EXISTS idx_opportunity_checklists_contact
  ON opportunity_checklists(contact_id) WHERE contact_id IS NOT NULL;

-- =====================================================
-- 2. Adicionar roadmap_execution_id em opportunity_checklist_items
--    Para vincular tarefas a uma execução de roadmap
-- =====================================================
ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS roadmap_execution_id UUID REFERENCES roadmap_executions(id) ON DELETE CASCADE;

-- Index para buscar tarefas por execução de roadmap
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_roadmap_exec
  ON opportunity_checklist_items(roadmap_execution_id) WHERE roadmap_execution_id IS NOT NULL;

-- =====================================================
-- 3. Adicionar title em opportunity_checklist_items
--    (se não existir - content será usado como fallback)
-- =====================================================
ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- =====================================================
-- 4. Adicionar task_type, priority, status se não existirem
-- =====================================================
ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'other';

ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';

ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- =====================================================
-- 5. Constraint: Checklist deve ter opportunity_id OU contact_id
-- =====================================================
ALTER TABLE opportunity_checklists
  DROP CONSTRAINT IF EXISTS chk_checklist_has_context;

ALTER TABLE opportunity_checklists
  ADD CONSTRAINT chk_checklist_has_context
  CHECK (opportunity_id IS NOT NULL OR contact_id IS NOT NULL);

-- =====================================================
-- 6. Trigger para atualizar completed_tasks no roadmap_executions
--    quando uma tarefa vinculada é marcada como concluída
-- =====================================================
CREATE OR REPLACE FUNCTION update_roadmap_execution_from_checklist_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a tarefa está vinculada a uma execução de roadmap
  IF NEW.roadmap_execution_id IS NOT NULL THEN
    UPDATE roadmap_executions
    SET
      completed_tasks = (
        SELECT COUNT(*)
        FROM opportunity_checklist_items
        WHERE roadmap_execution_id = NEW.roadmap_execution_id
        AND is_completed = true
      ),
      status = CASE
        WHEN (
          SELECT COUNT(*)
          FROM opportunity_checklist_items
          WHERE roadmap_execution_id = NEW.roadmap_execution_id
          AND is_completed = true
        ) = total_tasks THEN 'completed'
        ELSE status
      END,
      completed_at = CASE
        WHEN (
          SELECT COUNT(*)
          FROM opportunity_checklist_items
          WHERE roadmap_execution_id = NEW.roadmap_execution_id
          AND is_completed = true
        ) = total_tasks THEN CURRENT_TIMESTAMP
        ELSE completed_at
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.roadmap_execution_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_update_roadmap_exec_from_checklist ON opportunity_checklist_items;

-- Criar trigger
CREATE TRIGGER trigger_update_roadmap_exec_from_checklist
  AFTER UPDATE OF is_completed ON opportunity_checklist_items
  FOR EACH ROW
  WHEN (NEW.roadmap_execution_id IS NOT NULL)
  EXECUTE FUNCTION update_roadmap_execution_from_checklist_items();

-- =====================================================
-- 7. Comentários
-- =====================================================
COMMENT ON COLUMN opportunity_checklists.contact_id IS 'Contato associado (alternativa a opportunity_id para roadmaps sem oportunidade)';
COMMENT ON COLUMN opportunity_checklist_items.roadmap_execution_id IS 'Execução de roadmap que criou esta tarefa';
COMMENT ON COLUMN opportunity_checklist_items.title IS 'Título da tarefa (fallback: content)';

COMMIT;
