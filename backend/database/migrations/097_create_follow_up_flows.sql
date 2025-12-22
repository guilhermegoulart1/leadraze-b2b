-- Migration 097: Create follow_up_flows table
-- Purpose: Store follow-up flow definitions for AI employees

-- Create follow_up_flows table
CREATE TABLE IF NOT EXISTS follow_up_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identification
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Flow definition (React Flow structure)
  flow_definition JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}',
  -- Example: { nodes: [...], edges: [...] }

  -- Status
  is_active BOOLEAN DEFAULT false,

  -- Metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_follow_up_flows_account ON follow_up_flows(account_id);
CREATE INDEX idx_follow_up_flows_active ON follow_up_flows(is_active) WHERE is_active = true;
CREATE INDEX idx_follow_up_flows_created_at ON follow_up_flows(created_at DESC);

-- Add comments
COMMENT ON TABLE follow_up_flows IS 'Follow-up flow definitions for AI employees';
COMMENT ON COLUMN follow_up_flows.flow_definition IS 'React Flow nodes and edges for visual workflow builder';
COMMENT ON COLUMN follow_up_flows.is_active IS 'Whether this flow is currently active and processing';
COMMENT ON COLUMN follow_up_flows.total_executions IS 'Total number of times this flow has been executed';

-- Create trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_follow_up_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_up_flows_updated_at
  BEFORE UPDATE ON follow_up_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_flows_updated_at();
