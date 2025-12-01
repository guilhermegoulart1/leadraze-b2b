-- Migration 039: Sistema de Agente Facilitador e Rodízio de Atendentes
-- Adiciona suporte para:
-- 1. Agente Facilitador (handoff automático após X trocas)
-- 2. Sistema de rodízio de atendentes (round-robin)
-- 3. Sistema de notificações

-- ============================================
-- 1. NOVOS CAMPOS NA TABELA ai_agents
-- ============================================

-- Modo do agente: 'full' (completo) ou 'facilitator' (simplificado com handoff automático)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS agent_mode VARCHAR(20) DEFAULT 'full';

-- Número de trocas antes do handoff automático (apenas para facilitator ou quando configurado)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS handoff_after_exchanges INTEGER DEFAULT NULL;

-- Se a transferência é silenciosa (true) ou envia mensagem ao lead (false)
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS handoff_silent BOOLEAN DEFAULT true;

-- Mensagem enviada ao lead quando handoff_silent = false
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS handoff_message TEXT DEFAULT NULL;

-- Se deve notificar o atendente quando handoff ocorrer
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS notify_on_handoff BOOLEAN DEFAULT true;

-- ============================================
-- 2. TABELA DE RODÍZIO DE ATENDENTES
-- ============================================

CREATE TABLE IF NOT EXISTS agent_assignees (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rotation_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Cada usuário só pode estar uma vez por agente
    CONSTRAINT unique_agent_user UNIQUE (agent_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agent_assignees_agent ON agent_assignees(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignees_user ON agent_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignees_order ON agent_assignees(agent_id, rotation_order);

-- ============================================
-- 3. TABELA DE ESTADO DO RODÍZIO
-- ============================================

CREATE TABLE IF NOT EXISTS agent_rotation_state (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    last_assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_position INTEGER DEFAULT 0,
    total_assignments INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Apenas um estado por agente
    CONSTRAINT unique_agent_rotation UNIQUE (agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_rotation_agent ON agent_rotation_state(agent_id);

-- ============================================
-- 4. NOVOS CAMPOS NA TABELA conversations
-- ============================================

-- Contador de trocas completas (lead responde + IA responde = 1 troca)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS exchange_count INTEGER DEFAULT 0;

-- Timestamp de quando ocorreu o handoff
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMP DEFAULT NULL;

-- Motivo do handoff ('exchange_limit', 'escalation_sentiment', 'escalation_keyword', 'manual')
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS handoff_reason VARCHAR(100) DEFAULT NULL;

-- ============================================
-- 5. TABELA DE NOTIFICAÇÕES
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Tipo de notificação ('handoff', 'new_message', 'escalation', 'assignment')
    type VARCHAR(50) NOT NULL,

    -- Conteúdo
    title VARCHAR(255) NOT NULL,
    message TEXT,

    -- Referências opcionais
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,

    -- Metadata adicional (JSON)
    metadata JSONB DEFAULT '{}',

    -- Status de leitura
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_conversation ON notifications(conversation_id);

-- ============================================
-- 6. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

COMMENT ON COLUMN ai_agents.agent_mode IS 'Modo do agente: full (completo) ou facilitator (simplificado)';
COMMENT ON COLUMN ai_agents.handoff_after_exchanges IS 'Número de trocas antes do handoff automático';
COMMENT ON COLUMN ai_agents.handoff_silent IS 'Se true, transferência silenciosa. Se false, envia handoff_message';
COMMENT ON COLUMN ai_agents.handoff_message IS 'Mensagem enviada ao lead na transferência (quando handoff_silent=false)';
COMMENT ON COLUMN ai_agents.notify_on_handoff IS 'Se deve notificar o atendente quando handoff ocorrer';

COMMENT ON TABLE agent_assignees IS 'Usuários que participam do rodízio de atendimento do agente';
COMMENT ON COLUMN agent_assignees.rotation_order IS 'Ordem fixa no rodízio (1, 2, 3...)';

COMMENT ON TABLE agent_rotation_state IS 'Estado atual do rodízio round-robin por agente';
COMMENT ON COLUMN agent_rotation_state.current_position IS 'Posição atual no array de assignees';

COMMENT ON COLUMN conversations.exchange_count IS 'Número de trocas completas (lead+IA = 1 troca)';
COMMENT ON COLUMN conversations.handoff_reason IS 'Motivo do handoff: exchange_limit, escalation_sentiment, escalation_keyword, manual';

COMMENT ON TABLE notifications IS 'Notificações in-app para usuários';
