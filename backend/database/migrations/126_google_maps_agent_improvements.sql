-- Migration: Google Maps Agent Improvements
-- Purpose: Add support for multiple locations, CRM optional mode, larger radius,
--          duplicate tracking, and distribution modes

-- 1. Add insert_in_crm option (CRM optional mode)
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS insert_in_crm BOOLEAN DEFAULT true;

COMMENT ON COLUMN google_maps_agents.insert_in_crm IS 'If false, leads are stored in found_places JSONB instead of creating contacts/opportunities';

-- 2. Add found_places to store leads when not inserting in CRM
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS found_places JSONB DEFAULT '[]';

COMMENT ON COLUMN google_maps_agents.found_places IS 'Stores enriched lead data when insert_in_crm is false. Structure: [{place_id, name, phone, email, emails, phones, social_links, ...}]';

-- 3. Add duplicates tracking
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS duplicates_found INTEGER DEFAULT 0;

COMMENT ON COLUMN google_maps_agents.duplicates_found IS 'Count of duplicate places found (already exist in account contacts)';

-- 4. Add search_type for larger areas (city, state, country)
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS search_type VARCHAR(20) DEFAULT 'radius';

-- Add check constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'google_maps_agents_search_type_check'
    ) THEN
        ALTER TABLE google_maps_agents
        ADD CONSTRAINT google_maps_agents_search_type_check
        CHECK (search_type IN ('radius', 'city', 'region', 'state', 'country'));
    END IF;
END $$;

COMMENT ON COLUMN google_maps_agents.search_type IS 'Type of area search: radius (custom km), city, region, state, country';

-- 5. Add multiple locations support
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS search_locations JSONB DEFAULT '[]';

COMMENT ON COLUMN google_maps_agents.search_locations IS 'Array of locations to search. Structure: [{id, lat, lng, radius, location, city, country, current_page, search_type}]';

-- 6. Add current location index for sequential processing
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS current_location_index INTEGER DEFAULT 0;

COMMENT ON COLUMN google_maps_agents.current_location_index IS 'Index of current location being processed (for sequential distribution mode)';

-- 7. Add distribution mode for multiple locations
ALTER TABLE google_maps_agents
ADD COLUMN IF NOT EXISTS location_distribution VARCHAR(20) DEFAULT 'proportional';

-- Add check constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'google_maps_agents_location_distribution_check'
    ) THEN
        ALTER TABLE google_maps_agents
        ADD CONSTRAINT google_maps_agents_location_distribution_check
        CHECK (location_distribution IN ('proportional', 'sequential'));
    END IF;
END $$;

COMMENT ON COLUMN google_maps_agents.location_distribution IS 'How to distribute leads across locations: proportional (divide equally) or sequential (exhaust one before next)';

-- 8. Create table for tracking found duplicates (for display in UI)
CREATE TABLE IF NOT EXISTS google_maps_agent_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES google_maps_agents(id) ON DELETE CASCADE,
    place_id VARCHAR(255) NOT NULL,
    existing_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    place_data JSONB NOT NULL, -- Store the place data for reference
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to avoid duplicate duplicate entries
    UNIQUE(agent_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_gmaps_duplicates_agent ON google_maps_agent_duplicates(agent_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_duplicates_found_at ON google_maps_agent_duplicates(found_at DESC);

COMMENT ON TABLE google_maps_agent_duplicates IS 'Tracks duplicate places found by Google Maps agents for display in UI';

-- 9. Allow NULL daily_limit for unlimited mode
-- (Column already allows NULL, just updating comment)
COMMENT ON COLUMN google_maps_agents.daily_limit IS 'Daily lead limit. NULL = unlimited (capped at 2000 per execution for safety)';
