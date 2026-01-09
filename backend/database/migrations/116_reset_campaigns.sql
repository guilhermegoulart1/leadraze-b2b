-- Migration: 116_reset_campaigns.sql
-- Description: Limpar todas as campanhas

BEGIN;
SET session_replication_role = 'replica';
TRUNCATE TABLE campaigns CASCADE;
SET session_replication_role = 'origin';
COMMIT;
