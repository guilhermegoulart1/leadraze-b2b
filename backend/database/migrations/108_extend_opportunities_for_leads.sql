-- Migration 108: Estender tabela opportunities com campos de leads
-- Fase 1 do plano de migração LEADS -> OPPORTUNITIES

BEGIN;

-- =====================================================
-- Campos de campanha LinkedIn
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS qualifying_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- Campos de fila de convites
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS invite_queued_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS invite_expired_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- Campos de qualificação IA
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_size VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS budget VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS timeline VARCHAR(100);

-- =====================================================
-- Campos de descarte
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS discard_reason_id UUID REFERENCES discard_reasons(id) ON DELETE SET NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS discard_notes TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS discarded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS previous_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- =====================================================
-- Score, notes e closure_notes
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closure_notes TEXT;

-- =====================================================
-- LinkedIn identifiers
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS linkedin_profile_id VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- =====================================================
-- Sector (para multi-tenancy)
-- =====================================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL;

-- =====================================================
-- Índices adicionais
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_opportunities_linkedin_profile ON opportunities(linkedin_profile_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_sent_at ON opportunities(sent_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_accepted_at ON opportunities(accepted_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_scheduled_at ON opportunities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_sector ON opportunities(sector_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_discard_reason ON opportunities(discard_reason_id);

-- =====================================================
-- Comentários
-- =====================================================
COMMENT ON COLUMN opportunities.campaign_id IS 'Referência à campanha LinkedIn (opcional)';
COMMENT ON COLUMN opportunities.sent_at IS 'Data do envio do convite LinkedIn';
COMMENT ON COLUMN opportunities.accepted_at IS 'Data da aceitação do convite LinkedIn';
COMMENT ON COLUMN opportunities.qualifying_started_at IS 'Data de início da qualificação por IA';
COMMENT ON COLUMN opportunities.qualified_at IS 'Data da qualificação completa';
COMMENT ON COLUMN opportunities.scheduled_at IS 'Data do agendamento de reunião';
COMMENT ON COLUMN opportunities.linkedin_profile_id IS 'ID do perfil LinkedIn (para deduplicação)';
COMMENT ON COLUMN opportunities.score IS 'Pontuação de qualificação (0-100)';
COMMENT ON COLUMN opportunities.discard_reason_id IS 'Motivo de descarte da oportunidade';

COMMIT;
