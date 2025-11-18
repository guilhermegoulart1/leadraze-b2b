-- Migration 006: Adicionar campos de contato (email e telefone) na tabela leads

-- Adicionar campos de email e telefone
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email_captured_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS phone_captured_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_source VARCHAR(50), -- 'profile' ou 'conversation'
ADD COLUMN IF NOT EXISTS phone_source VARCHAR(50); -- 'profile' ou 'conversation'

-- Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- Comentários
COMMENT ON COLUMN leads.email IS 'Email do lead (capturado do perfil ou durante conversa)';
COMMENT ON COLUMN leads.phone IS 'Telefone do lead (capturado do perfil ou durante conversa)';
COMMENT ON COLUMN leads.email_captured_at IS 'Data/hora que o email foi capturado';
COMMENT ON COLUMN leads.phone_captured_at IS 'Data/hora que o telefone foi capturado';
COMMENT ON COLUMN leads.email_source IS 'Origem do email: profile (perfil público) ou conversation (durante chat)';
COMMENT ON COLUMN leads.phone_source IS 'Origem do telefone: profile (perfil público) ou conversation (durante chat)';
