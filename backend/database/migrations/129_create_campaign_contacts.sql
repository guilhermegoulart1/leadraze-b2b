-- Migration: Create campaign_contacts table
-- This table links contacts to campaigns, replacing the direct opportunity creation
-- Contacts collected by campaigns are now stored here until the agent creates opportunities

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Status do contato nesta campanha
  status VARCHAR(50) DEFAULT 'collected' NOT NULL,
  -- collected: recém coletado pela campanha
  -- approved: aprovado para envio de convite
  -- rejected: rejeitado na revisão
  -- invite_queued: convite na fila de envio
  -- invite_sent: convite de conexão enviado
  -- invite_accepted: convite aceito pelo lead
  -- invite_expired: convite expirou sem resposta
  -- conversation_started: agente iniciou conversa
  -- conversation_ended: conversa finalizada

  -- Dados do convite
  invite_sent_at TIMESTAMP,
  invite_accepted_at TIMESTAMP,
  invite_expires_at TIMESTAMP,

  -- LinkedIn metadata (para rastreamento e deduplicação)
  linkedin_profile_id VARCHAR(255),
  provider_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(campaign_id, contact_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact ON campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_account ON campaign_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_linkedin ON campaign_contacts(linkedin_profile_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_campaign_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_contacts_updated_at ON campaign_contacts;
CREATE TRIGGER campaign_contacts_updated_at
  BEFORE UPDATE ON campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_contacts_updated_at();

-- Comentários para documentação
COMMENT ON TABLE campaign_contacts IS 'Links contacts to campaigns - contacts collected are stored here until agent creates opportunities';
COMMENT ON COLUMN campaign_contacts.status IS 'collected, approved, rejected, invite_sent, invite_accepted, invite_expired, conversation_started, conversation_ended';
