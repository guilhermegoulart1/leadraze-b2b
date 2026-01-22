-- Migration: Create onboarding_responses table
-- Description: Stores client onboarding data for agent setup

CREATE TABLE IF NOT EXISTS onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Etapa 1: Dados da Empresa
  company_name VARCHAR(255),
  website VARCHAR(255),
  industry VARCHAR(100),
  company_size VARCHAR(50),
  description TEXT,
  products_services TEXT,
  differentials TEXT,
  success_cases TEXT,

  -- Etapa 2: Sobre os Clientes (ICP)
  ideal_customer TEXT,
  target_roles VARCHAR(255),
  target_location VARCHAR(255),
  target_industries TEXT,
  buying_signals TEXT,
  main_problem TEXT,

  -- Etapa 3: Atendimento
  faq JSONB DEFAULT '[]',
  objections JSONB DEFAULT '[]',
  policies TEXT,
  business_hours VARCHAR(100),
  escalation_triggers TEXT[] DEFAULT '{}',

  -- Etapa 4: Finalização
  goals TEXT[] DEFAULT '{}',
  lead_target VARCHAR(50),
  meeting_target VARCHAR(50),
  materials_links TEXT,
  calendar_link VARCHAR(255),
  blacklist TEXT,
  additional_notes TEXT,

  -- Dados de Contato
  contact_name VARCHAR(255),
  contact_role VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),

  -- Status e Controle
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reviewed')),
  current_step INTEGER DEFAULT 1,
  completed_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_account ON onboarding_responses(account_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user ON onboarding_responses(account_id, user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_status ON onboarding_responses(status);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_onboarding_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_onboarding_responses_updated_at ON onboarding_responses;
CREATE TRIGGER trigger_onboarding_responses_updated_at
  BEFORE UPDATE ON onboarding_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_responses_updated_at();

-- Comments
COMMENT ON TABLE onboarding_responses IS 'Stores client onboarding responses for AI agent setup';
COMMENT ON COLUMN onboarding_responses.status IS 'pending = not completed, completed = submitted by client, reviewed = processed by team';
COMMENT ON COLUMN onboarding_responses.current_step IS 'Current step in the wizard (1-4)';
COMMENT ON COLUMN onboarding_responses.faq IS 'JSON array of {question, answer} objects';
COMMENT ON COLUMN onboarding_responses.objections IS 'JSON array of {objection, response} objects';
