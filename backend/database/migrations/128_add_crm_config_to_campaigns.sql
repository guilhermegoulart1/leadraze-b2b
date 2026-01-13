-- Migration: Add CRM configuration fields to campaigns table
-- This allows LinkedIn campaigns to have pipeline/stage/round-robin configuration
-- similar to Google Maps agents

-- Add insert_in_crm flag (default true for backward compatibility)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS insert_in_crm BOOLEAN DEFAULT true;

-- Add pipeline_id for selecting which pipeline to insert accepted leads
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;

-- Add stage_id for selecting which stage to insert accepted leads
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- Add assignees for round-robin distribution (JSONB array of user IDs)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS assignees JSONB DEFAULT '[]';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_pipeline_id ON campaigns(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_stage_id ON campaigns(stage_id);

-- Comment on new columns
COMMENT ON COLUMN campaigns.insert_in_crm IS 'Whether to automatically insert accepted leads into CRM';
COMMENT ON COLUMN campaigns.pipeline_id IS 'Pipeline to insert accepted leads into';
COMMENT ON COLUMN campaigns.stage_id IS 'Initial stage for accepted leads';
COMMENT ON COLUMN campaigns.assignees IS 'JSONB array of user IDs for round-robin assignment';
