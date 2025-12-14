-- Migration 070: Create Secret Agent Intelligence System
-- GetRaze Secret Agent - FBI-style investigation system

-- =============================================
-- TABELA: secret_agent_sessions
-- Sessões de chat com o agente secreto
-- =============================================
CREATE TABLE IF NOT EXISTS secret_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Status e Tipo
  status VARCHAR(50) DEFAULT 'chat' CHECK (status IN ('chat', 'investigating', 'completed', 'failed')),
  research_type VARCHAR(50) CHECK (research_type IN ('company', 'person', 'niche', 'connection')),

  -- Alvo da Investigacao
  target_name VARCHAR(255),
  target_details JSONB DEFAULT '{}',
  objective TEXT,

  -- Conversa com o agente
  messages JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',

  -- Referencia ao briefing final
  briefing_id UUID,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  investigation_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indices para sessions
CREATE INDEX IF NOT EXISTS idx_secret_sessions_account ON secret_agent_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_secret_sessions_user ON secret_agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_secret_sessions_status ON secret_agent_sessions(status);

-- =============================================
-- TABELA: secret_agent_investigations
-- Investigacoes em andamento (processo assincrono)
-- =============================================
CREATE TABLE IF NOT EXISTS secret_agent_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES secret_agent_sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Case Number (ex: CASE-2024-015A)
  case_number VARCHAR(50) NOT NULL UNIQUE,

  -- Status Geral
  status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Informacoes do alvo
  target_name VARCHAR(255) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  objective TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para investigations
CREATE INDEX IF NOT EXISTS idx_secret_investigations_session ON secret_agent_investigations(session_id);
CREATE INDEX IF NOT EXISTS idx_secret_investigations_account ON secret_agent_investigations(account_id);
CREATE INDEX IF NOT EXISTS idx_secret_investigations_status ON secret_agent_investigations(status);
CREATE INDEX IF NOT EXISTS idx_secret_investigations_case ON secret_agent_investigations(case_number);

-- =============================================
-- TABELA: secret_agent_reports
-- Relatorios individuais de cada agente da equipe
-- =============================================
CREATE TABLE IF NOT EXISTS secret_agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES secret_agent_investigations(id) ON DELETE CASCADE,

  -- Agente que gerou (marcus_chen, sarah_mitchell, etc.)
  agent_id VARCHAR(50) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  agent_role VARCHAR(100) NOT NULL,

  -- Status do agente
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'working', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_task TEXT,

  -- Relatorio
  report_text TEXT,
  report_data JSONB DEFAULT '{}',
  sources_used JSONB DEFAULT '[]',
  findings JSONB DEFAULT '[]',
  error_message TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para reports
CREATE INDEX IF NOT EXISTS idx_secret_reports_investigation ON secret_agent_reports(investigation_id);
CREATE INDEX IF NOT EXISTS idx_secret_reports_agent ON secret_agent_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_secret_reports_status ON secret_agent_reports(status);

-- =============================================
-- TABELA: secret_agent_briefings
-- Dossies finais (documentos TOP SECRET)
-- =============================================
CREATE TABLE IF NOT EXISTS secret_agent_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_id UUID REFERENCES secret_agent_sessions(id) ON DELETE SET NULL,
  investigation_id UUID REFERENCES secret_agent_investigations(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Metadados (tema FBI)
  title VARCHAR(500) NOT NULL,
  case_number VARCHAR(50) NOT NULL,
  classification VARCHAR(50) DEFAULT 'CONFIDENTIAL' CHECK (classification IN ('CONFIDENTIAL', 'CLASSIFIED', 'TOP_SECRET')),
  research_type VARCHAR(50) NOT NULL,
  target_name VARCHAR(255) NOT NULL,

  -- Conteudo estruturado
  executive_summary TEXT,
  key_findings JSONB DEFAULT '[]',

  -- Dados coletados por fonte
  company_data JSONB DEFAULT '{}',
  people_data JSONB DEFAULT '{}',
  connections_data JSONB DEFAULT '{}',
  market_data JSONB DEFAULT '{}',
  media_data JSONB DEFAULT '{}',

  -- Relatorio final
  full_report_markdown TEXT,
  full_report_html TEXT,

  -- Campanhas sugeridas
  suggested_campaigns JSONB DEFAULT '[]',

  -- Vinculacao com leads
  linked_lead_ids UUID[] DEFAULT '{}',

  -- Busca full-text
  search_vector TSVECTOR,
  tags VARCHAR(100)[] DEFAULT '{}',

  -- Estatisticas
  sources_consulted INTEGER DEFAULT 0,
  total_findings INTEGER DEFAULT 0,
  duration_seconds INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para briefings
CREATE INDEX IF NOT EXISTS idx_secret_briefings_account ON secret_agent_briefings(account_id);
CREATE INDEX IF NOT EXISTS idx_secret_briefings_search ON secret_agent_briefings USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_secret_briefings_linked_leads ON secret_agent_briefings USING GIN(linked_lead_ids);
CREATE INDEX IF NOT EXISTS idx_secret_briefings_case ON secret_agent_briefings(case_number);
CREATE INDEX IF NOT EXISTS idx_secret_briefings_created ON secret_agent_briefings(created_at DESC);

-- =============================================
-- TABELA: secret_agent_cache
-- Cache de respostas das APIs externas
-- =============================================
CREATE TABLE IF NOT EXISTS secret_agent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(500) UNIQUE NOT NULL,
  source VARCHAR(100) NOT NULL,
  query_params JSONB DEFAULT '{}',
  response_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indice para cache
CREATE INDEX IF NOT EXISTS idx_secret_cache_key ON secret_agent_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_secret_cache_expires ON secret_agent_cache(expires_at);

-- =============================================
-- FUNCOES E TRIGGERS
-- =============================================

-- Funcao para atualizar search_vector em briefings
CREATE OR REPLACE FUNCTION secret_briefings_search_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.target_name, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.executive_summary, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.full_report_markdown, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para search_vector
DROP TRIGGER IF EXISTS secret_briefings_search_update ON secret_agent_briefings;
CREATE TRIGGER secret_briefings_search_update
  BEFORE INSERT OR UPDATE ON secret_agent_briefings
  FOR EACH ROW EXECUTE FUNCTION secret_briefings_search_trigger();

-- Trigger para updated_at em sessions
CREATE OR REPLACE FUNCTION update_secret_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS secret_sessions_updated_at ON secret_agent_sessions;
CREATE TRIGGER secret_sessions_updated_at
  BEFORE UPDATE ON secret_agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_secret_sessions_timestamp();

-- Trigger para updated_at em briefings
DROP TRIGGER IF EXISTS secret_briefings_updated_at ON secret_agent_briefings;
CREATE TRIGGER secret_briefings_updated_at
  BEFORE UPDATE ON secret_agent_briefings
  FOR EACH ROW EXECUTE FUNCTION update_secret_sessions_timestamp();

-- Funcao para limpar cache expirado
CREATE OR REPLACE FUNCTION clean_expired_secret_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM secret_agent_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Funcao para gerar case number
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_part VARCHAR(4);
  seq_part INTEGER;
  letter_part CHAR(1);
  case_num VARCHAR(50);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get next sequence number for the year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(case_number FROM 'CASE-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_part
  FROM secret_agent_investigations
  WHERE case_number LIKE 'CASE-' || year_part || '-%';

  -- Generate random letter suffix
  letter_part := CHR(65 + FLOOR(RANDOM() * 26)::INTEGER);

  case_num := 'CASE-' || year_part || '-' || LPAD(seq_part::TEXT, 3, '0') || letter_part;

  RETURN case_num;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMENTARIOS PARA DOCUMENTACAO
-- =============================================
COMMENT ON TABLE secret_agent_sessions IS 'Sessoes de chat com o Agente Secreto GetRaze';
COMMENT ON TABLE secret_agent_investigations IS 'Investigacoes em andamento (processamento assincrono)';
COMMENT ON TABLE secret_agent_reports IS 'Relatorios individuais de cada agente da equipe de inteligencia';
COMMENT ON TABLE secret_agent_briefings IS 'Dossies finais - documentos classificados';
COMMENT ON TABLE secret_agent_cache IS 'Cache de respostas das APIs externas (Exa, Tavily, etc.)';
