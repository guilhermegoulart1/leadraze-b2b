-- Migration 074: Add 'in_progress' status to google_maps_agents
-- This status is used when there are more results to fetch but current batch is done

-- Drop old constraint and add new one with 'in_progress'
ALTER TABLE google_maps_agents DROP CONSTRAINT IF EXISTS google_maps_agents_status_check;
ALTER TABLE google_maps_agents ADD CONSTRAINT google_maps_agents_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'failed', 'in_progress'));

-- Update any agents stuck in bad state
UPDATE google_maps_agents SET status = 'active' WHERE status NOT IN ('active', 'paused', 'completed', 'failed', 'in_progress');
