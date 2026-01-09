-- Migration: 115_reset_all_data.sql
-- Description: Limpar todos os dados operacionais para começar do zero
-- Date: 2025-01-08

BEGIN;

-- Desabilitar triggers temporariamente
SET session_replication_role = 'replica';

-- Limpar cada tabela com tratamento de erro individual
DO $$
BEGIN
  -- Oportunidades
  BEGIN TRUNCATE TABLE opportunity_history CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunity_tags CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunity_comments CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunity_products CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunity_checklist_items CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunity_checklists CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunity_checklist_item_assignees CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE opportunities CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Leads (tabelas antigas)
  BEGIN TRUNCATE TABLE lead_tags CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE lead_comments CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE lead_products CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE checklist_item_assignees CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE checklist_items CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE checklists CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE leads CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Conversas e mensagens
  BEGIN TRUNCATE TABLE messages CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE conversations CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Contatos
  BEGIN TRUNCATE TABLE contacts CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Filas e logs
  BEGIN TRUNCATE TABLE campaign_invite_queue CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE linkedin_invite_logs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Notificações
  BEGIN TRUNCATE TABLE notifications CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Tasks
  BEGIN TRUNCATE TABLE task_assignees CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE tasks CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  RAISE NOTICE 'Todas as tabelas foram limpas com sucesso';
END $$;

-- Resetar contadores das campanhas (apenas colunas que existem)
DO $$
BEGIN
  UPDATE campaigns SET
    total_leads = 0,
    leads_pending = 0,
    leads_sent = 0,
    leads_accepted = 0,
    leads_qualified = 0,
    leads_discarded = 0,
    updated_at = NOW();
EXCEPTION WHEN undefined_column THEN
  -- Se alguma coluna não existir, tenta update básico
  UPDATE campaigns SET updated_at = NOW();
END $$;

-- Reabilitar triggers
SET session_replication_role = 'origin';

COMMIT;
