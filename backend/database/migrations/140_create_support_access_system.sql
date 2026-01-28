-- Migration: Sistema de Acesso de Suporte (Impersonação)
-- Permite que operadores acessem contas de clientes com consentimento explícito
-- Compliance: LGPD/GDPR - consentimento, auditoria, revogação

-- ============================================
-- TABELA: support_access_tokens
-- Tokens gerados pelo cliente para autorizar acesso
-- ============================================
CREATE TABLE IF NOT EXISTS support_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Token (nunca armazenar plain text)
  token_hash VARCHAR(255) NOT NULL,
  token_prefix VARCHAR(16) NOT NULL,  -- "sat_xxxx" para identificação visual

  -- Quem criou o token
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Para quem é o token (opcional - restringe uso)
  operator_email VARCHAR(255),
  operator_name VARCHAR(255),

  -- Escopo de permissões
  scope JSONB DEFAULT '["read", "configure_agents"]'::jsonb,
  -- Escopos disponíveis:
  -- read: visualizar dados
  -- configure_agents: criar/editar agentes
  -- configure_campaigns: criar/editar campanhas
  -- configure_workflows: criar/editar workflows
  -- view_conversations: ver conversas
  -- manage_contacts: gerenciar contatos
  -- manage_leads: gerenciar leads
  -- full_admin: todas permissões (exceto billing/users)

  -- Validade
  expires_at TIMESTAMP NOT NULL,
  original_expires_at TIMESTAMP NOT NULL,  -- Para tracking de extensões
  max_uses INTEGER DEFAULT NULL,  -- Limite de usos (null = ilimitado)
  use_count INTEGER DEFAULT 0,

  -- Extensões
  extension_count INTEGER DEFAULT 0,
  max_extensions INTEGER DEFAULT 3,  -- Máximo de vezes que pode ser estendido
  last_extended_at TIMESTAMP,
  last_extended_by UUID REFERENCES users(id),

  -- Status
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,

  -- Metadados
  purpose TEXT,  -- "Configuração inicial de agentes"
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_support_tokens_account_id ON support_access_tokens(account_id);
CREATE INDEX idx_support_tokens_token_hash ON support_access_tokens(token_hash);
CREATE INDEX idx_support_tokens_is_active ON support_access_tokens(is_active);
CREATE INDEX idx_support_tokens_expires_at ON support_access_tokens(expires_at);
CREATE INDEX idx_support_tokens_created_by ON support_access_tokens(created_by);

-- ============================================
-- TABELA: support_access_sessions
-- Sessões ativas de acesso de suporte
-- ============================================
CREATE TABLE IF NOT EXISTS support_access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES support_access_tokens(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identificação do operador
  operator_name VARCHAR(255) NOT NULL,
  operator_email VARCHAR(255),
  operator_identifier VARCHAR(255) NOT NULL,  -- Hash ou ID único

  -- Sessão JWT
  session_token_hash VARCHAR(255) NOT NULL,

  -- Contexto da sessão
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Status
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  end_reason VARCHAR(50),  -- 'manual', 'token_revoked', 'token_expired', 'inactivity'
  is_active BOOLEAN DEFAULT true,

  -- Métricas
  actions_count INTEGER DEFAULT 0,
  last_action_at TIMESTAMP
);

-- Índices
CREATE INDEX idx_support_sessions_token_id ON support_access_sessions(token_id);
CREATE INDEX idx_support_sessions_account_id ON support_access_sessions(account_id);
CREATE INDEX idx_support_sessions_is_active ON support_access_sessions(is_active);
CREATE INDEX idx_support_sessions_started_at ON support_access_sessions(started_at);

-- ============================================
-- TABELA: support_access_audit_log
-- Log completo de todas as ações realizadas
-- ============================================
CREATE TABLE IF NOT EXISTS support_access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES support_access_sessions(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES support_access_tokens(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Ação realizada
  action_type VARCHAR(100) NOT NULL,
  -- Tipos: 'view', 'create', 'update', 'delete', 'session_start', 'session_end'

  resource_type VARCHAR(100),
  -- Tipos: 'ai_agents', 'campaigns', 'workflows', 'conversations', 'leads', 'contacts'

  resource_id UUID,
  resource_name VARCHAR(255),  -- Nome do recurso para fácil identificação

  -- Detalhes da ação
  action_details JSONB,  -- Dados específicos (before/after para updates)

  -- Request HTTP
  endpoint VARCHAR(255),
  http_method VARCHAR(10),
  request_body_summary JSONB,  -- Resumo do body (sem dados sensíveis)
  response_status INTEGER,

  -- Contexto
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas de auditoria
CREATE INDEX idx_support_audit_session_id ON support_access_audit_log(session_id);
CREATE INDEX idx_support_audit_token_id ON support_access_audit_log(token_id);
CREATE INDEX idx_support_audit_account_id ON support_access_audit_log(account_id);
CREATE INDEX idx_support_audit_action_type ON support_access_audit_log(action_type);
CREATE INDEX idx_support_audit_resource_type ON support_access_audit_log(resource_type);
CREATE INDEX idx_support_audit_created_at ON support_access_audit_log(created_at);

-- ============================================
-- TRIGGER: Atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_support_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_support_tokens_updated_at
  BEFORE UPDATE ON support_access_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tokens_updated_at();

-- ============================================
-- FUNÇÃO: Limpar sessões inativas automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_inactive_support_sessions()
RETURNS INTEGER AS $$
DECLARE
  closed_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Encerrar sessões de tokens expirados
  UPDATE support_access_sessions
  SET
    is_active = false,
    ended_at = CURRENT_TIMESTAMP,
    end_reason = 'token_expired'
  WHERE is_active = true
    AND token_id IN (
      SELECT id FROM support_access_tokens
      WHERE expires_at < CURRENT_TIMESTAMP OR is_active = false
    );

  GET DIAGNOSTICS temp_count = ROW_COUNT;
  closed_count := closed_count + temp_count;

  -- Encerrar sessões inativas por mais de 4 horas
  UPDATE support_access_sessions
  SET
    is_active = false,
    ended_at = CURRENT_TIMESTAMP,
    end_reason = 'inactivity'
  WHERE is_active = true
    AND last_action_at < CURRENT_TIMESTAMP - INTERVAL '4 hours';

  GET DIAGNOSTICS temp_count = ROW_COUNT;
  closed_count := closed_count + temp_count;

  RETURN closed_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Tokens ativos com estatísticas
-- ============================================
CREATE OR REPLACE VIEW support_tokens_with_stats AS
SELECT
  t.*,
  a.name as account_name,
  u.name as created_by_name,
  u.email as created_by_email,
  (SELECT COUNT(*) FROM support_access_sessions s WHERE s.token_id = t.id) as total_sessions,
  (SELECT COUNT(*) FROM support_access_sessions s WHERE s.token_id = t.id AND s.is_active = true) as active_sessions,
  (SELECT COUNT(*) FROM support_access_audit_log l WHERE l.token_id = t.id) as total_actions,
  CASE
    WHEN t.revoked_at IS NOT NULL THEN 'revoked'
    WHEN t.expires_at < CURRENT_TIMESTAMP THEN 'expired'
    WHEN t.is_active = false THEN 'inactive'
    ELSE 'active'
  END as status
FROM support_access_tokens t
JOIN accounts a ON t.account_id = a.id
JOIN users u ON t.created_by = u.id;

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
COMMENT ON TABLE support_access_tokens IS 'Tokens de acesso temporário para suporte - permite que operadores acessem contas com consentimento do cliente';
COMMENT ON TABLE support_access_sessions IS 'Sessões ativas de acesso de suporte - rastreia quando e como os tokens são usados';
COMMENT ON TABLE support_access_audit_log IS 'Log de auditoria completo de todas ações realizadas durante acesso de suporte - compliance LGPD/GDPR';
COMMENT ON COLUMN support_access_tokens.scope IS 'Array JSON de permissões: read, configure_agents, configure_campaigns, configure_workflows, view_conversations, manage_contacts, manage_leads, full_admin';
COMMENT ON COLUMN support_access_tokens.extension_count IS 'Número de vezes que o token foi estendido (máx 3 por padrão)';
