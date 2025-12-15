-- ================================================
-- Migration 079: Create Products Table
-- ================================================
-- Cadastro de produtos/servicos para o CRM
-- Usado para associar aos leads ganhos (won)

BEGIN;

-- ================================================
-- 1. PRODUCTS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identificacao
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Valores
  default_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',

  -- Unidade de tempo (para servicos)
  time_unit VARCHAR(20), -- 'hour', 'day', 'week', 'month', 'project', 'unit'

  -- Condicoes de pagamento padrao
  payment_conditions TEXT,

  -- Flags
  is_active BOOLEAN DEFAULT true,

  -- Auditoria
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- ================================================
-- 2. TRIGGER: Auto-update updated_at
-- ================================================

CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_products ON products;
CREATE TRIGGER trigger_update_products
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

COMMIT;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 079 completed successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - products (product/service catalog)';
  RAISE NOTICE '';
  RAISE NOTICE 'Fields:';
  RAISE NOTICE '  - name, description';
  RAISE NOTICE '  - default_price, currency';
  RAISE NOTICE '  - time_unit (hour, day, week, month, project, unit)';
  RAISE NOTICE '  - payment_conditions';
  RAISE NOTICE '';
END $$;
