-- ================================================
-- Migration 030: Create Plans Table
-- ================================================
-- Tabela de planos do sistema com limites e configuracoes
-- Planos: Light, Smart, Business, Admin

BEGIN;

-- ================================================
-- 1. PLANS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificacao
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,

  -- Precos (em centavos)
  price_monthly_cents INTEGER DEFAULT 0,
  price_yearly_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',

  -- Stripe IDs
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  stripe_product_id VARCHAR(255),

  -- Limites
  max_channels INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 1,
  monthly_gmaps_credits INTEGER NOT NULL DEFAULT 0,

  -- Features (para exibicao)
  features JSONB DEFAULT '[]'::jsonb,

  -- Flags
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,  -- false = plano interno (Admin)
  is_default BOOLEAN DEFAULT false, -- plano padrao para novos usuarios

  -- Ordenacao
  display_order INTEGER DEFAULT 0,

  -- Destaque
  is_highlighted BOOLEAN DEFAULT false,  -- "Mais popular"
  highlight_text VARCHAR(100),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_is_public ON plans(is_public);
CREATE INDEX IF NOT EXISTS idx_plans_display_order ON plans(display_order);

-- ================================================
-- 2. UPDATE SUBSCRIPTIONS TABLE
-- ================================================

-- Drop dependent view first
DROP VIEW IF EXISTS account_billing_summary;

-- Adicionar referencia ao plan
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);

-- Remover o check constraint antigo do plan_type
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;

-- Adicionar novos valores ao plan_type (se necessario)
-- plan_type ja deve ser VARCHAR(50), mas garantimos aqui
DO $$
BEGIN
  -- Tenta alterar, ignora se ja for VARCHAR(50)
  BEGIN
    ALTER TABLE subscriptions ALTER COLUMN plan_type TYPE VARCHAR(50);
  EXCEPTION WHEN others THEN
    -- Ignora erro se o tipo ja for correto
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);

-- Recreate the view
CREATE OR REPLACE VIEW account_billing_summary AS
SELECT
  a.id as account_id,
  a.name as account_name,
  a.stripe_customer_id,
  a.subscription_status,
  s.plan_type,
  s.status as subscription_status_detail,
  s.current_period_end,
  s.trial_end,
  s.cancel_at_period_end,
  s.max_channels,
  s.max_users,
  s.monthly_gmaps_credits,
  s.plan_id,
  p.name as plan_name,
  p.slug as plan_slug,
  -- Count add-ons
  (SELECT COALESCE(SUM(quantity), 0) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as extra_channels,
  (SELECT COALESCE(SUM(quantity), 0) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'user' AND si.is_active) as extra_users,
  -- Available credits
  get_available_credits(a.id, 'gmaps') as available_gmaps_credits,
  -- Usage counts
  (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id) as current_users,
  (SELECT COUNT(*) FROM linkedin_accounts la WHERE la.account_id = a.id) as current_channels
FROM accounts a
LEFT JOIN subscriptions s ON s.account_id = a.id
LEFT JOIN plans p ON p.id = s.plan_id;

-- ================================================
-- 3. INSERT PLANS
-- ================================================

-- Admin (plano interno com tudo liberado)
INSERT INTO plans (
  name, slug, description,
  price_monthly_cents, price_yearly_cents,
  max_channels, max_users, monthly_gmaps_credits,
  features, is_active, is_public, is_default, display_order
) VALUES (
  'Admin', 'admin', 'Plano administrativo com acesso total',
  0, 0,
  999999, 999999, 999999,
  '["Canais ilimitados", "Usuarios ilimitados", "Creditos Google Maps ilimitados", "Acesso total ao sistema"]'::jsonb,
  true, false, false, 0
) ON CONFLICT (slug) DO NOTHING;

-- Light
INSERT INTO plans (
  name, slug, description,
  price_monthly_cents, price_yearly_cents,
  max_channels, max_users, monthly_gmaps_credits,
  features, is_active, is_public, is_default, display_order
) VALUES (
  'Light', 'light', 'Ideal para comecar sua prospeccao',
  9900, 99000,  -- R$ 99/mes ou R$ 990/ano
  1, 2, 500,
  '["1 canal de comunicacao", "2 usuarios", "500 creditos Google Maps/mes", "Suporte por email"]'::jsonb,
  true, true, true, 1
) ON CONFLICT (slug) DO NOTHING;

-- Smart
INSERT INTO plans (
  name, slug, description,
  price_monthly_cents, price_yearly_cents,
  max_channels, max_users, monthly_gmaps_credits,
  features, is_active, is_public, is_default, display_order, is_highlighted, highlight_text
) VALUES (
  'Smart', 'smart', 'Para equipes em crescimento',
  19900, 199000,  -- R$ 199/mes ou R$ 1.990/ano
  2, 5, 1000,
  '["2 canais de comunicacao", "5 usuarios", "1.000 creditos Google Maps/mes", "Suporte prioritario", "Relatorios avancados"]'::jsonb,
  true, true, false, 2, true, 'Mais popular'
) ON CONFLICT (slug) DO NOTHING;

-- Business
INSERT INTO plans (
  name, slug, description,
  price_monthly_cents, price_yearly_cents,
  max_channels, max_users, monthly_gmaps_credits,
  features, is_active, is_public, is_default, display_order
) VALUES (
  'Business', 'business', 'Para empresas com alta demanda',
  49900, 499000,  -- R$ 499/mes ou R$ 4.990/ano
  5, 10, 2500,
  '["5 canais de comunicacao", "10 usuarios", "2.500 creditos Google Maps/mes", "Suporte dedicado", "API access", "Integracoes avancadas"]'::jsonb,
  true, true, false, 3
) ON CONFLICT (slug) DO NOTHING;

-- ================================================
-- 4. TRIGGER: Auto-update updated_at
-- ================================================

DROP TRIGGER IF EXISTS trigger_update_plans ON plans;
CREATE TRIGGER trigger_update_plans
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

-- ================================================
-- 5. VIEW: Plans with stats
-- ================================================

CREATE OR REPLACE VIEW plans_overview AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.description,
  p.price_monthly_cents,
  p.price_yearly_cents,
  p.max_channels,
  p.max_users,
  p.monthly_gmaps_credits,
  p.features,
  p.is_active,
  p.is_public,
  p.is_highlighted,
  p.highlight_text,
  p.display_order,
  (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status IN ('active', 'trialing')) as active_subscriptions
FROM plans p
WHERE p.is_active = true
ORDER BY p.display_order;

COMMIT;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 030 completed successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - plans (system plans)';
  RAISE NOTICE '';
  RAISE NOTICE 'Inserted plans:';
  RAISE NOTICE '  - Admin (internal, unlimited)';
  RAISE NOTICE '  - Light (1 channel, 500 credits, 2 users)';
  RAISE NOTICE '  - Smart (2 channels, 1000 credits, 5 users)';
  RAISE NOTICE '  - Business (5 channels, 2500 credits, 10 users)';
  RAISE NOTICE '';
END $$;
