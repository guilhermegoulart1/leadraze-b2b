-- =====================================================
-- Fix: Roadmap execution status should revert to 'in_progress'
-- when a task is unchecked (not all tasks completed)
-- =====================================================
-- Bug: When unchecking a task, the status stayed as 'completed'
-- because the trigger used "ELSE status" (keeping current status)
-- instead of reverting to 'in_progress'
-- =====================================================

CREATE OR REPLACE FUNCTION update_roadmap_execution_from_checklist_items()
RETURNS TRIGGER AS $$
DECLARE
  completed_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Se a tarefa está vinculada a uma execução de roadmap
  IF NEW.roadmap_execution_id IS NOT NULL THEN
    -- Count completed tasks
    SELECT COUNT(*) INTO completed_count
    FROM opportunity_checklist_items
    WHERE roadmap_execution_id = NEW.roadmap_execution_id
    AND is_completed = true;

    -- Get total tasks from the execution
    SELECT total_tasks INTO total_count
    FROM roadmap_executions
    WHERE id = NEW.roadmap_execution_id;

    -- Update execution with correct status
    UPDATE roadmap_executions
    SET
      completed_tasks = completed_count,
      status = CASE
        WHEN completed_count = total_count THEN 'completed'
        ELSE 'in_progress'  -- FIXED: Revert to in_progress when not all tasks are done
      END,
      completed_at = CASE
        WHEN completed_count = total_count THEN CURRENT_TIMESTAMP
        ELSE NULL  -- FIXED: Clear completed_at when reverting to in_progress
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.roadmap_execution_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also fix any existing roadmap_executions that have incorrect status
UPDATE roadmap_executions re
SET
  status = 'in_progress',
  completed_at = NULL
WHERE status = 'completed'
AND completed_tasks < total_tasks;
