-- Migration 017: Add Google Maps fields to contacts table
-- Purpose: Enrich contacts with comprehensive Google Maps business data
-- Date: 2025-01-23

-- Add Google Maps specific fields to contacts table
ALTER TABLE contacts
  -- Google Maps identifiers
  ADD COLUMN IF NOT EXISTS place_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS data_cid VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,

  -- Address details (more granular than existing 'location' field)
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country VARCHAR(255),

  -- Geographic coordinates
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),

  -- Business ratings and reviews
  ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,

  -- Business classification
  ADD COLUMN IF NOT EXISTS business_category VARCHAR(255),
  ADD COLUMN IF NOT EXISTS business_types JSONB,
  ADD COLUMN IF NOT EXISTS price_level VARCHAR(10),

  -- Business information (JSONB for flexibility)
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS service_options JSONB,
  ADD COLUMN IF NOT EXISTS photos JSONB,

  -- Verification status
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS permanently_closed BOOLEAN DEFAULT FALSE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contacts_place_id ON contacts(place_id);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city);
CREATE INDEX IF NOT EXISTS idx_contacts_state ON contacts(state);
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country);
CREATE INDEX IF NOT EXISTS idx_contacts_rating ON contacts(rating);
CREATE INDEX IF NOT EXISTS idx_contacts_business_category ON contacts(business_category);
CREATE INDEX IF NOT EXISTS idx_contacts_coordinates ON contacts(latitude, longitude);

-- Create GIN index for JSONB fields (faster JSONB queries)
CREATE INDEX IF NOT EXISTS idx_contacts_business_types_gin ON contacts USING GIN(business_types);
CREATE INDEX IF NOT EXISTS idx_contacts_service_options_gin ON contacts USING GIN(service_options);

-- Update the source column to include 'google_maps' as a valid source
-- (No constraint update needed, just documentation)

-- Comments for documentation
COMMENT ON COLUMN contacts.place_id IS 'Unique Google Maps place identifier';
COMMENT ON COLUMN contacts.data_cid IS 'Google Maps customer ID';
COMMENT ON COLUMN contacts.google_maps_url IS 'Direct link to Google Maps listing';
COMMENT ON COLUMN contacts.rating IS 'Google Maps rating (0.0 to 5.0)';
COMMENT ON COLUMN contacts.review_count IS 'Number of Google Maps reviews';
COMMENT ON COLUMN contacts.business_category IS 'Primary business category from Google Maps';
COMMENT ON COLUMN contacts.business_types IS 'Array of all business types/categories from Google Maps';
COMMENT ON COLUMN contacts.price_level IS 'Price level indicator (e.g., $, $$, $$$, $$$$)';
COMMENT ON COLUMN contacts.opening_hours IS 'Structured opening hours data from Google Maps';
COMMENT ON COLUMN contacts.service_options IS 'Service options (dine-in, delivery, takeout, etc.)';
COMMENT ON COLUMN contacts.photos IS 'Array of photo URLs from Google Maps';
COMMENT ON COLUMN contacts.verified IS 'Whether the business is verified on Google Maps';
COMMENT ON COLUMN contacts.permanently_closed IS 'Whether the business is marked as permanently closed';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 017 completed: Google Maps fields added to contacts table';
END $$;
