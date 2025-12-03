-- Migration: 054_checklist_items_multiple_assignees.sql
-- Description: Add due_date to checklist_items and create junction table for multiple assignees

-- Add due_date column to checklist_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'due_date') THEN
    ALTER TABLE checklist_items ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create junction table for multiple assignees
CREATE TABLE IF NOT EXISTS checklist_item_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(checklist_item_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checklist_item_assignees_item ON checklist_item_assignees(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_assignees_user ON checklist_item_assignees(user_id);

-- Migrate existing assigned_to data to new junction table
INSERT INTO checklist_item_assignees (checklist_item_id, user_id)
SELECT id, assigned_to FROM checklist_items
WHERE assigned_to IS NOT NULL
ON CONFLICT (checklist_item_id, user_id) DO NOTHING;

-- Add index for due_date queries
CREATE INDEX IF NOT EXISTS idx_checklist_items_due_date ON checklist_items(due_date) WHERE due_date IS NOT NULL;

COMMENT ON TABLE checklist_item_assignees IS 'Junction table for multiple assignees per checklist item';
