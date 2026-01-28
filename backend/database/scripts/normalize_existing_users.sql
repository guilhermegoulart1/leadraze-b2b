-- Script para normalizar usuários pagantes existentes
-- Usuário 1: 46f0423c-8654-4bdc-8488-3b292489b56b (plano base + 1 canal extra)
-- Usuário 2: d7827615-878c-40c0-8f3e-7bc07cfc1e5e (plano base + 4 canais extras)

-- ============================================
-- PASSO 1: Verificar estado atual
-- ============================================

-- Verificar accounts
SELECT
  id,
  name,
  company_name,
  stripe_customer_id,
  subscription_status,
  preferred_currency
FROM accounts
WHERE id IN (
  '46f0423c-8654-4bdc-8488-3b292489b56b',
  'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
);

-- Verificar subscriptions
SELECT
  s.id as subscription_id,
  s.account_id,
  s.stripe_subscription_id,
  s.plan_type,
  s.status,
  s.max_channels,
  s.max_users,
  s.current_period_start,
  s.current_period_end
FROM subscriptions s
WHERE s.account_id IN (
  '46f0423c-8654-4bdc-8488-3b292489b56b',
  'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
);

-- Verificar subscription_items (add-ons)
SELECT
  si.id,
  si.subscription_id,
  s.account_id,
  si.addon_type,
  si.quantity,
  si.stripe_price_id,
  si.is_active
FROM subscription_items si
JOIN subscriptions s ON s.id = si.subscription_id
WHERE s.account_id IN (
  '46f0423c-8654-4bdc-8488-3b292489b56b',
  'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
);

-- ============================================
-- PASSO 2: Atualizar preferred_currency para BRL
-- ============================================

UPDATE accounts
SET preferred_currency = 'BRL'
WHERE id IN (
  '46f0423c-8654-4bdc-8488-3b292489b56b',
  'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
);

-- ============================================
-- PASSO 3: Verificar se subscription_items existem
-- Se não existirem, criar para os canais extras
-- ============================================

-- Para o usuário com 1 canal extra (46f0423c-8654-4bdc-8488-3b292489b56b)
-- Precisamos garantir que existe um subscription_item com addon_type='channel' e quantity=1

-- Para o usuário com 4 canais extras (d7827615-878c-40c0-8f3e-7bc07cfc1e5e)
-- Precisamos garantir que existe um subscription_item com addon_type='channel' e quantity=4

-- Verificar pricing table items para BRL (para obter o stripe_price_id correto)
SELECT * FROM pricing_table_items pti
JOIN pricing_tables pt ON pt.id = pti.pricing_table_id
WHERE pt.slug = 'default-brl'
AND pti.product_type = 'extra_channel';

-- ============================================
-- PASSO 4: Atualizar max_channels nas subscriptions
-- ============================================

-- Usuário 1: plano base (1 canal) + 1 extra = 2 canais total
UPDATE subscriptions
SET max_channels = 2
WHERE account_id = '46f0423c-8654-4bdc-8488-3b292489b56b';

-- Usuário 2: plano base (1 canal) + 4 extras = 5 canais total
UPDATE subscriptions
SET max_channels = 5
WHERE account_id = 'd7827615-878c-40c0-8f3e-7bc07cfc1e5e';

-- ============================================
-- PASSO 5: Verificar resultado final
-- ============================================

SELECT
  a.id,
  a.name,
  a.preferred_currency,
  s.plan_type,
  s.status,
  s.max_channels,
  s.max_users,
  (SELECT COUNT(*) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as channel_addons,
  (SELECT COALESCE(SUM(si.quantity), 0) FROM subscription_items si WHERE si.subscription_id = s.id AND si.addon_type = 'channel' AND si.is_active) as total_extra_channels
FROM accounts a
LEFT JOIN subscriptions s ON s.account_id = a.id
WHERE a.id IN (
  '46f0423c-8654-4bdc-8488-3b292489b56b',
  'd7827615-878c-40c0-8f3e-7bc07cfc1e5e'
);
