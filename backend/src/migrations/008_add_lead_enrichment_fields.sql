-- ================================
-- Migration 008: Add Lead Enrichment Fields
-- ================================
-- Adiciona campos extras para armazenar dados completos do perfil LinkedIn
-- Permite enriquecimento progressivo dos leads

-- ================================
-- 1. CAMPOS BÁSICOS EXTRAS (da busca de perfil completo)
-- ================================

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS connections_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_influencer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS network_distance VARCHAR(50), -- FIRST_DEGREE, SECOND_DEGREE, THIRD_DEGREE, OUT_OF_NETWORK
ADD COLUMN IF NOT EXISTS public_identifier VARCHAR(255), -- Username do LinkedIn (ex: "felipelafalce")
ADD COLUMN IF NOT EXISTS member_urn VARCHAR(255), -- URN do membro LinkedIn
ADD COLUMN IF NOT EXISTS profile_picture_large TEXT, -- URL da foto em alta resolução
ADD COLUMN IF NOT EXISTS primary_locale JSONB; -- { "country": "BR", "language": "pt" }

-- ================================
-- 2. CAMPOS PARA DADOS ESTRUTURADOS (JSONB)
-- ================================

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS websites JSONB, -- Array de websites: ["https://example.com"]
ADD COLUMN IF NOT EXISTS experience JSONB, -- Histórico profissional
ADD COLUMN IF NOT EXISTS education JSONB, -- Educação
ADD COLUMN IF NOT EXISTS skills JSONB, -- Habilidades
ADD COLUMN IF NOT EXISTS certifications JSONB, -- Certificações
ADD COLUMN IF NOT EXISTS languages JSONB, -- Idiomas
ADD COLUMN IF NOT EXISTS about TEXT; -- Sobre/Resumo do perfil

-- ================================
-- 3. CAMPOS DE CONTROLE DE ENRIQUECIMENTO
-- ================================

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS full_profile_fetched_at TIMESTAMP, -- Quando buscamos o perfil completo
ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0, -- Quantas vezes tentamos enriquecer
ADD COLUMN IF NOT EXISTS last_enrichment_error TEXT; -- Último erro ao tentar enriquecer

-- ================================
-- 4. ÍNDICES PARA PERFORMANCE
-- ================================

CREATE INDEX IF NOT EXISTS idx_leads_public_identifier ON leads(public_identifier);
CREATE INDEX IF NOT EXISTS idx_leads_is_premium ON leads(is_premium);
CREATE INDEX IF NOT EXISTS idx_leads_is_creator ON leads(is_creator);
CREATE INDEX IF NOT EXISTS idx_leads_is_influencer ON leads(is_influencer);
CREATE INDEX IF NOT EXISTS idx_leads_full_profile_fetched ON leads(full_profile_fetched_at);
CREATE INDEX IF NOT EXISTS idx_leads_connections_count ON leads(connections_count);

-- ================================
-- 5. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================

COMMENT ON COLUMN leads.first_name IS 'Primeiro nome do lead';
COMMENT ON COLUMN leads.last_name IS 'Sobrenome do lead';
COMMENT ON COLUMN leads.connections_count IS 'Número de conexões no LinkedIn';
COMMENT ON COLUMN leads.follower_count IS 'Número de seguidores no LinkedIn';
COMMENT ON COLUMN leads.is_premium IS 'Se possui conta LinkedIn Premium';
COMMENT ON COLUMN leads.is_creator IS 'Se está em Creator Mode';
COMMENT ON COLUMN leads.is_influencer IS 'Se é marcado como influencer';
COMMENT ON COLUMN leads.network_distance IS 'Distância na rede (1st, 2nd, 3rd degree)';
COMMENT ON COLUMN leads.public_identifier IS 'Username público do LinkedIn';
COMMENT ON COLUMN leads.member_urn IS 'URN do membro no LinkedIn';
COMMENT ON COLUMN leads.profile_picture_large IS 'URL da foto de perfil em alta resolução';
COMMENT ON COLUMN leads.primary_locale IS 'Idioma e país primário do perfil';
COMMENT ON COLUMN leads.websites IS 'Array de websites do perfil';
COMMENT ON COLUMN leads.experience IS 'Histórico profissional completo (JSONB)';
COMMENT ON COLUMN leads.education IS 'Educação completa (JSONB)';
COMMENT ON COLUMN leads.skills IS 'Habilidades (JSONB)';
COMMENT ON COLUMN leads.certifications IS 'Certificações (JSONB)';
COMMENT ON COLUMN leads.languages IS 'Idiomas que fala (JSONB)';
COMMENT ON COLUMN leads.about IS 'Seção Sobre/Resumo do perfil';
COMMENT ON COLUMN leads.full_profile_fetched_at IS 'Data/hora da última busca de perfil completo';
COMMENT ON COLUMN leads.enrichment_attempts IS 'Número de tentativas de enriquecimento';
COMMENT ON COLUMN leads.last_enrichment_error IS 'Último erro durante enriquecimento';
