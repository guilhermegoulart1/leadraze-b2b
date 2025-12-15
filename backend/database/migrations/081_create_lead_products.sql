-- ================================================
-- Migration 081: Create Lead Products Table
-- ================================================
-- Tabela para multiplos produtos por lead (fechamento)

BEGIN;

-- ================================================
-- 1. LEAD_PRODUCTS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS lead_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),

  -- Valores
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,

  -- Condicoes de pagamento (pode ser diferente do padrao do produto)
  payment_conditions TEXT,

  -- Observacoes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_products_lead_id ON lead_products(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_products_product_id ON lead_products(product_id);

-- ================================================
-- 2. CAMPOS ADICIONAIS NO LEAD PARA FECHAMENTO
-- ================================================

-- Observacoes do fechamento
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closure_notes TEXT;

-- Data de fechamento (quando ganhou)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS won_at TIMESTAMP;

-- Criar indice para won_at
CREATE INDEX IF NOT EXISTS idx_leads_won_at ON leads(won_at);

COMMIT;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 081 completed successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - lead_products (multiple products per lead)';
  RAISE NOTICE '';
  RAISE NOTICE 'Added columns to leads:';
  RAISE NOTICE '  - closure_notes (TEXT)';
  RAISE NOTICE '  - won_at (TIMESTAMP)';
  RAISE NOTICE '';
END $$;
