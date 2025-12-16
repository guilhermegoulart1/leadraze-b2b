-- Migration 085: Add status field to checklist_items
-- This allows tasks to have pending, in_progress, and completed status

ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Migrate existing data based on is_completed
UPDATE checklist_items SET status = 'completed' WHERE is_completed = true AND (status IS NULL OR status = 'pending');
UPDATE checklist_items SET status = 'pending' WHERE (is_completed = false OR is_completed IS NULL) AND status IS NULL;

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_checklist_items_status ON checklist_items(status);

COMMENT ON COLUMN checklist_items.status IS 'Task status: pending, in_progress, completed';
