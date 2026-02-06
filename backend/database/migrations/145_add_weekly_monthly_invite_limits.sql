-- Migration 145: Add Weekly & Monthly Invite Limits
-- Alinha os limites de convites com os limites reais do LinkedIn:
-- - Limites SEMANAIS (LinkedIn usa semanal, não diário)
-- - Limite MENSAL de mensagens personalizadas (Free: 5-10/mês, Premium: ilimitado)
-- - Limite de caracteres por tipo de conta (Free: 200, Premium: 300)
-- - Tracking de message_included nos logs

-- =============================================
-- 1. Novas colunas em linkedin_accounts
-- =============================================

-- Limite semanal de convites (rolling 7 days)
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS weekly_limit INTEGER DEFAULT 100;

-- Limite mensal de convites COM mensagem personalizada
-- Free: 10, Premium/SalesNav/Recruiter: 99999 (efetivamente ilimitado)
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS monthly_message_limit INTEGER DEFAULT 10;

-- Limite de caracteres da nota de convite
-- Free: 200, Premium/SalesNav: 300
ALTER TABLE linkedin_accounts
ADD COLUMN IF NOT EXISTS note_char_limit INTEGER DEFAULT 200;

-- =============================================
-- 2. Adicionar message_included em linkedin_invite_logs
-- =============================================

ALTER TABLE linkedin_invite_logs
ADD COLUMN IF NOT EXISTS message_included BOOLEAN DEFAULT false;

-- Indice para contagem rapida de mensagens no mes (apenas com mensagem)
CREATE INDEX IF NOT EXISTS idx_invite_logs_message_monthly
ON linkedin_invite_logs(linkedin_account_id, sent_at)
WHERE message_included = true AND status = 'sent';

-- Indice para contagem rapida semanal
CREATE INDEX IF NOT EXISTS idx_invite_logs_weekly
ON linkedin_invite_logs(linkedin_account_id, sent_at)
WHERE status = 'sent';

-- =============================================
-- 3. Backfill contas existentes por tipo
-- =============================================

-- Free accounts
UPDATE linkedin_accounts SET
  weekly_limit = 100,
  monthly_message_limit = 10,
  note_char_limit = 200,
  daily_limit = CASE WHEN daily_limit IN (25, 50) THEN 20 ELSE daily_limit END
WHERE account_type = 'free' OR account_type IS NULL;

-- Premium accounts
UPDATE linkedin_accounts SET
  weekly_limit = 200,
  monthly_message_limit = 99999,
  note_char_limit = 300,
  daily_limit = CASE WHEN daily_limit = 50 THEN 35 ELSE daily_limit END
WHERE account_type = 'premium';

-- Sales Navigator accounts
UPDATE linkedin_accounts SET
  weekly_limit = 250,
  monthly_message_limit = 99999,
  note_char_limit = 300,
  daily_limit = CASE WHEN daily_limit = 80 THEN 40 ELSE daily_limit END
WHERE account_type = 'sales_navigator';

-- Recruiter accounts
UPDATE linkedin_accounts SET
  weekly_limit = 250,
  monthly_message_limit = 99999,
  note_char_limit = 300,
  daily_limit = CASE WHEN daily_limit = 80 THEN 40 ELSE daily_limit END
WHERE account_type = 'recruiter';

-- =============================================
-- 4. Comments
-- =============================================

COMMENT ON COLUMN linkedin_accounts.weekly_limit IS 'Max connection requests per rolling 7-day window. Free=100, Premium=200, SalesNav=250';
COMMENT ON COLUMN linkedin_accounts.monthly_message_limit IS 'Max personalized invite notes per calendar month. Free=10, Premium/SalesNav=99999 (unlimited)';
COMMENT ON COLUMN linkedin_accounts.note_char_limit IS 'Max characters for invite note. Free=200, Premium/SalesNav=300';
COMMENT ON COLUMN linkedin_invite_logs.message_included IS 'Whether a personalized note was included with the connection invite';
