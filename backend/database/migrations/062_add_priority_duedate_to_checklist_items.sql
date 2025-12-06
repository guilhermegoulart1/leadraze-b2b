-- Migration: 062_add_priority_duedate_to_checklist_items.sql
-- Description: Add priority and due_date fields to checklist_items table

-- Add priority column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'checklist_items' AND column_name = 'priority') THEN
    ALTER TABLE checklist_items ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
  END IF;
END $$;

-- Add due_date column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'checklist_items' AND column_name = 'due_date') THEN
    ALTER TABLE checklist_items ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN checklist_items.priority IS 'Task priority: low, medium, high, urgent';
COMMENT ON COLUMN checklist_items.due_date IS 'When the task is due';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_checklist_items_priority ON checklist_items(priority);
CREATE INDEX IF NOT EXISTS idx_checklist_items_due_date ON checklist_items(due_date) WHERE due_date IS NOT NULL;
