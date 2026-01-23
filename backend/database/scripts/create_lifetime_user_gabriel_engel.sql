-- Script: Criar usuário com acesso vitalício para gabriel.engel@gmail.com
-- Data: 2026-01-23
-- Limites: 1 canal, 3 usuários, 1.000 créditos IA, 200 créditos Google Maps

DO $$
DECLARE
  v_account_id UUID;
  v_user_id UUID;
  v_subscription_id UUID;
BEGIN
  -- Verificar se o usuário já existe
  IF EXISTS (SELECT 1 FROM users WHERE email = 'gabriel.engel@gmail.com') THEN
    RAISE EXCEPTION 'Usuário gabriel.engel@gmail.com já existe no sistema';
  END IF;

  -- 1. Criar Account
  INSERT INTO accounts (
    id, name, slug, company_email, plan,
    max_users, max_channels, is_active, subscription_status,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    'Gabriel Engel',
    'gabriel-engel-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    'gabriel.engel@gmail.com',
    'lifetime',
    3,
    1,
    true,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_account_id;

  RAISE NOTICE 'Account criada: %', v_account_id;

  -- 2. Criar User (admin da account)
  INSERT INTO users (
    id, email, password_hash, name, account_id, role, is_active, subscription_tier,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    'gabriel.engel@gmail.com',
    '$2b$10$LIFETIME_USER_NEEDS_PASSWORD_RESET',
    'Gabriel Engel',
    v_account_id,
    'admin',
    true,
    'lifetime',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_user_id;

  RAISE NOTICE 'Usuário criado: %', v_user_id;

  -- 3. Criar Subscription (vitalícia)
  INSERT INTO subscriptions (
    id, account_id, stripe_customer_id, plan_type, status,
    max_channels, max_users, monthly_gmaps_credits, monthly_ai_credits,
    current_period_start, current_period_end,
    created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_account_id,
    'manual_lifetime_' || v_account_id::TEXT,
    'lifetime',
    'active',
    1,     -- 1 canal
    3,     -- 3 usuários
    0,     -- Créditos são vitalícios, não mensais
    0,     -- Créditos são vitalícios, não mensais
    NOW(),
    '2099-12-31 23:59:59'::TIMESTAMP WITH TIME ZONE,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_subscription_id;

  RAISE NOTICE 'Subscription criada: %', v_subscription_id;

  -- 4. Créditos de IA (1.000 vitalícios)
  INSERT INTO credit_packages (
    id, account_id, credit_type, initial_credits, remaining_credits,
    expires_at, never_expires, status, source,
    purchased_at
  )
  VALUES (
    gen_random_uuid(),
    v_account_id,
    'ai',
    1000,
    1000,
    '2099-12-31 23:59:59'::TIMESTAMP WITH TIME ZONE,
    true,
    'active',
    'bonus',
    NOW()
  );

  RAISE NOTICE 'Créditos de IA adicionados: 1000';

  -- 5. Créditos Google Maps (200 vitalícios)
  INSERT INTO credit_packages (
    id, account_id, credit_type, initial_credits, remaining_credits,
    expires_at, never_expires, status, source,
    purchased_at
  )
  VALUES (
    gen_random_uuid(),
    v_account_id,
    'gmaps',
    200,
    200,
    '2099-12-31 23:59:59'::TIMESTAMP WITH TIME ZONE,
    true,
    'active',
    'bonus',
    NOW()
  );

  RAISE NOTICE 'Créditos Google Maps adicionados: 200';

  -- Resumo final
  RAISE NOTICE '========================================';
  RAISE NOTICE 'USUÁRIO VITALÍCIO CRIADO COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email: gabriel.engel@gmail.com';
  RAISE NOTICE 'Account ID: %', v_account_id;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Subscription ID: %', v_subscription_id;
  RAISE NOTICE 'Limites: 1 canal, 3 usuários';
  RAISE NOTICE 'Créditos: 1000 IA, 200 Google Maps (vitalícios)';
  RAISE NOTICE '========================================';

END $$;

-- Verificação final
SELECT
  a.id as account_id,
  a.name,
  a.company_email,
  a.max_users,
  a.max_channels,
  a.subscription_status,
  s.status as subscription_status,
  s.plan_type,
  s.current_period_end,
  (SELECT SUM(remaining_credits) FROM credit_packages WHERE account_id = a.id AND credit_type = 'ai') as ai_credits,
  (SELECT SUM(remaining_credits) FROM credit_packages WHERE account_id = a.id AND credit_type = 'gmaps') as gmaps_credits
FROM accounts a
LEFT JOIN subscriptions s ON s.account_id = a.id
WHERE a.company_email = 'gabriel.engel@gmail.com';
