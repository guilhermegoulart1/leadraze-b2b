-- Migration: 098_create_folders.sql
-- Description: Create folders table for organizing AI Employees and Follow-up Flows
-- Created: 2025-12-21

BEGIN;

-- Create folders table with hierarchical support
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT 'gray',
  parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  folder_type VARCHAR(20) NOT NULL CHECK (folder_type IN ('agents', 'followup')),
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, name, parent_folder_id, folder_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(folder_type);
CREATE INDEX IF NOT EXISTS idx_folders_account_type ON folders(account_id, folder_type);

-- Add folder_id to ai_agents table
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_agents_folder ON ai_agents(folder_id);

-- Add folder_id to follow_up_flows table
ALTER TABLE follow_up_flows ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_follow_up_flows_folder ON follow_up_flows(folder_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_folders_updated_at ON folders;
CREATE TRIGGER trigger_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folders_updated_at();

-- Add comments for documentation
COMMENT ON TABLE folders IS 'Folders for organizing AI Employees and Follow-up Flows';
COMMENT ON COLUMN folders.id IS 'Unique identifier for the folder';
COMMENT ON COLUMN folders.account_id IS 'Account that owns this folder';
COMMENT ON COLUMN folders.name IS 'Display name of the folder';
COMMENT ON COLUMN folders.color IS 'Color theme for the folder (gray, blue, green, purple, orange, red, yellow, pink)';
COMMENT ON COLUMN folders.parent_folder_id IS 'Parent folder ID for hierarchical structure (NULL for root folders)';
COMMENT ON COLUMN folders.folder_type IS 'Type of items this folder contains: agents or followup';
COMMENT ON COLUMN folders.display_order IS 'Order of the folder in the list';
COMMENT ON COLUMN folders.created_by IS 'User who created this folder';

COMMIT;
