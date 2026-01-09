-- Migration: 117_reset_google_maps_agents.sql
-- Description: Limpar agentes do Google Maps

BEGIN;
SET session_replication_role = 'replica';
TRUNCATE TABLE google_maps_agent_contacts CASCADE;
TRUNCATE TABLE google_maps_agents CASCADE;
SET session_replication_role = 'origin';
COMMIT;
