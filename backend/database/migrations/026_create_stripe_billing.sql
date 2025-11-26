-- ================================================
-- Migration 026: Stripe Billing Integration
-- ================================================
-- Sistema completo de assinaturas, add-ons e creditos com expiracao
-- Integrado com Stripe para processamento de pagamentos

BEGIN;

-- ================================================
-- 1. SUBSCRIPTIONS TABLE
-- ================================================
-- Armazena a assinatura principal de cada account

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),

  -- Plan info
  plan_type VARCHAR(50) NOT NULL DEFAULT 'free'
    CHECK (plan_type IN ('free', 'starter', 'professional', 'enterprise')),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired')),

  -- Billing period
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,

  -- Trial info
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP,
  ended_at TIMESTAMP,

  -- Limits from plan (cached for quick access)
  max_channels INTEGER DEFAULT 2,
  max_users INTEGER DEFAULT 3,
  monthly_gmaps_credits INTEGER DEFAULT 500,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- One subscription per account
  UNIQUE(account_id)
);

-- ================================================
-- 2. SUBSCRIPTION ITEMS (Add-ons Recorrentes)
-- ================================================
-- Canais extras, usuarios extras - cobrados mensalmente

CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_subscription_item_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255) NOT NULL,

  -- Item details
  addon_type VARCHAR(50) NOT NULL CHECK (addon_type IN ('channel', 'user')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 3. CREDIT PACKAGES (Creditos com Expiracao)
-- ================================================
-- Creditos Google Maps - expiram em 30 dias

CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Stripe reference
  stripe_payment_intent_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  stripe_checkout_session_id VARCHAR(255),

  -- Credit details
  credit_type VARCHAR(50) NOT NULL CHECK (credit_type IN ('gmaps', 'gmaps_monthly')),
  initial_credits INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,

  -- Pricing
  price_paid_cents INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Expiration
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted', 'expired')),

  -- Source
  source VARCHAR(50) DEFAULT 'purchase'
    CHECK (source IN ('purchase', 'subscription', 'bonus', 'refund')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 4. CREDIT USAGE LOG
-- ================================================
-- Historico de consumo de creditos

CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  credit_package_id UUID REFERENCES credit_packages(id) ON DELETE SET NULL,

  -- Usage details
  credit_type VARCHAR(50) NOT NULL,
  credits_used INTEGER NOT NULL,

  -- Context
  resource_type VARCHAR(50), -- 'google_maps_search', 'google_maps_agent', etc.
  resource_id UUID,
  description TEXT,

  -- User who triggered
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 5. STRIPE WEBHOOK EVENTS
-- ================================================
-- Log de eventos processados para idempotencia

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Event info
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  api_version VARCHAR(50),

  -- Processing
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),

  -- Payload
  payload JSONB NOT NULL,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timing
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- ================================================
-- 6. INVOICES (Cache)
-- ================================================
-- Cache de faturas do Stripe para exibicao

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),

  -- Invoice details
  number VARCHAR(100),
  status VARCHAR(50),

  -- Amounts
  amount_due_cents INTEGER,
  amount_paid_cents INTEGER,
  subtotal_cents INTEGER,
  tax_cents INTEGER,
  total_cents INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',

  -- URLs
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,

  -- Dates
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  due_date TIMESTAMP,
  paid_at TIMESTAMP,

  -- Items summary
  line_items JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 7. EMAIL LOGS
-- ================================================
-- Historico de emails enviados

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relacionamentos
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Identificacao
  message_id VARCHAR(255),

  -- Destinatario
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),

  -- Conteudo
  template_name VARCHAR(100) NOT NULL,
  subject VARCHAR(500),

  -- Status
  status VARCHAR(50) DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),

  -- Categoria
  category VARCHAR(50) CHECK (category IN ('transactional', 'billing', 'notification', 'marketing')),

  -- Idioma
  language VARCHAR(10) DEFAULT 'en',

  -- Metadados
  metadata JSONB,

  -- Tracking
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 8. UPDATE ACCOUNTS TABLE
-- ================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'none';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS max_channels INTEGER DEFAULT 2;

-- ================================================
-- 9. INDEXES
-- ================================================

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_type);

-- Subscription Items
CREATE INDEX IF NOT EXISTS idx_sub_items_subscription ON subscription_items(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_items_type ON subscription_items(addon_type);
CREATE INDEX IF NOT EXISTS idx_sub_items_stripe ON subscription_items(stripe_subscription_item_id);

-- Credit Packages
CREATE INDEX IF NOT EXISTS idx_credit_packages_account ON credit_packages(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_packages_expires ON credit_packages(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_packages_type_status ON credit_packages(credit_type, status);
CREATE INDEX IF NOT EXISTS idx_credit_packages_stripe_checkout ON credit_packages(stripe_checkout_session_id);

-- Credit Usage
CREATE INDEX IF NOT EXISTS idx_credit_usage_account ON credit_usage(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_package ON credit_usage(credit_package_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_date ON credit_usage(used_at);
CREATE INDEX IF NOT EXISTS idx_credit_usage_type ON credit_usage(credit_type);

-- Stripe Webhook Events
CREATE INDEX IF NOT EXISTS idx_stripe_events_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received ON stripe_webhook_events(received_at);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Email Logs
CREATE INDEX IF NOT EXISTS idx_email_logs_account ON email_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_name);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

-- Accounts (new columns)
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer ON accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_subscription_status ON accounts(subscription_status);

-- ================================================
-- 10. TRIGGER: Auto-update updated_at
-- ================================================

CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_subscription ON subscriptions;
CREATE TRIGGER trigger_update_subscription
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS trigger_update_subscription_items ON subscription_items;
CREATE TRIGGER trigger_update_subscription_items
  BEFORE UPDATE ON subscription_items
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_updated_at();

-- ================================================
-- 11. FUNCTION: Get available credits
-- ================================================

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
    AND expires_at > NOW();

  RETURN total_credits;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 12. FUNCTION: Consume credits (FIFO)
-- ================================================

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

  -- Consume from oldest packages first (FIFO)
  FOR package_record IN
    SELECT id, remaining_credits
    FROM credit_packages
    WHERE account_id = p_account_id
      AND credit_type IN (p_credit_type, p_credit_type || '_monthly')
      AND status = 'active'
      AND expires_at > NOW()
      AND remaining_credits > 0
    ORDER BY expires_at ASC, purchased_at ASC
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
-- 13. FUNCTION: Expire old credits (for scheduled job)
-- ================================================

CREATE OR REPLACE FUNCTION expire_old_credits() RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE credit_packages
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at <= NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 14. VIEW: Account billing summary
-- ================================================

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
  -- Count add-ons
  (SELECT COALESCE(SUM(quantity), 0) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as extra_channels,
  (SELECT COALESCE(SUM(quantity), 0) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'user' AND si.is_active) as extra_users,
  -- Available credits
  get_available_credits(a.id, 'gmaps') as available_gmaps_credits,
  -- Usage counts
  (SELECT COUNT(*) FROM users u WHERE u.account_id = a.id) as current_users,
  (SELECT COUNT(*) FROM linkedin_accounts la WHERE la.account_id = a.id) as current_channels
FROM accounts a
LEFT JOIN subscriptions s ON s.account_id = a.id;

COMMIT;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 026 completed successfully!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - subscriptions (main subscription per account)';
  RAISE NOTICE '  - subscription_items (add-ons: channels, users)';
  RAISE NOTICE '  - credit_packages (Google Maps credits with expiration)';
  RAISE NOTICE '  - credit_usage (usage log)';
  RAISE NOTICE '  - stripe_webhook_events (webhook idempotency)';
  RAISE NOTICE '  - invoices (invoice cache)';
  RAISE NOTICE '  - email_logs (email tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - get_available_credits(account_id, type)';
  RAISE NOTICE '  - consume_credits(account_id, type, amount, ...)';
  RAISE NOTICE '  - expire_old_credits()';
  RAISE NOTICE '';
  RAISE NOTICE 'Created view:';
  RAISE NOTICE '  - account_billing_summary';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Configure Stripe products/prices in dashboard';
  RAISE NOTICE '  2. Set environment variables (STRIPE_SECRET_KEY, etc)';
  RAISE NOTICE '  3. Implement webhook endpoint';
  RAISE NOTICE '';
END $$;
