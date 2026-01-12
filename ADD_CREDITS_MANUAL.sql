-- EXECUTE ESTE SQL NO SEU BANCO DE DADOS PostgreSQL
-- Para adicionar 5000 créditos GMaps para teste@leadraze.com

DO $$
DECLARE
  v_account_id UUID;
  v_user_email TEXT := 'teste@leadraze.com';
BEGIN
  -- Buscar account_id do usuário
  SELECT account_id INTO v_account_id
  FROM users
  WHERE email = v_user_email;

  -- Verificar se o usuário existe
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Usuário % não encontrado', v_user_email;
  END IF;

  -- Adicionar 5000 créditos GMaps
  INSERT INTO credit_packages (
    account_id,
    credit_type,
    initial_credits,
    remaining_credits,
    expires_at,
    source,
    currency,
    status,
    created_at
  ) VALUES (
    v_account_id,
    'gmaps',
    5000,
    5000,
    NOW() + INTERVAL '90 days',  -- Válido por 90 dias
    'bonus',  -- Valores permitidos: 'purchase', 'purchase_onetime', 'subscription', 'bonus', 'refund'
    'USD',
    'active',
    NOW()
  );

  -- Mostrar total de créditos
  RAISE NOTICE '✅ 5000 créditos GMaps adicionados para account: %', v_account_id;
  RAISE NOTICE '📊 Total de créditos GMaps disponíveis: %',
    (SELECT get_available_credits(v_account_id, 'gmaps'));
END $$;
