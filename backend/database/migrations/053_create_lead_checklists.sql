-- Migration: 053_create_lead_checklists.sql
-- Description: Create checklists for leads (ClickUp-style quick checklists)

-- Create lead_checklists table (groups of items)
CREATE TABLE IF NOT EXISTS lead_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create checklist_items table (items within a checklist)
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES lead_checklists(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  task_type VARCHAR(50) DEFAULT 'call', -- call, meeting, email, follow_up, proposal, other
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments
COMMENT ON TABLE lead_checklists IS 'Checklists grouped by lead for quick task tracking';
COMMENT ON TABLE checklist_items IS 'Individual items within a checklist';

-- Indexes for lead_checklists
CREATE INDEX IF NOT EXISTS idx_lead_checklists_lead ON lead_checklists(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_checklists_account ON lead_checklists(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_checklists_position ON lead_checklists(lead_id, position);

-- Indexes for checklist_items
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_position ON checklist_items(checklist_id, position);
CREATE INDEX IF NOT EXISTS idx_checklist_items_assigned ON checklist_items(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checklist_items_completed ON checklist_items(checklist_id, is_completed);

-- Add task_type column if it doesn't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'task_type') THEN
    ALTER TABLE checklist_items ADD COLUMN task_type VARCHAR(50) DEFAULT 'call';
  END IF;
END $$;
