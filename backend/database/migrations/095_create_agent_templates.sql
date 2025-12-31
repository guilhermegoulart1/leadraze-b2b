-- Migration 095: Create agent templates table
-- Purpose: Store reusable AI employee templates with community sharing support

-- Create agent_templates table
CREATE TABLE IF NOT EXISTS agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE, -- NULL = official/system template

  -- Identification
  name VARCHAR(100) NOT NULL,
  description TEXT,
  agent_type VARCHAR(20) NOT NULL CHECK (agent_type IN ('prospeccao', 'atendimento')),

  -- Categorization
  niche VARCHAR(50),
  niche_display_name VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  language VARCHAR(10) DEFAULT 'pt-BR',

  -- Configuration
  niche_parameters JSONB NOT NULL DEFAULT '[]', -- Parameters specific to niche
  -- Example: [{ id: "services", label: "Servicos", type: "multiselect", required: true, options: [...] }]

  workflow_definition JSONB NOT NULL DEFAULT '{}', -- React Flow structure
  -- Example: { nodes: [...], edges: [...] }

  prompt_template TEXT, -- Base prompt template with {{variables}}

  default_config JSONB DEFAULT '{}', -- Default agent configuration
  -- Example: { behavioral_profile: "consultivo", response_length: "short", ... }

  -- Status
  is_official BOOLEAN DEFAULT false, -- Official templates from GetRaze
  is_public BOOLEAN DEFAULT false, -- Visible to community
  is_approved BOOLEAN DEFAULT false, -- Approved by admin
  approval_status VARCHAR(20) DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Metrics
  usage_count INTEGER DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  rating_sum INTEGER DEFAULT 0,
  -- rating_average is computed on read to avoid update anomalies

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_agent_templates_account ON agent_templates(account_id);
CREATE INDEX idx_agent_templates_type ON agent_templates(agent_type);
CREATE INDEX idx_agent_templates_niche ON agent_templates(niche);
CREATE INDEX idx_agent_templates_official ON agent_templates(is_official) WHERE is_official = true;
CREATE INDEX idx_agent_templates_public ON agent_templates(is_public, is_approved) WHERE is_public = true AND is_approved = true;
CREATE INDEX idx_agent_templates_language ON agent_templates(language);
CREATE INDEX idx_agent_templates_tags ON agent_templates USING GIN(tags);

-- Add comments
COMMENT ON TABLE agent_templates IS 'Reusable AI employee templates with community sharing support';
COMMENT ON COLUMN agent_templates.agent_type IS 'Type: prospeccao (outbound) or atendimento (inbound)';
COMMENT ON COLUMN agent_templates.niche_parameters IS 'JSON array of parameters to collect during smart interview';
COMMENT ON COLUMN agent_templates.workflow_definition IS 'React Flow nodes and edges for visual workflow';
COMMENT ON COLUMN agent_templates.is_official IS 'Official templates created by GetRaze team';
COMMENT ON COLUMN agent_templates.approval_status IS 'For community templates: draft, pending, approved, rejected';

-- =====================================================
-- INSERT OFFICIAL TEMPLATES
-- =====================================================

-- SDR SaaS B2B Template (Prospeccao)
INSERT INTO agent_templates (
  account_id, name, description, agent_type, niche, niche_display_name, tags, language,
  niche_parameters, workflow_definition, default_config, is_official, is_public, is_approved, approval_status
) VALUES (
  NULL,
  'SDR SaaS B2B',
  'Prospeccao para empresas de software. Qualifica leads por fit tecnico e orcamento.',
  'prospeccao',
  'saas',
  'SaaS / Software',
  ARRAY['tech', 'b2b', 'enterprise'],
  'pt-BR',
  '[
    {"id": "product_name", "label": "Nome do produto/software", "type": "text", "required": true},
    {"id": "product_description", "label": "Descricao do produto", "type": "textarea", "required": true},
    {"id": "target_roles", "label": "Cargos-alvo", "type": "multiselect", "options": ["CEO", "CTO", "CFO", "CMO", "Diretor", "Gerente", "Coordenador"], "required": true},
    {"id": "target_company_size", "label": "Tamanho de empresa", "type": "multiselect", "options": ["1-10", "11-50", "51-200", "201-500", "500+"], "required": true},
    {"id": "main_pain_points", "label": "Principais dores que resolve", "type": "textarea", "required": true},
    {"id": "pricing_model", "label": "Modelo de precificacao", "type": "select", "options": ["Mensal", "Anual", "Por usuario", "Setup + mensal", "Sob consulta"], "required": false},
    {"id": "demo_available", "label": "Oferece demonstracao?", "type": "select", "options": ["Sim, gratuita", "Sim, mediante qualificacao", "Nao"], "required": true},
    {"id": "competitors", "label": "Principais concorrentes", "type": "text", "required": false}
  ]'::jsonb,
  '{
    "nodes": [
      {"id": "trigger", "type": "trigger", "data": {"event": "invite_accepted"}, "position": {"x": 250, "y": 0}},
      {"id": "step1", "type": "conversation_step", "data": {"name": "Quebrar gelo", "instructions": "Agradecer conexao e criar rapport", "max_messages": 3}, "position": {"x": 250, "y": 100}},
      {"id": "step2", "type": "conversation_step", "data": {"name": "Descobrir contexto", "instructions": "Entender cenario atual e desafios", "max_messages": 4}, "position": {"x": 250, "y": 200}},
      {"id": "step3", "type": "conversation_step", "data": {"name": "Apresentar valor", "instructions": "Conectar produto com as dores identificadas", "max_messages": 3}, "position": {"x": 250, "y": 300}},
      {"id": "step4", "type": "conversation_step", "data": {"name": "Qualificar", "instructions": "Verificar fit, timing e budget", "max_messages": 3}, "position": {"x": 250, "y": 400}},
      {"id": "transfer", "type": "action", "data": {"action": "transfer_to_human", "message": "Vou te conectar com um especialista"}, "position": {"x": 250, "y": 500}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger", "target": "step1"},
      {"id": "e2", "source": "step1", "target": "step2"},
      {"id": "e3", "source": "step2", "target": "step3"},
      {"id": "e4", "source": "step3", "target": "step4"},
      {"id": "e5", "source": "step4", "target": "transfer"}
    ]
  }'::jsonb,
  '{"behavioral_profile": "consultivo", "response_length": "short", "methodology": "spin"}'::jsonb,
  true, true, true, 'approved'
),

-- Clinica Veterinaria Template (Atendimento)
(
  NULL,
  'Atendente Clinica Veterinaria',
  'Atendimento para pet shops e clinicas vet. Agendamento, duvidas e emergencias.',
  'atendimento',
  'veterinary',
  'Clinica Veterinaria',
  ARRAY['pets', 'agendamento', 'saude', 'b2c'],
  'pt-BR',
  '[
    {"id": "clinic_name", "label": "Nome da clinica", "type": "text", "required": true},
    {"id": "services", "label": "Servicos oferecidos", "type": "multiselect", "options": ["Consultas", "Cirurgias", "Vacinas", "Banho e tosa", "Pet shop", "Hotel para pets", "Emergencias 24h", "Exames laboratoriais", "Raio-X/Ultrassom"], "required": true},
    {"id": "species", "label": "Especies atendidas", "type": "multiselect", "options": ["Caes", "Gatos", "Aves", "Roedores", "Repteis", "Peixes"], "required": true},
    {"id": "emergency_24h", "label": "Atende emergencias 24h?", "type": "select", "options": ["Sim, 24 horas", "Sim, em horario estendido", "Nao, apenas horario comercial"], "required": true},
    {"id": "has_petshop", "label": "Tem pet shop?", "type": "select", "options": ["Sim", "Nao"], "required": true},
    {"id": "operating_hours", "label": "Horario de funcionamento", "type": "text", "required": true},
    {"id": "address", "label": "Endereco", "type": "text", "required": true},
    {"id": "accepts_insurance", "label": "Aceita plano de saude pet?", "type": "select", "options": ["Sim", "Nao", "Alguns planos"], "required": true},
    {"id": "avg_consultation_price", "label": "Valor medio da consulta", "type": "text", "required": false}
  ]'::jsonb,
  '{
    "nodes": [
      {"id": "trigger", "type": "trigger", "data": {"event": "message_received"}, "position": {"x": 250, "y": 0}},
      {"id": "greeting", "type": "conversation_step", "data": {"name": "Saudacao", "instructions": "Cumprimentar e identificar necessidade", "max_messages": 2}, "position": {"x": 250, "y": 100}},
      {"id": "condition1", "type": "condition", "data": {"condition": "intent", "operator": "equals", "value": "emergency"}, "position": {"x": 250, "y": 200}},
      {"id": "emergency", "type": "action", "data": {"action": "transfer_to_human", "message": "Emergencia detectada! Transferindo imediatamente."}, "position": {"x": 100, "y": 300}},
      {"id": "normal_flow", "type": "conversation_step", "data": {"name": "Atendimento", "instructions": "Responder duvidas e oferecer agendamento", "max_messages": 10}, "position": {"x": 400, "y": 300}},
      {"id": "scheduling", "type": "action", "data": {"action": "offer_scheduling"}, "position": {"x": 400, "y": 400}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger", "target": "greeting"},
      {"id": "e2", "source": "greeting", "target": "condition1"},
      {"id": "e3", "source": "condition1", "target": "emergency", "label": "Emergencia"},
      {"id": "e4", "source": "condition1", "target": "normal_flow", "label": "Normal"},
      {"id": "e5", "source": "normal_flow", "target": "scheduling"}
    ]
  }'::jsonb,
  '{"behavioral_profile": "amigavel", "response_length": "medium", "tone": "caloroso"}'::jsonb,
  true, true, true, 'approved'
),

-- Suporte Tecnico L1 Template (Atendimento)
(
  NULL,
  'Suporte Tecnico L1',
  'Primeiro nivel de suporte tecnico. Triagem, FAQ e escalacao.',
  'atendimento',
  'tech_support',
  'Suporte Tecnico',
  ARRAY['suporte', 'tech', 'b2b', 'saas'],
  'pt-BR',
  '[
    {"id": "product_name", "label": "Nome do produto/sistema", "type": "text", "required": true},
    {"id": "common_issues", "label": "Problemas mais comuns", "type": "textarea", "required": true},
    {"id": "support_hours", "label": "Horario do suporte", "type": "text", "required": true},
    {"id": "sla_response", "label": "SLA de resposta", "type": "text", "required": false},
    {"id": "escalation_criteria", "label": "Criterios de escalacao para L2", "type": "textarea", "required": true},
    {"id": "knowledge_base_url", "label": "URL da base de conhecimento (se houver)", "type": "text", "required": false},
    {"id": "ticketing_system", "label": "Sistema de tickets", "type": "select", "options": ["Zendesk", "Freshdesk", "Jira", "Intercom", "Outro", "Nao temos"], "required": false}
  ]'::jsonb,
  '{
    "nodes": [
      {"id": "trigger", "type": "trigger", "data": {"event": "message_received"}, "position": {"x": 250, "y": 0}},
      {"id": "identify", "type": "conversation_step", "data": {"name": "Identificar problema", "instructions": "Entender o problema do usuario e coletar detalhes", "max_messages": 3}, "position": {"x": 250, "y": 100}},
      {"id": "search_kb", "type": "action", "data": {"action": "search_knowledge_base"}, "position": {"x": 250, "y": 200}},
      {"id": "try_resolve", "type": "conversation_step", "data": {"name": "Tentar resolver", "instructions": "Oferecer solucao baseada na KB ou troubleshooting basico", "max_messages": 5}, "position": {"x": 250, "y": 300}},
      {"id": "condition_resolved", "type": "condition", "data": {"condition": "user_satisfied", "operator": "equals", "value": "true"}, "position": {"x": 250, "y": 400}},
      {"id": "close_ticket", "type": "action", "data": {"action": "close_conversation", "message": "Fico feliz em ter ajudado!"}, "position": {"x": 100, "y": 500}},
      {"id": "escalate", "type": "action", "data": {"action": "transfer_to_human", "message": "Vou transferir para um especialista L2"}, "position": {"x": 400, "y": 500}}
    ],
    "edges": [
      {"id": "e1", "source": "trigger", "target": "identify"},
      {"id": "e2", "source": "identify", "target": "search_kb"},
      {"id": "e3", "source": "search_kb", "target": "try_resolve"},
      {"id": "e4", "source": "try_resolve", "target": "condition_resolved"},
      {"id": "e5", "source": "condition_resolved", "target": "close_ticket", "label": "Resolvido"},
      {"id": "e6", "source": "condition_resolved", "target": "escalate", "label": "Nao resolvido"}
    ]
  }'::jsonb,
  '{"behavioral_profile": "educativo", "response_length": "medium", "tone": "prestativo"}'::jsonb,
  true, true, true, 'approved'
);
