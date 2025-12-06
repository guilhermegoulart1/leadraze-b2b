-- Migration: 063_add_description_to_checklist_items.sql
-- Description: Add description field to checklist_items table

-- Add description column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'checklist_items' AND column_name = 'description') THEN
    ALTER TABLE checklist_items ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN checklist_items.description IS 'Detailed description of the task';
