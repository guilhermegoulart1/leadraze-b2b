-- ================================================
-- Migration 031: Simplified Plan Model
-- ================================================
-- Modelo simplificado:
-- - Plano Base unico (R$ 297/mes)
-- - Add-ons recorrentes (canal, usuario)
-- - Creditos avulsos (nao expiram)

BEGIN;

-- ================================================
-- 1. UPDATE PLANS - Remove old, keep Admin, add Base
-- ================================================

-- Remove planos antigos (Light, Smart, Business)
DELETE FROM plans WHERE slug IN ('light', 'smart', 'business', 'free', 'starter', 'professional', 'enterprise');

-- Update or insert Base plan
INSERT INTO plans (
  name, slug, description,
  price_monthly_cents, price_yearly_cents,
  max_channels, max_users, monthly_gmaps_credits,
  features, is_active, is_public, is_default, display_order, is_highlighted, highlight_text
) VALUES (
  'Base', 'base', 'Plano completo para prospecção B2B',
  29700, 297000,  -- R$ 297/mes
  1, 2, 200,
  '["1 canal de comunicação", "2 usuários", "200 créditos Google Maps/mês", "Agentes de IA ilimitados", "Suporte prioritário"]'::jsonb,
  true, true, true, 1, true, 'Plano Único'
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  max_channels = EXCLUDED.max_channels,
  max_users = EXCLUDED.max_users,
  monthly_gmaps_credits = EXCLUDED.monthly_gmaps_credits,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  is_highlighted = EXCLUDED.is_highlighted,
  highlight_text = EXCLUDED.highlight_text;

-- Ensure Admin plan exists
INSERT INTO plans (
  name, slug, description,
  price_monthly_cents, price_yearly_cents,
  max_channels, max_users, monthly_gmaps_credits,
  features, is_active, is_public, is_default, display_order
) VALUES (
  'Admin', 'admin', 'Plano administrativo com acesso total',
  0, 0,
  999999, 999999, 999999,
  '["Canais ilimitados", "Usuários ilimitados", "Créditos Google Maps ilimitados", "Acesso total ao sistema"]'::jsonb,
  true, false, false, 0
) ON CONFLICT (slug) DO NOTHING;

-- ================================================
-- 2. UPDATE CREDIT_PACKAGES - Add expires_at handling
-- ================================================

-- Add column to track if package expires
ALTER TABLE credit_packages
  ADD COLUMN IF NOT EXISTS never_expires BOOLEAN DEFAULT false;

-- Update source check constraint to include 'purchase_onetime'
ALTER TABLE credit_packages
  DROP CONSTRAINT IF EXISTS credit_packages_source_check;

ALTER TABLE credit_packages
  ADD CONSTRAINT credit_packages_source_check
  CHECK (source IN ('purchase', 'purchase_onetime', 'subscription', 'bonus', 'refund'));

-- ================================================
-- 3. UPDATE FUNCTION: Get available credits
-- ================================================
-- Now considers never_expires flag

CREATE OR REPLACE FUNCTION get_available_credits(
  p_account_id UUID,
  p_credit_type VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
  total_credits INTEGER;
BEGIN
  SELECT COALESCE(SUM(remaining_credits), 0) INTO total_credits
  FROM credit_packages
  WHERE account_id = p_account_id
    AND credit_type IN (p_credit_type, p_credit_type || '_monthly')
    AND status = 'active'
    AND (never_expires = true OR expires_at > NOW());

  RETURN total_credits;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 4. UPDATE FUNCTION: Consume credits (FIFO)
-- ================================================
-- Now uses expiring credits first, then non-expiring

CREATE OR REPLACE FUNCTION consume_credits(
  p_account_id UUID,
  p_credit_type VARCHAR(50),
  p_amount INTEGER,
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  available INTEGER;
  remaining_to_consume INTEGER;
  package_record RECORD;
  credits_to_take INTEGER;
BEGIN
  -- Check available credits
  SELECT get_available_credits(p_account_id, p_credit_type) INTO available;

  IF available < p_amount THEN
    RETURN FALSE;
  END IF;

  remaining_to_consume := p_amount;

  -- Consume from expiring packages first (FIFO by expiration), then non-expiring
  FOR package_record IN
    SELECT id, remaining_credits, never_expires
    FROM credit_packages
    WHERE account_id = p_account_id
      AND credit_type IN (p_credit_type, p_credit_type || '_monthly')
      AND status = 'active'
      AND (never_expires = true OR expires_at > NOW())
      AND remaining_credits > 0
    ORDER BY
      never_expires ASC,  -- Expiring first
      expires_at ASC NULLS LAST,
      purchased_at ASC
  LOOP
    credits_to_take := LEAST(package_record.remaining_credits, remaining_to_consume);

    -- Update package
    UPDATE credit_packages
    SET remaining_credits = remaining_credits - credits_to_take,
        status = CASE WHEN remaining_credits - credits_to_take = 0 THEN 'exhausted' ELSE 'active' END
    WHERE id = package_record.id;

    -- Log usage
    INSERT INTO credit_usage (
      account_id,
      credit_package_id,
      credit_type,
      credits_used,
      resource_type,
      resource_id,
      user_id,
      description
    )
    VALUES (
      p_account_id,
      package_record.id,
      p_credit_type,
      credits_to_take,
      p_resource_type,
      p_resource_id,
      p_user_id,
      p_description
    );

    remaining_to_consume := remaining_to_consume - credits_to_take;

    EXIT WHEN remaining_to_consume = 0;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 5. CREATE ADD-ONS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,

  -- Type
  addon_type VARCHAR(50) NOT NULL CHECK (addon_type IN ('channel', 'user', 'credits')),

  -- Pricing
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('recurring', 'onetime')),

  -- Stripe
  stripe_price_id VARCHAR(255),
  stripe_product_id VARCHAR(255),

  -- For credit packages
  credits_amount INTEGER,
  credits_expire BOOLEAN DEFAULT true,

  -- Display
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_addons_slug ON addons(slug);
CREATE INDEX IF NOT EXISTS idx_addons_type ON addons(addon_type);
CREATE INDEX IF NOT EXISTS idx_addons_is_active ON addons(is_active);

-- ================================================
-- 6. INSERT ADD-ONS
-- ================================================

-- Canal Extra (recorrente)
INSERT INTO addons (name, slug, description, addon_type, price_cents, billing_type, display_order)
VALUES ('Canal Extra', 'channel-extra', 'Adicione mais um canal de comunicação', 'channel', 14700, 'recurring', 1)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  description = EXCLUDED.description;

-- Usuário Extra (recorrente)
INSERT INTO addons (name, slug, description, addon_type, price_cents, billing_type, display_order)
VALUES ('Usuário Extra', 'user-extra', 'Adicione mais um usuário à sua equipe', 'user', 2700, 'recurring', 2)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  description = EXCLUDED.description;

-- Pacotes de Créditos (avulso, não expira)
INSERT INTO addons (name, slug, description, addon_type, price_cents, billing_type, credits_amount, credits_expire, display_order)
VALUES ('500 Créditos Google Maps', 'credits-500', '500 créditos para busca no Google Maps', 'credits', 4700, 'onetime', 500, false, 3)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_amount = EXCLUDED.credits_amount,
  credits_expire = EXCLUDED.credits_expire;

INSERT INTO addons (name, slug, description, addon_type, price_cents, billing_type, credits_amount, credits_expire, display_order)
VALUES ('1.000 Créditos Google Maps', 'credits-1000', '1.000 créditos para busca no Google Maps', 'credits', 8700, 'onetime', 1000, false, 4)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_amount = EXCLUDED.credits_amount,
  credits_expire = EXCLUDED.credits_expire;

INSERT INTO addons (name, slug, description, addon_type, price_cents, billing_type, credits_amount, credits_expire, display_order)
VALUES ('2.500 Créditos Google Maps', 'credits-2500', '2.500 créditos para busca no Google Maps', 'credits', 19700, 'onetime', 2500, false, 5)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_amount = EXCLUDED.credits_amount,
  credits_expire = EXCLUDED.credits_expire;

INSERT INTO addons (name, slug, description, addon_type, price_cents, billing_type, credits_amount, credits_expire, display_order)
VALUES ('5.000 Créditos Google Maps', 'credits-5000', '5.000 créditos para busca no Google Maps', 'credits', 29700, 'onetime', 5000, false, 6)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  credits_amount = EXCLUDED.credits_amount,
  credits_expire = EXCLUDED.credits_expire;

-- ================================================
-- 7. TRIGGER for addons
-- ================================================

DROP TRIGGER IF EXISTS trigger_update_addons ON addons;
CREATE TRIGGER trigger_update_addons
  BEFORE UPDATE ON addons
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

COMMIT;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 031 completed successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New pricing model:';
  RAISE NOTICE '  - Base plan: R$ 297/month (1 channel, 2 users, 200 credits/month)';
  RAISE NOTICE '';
  RAISE NOTICE 'Recurring add-ons:';
  RAISE NOTICE '  - Channel Extra: R$ 147/month';
  RAISE NOTICE '  - User Extra: R$ 27/month';
  RAISE NOTICE '';
  RAISE NOTICE 'One-time credits (never expire):';
  RAISE NOTICE '  - 500 credits: R$ 47';
  RAISE NOTICE '  - 1000 credits: R$ 87';
  RAISE NOTICE '  - 2500 credits: R$ 197';
  RAISE NOTICE '  - 5000 credits: R$ 297';
  RAISE NOTICE '';
END $$;
