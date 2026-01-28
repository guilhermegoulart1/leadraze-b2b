-- Migration: Create Pricing Tables System
-- Permite preços dinâmicos por conta e moeda (BRL, USD, EUR)

-- Habilitar extensão para UUIDs (se não existir)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de pricing tables (configurações de preço nomeadas)
CREATE TABLE IF NOT EXISTS pricing_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Apenas uma default por moeda
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_tables_default_currency
  ON pricing_tables(currency) WHERE is_default = true;

-- Index para busca por slug
CREATE INDEX IF NOT EXISTS idx_pricing_tables_slug ON pricing_tables(slug);

-- Index para busca por currency
CREATE INDEX IF NOT EXISTS idx_pricing_tables_currency ON pricing_tables(currency);

-- Itens de cada pricing table
CREATE TABLE IF NOT EXISTS pricing_table_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_table_id UUID NOT NULL REFERENCES pricing_tables(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL,
  stripe_product_id VARCHAR(255),
  stripe_price_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  billing_type VARCHAR(20) NOT NULL,
  billing_interval VARCHAR(20),
  credits_amount INTEGER,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Constraint para tipos de produto válidos
ALTER TABLE pricing_table_items
  ADD CONSTRAINT chk_product_type
  CHECK (product_type IN ('base_plan', 'extra_channel', 'extra_user', 'credits_gmaps', 'credits_ai'));

-- Constraint para tipos de billing válidos
ALTER TABLE pricing_table_items
  ADD CONSTRAINT chk_billing_type
  CHECK (billing_type IN ('recurring', 'one_time'));

-- Constraint para intervalos válidos
ALTER TABLE pricing_table_items
  ADD CONSTRAINT chk_billing_interval
  CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year'));

-- Cada combinação produto/créditos só pode aparecer uma vez por pricing table
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_table_items_unique
  ON pricing_table_items(pricing_table_id, product_type, COALESCE(credits_amount, 0));

-- Index para busca por pricing_table_id
CREATE INDEX IF NOT EXISTS idx_pricing_table_items_table_id ON pricing_table_items(pricing_table_id);

-- Index para busca por product_type
CREATE INDEX IF NOT EXISTS idx_pricing_table_items_product_type ON pricing_table_items(product_type);

-- Associação conta -> pricing table
CREATE TABLE IF NOT EXISTS account_pricing_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pricing_table_id UUID NOT NULL REFERENCES pricing_tables(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cada conta só pode ter uma pricing table
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_pricing_tables_account
  ON account_pricing_tables(account_id);

-- Adicionar moeda preferida nas contas (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'preferred_currency'
  ) THEN
    ALTER TABLE accounts ADD COLUMN preferred_currency VARCHAR(3) DEFAULT 'BRL';
  END IF;
END $$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_pricing_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pricing_tables_updated_at ON pricing_tables;
CREATE TRIGGER trigger_pricing_tables_updated_at
  BEFORE UPDATE ON pricing_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_tables_updated_at();

DROP TRIGGER IF EXISTS trigger_pricing_table_items_updated_at ON pricing_table_items;
CREATE TRIGGER trigger_pricing_table_items_updated_at
  BEFORE UPDATE ON pricing_table_items
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_tables_updated_at();

-- ============================================
-- SEED: Inserir pricing tables default
-- ============================================

-- Pricing Table: default-brl (BRL) - Default para Real
INSERT INTO pricing_tables (name, slug, description, currency, is_default, is_active)
VALUES ('Default BRL', 'default-brl', 'Tabela de preços padrão em Real brasileiro', 'BRL', true, true)
ON CONFLICT (slug) DO NOTHING;

-- Pricing Table: default-usd (USD) - Default para Dólar
INSERT INTO pricing_tables (name, slug, description, currency, is_default, is_active)
VALUES ('Default USD', 'default-usd', 'Default pricing table in US Dollars', 'USD', true, true)
ON CONFLICT (slug) DO NOTHING;

-- Pricing Table: default-eur (EUR) - Default para Euro
INSERT INTO pricing_tables (name, slug, description, currency, is_default, is_active)
VALUES ('Default EUR', 'default-eur', 'Default pricing table in Euros', 'EUR', true, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED: Itens da pricing table BRL
-- ============================================
INSERT INTO pricing_table_items (pricing_table_id, product_type, stripe_price_id, name, description, price_cents, billing_type, billing_interval, credits_amount, display_order)
SELECT
  pt.id,
  item.product_type,
  item.stripe_price_id,
  item.name,
  item.description,
  item.price_cents,
  item.billing_type,
  item.billing_interval,
  item.credits_amount,
  item.display_order
FROM pricing_tables pt
CROSS JOIN (VALUES
  ('base_plan', 'price_1SrP97F139XY9QwN4F92oU46', 'Plano Base', 'Assinatura mensal do plano base', 33000, 'recurring', 'month', NULL, 1),
  ('extra_channel', 'price_1SrP9LF139XY9QwNljbRKdyT', 'Canal Extra', 'Canal adicional por mês', 9900, 'recurring', 'month', NULL, 2),
  ('extra_user', 'price_1SrP9WF139XY9QwNvnL5h7CD', 'Usuário Extra', 'Usuário adicional por mês', 1800, 'recurring', 'month', NULL, 3),
  ('credits_gmaps', 'price_1SuBybF139XY9QwNmdqffX33', '500 Créditos GMaps', 'Pacote de 500 créditos para Google Maps', 5500, 'one_time', NULL, 500, 4),
  ('credits_gmaps', 'price_1SuC1rF139XY9QwNolIz4VhZ', '1000 Créditos GMaps', 'Pacote de 1000 créditos para Google Maps', 9900, 'one_time', NULL, 1000, 5),
  ('credits_gmaps', 'price_1SuC4AF139XY9QwNRXZY09y8', '2500 Créditos GMaps', 'Pacote de 2500 créditos para Google Maps', 23900, 'one_time', NULL, 2500, 6),
  ('credits_gmaps', 'price_1SuC5QF139XY9QwNp2V41P61', '5000 Créditos GMaps', 'Pacote de 5000 créditos para Google Maps', 33000, 'one_time', NULL, 5000, 7),
  ('credits_ai', 'price_1SuC6MF139XY9QwNKbti9BNo', '5000 Créditos AI', 'Pacote de 5000 créditos para IA', 17900, 'one_time', NULL, 5000, 8),
  ('credits_ai', 'price_1SuC7JF139XY9QwNBkYnVJ5w', '10000 Créditos AI', 'Pacote de 10000 créditos para IA', 29900, 'one_time', NULL, 10000, 9)
) AS item(product_type, stripe_price_id, name, description, price_cents, billing_type, billing_interval, credits_amount, display_order)
WHERE pt.slug = 'default-brl'
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Itens da pricing table USD
-- ============================================
INSERT INTO pricing_table_items (pricing_table_id, product_type, stripe_price_id, name, description, price_cents, billing_type, billing_interval, credits_amount, display_order)
SELECT
  pt.id,
  item.product_type,
  item.stripe_price_id,
  item.name,
  item.description,
  item.price_cents,
  item.billing_type,
  item.billing_interval,
  item.credits_amount,
  item.display_order
FROM pricing_tables pt
CROSS JOIN (VALUES
  ('base_plan', 'price_1SuBzQF139XY9QwNeq8TGdrF', 'Base Plan', 'Monthly base plan subscription', 5500, 'recurring', 'month', NULL, 1),
  ('extra_channel', 'price_1SuC0jF139XY9QwNPLP3OH9G', 'Extra Channel', 'Additional channel per month', 1800, 'recurring', 'month', NULL, 2),
  ('extra_user', 'price_1SuC01F139XY9QwNustct1U6', 'Extra User', 'Additional user per month', 300, 'recurring', 'month', NULL, 3),
  ('credits_gmaps', 'price_1SuBywF139XY9QwNrzGy2RBS', '500 GMaps Credits', 'Pack of 500 credits for Google Maps', 900, 'one_time', NULL, 500, 4),
  ('credits_gmaps', 'price_1SuC29F139XY9QwNxeBxyiz1', '1000 GMaps Credits', 'Pack of 1000 credits for Google Maps', 1800, 'one_time', NULL, 1000, 5),
  ('credits_gmaps', 'price_1SuC4PF139XY9QwNPwTL5Ghe', '2500 GMaps Credits', 'Pack of 2500 credits for Google Maps', 3900, 'one_time', NULL, 2500, 6),
  ('credits_gmaps', 'price_1SuC5mF139XY9QwNj16uOTi6', '5000 GMaps Credits', 'Pack of 5000 credits for Google Maps', 5500, 'one_time', NULL, 5000, 7),
  ('credits_ai', 'price_1SuC6bF139XY9QwNqG3mu2Rh', '5000 AI Credits', 'Pack of 5000 credits for AI', 3500, 'one_time', NULL, 5000, 8),
  ('credits_ai', 'price_1SuC7YF139XY9QwNGJlmBuLH', '10000 AI Credits', 'Pack of 10000 credits for AI', 5900, 'one_time', NULL, 10000, 9)
) AS item(product_type, stripe_price_id, name, description, price_cents, billing_type, billing_interval, credits_amount, display_order)
WHERE pt.slug = 'default-usd'
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Itens da pricing table EUR
-- ============================================
INSERT INTO pricing_table_items (pricing_table_id, product_type, stripe_price_id, name, description, price_cents, billing_type, billing_interval, credits_amount, display_order)
SELECT
  pt.id,
  item.product_type,
  item.stripe_price_id,
  item.name,
  item.description,
  item.price_cents,
  item.billing_type,
  item.billing_interval,
  item.credits_amount,
  item.display_order
FROM pricing_tables pt
CROSS JOIN (VALUES
  ('base_plan', 'price_1SuBzaF139XY9QwNs5gPect0', 'Base Plan', 'Monthly base plan subscription', 5500, 'recurring', 'month', NULL, 1),
  ('extra_channel', 'price_1SuC0uF139XY9QwNv3C7nL06', 'Extra Channel', 'Additional channel per month', 1800, 'recurring', 'month', NULL, 2),
  ('extra_user', 'price_1SuC0AF139XY9QwNL27MMcB4', 'Extra User', 'Additional user per month', 300, 'recurring', 'month', NULL, 3),
  ('credits_gmaps', 'price_1SuBz9F139XY9QwNkOXsZc0F', '500 GMaps Credits', 'Pack of 500 credits for Google Maps', 900, 'one_time', NULL, 500, 4),
  ('credits_gmaps', 'price_1SuC2eF139XY9QwNxxFKeOFb', '1000 GMaps Credits', 'Pack of 1000 credits for Google Maps', 1800, 'one_time', NULL, 1000, 5),
  ('credits_gmaps', 'price_1SuC4aF139XY9QwNOAiWH5DV', '2500 GMaps Credits', 'Pack of 2500 credits for Google Maps', 3900, 'one_time', NULL, 2500, 6),
  ('credits_gmaps', 'price_1SuC5uF139XY9QwNMCI5wtLO', '5000 GMaps Credits', 'Pack of 5000 credits for Google Maps', 5500, 'one_time', NULL, 5000, 7),
  ('credits_ai', 'price_1SuC6jF139XY9QwNduC9xlI4', '5000 AI Credits', 'Pack of 5000 credits for AI', 3500, 'one_time', NULL, 5000, 8),
  ('credits_ai', 'price_1SuC7gF139XY9QwNpsbLFRtB', '10000 AI Credits', 'Pack of 10000 credits for AI', 5900, 'one_time', NULL, 10000, 9)
) AS item(product_type, stripe_price_id, name, description, price_cents, billing_type, billing_interval, credits_amount, display_order)
WHERE pt.slug = 'default-eur'
ON CONFLICT DO NOTHING;
