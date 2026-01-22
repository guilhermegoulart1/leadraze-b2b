-- Migration 131: Fix due_date column type from DATE to TIMESTAMP WITH TIME ZONE
-- This enables storing task times, not just dates

BEGIN;

-- Step 1: Add temporary column with correct type
ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS due_date_new TIMESTAMP WITH TIME ZONE;

-- Step 2: Migrate existing data (preserve the date, set time to midnight UTC)
UPDATE opportunity_checklist_items
SET due_date_new = due_date::TIMESTAMP WITH TIME ZONE
WHERE due_date IS NOT NULL;

-- Step 3: Drop old column
ALTER TABLE opportunity_checklist_items
  DROP COLUMN IF EXISTS due_date;

-- Step 4: Rename new column to due_date
ALTER TABLE opportunity_checklist_items
  RENAME COLUMN due_date_new TO due_date;

-- Step 5: Recreate index
DROP INDEX IF EXISTS idx_opp_checklist_items_due_date;
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_due_date
  ON opportunity_checklist_items(due_date);

-- Step 6: Recreate composite index for calendar queries
DROP INDEX IF EXISTS idx_opp_checklist_items_date_range;
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_date_range
  ON opportunity_checklist_items(due_date, end_date)
  WHERE due_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN opportunity_checklist_items.due_date IS
  'When the task is due (TIMESTAMP WITH TIME ZONE for time support)';

COMMIT;
