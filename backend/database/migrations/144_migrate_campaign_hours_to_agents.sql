-- Migration: Migrate campaign business hours to agent workingHours
-- The agent is now the single source of truth for business hours.
-- This migration copies campaign send hours to the agent's workingHours config
-- ONLY for agents that don't already have workingHours enabled.

-- Migrate: for each campaign that has a review config with send hours,
-- if the linked agent does NOT have workingHours.enabled = true,
-- set the agent's workingHours from the campaign's send hours.
UPDATE ai_agents aa
SET config = jsonb_set(
  COALESCE(
    CASE
      WHEN aa.config IS NULL THEN '{}'::jsonb
      WHEN pg_typeof(aa.config) = 'jsonb'::regtype THEN aa.config
      ELSE aa.config::jsonb
    END,
    '{}'::jsonb
  ),
  '{workingHours}',
  jsonb_build_object(
    'enabled', true,
    'timezone', COALESCE(crc.timezone, 'America/Sao_Paulo'),
    'startTime', LPAD(COALESCE(crc.send_start_hour, 9)::text, 2, '0') || ':00',
    'endTime', LPAD(COALESCE(crc.send_end_hour, 18)::text, 2, '0') || ':00',
    'days', '["mon","tue","wed","thu","fri"]'::jsonb,
    'outsideBehavior', 'queue',
    'awayMessage', 'Obrigado pelo contato! Estamos fora do horario de atendimento no momento. Responderemos assim que possivel!'
  )
),
updated_at = NOW()
FROM campaigns c
JOIN campaign_review_config crc ON crc.campaign_id = c.id
WHERE c.ai_agent_id = aa.id
  AND c.ai_agent_id IS NOT NULL
  AND (
    -- Agent has no config at all
    aa.config IS NULL
    OR aa.config::text = '{}'
    OR aa.config::text = 'null'
    -- Or agent config has no workingHours
    OR NOT (aa.config::jsonb ? 'workingHours')
    -- Or workingHours exists but is not enabled
    OR (aa.config::jsonb -> 'workingHours' ->> 'enabled')::boolean IS NOT TRUE
  );
