-- Add execution_logs column to google_maps_agents table
-- Stores SERPAPI raw responses for debugging and transparency

ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS execution_logs JSONB DEFAULT '[]'::jsonb;

-- Add index for faster access
CREATE INDEX IF NOT EXISTS idx_gmaps_agents_execution_logs
ON google_maps_agents USING GIN (execution_logs);

-- Add comment
COMMENT ON COLUMN google_maps_agents.execution_logs IS 'Array of SERPAPI raw responses for debugging';
