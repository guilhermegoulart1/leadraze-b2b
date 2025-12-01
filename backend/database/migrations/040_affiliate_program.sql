-- ================================================
-- Migration 040: Affiliate Program
-- ================================================
-- Sistema de afiliados com links únicos, tracking de referrals
-- e comissões recorrentes de 10% enquanto o indicado estiver ativo

BEGIN;

-- ================================================
-- 1. AFFILIATE LINKS TABLE
-- ================================================
-- Cada account tem um link de afiliado único

CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,

  -- Código único do afiliado (ex: ABC123XY)
  code VARCHAR(20) UNIQUE NOT NULL,

  -- Estatísticas
  clicks INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 2. REFERRALS TABLE
-- ================================================
-- Rastreia quem indicou quem

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem indicou
  affiliate_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  affiliate_link_id UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,

  -- Quem foi indicado (preenchido após checkout)
  referred_account_id UUID UNIQUE REFERENCES accounts(id) ON DELETE SET NULL,
  referred_email VARCHAR(255),

  -- Stripe tracking
  stripe_checkout_session_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'canceled')),

  -- Timestamps
  converted_at TIMESTAMP,
  canceled_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 3. AFFILIATE EARNINGS TABLE
-- ================================================
-- Registro de todas as comissões geradas

CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Afiliado que ganhou
  affiliate_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Referral que gerou o ganho
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,

  -- Stripe reference
  stripe_invoice_id VARCHAR(255) UNIQUE,

  -- Valores
  invoice_amount_cents INTEGER NOT NULL,
  commission_percent INTEGER DEFAULT 10,
  earning_cents INTEGER NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 4. INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_account ON affiliate_links(account_id);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON referrals(affiliate_account_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_account_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_checkout ON referrals(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_earnings_affiliate ON affiliate_earnings(affiliate_account_id);
CREATE INDEX IF NOT EXISTS idx_earnings_referral ON affiliate_earnings(referral_id);
CREATE INDEX IF NOT EXISTS idx_earnings_created ON affiliate_earnings(created_at);

-- ================================================
-- 5. TRIGGERS
-- ================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_affiliate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_affiliate_links_updated_at
  BEFORE UPDATE ON affiliate_links
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

CREATE TRIGGER trigger_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

COMMIT;

-- ================================================
-- Success message
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 040: Affiliate Program completed successfully';
END $$;
