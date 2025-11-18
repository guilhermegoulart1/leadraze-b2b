-- Migration: Add AI Knowledge Base with pgvector
-- Created: 2025-01-17
-- Description: Adds pgvector extension and ai_agent_knowledge table for RAG

-- ================================
-- 1. ENABLE PGVECTOR EXTENSION
-- ================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ================================
-- 2. ADD NEW FIELDS TO AI_AGENTS
-- ================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS key_differentiators TEXT[];
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS success_cases JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS product_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS escalation_rules JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN ai_agents.company_description IS 'Descrição detalhada da empresa';
COMMENT ON COLUMN ai_agents.value_proposition IS 'Proposta de valor única';
COMMENT ON COLUMN ai_agents.key_differentiators IS 'Principais diferenciais vs concorrentes';
COMMENT ON COLUMN ai_agents.success_cases IS 'Array de casos de sucesso';
COMMENT ON COLUMN ai_agents.product_details IS 'Detalhes de produtos/serviços (features, benefícios, preços)';
COMMENT ON COLUMN ai_agents.escalation_rules IS 'Regras de quando escalar para humano';

-- ================================
-- 3. CREATE AI_AGENT_KNOWLEDGE TABLE
-- ================================
CREATE TABLE IF NOT EXISTS ai_agent_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,

  -- Conteúdo
  type VARCHAR(50) NOT NULL, -- 'faq', 'document', 'objection', 'product_info', 'case_study'
  question TEXT, -- Para FAQs e objeções
  answer TEXT NOT NULL, -- Resposta ou conteúdo
  content TEXT, -- Conteúdo completo para documentos

  -- Metadados
  category VARCHAR(100), -- Categoria do conhecimento
  tags TEXT[], -- Tags para filtrar
  metadata JSONB DEFAULT '{}'::jsonb, -- Metadados adicionais

  -- Vector embedding
  embedding vector(1536), -- OpenAI text-embedding-ada-002

  -- Controle
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- 4. CREATE INDEXES
-- ================================

-- Índice para busca por agente e tipo
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_agent_type
ON ai_agent_knowledge(ai_agent_id, type) WHERE active = true;

-- Índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_category
ON ai_agent_knowledge(category) WHERE active = true;

-- Índice vetorial para busca semântica (usando HNSW - mais rápido que IVFFlat)
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_embedding
ON ai_agent_knowledge USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice GIN para tags
CREATE INDEX IF NOT EXISTS idx_ai_agent_knowledge_tags
ON ai_agent_knowledge USING GIN(tags);

-- ================================
-- 5. CREATE FUNCTIONS
-- ================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_ai_agent_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_ai_agent_knowledge_updated_at ON ai_agent_knowledge;
CREATE TRIGGER trigger_update_ai_agent_knowledge_updated_at
  BEFORE UPDATE ON ai_agent_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_agent_knowledge_updated_at();

-- Função para busca semântica
CREATE OR REPLACE FUNCTION search_knowledge(
  p_agent_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 5,
  p_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type VARCHAR(50),
  question TEXT,
  answer TEXT,
  content TEXT,
  category VARCHAR(100),
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.type,
    k.question,
    k.answer,
    k.content,
    k.category,
    1 - (k.embedding <=> p_query_embedding) AS similarity
  FROM ai_agent_knowledge k
  WHERE k.ai_agent_id = p_agent_id
    AND k.active = true
    AND (p_type IS NULL OR k.type = p_type)
  ORDER BY k.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- 6. ADD COMMENTS
-- ================================
COMMENT ON TABLE ai_agent_knowledge IS 'Base de conhecimento para agentes de IA com embeddings vetoriais';
COMMENT ON COLUMN ai_agent_knowledge.type IS 'Tipo: faq, document, objection, product_info, case_study';
COMMENT ON COLUMN ai_agent_knowledge.embedding IS 'Vetor de embedding OpenAI ada-002 (1536 dimensões)';
COMMENT ON FUNCTION search_knowledge IS 'Busca semântica por similaridade de vetores';

-- ================================
-- 7. GRANT PERMISSIONS
-- ================================
-- (Ajustar conforme usuário do banco)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ai_agent_knowledge TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE ai_agent_knowledge_id_seq TO your_app_user;

COMMIT;
