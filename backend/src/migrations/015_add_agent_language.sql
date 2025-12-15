-- Migration: Add language field to AI agents
-- Created: 2025-12-15
-- Description: Adds language preference field to ai_agents table for multilingual support

-- ================================
-- 1. ADD LANGUAGE COLUMN TO AI_AGENTS
-- ================================
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT NULL;

-- ================================
-- 2. ADD COMMENT
-- ================================
COMMENT ON COLUMN ai_agents.language IS 'Idioma de resposta do agente (ex: pt-BR, pt-PT, en, es). Se NULL, usa preferência do usuário.';

-- ================================
-- 3. CREATE INDEX FOR LANGUAGE QUERIES (optional, for analytics)
-- ================================
CREATE INDEX IF NOT EXISTS idx_ai_agents_language ON ai_agents(language) WHERE language IS NOT NULL;

COMMIT;
