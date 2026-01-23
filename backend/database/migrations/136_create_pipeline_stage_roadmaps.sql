-- Migration: Create Pipeline Stage Roadmaps
-- Description: Links pipeline stages to roadmaps for automatic execution when opportunities are created

-- ============================================
-- PIPELINE STAGE ROADMAPS (Automations)
-- ============================================
CREATE TABLE IF NOT EXISTS pipeline_stage_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,  -- Order of execution
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(stage_id, roadmap_id)
);

COMMENT ON TABLE pipeline_stage_roadmaps IS 'Associates roadmaps with pipeline stages for automatic execution when opportunities are created';
COMMENT ON COLUMN pipeline_stage_roadmaps.position IS 'Order in which roadmaps will be executed (lower = first)';
COMMENT ON COLUMN pipeline_stage_roadmaps.is_active IS 'If false, this association is disabled but not deleted';

-- Indexes
CREATE INDEX idx_stage_roadmaps_stage ON pipeline_stage_roadmaps(stage_id);
CREATE INDEX idx_stage_roadmaps_roadmap ON pipeline_stage_roadmaps(roadmap_id);
CREATE INDEX idx_stage_roadmaps_active ON pipeline_stage_roadmaps(stage_id, is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER trigger_stage_roadmaps_updated_at
  BEFORE UPDATE ON pipeline_stage_roadmaps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
