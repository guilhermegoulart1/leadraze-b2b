-- Migration 019: Add UX improvement fields to google_maps_agents table
-- Adds: avatar_url, radius, latitude, longitude, business_category, business_specification

BEGIN;

-- Add avatar URL field
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add radius field (in km)
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 10;

-- Add latitude and longitude for precise location
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add business category (from Google's official list)
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS business_category VARCHAR(100);

-- Add business specification (custom user input)
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS business_specification VARCHAR(255);

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_location
ON google_maps_agents(latitude, longitude);

-- Add index for category searches
CREATE INDEX IF NOT EXISTS idx_google_maps_agents_category
ON google_maps_agents(business_category);

COMMIT;

-- Rollback instructions:
-- ALTER TABLE google_maps_agents DROP COLUMN IF EXISTS avatar_url;
-- ALTER TABLE google_maps_agents DROP COLUMN IF EXISTS radius;
-- ALTER TABLE google_maps_agents DROP COLUMN IF EXISTS latitude;
-- ALTER TABLE google_maps_agents DROP COLUMN IF EXISTS longitude;
-- ALTER TABLE google_maps_agents DROP COLUMN IF EXISTS business_category;
-- ALTER TABLE google_maps_agents DROP COLUMN IF EXISTS business_specification;
-- DROP INDEX IF EXISTS idx_google_maps_agents_location;
-- DROP INDEX IF EXISTS idx_google_maps_agents_category;
