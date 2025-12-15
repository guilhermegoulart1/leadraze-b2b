-- Migration: Add discard fields to leads table
-- Description: Add discard_reason_id, discard_notes, and previous_status columns

-- Add discard_reason_id column (references discard_reasons table)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discard_reason_id UUID REFERENCES discard_reasons(id);

-- Add discard_notes column for additional notes when discarding
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discard_notes TEXT;

-- Add previous_status column to allow lead reactivation
ALTER TABLE leads ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);

-- Add discarded_at timestamp
ALTER TABLE leads ADD COLUMN IF NOT EXISTS discarded_at TIMESTAMP;

-- Create index on discard_reason_id
CREATE INDEX IF NOT EXISTS idx_leads_discard_reason_id ON leads(discard_reason_id);
