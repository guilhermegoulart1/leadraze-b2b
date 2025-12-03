-- Migration 047: Sistema de Rodízio para Google Maps Agents
-- Adiciona suporte para distribuição de leads por rodízio de atendentes
-- Date: 2024-12-03

-- ============================================
-- 1. TABELA DE RODÍZIO DE ATENDENTES PARA GOOGLE MAPS AGENTS
-- ============================================

CREATE TABLE IF NOT EXISTS google_maps_agent_assignees (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES google_maps_agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rotation_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Cada usuário só pode estar uma vez por agente
    CONSTRAINT unique_gmaps_agent_user UNIQUE (agent_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gmaps_agent_assignees_agent ON google_maps_agent_assignees(agent_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_agent_assignees_user ON google_maps_agent_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_agent_assignees_order ON google_maps_agent_assignees(agent_id, rotation_order);

-- ============================================
-- 2. TABELA DE ESTADO DO RODÍZIO
-- ============================================

CREATE TABLE IF NOT EXISTS google_maps_agent_rotation_state (
    id SERIAL PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES google_maps_agents(id) ON DELETE CASCADE,
    last_assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_position INTEGER DEFAULT 0,
    total_assignments INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Apenas um estado por agente
    CONSTRAINT unique_gmaps_agent_rotation UNIQUE (agent_id)
);

CREATE INDEX IF NOT EXISTS idx_gmaps_agent_rotation_agent ON google_maps_agent_rotation_state(agent_id);

-- ============================================
-- 3. TABELA DE LOG DE ATRIBUIÇÕES
-- ============================================

CREATE TABLE IF NOT EXISTS google_maps_agent_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES google_maps_agents(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rotation_position INTEGER,
    total_assignees INTEGER,
    lead_name VARCHAR(255),
    lead_company VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gmaps_assignments_account ON google_maps_agent_assignments(account_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_assignments_agent ON google_maps_agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_assignments_user ON google_maps_agent_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_assignments_created ON google_maps_agent_assignments(created_at DESC);

-- ============================================
-- 4. ADICIONAR CAMPO assigned_user_id NA TABELA contacts (se não existir)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'assigned_user_id'
    ) THEN
        ALTER TABLE contacts ADD COLUMN assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_contacts_assigned_user ON contacts(assigned_user_id);
    END IF;
END $$;

-- ============================================
-- 5. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE google_maps_agent_assignees IS 'Usuários que participam do rodízio de atendimento do agente Google Maps';
COMMENT ON COLUMN google_maps_agent_assignees.rotation_order IS 'Ordem fixa no rodízio (1, 2, 3...)';

COMMENT ON TABLE google_maps_agent_rotation_state IS 'Estado atual do rodízio round-robin por agente Google Maps';
COMMENT ON COLUMN google_maps_agent_rotation_state.current_position IS 'Posição atual no array de assignees';

COMMENT ON TABLE google_maps_agent_assignments IS 'Log de atribuições de leads do Google Maps para usuários';
