-- ================================================
-- Migration 059: Add deal_value and source to leads
-- ================================================
-- Adiciona campos para tracking de valor monetário e fonte dos leads

BEGIN;

-- ================================================
-- 1. DEAL VALUE (Valor do negócio em R$)
-- ================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value DECIMAL(15,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_currency VARCHAR(3) DEFAULT 'BRL';

-- ================================================
-- 2. LEAD SOURCE (Fonte do lead)
-- ================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'linkedin';

-- Adicionar constraint de validação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_source_check'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_source_check
      CHECK (source IN ('linkedin', 'google_maps', 'list', 'paid_traffic', 'other'));
  END IF;
END $$;

-- ================================================
-- 3. UPDATE EXISTING GOOGLE MAPS LEADS
-- ================================================

-- Google Maps leads have campaign_id = NULL
UPDATE leads
SET source = 'google_maps'
WHERE campaign_id IS NULL AND source = 'linkedin';

-- ================================================
-- 4. INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_leads_deal_value ON leads(deal_value) WHERE deal_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_won_at ON leads(won_at) WHERE won_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);

-- ================================================
-- 5. COMMENTS
-- ================================================

COMMENT ON COLUMN leads.deal_value IS 'Valor estimado/fechado do negócio';
COMMENT ON COLUMN leads.deal_currency IS 'Moeda do valor (default: BRL)';
COMMENT ON COLUMN leads.source IS 'Fonte do lead: linkedin, google_maps, list, paid_traffic, other';

COMMIT;

-- ================================================
-- Success message
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 059: Deal value and source fields added to leads';
END $$;
