-- Migration 073: Add CNPJ columns to contacts table
-- Purpose: Store CNPJ and official company data from ReceitaWS API
-- Date: 2024-12-14

-- Add CNPJ column (with or without formatting: XX.XXX.XXX/XXXX-XX)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18);

-- Add CNPJ data column (full response from ReceitaWS)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS cnpj_data JSONB;

-- Create index for CNPJ searches
CREATE INDEX IF NOT EXISTS idx_contacts_cnpj ON contacts(cnpj);

-- Comments
COMMENT ON COLUMN contacts.cnpj IS 'Brazilian company registration number (CNPJ) scraped from website';
COMMENT ON COLUMN contacts.cnpj_data IS 'Full company data from ReceitaWS API (razao social, situacao, QSA, etc)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 073 completed: CNPJ columns added to contacts table';
END $$;
