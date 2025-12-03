-- Migration: 052_create_checklist_templates.sql
-- Description: Create checklist templates for automatic task creation on pipeline stage change
-- When a lead enters a stage, tasks are automatically created based on the template

-- Create checklist_templates table
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  pipeline_stage VARCHAR(50) NOT NULL,  -- leads, qualifying, scheduled, proposal, negotiation, won, lost
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE checklist_templates IS 'Templates for automatic task creation when leads change pipeline stage';
COMMENT ON COLUMN checklist_templates.pipeline_stage IS 'Pipeline stage that triggers this checklist: leads, qualifying, scheduled, proposal, negotiation, won, lost';
COMMENT ON COLUMN checklist_templates.is_active IS 'Whether this template is active and should create tasks';

-- Create checklist_template_items table
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_days INTEGER DEFAULT 0,  -- days after entering the stage (0 = same day)
  priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent
  position INTEGER DEFAULT 0,  -- display order
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comments
COMMENT ON TABLE checklist_template_items IS 'Individual items in a checklist template';
COMMENT ON COLUMN checklist_template_items.due_days IS 'Number of days after stage entry for the task due date (0 = same day)';
COMMENT ON COLUMN checklist_template_items.position IS 'Order of display within the template';

-- Create indexes for templates
CREATE INDEX IF NOT EXISTS idx_checklist_templates_account ON checklist_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_stage ON checklist_templates(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_active ON checklist_templates(account_id, pipeline_stage)
  WHERE is_active = true;

-- Create indexes for template items
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template ON checklist_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_position ON checklist_template_items(template_id, position);

-- Unique constraint: one active template per stage per account
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_templates_unique_active
  ON checklist_templates(account_id, pipeline_stage)
  WHERE is_active = true;
