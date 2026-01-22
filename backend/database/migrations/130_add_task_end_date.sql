-- Migration: Add end_date for multi-day task support (Gantt-style calendar)
-- This allows tasks to span multiple days in the calendar view

-- Add end_date column to opportunity_checklist_items
ALTER TABLE opportunity_checklist_items
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- Add index for calendar date range queries
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_end_date
  ON opportunity_checklist_items(end_date);

-- Add composite index for efficient calendar range queries
CREATE INDEX IF NOT EXISTS idx_opp_checklist_items_date_range
  ON opportunity_checklist_items(due_date, end_date)
  WHERE due_date IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN opportunity_checklist_items.end_date IS
  'End date/time for multi-day tasks. If NULL, task is single-point (shows only on due_date).';
