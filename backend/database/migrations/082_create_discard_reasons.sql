-- Migration: Create discard_reasons table
-- Description: Table for storing lead discard reasons

-- Create the discard_reasons table
CREATE TABLE IF NOT EXISTS discard_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discard_reasons_account_id ON discard_reasons(account_id);
CREATE INDEX IF NOT EXISTS idx_discard_reasons_is_active ON discard_reasons(is_active);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_discard_reasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_discard_reasons_updated_at ON discard_reasons;
CREATE TRIGGER trigger_discard_reasons_updated_at
  BEFORE UPDATE ON discard_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_discard_reasons_updated_at();
