-- Migration: Add Pipeline and Stage Selection to Google Maps Agents
-- Purpose: Allow users to select which pipeline and stage leads should be inserted into,
--          instead of always using the default pipeline

-- 1. Add pipeline_id column
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL;

COMMENT ON COLUMN google_maps_agents.pipeline_id IS 'Pipeline where leads will be inserted as opportunities. NULL = use default pipeline';

-- 2. Add stage_id column
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

COMMENT ON COLUMN google_maps_agents.stage_id IS 'Initial stage for new opportunities. NULL = use first stage of pipeline';

-- 3. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_pipeline ON google_maps_agents(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_stage ON google_maps_agents(stage_id);

-- Note: sector_id is kept for backward compatibility with existing agents
-- Existing agents will continue to work with sector-based round robin
-- New agents can use pipeline-based configuration
