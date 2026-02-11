-- Migration 147: Create Terms Acceptance Audit Log
-- Registra TODOS os aceites de termos com dados completos para compliance/auditoria.
-- Cada aceite gera um novo registro (nunca sobrescreve), mantendo historico completo.

CREATE TABLE IF NOT EXISTS terms_acceptance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  terms_version VARCHAR(20) NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  email VARCHAR(255),
  user_name VARCHAR(255),
  action VARCHAR(20) NOT NULL DEFAULT 'accept',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indices para queries de auditoria
CREATE INDEX IF NOT EXISTS idx_terms_logs_user_id ON terms_acceptance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_terms_logs_account_id ON terms_acceptance_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_terms_logs_accepted_at ON terms_acceptance_logs(accepted_at);
CREATE INDEX IF NOT EXISTS idx_terms_logs_version ON terms_acceptance_logs(terms_version);

-- Comentarios
COMMENT ON TABLE terms_acceptance_logs IS 'Audit log de todos os aceites de Termos de Uso e Politica de Privacidade';
COMMENT ON COLUMN terms_acceptance_logs.user_id IS 'Usuario que aceitou';
COMMENT ON COLUMN terms_acceptance_logs.account_id IS 'Conta/workspace do usuario no momento do aceite';
COMMENT ON COLUMN terms_acceptance_logs.terms_version IS 'Versao dos termos aceitos (YYYY-MM-DD)';
COMMENT ON COLUMN terms_acceptance_logs.accepted_at IS 'Momento exato do aceite';
COMMENT ON COLUMN terms_acceptance_logs.ip_address IS 'IP do usuario no momento do aceite';
COMMENT ON COLUMN terms_acceptance_logs.user_agent IS 'User-Agent do navegador no momento do aceite';
COMMENT ON COLUMN terms_acceptance_logs.email IS 'Email do usuario no momento do aceite (snapshot)';
COMMENT ON COLUMN terms_acceptance_logs.user_name IS 'Nome do usuario no momento do aceite (snapshot)';
COMMENT ON COLUMN terms_acceptance_logs.action IS 'Tipo de acao: accept, re-accept';
