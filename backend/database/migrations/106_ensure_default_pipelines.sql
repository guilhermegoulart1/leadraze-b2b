-- Migration 106: Garantir pipeline padrão para todas as contas
-- Necessário para ETAPA 0.1 do plano de migração LEADS -> OPPORTUNITIES

BEGIN;

-- =====================================================
-- Criar pipelines padrão para contas que não têm
-- =====================================================
DO $$
DECLARE
  v_account RECORD;
  v_pipeline_id UUID;
  v_created_count INTEGER := 0;
BEGIN
  -- Iterar sobre contas que NÃO têm pipeline default
  FOR v_account IN
    SELECT a.id as account_id
    FROM accounts a
    WHERE NOT EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.account_id = a.id
      AND p.is_default = true
    )
  LOOP
    -- Criar pipeline default
    INSERT INTO pipelines (account_id, name, description, color, is_default, is_active)
    VALUES (
      v_account.account_id,
      'Pipeline Principal',
      'Pipeline padrão para gerenciamento de oportunidades',
      'blue',
      true,
      true
    )
    RETURNING id INTO v_pipeline_id;

    -- Criar etapas padrão
    INSERT INTO pipeline_stages (pipeline_id, name, color, position, is_win_stage, is_loss_stage)
    VALUES
      (v_pipeline_id, 'Novos', 'slate', 0, false, false),
      (v_pipeline_id, 'Contato Inicial', 'blue', 1, false, false),
      (v_pipeline_id, 'Qualificação', 'purple', 2, false, false),
      (v_pipeline_id, 'Proposta', 'amber', 3, false, false),
      (v_pipeline_id, 'Negociação', 'orange', 4, false, false),
      (v_pipeline_id, 'Fechado (Ganho)', 'emerald', 5, true, false),
      (v_pipeline_id, 'Fechado (Perdido)', 'red', 6, false, true);

    v_created_count := v_created_count + 1;
    RAISE NOTICE 'Pipeline padrão criada para conta: %', v_account.account_id;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de pipelines padrão criadas: %', v_created_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- Verificar resultado
-- =====================================================
DO $$
DECLARE
  v_total_accounts INTEGER;
  v_accounts_with_default INTEGER;
  v_accounts_without_default INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_accounts FROM accounts;

  SELECT COUNT(DISTINCT a.id) INTO v_accounts_with_default
  FROM accounts a
  JOIN pipelines p ON p.account_id = a.id AND p.is_default = true;

  v_accounts_without_default := v_total_accounts - v_accounts_with_default;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO FINAL';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de contas: %', v_total_accounts;
  RAISE NOTICE 'Contas COM pipeline default: %', v_accounts_with_default;
  RAISE NOTICE 'Contas SEM pipeline default: %', v_accounts_without_default;

  IF v_accounts_without_default > 0 THEN
    RAISE WARNING 'Ainda existem contas sem pipeline default!';
  ELSE
    RAISE NOTICE 'Todas as contas têm pipeline default.';
  END IF;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
