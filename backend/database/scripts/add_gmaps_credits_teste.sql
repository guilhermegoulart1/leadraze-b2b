-- Add 5000 GMaps credits to teste@leadraze.com for testing
-- Run this script: node backend/scripts/run-sql.js backend/database/scripts/add_gmaps_credits_teste.sql

DO $$
DECLARE
  v_account_id UUID;
  v_user_id UUID;
BEGIN
  -- Get account_id and user_id for teste@leadraze.com
  SELECT u.id, u.account_id INTO v_user_id, v_account_id
  FROM users u
  WHERE u.email = 'teste@leadraze.com';

  -- Check if user exists
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'User teste@leadraze.com not found';
  END IF;

  RAISE NOTICE 'Found user: % (account: %)', v_user_id, v_account_id;

  -- Add 5000 GMaps credits package
  -- Valid for 90 days, marked as 'bonus' source for testing
  -- Allowed sources: 'purchase', 'purchase_onetime', 'subscription', 'bonus', 'refund'
  INSERT INTO credit_packages (
    account_id,
    credit_type,
    initial_credits,
    remaining_credits,
    expires_at,
    source,
    currency,
    status
  ) VALUES (
    v_account_id,
    'gmaps',
    5000,
    5000,
    NOW() + INTERVAL '90 days',
    'bonus',
    'USD',
    'active'
  );

  RAISE NOTICE 'Successfully added 5000 GMaps credits to account %', v_account_id;

  -- Show current total credits
  RAISE NOTICE 'Total GMaps credits available: %', (
    SELECT get_available_credits(v_account_id, 'gmaps')
  );

END $$;
