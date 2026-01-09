-- Migration: 118_reset_all_remaining.sql
-- Description: Limpar todos os dados residuais (pipelines, projetos, logs)

BEGIN;
SET session_replication_role = 'replica';

DO $$
BEGIN
  -- Pipelines e Projetos CRM
  BEGIN TRUNCATE TABLE pipeline_users CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE pipeline_stages CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE pipelines CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE crm_projects CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Jobs e Logs
  BEGIN TRUNCATE TABLE bulk_collection_jobs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE webhook_logs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE activity_logs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE daily_analytics CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Workflow executions
  BEGIN TRUNCATE TABLE workflow_executions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE workflow_execution_logs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Secret Agent logs
  BEGIN TRUNCATE TABLE secret_agent_coaching_sessions CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN TRUNCATE TABLE google_maps_execution_logs CASCADE; EXCEPTION WHEN undefined_table THEN NULL; END;

  RAISE NOTICE 'Todos os dados residuais foram limpos';
END $$;

SET session_replication_role = 'origin';
COMMIT;
