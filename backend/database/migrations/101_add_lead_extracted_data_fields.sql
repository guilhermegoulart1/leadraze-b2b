-- Migration: Add extracted data fields to leads
-- Adds fields for AI-extracted lead information

-- Add extracted data fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_size VARCHAR(100) DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget VARCHAR(100) DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timeline VARCHAR(100) DEFAULT NULL;

-- Add comments explaining the fields
COMMENT ON COLUMN leads.company_size IS 'Company size extracted by AI (e.g., "50 employees", "SMB")';
COMMENT ON COLUMN leads.budget IS 'Budget information extracted by AI (e.g., "R$ 5000/month")';
COMMENT ON COLUMN leads.timeline IS 'Timeline/urgency extracted by AI (e.g., "next month", "Q2 2024")';
