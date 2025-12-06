-- Migration: 060_campaign_invite_system.sql
-- Description: Sistema de fila de convites para campanhas de LinkedIn
-- Date: 2024-12-04

-- ============================================
-- 1. Tabela de configuração de revisão da campanha
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_review_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id UUID UNIQUE NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Round Robin
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  round_robin_users UUID[] DEFAULT '{}',

  -- Configurações de Convite
  invite_expiry_days INTEGER DEFAULT 7 CHECK (invite_expiry_days BETWEEN 1 AND 14),
  max_pending_invites INTEGER DEFAULT 100,
  withdraw_expired_invites BOOLEAN DEFAULT true,

  -- Horário de Envio (configurável)
  send_start_hour INTEGER DEFAULT 9 CHECK (send_start_hour BETWEEN 0 AND 23),
  send_end_hour INTEGER DEFAULT 18 CHECK (send_end_hour BETWEEN 0 AND 23),
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',

  -- Configurações do Agente de IA
  ai_initiate_delay_min INTEGER DEFAULT 5,
  ai_initiate_delay_max INTEGER DEFAULT 60,

  -- Status da Revisão
  is_reviewed BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para campaign_review_config
CREATE INDEX IF NOT EXISTS idx_campaign_review_config_account ON campaign_review_config(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_review_config_sector ON campaign_review_config(sector_id);

-- ============================================
-- 2. Tabela de fila de convites
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_invite_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,

  -- Status do convite na fila
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'accepted', 'expired', 'withdrawn', 'failed')),
  priority INTEGER DEFAULT 0,

  -- Agendamento
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,

  -- Expiração
  expires_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,

  -- Tracking do job
  bull_job_id VARCHAR(255),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para campaign_invite_queue
CREATE INDEX IF NOT EXISTS idx_invite_queue_account ON campaign_invite_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_invite_queue_campaign ON campaign_invite_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_invite_queue_lead ON campaign_invite_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_invite_queue_linkedin_account ON campaign_invite_queue(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_invite_queue_status ON campaign_invite_queue(status);
CREATE INDEX IF NOT EXISTS idx_invite_queue_scheduled ON campaign_invite_queue(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_invite_queue_expires ON campaign_invite_queue(expires_at) WHERE status = 'sent';

-- ============================================
-- 3. Alterações na tabela campaigns
-- ============================================
DO $$
BEGIN
  -- Contador de convites pendentes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'pending_invites_count') THEN
    ALTER TABLE campaigns ADD COLUMN pending_invites_count INTEGER DEFAULT 0;
  END IF;

  -- Flag de revisão completa
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'review_completed') THEN
    ALTER TABLE campaigns ADD COLUMN review_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 4. Alterações na tabela leads
-- ============================================
DO $$
BEGIN
  -- Timestamp de quando foi adicionado à fila
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'invite_queued_at') THEN
    ALTER TABLE leads ADD COLUMN invite_queued_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Timestamp de expiração do convite
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'invite_expires_at') THEN
    ALTER TABLE leads ADD COLUMN invite_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Timestamp de quando expirou
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'invite_expired_at') THEN
    ALTER TABLE leads ADD COLUMN invite_expired_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Timestamp de distribuição round robin
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'round_robin_distributed_at') THEN
    ALTER TABLE leads ADD COLUMN round_robin_distributed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- ============================================
-- 5. Atualizar constraint de status dos leads
-- ============================================
DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'check_status' AND table_name = 'leads') THEN
    ALTER TABLE leads DROP CONSTRAINT check_status;
  END IF;

  -- Adicionar nova constraint com novos status
  ALTER TABLE leads ADD CONSTRAINT check_status CHECK (
    status IN (
      'lead', 'leads', 'invite_queued', 'invite_sent', 'invite_expired',
      'accepted', 'qualifying', 'qualified', 'discarded', 'scheduled', 'won', 'lost'
    )
  );
EXCEPTION
  WHEN others THEN
    -- Constraint pode não existir, ignorar erro
    NULL;
END $$;

-- ============================================
-- 6. Criar tag para convites não aceitos
-- ============================================
INSERT INTO tags (name, color, category, description)
VALUES ('Convite não aceito', 'gray', 'status', 'Convite do LinkedIn expirou sem resposta')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 7. Adicionar campo link à tabela notifications (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'link') THEN
    ALTER TABLE notifications ADD COLUMN link VARCHAR(500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'campaign_id') THEN
    ALTER TABLE notifications ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 8. Trigger para atualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para campaign_review_config
DROP TRIGGER IF EXISTS update_campaign_review_config_updated_at ON campaign_review_config;
CREATE TRIGGER update_campaign_review_config_updated_at
  BEFORE UPDATE ON campaign_review_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para campaign_invite_queue
DROP TRIGGER IF EXISTS update_campaign_invite_queue_updated_at ON campaign_invite_queue;
CREATE TRIGGER update_campaign_invite_queue_updated_at
  BEFORE UPDATE ON campaign_invite_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. Índice para deduplicação de leads
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_linkedin_profile_id ON leads(account_id, linkedin_profile_id) WHERE linkedin_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_profile_url ON leads(account_id, profile_url) WHERE profile_url IS NOT NULL;

-- ============================================
-- 10. Comentários nas tabelas
-- ============================================
COMMENT ON TABLE campaign_review_config IS 'Configurações de revisão e round robin para campanhas de LinkedIn';
COMMENT ON TABLE campaign_invite_queue IS 'Fila de convites pendentes para campanhas de LinkedIn';
COMMENT ON TABLE notifications IS 'Notificações do sistema para usuários';

COMMENT ON COLUMN campaign_review_config.invite_expiry_days IS 'Dias para expirar convite (1-14)';
COMMENT ON COLUMN campaign_review_config.max_pending_invites IS 'Máximo de convites pendentes por conta LinkedIn';
COMMENT ON COLUMN campaign_review_config.withdraw_expired_invites IS 'Retirar convites expirados via API Unipile';
COMMENT ON COLUMN campaign_review_config.timezone IS 'Timezone para envio de convites (ex: America/Sao_Paulo, UTC)';

COMMENT ON COLUMN campaign_invite_queue.status IS 'pending=aguardando, scheduled=agendado, sent=enviado, accepted=aceito, expired=expirado, withdrawn=retirado, failed=falhou';
COMMENT ON COLUMN campaign_invite_queue.bull_job_id IS 'ID do job no Bull queue';

COMMENT ON COLUMN leads.invite_queued_at IS 'Quando o lead foi adicionado à fila de convites';
COMMENT ON COLUMN leads.invite_expires_at IS 'Quando o convite irá expirar';
COMMENT ON COLUMN leads.invite_expired_at IS 'Quando o convite expirou';
COMMENT ON COLUMN leads.round_robin_distributed_at IS 'Quando o lead foi distribuído via round robin';
