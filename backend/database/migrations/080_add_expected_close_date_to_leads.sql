-- ================================================
-- Migration 080: Add Expected Close Date to Leads
-- ================================================
-- Campo para data prevista de fechamento do lead

BEGIN;

-- Adicionar campo expected_close_date
ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Criar indice para busca por data prevista
CREATE INDEX IF NOT EXISTS idx_leads_expected_close_date ON leads(expected_close_date);

COMMIT;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 080 completed successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Added columns:';
  RAISE NOTICE '  - expected_close_date (DATE) to leads table';
  RAISE NOTICE '';
END $$;
