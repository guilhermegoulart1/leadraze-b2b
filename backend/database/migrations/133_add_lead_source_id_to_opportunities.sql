-- Migration: Add lead_source_id to opportunities table
-- Description: Reference to lead_sources table for customizable sources

-- Add new column
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_opportunities_lead_source ON opportunities(lead_source_id);
