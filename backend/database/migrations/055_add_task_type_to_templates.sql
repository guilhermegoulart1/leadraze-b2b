-- Migration: 055_add_task_type_to_templates.sql
-- Description: Add task_type column to checklist_template_items

-- Add task_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_template_items' AND column_name = 'task_type') THEN
    ALTER TABLE checklist_template_items ADD COLUMN task_type VARCHAR(50) DEFAULT 'call';
  END IF;
END $$;

COMMENT ON COLUMN checklist_template_items.task_type IS 'Type of task: call, meeting, email, follow_up, proposal, other';
