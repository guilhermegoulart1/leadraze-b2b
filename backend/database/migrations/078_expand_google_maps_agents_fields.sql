-- Migration 078: Expand VARCHAR fields in google_maps_agents table
-- Purpose: Fix "value too long for type character varying(255)" when creating agents
-- Date: 2024-12-14

-- Expand google_maps_agents fields
ALTER TABLE google_maps_agents
  ALTER COLUMN name TYPE VARCHAR(500),
  ALTER COLUMN search_location TYPE TEXT,
  ALTER COLUMN search_query TYPE TEXT;

-- Comments
COMMENT ON COLUMN google_maps_agents.name IS 'Agent name (expanded to VARCHAR(500))';
COMMENT ON COLUMN google_maps_agents.search_location IS 'Google Maps location/coordinates (expanded to TEXT)';
COMMENT ON COLUMN google_maps_agents.search_query IS 'Search query for Google Maps (expanded to TEXT)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 078 completed: google_maps_agents VARCHAR fields expanded';
END $$;
