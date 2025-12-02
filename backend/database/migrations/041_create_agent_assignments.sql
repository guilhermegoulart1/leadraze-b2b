-- Migration 041: Create Agent Assignments Log
-- Tracks all automatic assignments from round-robin rotation

-- ============================================
-- 1. TABELA DE LOG DE ATRIBUICOES
-- ============================================

CREATE TABLE IF NOT EXISTS agent_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Contexto da conta (multi-tenancy)
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- Referencias principais
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

    -- Usuario que recebeu a atribuicao
    assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Informacoes do round-robin
    rotation_position INTEGER,      -- posicao no rodizio (1, 2, 3...)
    total_assignees INTEGER,        -- total de usuarios no rodizio naquele momento

    -- Lead info (denormalized for quick display)
    lead_name VARCHAR(255),
    lead_company VARCHAR(255),
    lead_profile_picture TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. INDICES
-- ============================================

-- Indice principal por agente (listagem de atribuicoes do agente)
CREATE INDEX idx_agent_assignments_agent ON agent_assignments(agent_id, created_at DESC);

-- Indice por usuario (minhas atribuicoes)
CREATE INDEX idx_agent_assignments_user ON agent_assignments(assigned_to_user_id, created_at DESC);

-- Indice por account (multi-tenancy)
CREATE INDEX idx_agent_assignments_account ON agent_assignments(account_id, created_at DESC);

-- Indice por data (relatorios)
CREATE INDEX idx_agent_assignments_date ON agent_assignments(created_at DESC);

-- ============================================
-- 3. COMENTARIOS
-- ============================================

COMMENT ON TABLE agent_assignments IS 'Log de atribuicoes automaticas do sistema de round-robin';
COMMENT ON COLUMN agent_assignments.rotation_position IS 'Posicao do usuario no rodizio quando foi atribuido (1-based)';
COMMENT ON COLUMN agent_assignments.total_assignees IS 'Numero total de usuarios no rodizio naquele momento';
