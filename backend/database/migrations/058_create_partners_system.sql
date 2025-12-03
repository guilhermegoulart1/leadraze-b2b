-- ================================================
-- Migration 058: Partners System
-- ================================================
-- Sistema de Partners para agências/profissionais que podem
-- revender a plataforma com 10% de comissão recorrente

BEGIN;

-- ================================================
-- 1. PARTNERS TABLE
-- ================================================
-- Cadastro de partners (agências/profissionais)

CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados do cadastro
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  type VARCHAR(20) NOT NULL CHECK (type IN ('individual', 'company')),
  country VARCHAR(100),

  -- Autenticação (preenchido após aprovação)
  password_hash VARCHAR(255),

  -- Link de afiliado (gerado após aprovação)
  affiliate_code VARCHAR(20) UNIQUE,
  clicks INTEGER DEFAULT 0,

  -- Status do partner
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 2. PARTNER REFERRALS TABLE
-- ================================================
-- Rastreia indicações feitas por partners

CREATE TABLE IF NOT EXISTS partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partner que indicou
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- Conta indicada (preenchido após checkout)
  referred_account_id UUID UNIQUE REFERENCES accounts(id) ON DELETE SET NULL,
  referred_email VARCHAR(255),

  -- Stripe tracking
  stripe_checkout_session_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Status da indicação
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'canceled')),

  -- Timestamps
  converted_at TIMESTAMP,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 3. PARTNER EARNINGS TABLE
-- ================================================
-- Registro de comissões (10% por pagamento)

CREATE TABLE IF NOT EXISTS partner_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partner que ganhou
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- Referral que gerou o ganho
  referral_id UUID NOT NULL REFERENCES partner_referrals(id) ON DELETE CASCADE,

  -- Stripe reference
  stripe_invoice_id VARCHAR(255) UNIQUE,

  -- Valores
  invoice_amount_cents INTEGER NOT NULL,
  commission_percent INTEGER DEFAULT 10,
  earning_cents INTEGER NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 4. PARTNER ACCOUNT ACCESS TABLE
-- ================================================
-- Controle de acesso do partner às contas dos clientes

CREATE TABLE IF NOT EXISTS partner_account_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partner e conta
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Quem concedeu o acesso
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Revogação
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Único por partner+account
  UNIQUE(partner_id, account_id)
);

-- ================================================
-- 5. INDEXES
-- ================================================

-- Partners indexes
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_affiliate_code ON partners(affiliate_code);

-- Partner referrals indexes
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_account ON partner_referrals(referred_account_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_status ON partner_referrals(status);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_checkout ON partner_referrals(stripe_checkout_session_id);

-- Partner earnings indexes
CREATE INDEX IF NOT EXISTS idx_partner_earnings_partner ON partner_earnings(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_referral ON partner_earnings(referral_id);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_created ON partner_earnings(created_at);

-- Partner account access indexes
CREATE INDEX IF NOT EXISTS idx_partner_account_access_partner ON partner_account_access(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_account_access_account ON partner_account_access(account_id);
CREATE INDEX IF NOT EXISTS idx_partner_account_access_active ON partner_account_access(is_active);

-- ================================================
-- 6. TRIGGERS
-- ================================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_partner_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_partner_updated_at();

CREATE TRIGGER trigger_partner_referrals_updated_at
  BEFORE UPDATE ON partner_referrals
  FOR EACH ROW EXECUTE FUNCTION update_partner_updated_at();

COMMIT;

-- ================================================
-- Success message
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 058: Partners System completed successfully';
END $$;
