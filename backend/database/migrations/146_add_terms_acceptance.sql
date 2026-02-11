-- Migration 146: Add Terms Acceptance Tracking
-- Adiciona campos para rastrear o aceite dos Termos de Uso e Política de Privacidade.
-- Usuários existentes terão NULL, forçando a exibição do modal de aceite.
-- O campo terms_version permite forçar re-aceite quando os termos mudarem.

-- =============================================
-- 1. Novas colunas em users
-- =============================================

-- Data/hora em que o usuário aceitou os termos
ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL;

-- Versão dos termos que o usuário aceitou (ex: "2026-02-11")
ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NULL;

-- =============================================
-- 2. Índice para queries
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_terms_accepted_at ON users(terms_accepted_at);

-- =============================================
-- 3. Comentários
-- =============================================

COMMENT ON COLUMN users.terms_accepted_at IS 'Timestamp do aceite dos Termos de Uso e Política de Privacidade';
COMMENT ON COLUMN users.terms_version IS 'Versão dos termos aceitos (formato: YYYY-MM-DD). Se diferente da versão atual, o usuário precisa re-aceitar';
