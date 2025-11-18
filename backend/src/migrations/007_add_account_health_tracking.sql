-- Migration 007: Account Health Tracking
-- Adiciona campos e tabelas para tracking de saúde da conta LinkedIn

-- ================================
-- 1. Adicionar campos na tabela linkedin_accounts
-- ================================

-- Adicionar campo account_type (free, premium, sales_navigator, recruiter)
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'free';

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_account_type
ON linkedin_accounts(account_type);

-- ================================
-- 2. Atualizar tabela linkedin_invite_logs
-- ================================

-- Adicionar campo accepted_at para tracking de aceitação
ALTER TABLE linkedin_invite_logs
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

-- Adicionar índice para cálculo de taxa de aceitação
CREATE INDEX IF NOT EXISTS idx_invite_logs_accepted
ON linkedin_invite_logs(linkedin_account_id, accepted_at)
WHERE accepted_at IS NOT NULL;

-- ================================
-- 3. Criar tabela de histórico de alterações de limite
-- ================================

CREATE TABLE IF NOT EXISTS linkedin_account_limit_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  old_limit INTEGER NOT NULL,
  new_limit INTEGER NOT NULL,
  recommended_limit INTEGER,
  changed_by UUID REFERENCES users(id),
  is_manual_override BOOLEAN DEFAULT FALSE,
  reason TEXT,
  risk_level VARCHAR(20), -- 'low', 'medium', 'high'
  account_health_score INTEGER, -- 0-100
  acceptance_rate DECIMAL(5,2), -- % de aceitação no momento da mudança
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_limit_changes_account
ON linkedin_account_limit_changes(linkedin_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_limit_changes_date
ON linkedin_account_limit_changes(created_at DESC);

-- ================================
-- 4. Criar tabela de métricas de account health
-- ================================

CREATE TABLE IF NOT EXISTS linkedin_account_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Métricas de convites
  invites_sent INTEGER DEFAULT 0,
  invites_accepted INTEGER DEFAULT 0,
  invites_pending INTEGER DEFAULT 0,
  invites_rejected INTEGER DEFAULT 0,

  -- Taxas calculadas
  acceptance_rate DECIMAL(5,2) DEFAULT 0, -- %
  response_time_hours DECIMAL(10,2), -- Tempo médio de resposta em horas

  -- Health score
  health_score INTEGER DEFAULT 100, -- 0-100
  risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high'

  -- Timestamps
  calculated_at TIMESTAMP DEFAULT NOW(),

  -- Constraint: Uma métrica por conta por dia
  UNIQUE(linkedin_account_id, date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_health_metrics_account_date
ON linkedin_account_health_metrics(linkedin_account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_health_metrics_health_score
ON linkedin_account_health_metrics(health_score);

-- ================================
-- 5. Atualizar constraint de status em linkedin_invite_logs
-- ================================

-- Remover constraint antiga se existir
ALTER TABLE linkedin_invite_logs
DROP CONSTRAINT IF EXISTS check_invite_status;

-- Adicionar nova constraint com 'accepted'
ALTER TABLE linkedin_invite_logs
ADD CONSTRAINT check_invite_status
CHECK (status IN ('sent', 'failed', 'pending', 'accepted', 'rejected'));

-- ================================
-- 6. Função auxiliar: Calcular métricas de health
-- ================================

CREATE OR REPLACE FUNCTION calculate_account_health_metrics(
  p_linkedin_account_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  invites_sent BIGINT,
  invites_accepted BIGINT,
  acceptance_rate DECIMAL,
  avg_response_time_hours DECIMAL,
  health_score INTEGER
) AS $$
DECLARE
  v_sent BIGINT;
  v_accepted BIGINT;
  v_rate DECIMAL;
  v_avg_time DECIMAL;
  v_score INTEGER;
BEGIN
  -- Contar convites enviados
  SELECT COUNT(*) INTO v_sent
  FROM linkedin_invite_logs
  WHERE linkedin_account_id = p_linkedin_account_id
    AND sent_at >= NOW() - (p_days || ' days')::INTERVAL
    AND status IN ('sent', 'accepted');

  -- Contar convites aceitos
  SELECT COUNT(*) INTO v_accepted
  FROM linkedin_invite_logs
  WHERE linkedin_account_id = p_linkedin_account_id
    AND accepted_at >= NOW() - (p_days || ' days')::INTERVAL
    AND status = 'accepted';

  -- Calcular taxa de aceitação
  IF v_sent > 0 THEN
    v_rate := (v_accepted::DECIMAL / v_sent::DECIMAL) * 100;
  ELSE
    v_rate := 0;
  END IF;

  -- Calcular tempo médio de resposta
  SELECT AVG(EXTRACT(EPOCH FROM (accepted_at - sent_at)) / 3600) INTO v_avg_time
  FROM linkedin_invite_logs
  WHERE linkedin_account_id = p_linkedin_account_id
    AND accepted_at >= NOW() - (p_days || ' days')::INTERVAL
    AND status = 'accepted'
    AND accepted_at IS NOT NULL;

  -- Calcular health score (0-100)
  v_score := 100;

  -- Penalizar taxa de aceitação baixa
  IF v_rate < 15 THEN
    v_score := v_score - 40;
  ELSIF v_rate < 25 THEN
    v_score := v_score - 20;
  ELSIF v_rate < 35 THEN
    v_score := v_score - 10;
  END IF;

  -- Penalizar se enviou muitos convites
  IF v_sent > 500 THEN
    v_score := v_score - 15;
  ELSIF v_sent > 300 THEN
    v_score := v_score - 10;
  END IF;

  -- Bonus para taxa alta
  IF v_rate > 50 THEN
    v_score := v_score + 10;
  END IF;

  -- Garantir que está entre 0 e 100
  v_score := GREATEST(0, LEAST(100, v_score));

  RETURN QUERY SELECT v_sent, v_accepted, v_rate, v_avg_time, v_score;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 7. View para facilitar consultas de health
-- ================================

CREATE OR REPLACE VIEW vw_linkedin_account_health AS
SELECT
  la.id as account_id,
  la.profile_name,
  la.account_type,
  la.daily_limit,
  la.status,

  -- Métricas dos últimos 7 dias
  (SELECT invites_sent FROM calculate_account_health_metrics(la.id, 7)) as sent_7d,
  (SELECT invites_accepted FROM calculate_account_health_metrics(la.id, 7)) as accepted_7d,
  (SELECT acceptance_rate FROM calculate_account_health_metrics(la.id, 7)) as acceptance_rate_7d,

  -- Métricas dos últimos 30 dias
  (SELECT invites_sent FROM calculate_account_health_metrics(la.id, 30)) as sent_30d,
  (SELECT invites_accepted FROM calculate_account_health_metrics(la.id, 30)) as accepted_30d,
  (SELECT acceptance_rate FROM calculate_account_health_metrics(la.id, 30)) as acceptance_rate_30d,

  -- Health score
  (SELECT health_score FROM calculate_account_health_metrics(la.id, 30)) as health_score,

  -- Última alteração de limite
  (
    SELECT created_at
    FROM linkedin_account_limit_changes
    WHERE linkedin_account_id = la.id
    ORDER BY created_at DESC
    LIMIT 1
  ) as last_limit_change,

  la.connected_at,
  EXTRACT(DAY FROM NOW() - la.connected_at) as account_age_days

FROM linkedin_accounts la
WHERE la.status = 'active';

-- ================================
-- ROLLBACK (caso necessário)
-- ================================

-- Para reverter esta migration, execute:
/*
DROP VIEW IF EXISTS vw_linkedin_account_health;
DROP FUNCTION IF EXISTS calculate_account_health_metrics;
DROP TABLE IF EXISTS linkedin_account_health_metrics;
DROP TABLE IF EXISTS linkedin_account_limit_changes;
ALTER TABLE linkedin_invite_logs DROP COLUMN IF EXISTS accepted_at;
ALTER TABLE linkedin_accounts DROP COLUMN IF EXISTS account_type;
*/
