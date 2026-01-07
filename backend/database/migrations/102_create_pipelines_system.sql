-- Migration 102: Sistema de Pipelines Customizáveis
-- Cria estrutura para projetos, pipelines, etapas e oportunidades

-- =====================================================
-- TABELA: crm_projects (Projetos que organizam pipelines)
-- =====================================================
CREATE TABLE IF NOT EXISTS crm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT 'blue',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, name)
);

-- Índices para crm_projects
CREATE INDEX IF NOT EXISTS idx_crm_projects_account ON crm_projects(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_projects_active ON crm_projects(account_id, is_active);

-- =====================================================
-- TABELA: pipelines
-- =====================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES crm_projects(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT 'blue',
  icon VARCHAR(50) DEFAULT 'target',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_restricted BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, name)
);

-- Índices para pipelines
CREATE INDEX IF NOT EXISTS idx_pipelines_account ON pipelines(account_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_project ON pipelines(project_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_default ON pipelines(account_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_pipelines_active ON pipelines(account_id, is_active);

-- Garantir apenas uma pipeline default por conta
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_single_default
  ON pipelines(account_id)
  WHERE is_default = true;

-- =====================================================
-- TABELA: pipeline_stages (Etapas da pipeline)
-- =====================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT 'gray',
  position INTEGER NOT NULL DEFAULT 0,
  is_win_stage BOOLEAN DEFAULT false,
  is_loss_stage BOOLEAN DEFAULT false,
  automations JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pipeline_id, name),
  UNIQUE(pipeline_id, position)
);

-- Índices para pipeline_stages
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(pipeline_id, position);

-- =====================================================
-- TABELA: pipeline_users (Permissões por pipeline)
-- =====================================================
CREATE TABLE IF NOT EXISTS pipeline_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pipeline_id, user_id)
);

-- Índices para pipeline_users
CREATE INDEX IF NOT EXISTS idx_pipeline_users_pipeline ON pipeline_users(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_users_user ON pipeline_users(user_id);

-- =====================================================
-- TABELA: opportunities (Oportunidades/Deals)
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,

  -- Dados da oportunidade
  title VARCHAR(255) NOT NULL,
  value DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),

  -- Datas
  expected_close_date DATE,
  won_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,

  -- Motivo de perda
  loss_reason_id UUID REFERENCES discard_reasons(id) ON DELETE SET NULL,
  loss_notes TEXT,

  -- Responsável
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Origem
  source_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  source VARCHAR(50),

  -- Metadados
  custom_fields JSONB DEFAULT '{}',

  -- Display
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline ON opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_source_lead ON opportunities(source_lead_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at DESC);

-- =====================================================
-- TABELA: opportunity_tags (Tags para oportunidades)
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(opportunity_id, tag_id)
);

-- Índices para opportunity_tags
CREATE INDEX IF NOT EXISTS idx_opportunity_tags_opportunity ON opportunity_tags(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_tags_tag ON opportunity_tags(tag_id);

-- =====================================================
-- TABELA: opportunity_history (Histórico de movimentações)
-- =====================================================
CREATE TABLE IF NOT EXISTS opportunity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  from_value DECIMAL(15, 2),
  to_value DECIMAL(15, 2),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para opportunity_history
CREATE INDEX IF NOT EXISTS idx_opportunity_history_opportunity ON opportunity_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_history_created ON opportunity_history(created_at DESC);

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para crm_projects
DROP TRIGGER IF EXISTS update_crm_projects_updated_at ON crm_projects;
CREATE TRIGGER update_crm_projects_updated_at
  BEFORE UPDATE ON crm_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para pipelines
DROP TRIGGER IF EXISTS update_pipelines_updated_at ON pipelines;
CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para pipeline_stages
DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para opportunities
DROP TRIGGER IF EXISTS update_opportunities_updated_at ON opportunities;
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTÁRIOS NAS TABELAS
-- =====================================================
COMMENT ON TABLE crm_projects IS 'Projetos para organizar pipelines';
COMMENT ON TABLE pipelines IS 'Pipelines customizáveis de vendas/CRM';
COMMENT ON TABLE pipeline_stages IS 'Etapas de cada pipeline';
COMMENT ON TABLE pipeline_users IS 'Controle de acesso por usuário em pipelines restritas';
COMMENT ON TABLE opportunities IS 'Oportunidades/deals associadas a contatos em pipelines';
COMMENT ON TABLE opportunity_tags IS 'Tags associadas a oportunidades';
COMMENT ON TABLE opportunity_history IS 'Histórico de ações em oportunidades';
