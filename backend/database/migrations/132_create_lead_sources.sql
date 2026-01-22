-- Migration: Create lead_sources table
-- Description: Table for storing customizable lead sources

-- Create the lead_sources table
CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6b7280',
  icon VARCHAR(10) DEFAULT '?',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_sources_account_id ON lead_sources(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_is_active ON lead_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_lead_sources_name ON lead_sources(account_id, name);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_lead_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lead_sources_updated_at ON lead_sources;
CREATE TRIGGER trigger_lead_sources_updated_at
  BEFORE UPDATE ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_sources_updated_at();
