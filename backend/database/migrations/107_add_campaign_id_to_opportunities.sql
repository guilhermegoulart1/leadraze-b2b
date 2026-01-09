-- Migration 107: Adicionar campaign_id em opportunities
-- Necessário para vincular oportunidades a campanhas (LinkedIn, etc.)

BEGIN;

-- Adicionar campo campaign_id em opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

-- Criar índice para busca por campanha
CREATE INDEX IF NOT EXISTS idx_opportunities_campaign ON opportunities(campaign_id);

COMMIT;
