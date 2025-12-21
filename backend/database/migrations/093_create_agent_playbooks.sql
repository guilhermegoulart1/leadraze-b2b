-- Migration 093: Create agent playbooks table
-- Purpose: Store structured sales playbooks with scripts and questions per methodology

-- Create agent_playbooks table
CREATE TABLE IF NOT EXISTS agent_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identification
  name VARCHAR(100) NOT NULL,
  description TEXT,
  methodology VARCHAR(50) NOT NULL, -- spin, challenger, sandler, meddpicc, gap, bant, inbound, consultivo-br

  -- Scripts
  opening_scripts JSONB NOT NULL DEFAULT '[]', -- Array of opening message templates
  closing_scripts JSONB NOT NULL DEFAULT '[]', -- Array of closing message templates

  -- Qualification questions (ordered by phase)
  qualification_questions JSONB NOT NULL DEFAULT '[]', -- [{order, phase, question, purpose, expected_answers}]

  -- Follow-up sequence
  follow_up_sequence JSONB DEFAULT '[]', -- [{day, message_template, condition}]

  -- Flags
  is_system BOOLEAN DEFAULT false, -- System templates
  is_active BOOLEAN DEFAULT true,
  language VARCHAR(10) DEFAULT 'pt-BR',

  -- Metrics
  times_used INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_agent_playbooks_account ON agent_playbooks(account_id);
CREATE INDEX idx_agent_playbooks_methodology ON agent_playbooks(methodology);
CREATE INDEX idx_agent_playbooks_system ON agent_playbooks(is_system) WHERE is_system = true;

-- Add comments
COMMENT ON TABLE agent_playbooks IS 'Sales playbooks with structured scripts and qualification questions';
COMMENT ON COLUMN agent_playbooks.methodology IS 'Sales methodology: spin, challenger, sandler, meddpicc, gap, bant, inbound, consultivo-br';
COMMENT ON COLUMN agent_playbooks.opening_scripts IS 'Array of opening message templates with variables';
COMMENT ON COLUMN agent_playbooks.qualification_questions IS 'Ordered questions by phase with purpose and expected answers';

-- Link playbook to agent
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS playbook_id UUID REFERENCES agent_playbooks(id);

COMMENT ON COLUMN ai_agents.playbook_id IS 'Reference to the playbook this agent should follow';

-- =====================================================
-- INSERT SYSTEM PLAYBOOKS (Portuguese)
-- =====================================================

-- SPIN Selling Playbook
INSERT INTO agent_playbooks (account_id, name, description, methodology, opening_scripts, closing_scripts, qualification_questions, is_system, language)
VALUES (
  NULL,
  'SPIN Selling',
  'Metodologia consultiva baseada em perguntas estratégicas: Situação, Problema, Implicação e Necessidade',
  'spin',
  '[
    "Olá {{nome}}! Vi que você atua como {{cargo}} na {{empresa}}. Como tem sido gerenciar a área de {{area}} por aí?",
    "Oi {{nome}}! Seu perfil chamou minha atenção. Você lida com {{problema_comum}} no dia a dia?",
    "Olá {{nome}}! Notei que a {{empresa}} atua no segmento de {{industria}}. Como está o cenário atual para vocês?"
  ]'::jsonb,
  '[
    "Faz sentido conversarmos mais a fundo? Posso te mostrar como resolvemos isso para empresas similares.",
    "Que tal uma call de 15 min pra eu entender melhor e ver se faz sentido pra vocês?",
    "Posso te enviar um case de uma empresa parecida com a {{empresa}} que resolveu esse problema?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "situation", "question": "Como funciona hoje o processo de {{area}} na sua empresa?", "purpose": "Entender contexto atual", "expected_answers": ["descrição do processo", "ferramentas usadas", "equipe envolvida"]},
    {"order": 2, "phase": "situation", "question": "Quantas pessoas estão envolvidas nesse processo?", "purpose": "Dimensionar operação", "expected_answers": ["número de pessoas", "estrutura da equipe"]},
    {"order": 3, "phase": "situation", "question": "Quais ferramentas vocês usam atualmente?", "purpose": "Mapear stack atual", "expected_answers": ["nome de ferramentas", "processos manuais"]},
    {"order": 4, "phase": "problem", "question": "Qual o maior desafio que você enfrenta com isso hoje?", "purpose": "Identificar dor principal", "expected_answers": ["problema específico", "frustração", "limitação"]},
    {"order": 5, "phase": "problem", "question": "O que te impede de atingir melhores resultados nessa área?", "purpose": "Aprofundar na dor", "expected_answers": ["obstáculos", "gargalos", "restrições"]},
    {"order": 6, "phase": "problem", "question": "Está satisfeito com os resultados atuais?", "purpose": "Validar insatisfação", "expected_answers": ["sim/não", "nível de satisfação", "expectativas"]},
    {"order": 7, "phase": "implication", "question": "Quanto tempo vocês perdem por causa disso?", "purpose": "Quantificar impacto", "expected_answers": ["horas", "dias", "percentual"]},
    {"order": 8, "phase": "implication", "question": "Como isso afeta os resultados da equipe/empresa?", "purpose": "Conectar com impacto de negócio", "expected_answers": ["impacto em vendas", "produtividade", "custos"]},
    {"order": 9, "phase": "implication", "question": "Já calculou quanto isso custa por mês para a empresa?", "purpose": "Criar urgência financeira", "expected_answers": ["valor monetário", "estimativa", "não calculei"]},
    {"order": 10, "phase": "need", "question": "Se pudesse resolver isso, qual seria o impacto?", "purpose": "Lead verbaliza necessidade", "expected_answers": ["benefícios esperados", "ROI potencial"]},
    {"order": 11, "phase": "need", "question": "O que você precisaria ver para considerar uma solução?", "purpose": "Identificar critérios de decisão", "expected_answers": ["demo", "case", "proposta", "ROI"]}
  ]'::jsonb,
  true,
  'pt-BR'
),

-- Challenger Sale Playbook
(
  NULL,
  'Challenger Sale',
  'Metodologia que desafia o status quo do cliente com insights e perspectivas novas',
  'challenger',
  '[
    "Olá {{nome}}! Tenho acompanhado empresas do segmento de {{industria}} e notei um padrão interessante. Posso compartilhar?",
    "Oi {{nome}}! Vi que a {{empresa}} está crescendo. Você sabia que 70% das empresas nessa fase enfrentam {{problema_comum}}?",
    "{{nome}}, trabalhando com empresas como a {{empresa}}, descobri algo que pode te interessar sobre {{area}}."
  ]'::jsonb,
  '[
    "Baseado no que conversamos, acho que vale uma conversa mais aprofundada. Que tal 20 min essa semana?",
    "Posso te mostrar exatamente como outras empresas do seu segmento resolveram isso. Topa uma call?",
    "Tenho um framework que pode te ajudar a pensar nisso de forma diferente. Quer que eu apresente?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "teach", "question": "Você sabia que {{insight_mercado}}?", "purpose": "Compartilhar insight provocativo", "expected_answers": ["não sabia", "interessante", "conte mais"]},
    {"order": 2, "phase": "teach", "question": "Como vocês estão lidando com {{tendencia_mercado}} atualmente?", "purpose": "Conectar insight com realidade", "expected_answers": ["não estamos", "estamos tentando", "é um desafio"]},
    {"order": 3, "phase": "tailor", "question": "Considerando que a {{empresa}} atua em {{industria}}, isso impacta vocês de que forma?", "purpose": "Personalizar para contexto", "expected_answers": ["impacto específico", "exemplos"]},
    {"order": 4, "phase": "tailor", "question": "O que te impede de abordar isso de forma diferente?", "purpose": "Identificar barreiras", "expected_answers": ["recursos", "tempo", "conhecimento", "prioridade"]},
    {"order": 5, "phase": "take_control", "question": "Se eu te mostrasse uma forma de resolver isso em {{tempo}}, valeria seu tempo?", "purpose": "Qualificar interesse", "expected_answers": ["sim", "depende", "não"]},
    {"order": 6, "phase": "take_control", "question": "Quem mais deveria participar dessa conversa?", "purpose": "Mapear stakeholders", "expected_answers": ["nome de pessoas", "cargos", "ninguém"]}
  ]'::jsonb,
  true,
  'pt-BR'
),

-- BANT Playbook
(
  NULL,
  'BANT',
  'Qualificação rápida e objetiva: Budget, Authority, Need, Timeline',
  'bant',
  '[
    "Olá {{nome}}! Vi seu interesse em {{area}}. Posso te fazer algumas perguntas rápidas para ver se faz sentido conversarmos?",
    "Oi {{nome}}! Antes de tomar seu tempo, quero entender se somos um bom fit. Posso fazer 4 perguntas diretas?",
    "{{nome}}, trabalho com {{solucao}} e quero ser direto: posso te qualificar rapidamente pra ver se vale uma conversa?"
  ]'::jsonb,
  '[
    "Ótimo! Pelas suas respostas, parece que somos um bom fit. Vamos agendar uma demo?",
    "Perfeito! Com esse contexto, posso preparar uma proposta. Qual o melhor dia essa semana?",
    "Entendi! Baseado no que você me contou, tenho uma solução que pode te ajudar. Topa 15 min de call?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "need", "question": "Qual é o principal desafio que você quer resolver?", "purpose": "Identificar necessidade", "expected_answers": ["problema específico", "meta", "objetivo"]},
    {"order": 2, "phase": "authority", "question": "Você é a pessoa que decide sobre isso ou tem outros envolvidos?", "purpose": "Mapear decisor", "expected_answers": ["eu decido", "preciso aprovar", "outros envolvidos"]},
    {"order": 3, "phase": "budget", "question": "Vocês já têm orçamento alocado para resolver isso?", "purpose": "Qualificar budget", "expected_answers": ["sim", "não", "ainda não", "depende do valor"]},
    {"order": 4, "phase": "timeline", "question": "Para quando vocês precisam resolver isso?", "purpose": "Entender urgência", "expected_answers": ["esse mês", "esse trimestre", "esse ano", "sem prazo"]},
    {"order": 5, "phase": "qualification", "question": "O que te faria avançar para uma conversa mais aprofundada?", "purpose": "Identificar próximo passo", "expected_answers": ["demo", "proposta", "case", "referência"]}
  ]'::jsonb,
  true,
  'pt-BR'
),

-- Consultivo Brasileiro Playbook
(
  NULL,
  'Consultivo Brasileiro',
  'Abordagem focada em relacionamento e confiança, adaptada à cultura brasileira',
  'consultivo-br',
  '[
    "E aí {{nome}}, tudo bem? Vi seu perfil e achei muito interessante o trabalho da {{empresa}}!",
    "Oi {{nome}}! Como está? Seu perfil chamou minha atenção e gostaria de trocar uma ideia contigo.",
    "Olá {{nome}}! Tudo certo? Vi que você trabalha com {{area}} e tenho certeza que teríamos muito assunto!"
  ]'::jsonb,
  '[
    "Adorei trocar essa ideia contigo! Que tal marcarmos um café virtual pra continuar?",
    "Foi ótimo te conhecer! Vamos marcar uma conversa pra eu entender melhor como posso te ajudar?",
    "Gostei muito do papo! Se fizer sentido, posso te apresentar algumas ideias. O que acha?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "rapport", "question": "Como está sendo o ano pra vocês aí na {{empresa}}?", "purpose": "Criar conexão", "expected_answers": ["bom", "desafiador", "corrido", "em crescimento"]},
    {"order": 2, "phase": "rapport", "question": "Vi que você atua há {{tempo}} na área. O que te levou pra esse caminho?", "purpose": "Conhecer trajetória", "expected_answers": ["história pessoal", "motivações"]},
    {"order": 3, "phase": "discovery", "question": "Me conta: qual o maior desafio que você enfrenta hoje no seu dia a dia?", "purpose": "Entender dores de forma natural", "expected_answers": ["desafios profissionais", "problemas"]},
    {"order": 4, "phase": "discovery", "question": "O que te ajudaria a ter mais resultados nessa área?", "purpose": "Identificar necessidades", "expected_answers": ["recursos", "ferramentas", "processos"]},
    {"order": 5, "phase": "value", "question": "Já pensou em resolver isso de alguma forma?", "purpose": "Entender iniciativas anteriores", "expected_answers": ["sim", "não", "tentamos"]},
    {"order": 6, "phase": "closing", "question": "Posso te ajudar com isso de alguma forma?", "purpose": "Oferecer ajuda genuína", "expected_answers": ["sim", "como?", "talvez"]}
  ]'::jsonb,
  true,
  'pt-BR'
),

-- Sandler Selling Playbook
(
  NULL,
  'Sandler Selling System',
  'Sistema focado em qualificação rigorosa e inversão de dinâmica de vendas',
  'sandler',
  '[
    "{{nome}}, antes de falar sobre nós, quero entender: o que te fez aceitar a conexão?",
    "Oi {{nome}}! Sou direto: não sei se somos um bom fit ainda. Posso te fazer algumas perguntas?",
    "{{nome}}, não quero te vender nada ainda. Primeiro quero entender se faz sentido conversarmos."
  ]'::jsonb,
  '[
    "Baseado no que você me contou, parece que podemos te ajudar. Mas antes, tem mais algo que eu deveria saber?",
    "Ok, se eu te apresentar uma solução que resolve isso, qual seria o próximo passo do seu lado?",
    "Entendi seu cenário. Se avançarmos, você consegue tomar essa decisão ou tem mais alguém envolvido?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "bonding", "question": "O que te fez aceitar minha conexão / responder minha mensagem?", "purpose": "Entender motivação inicial", "expected_answers": ["curiosidade", "interesse", "cortesia"]},
    {"order": 2, "phase": "upfront_contract", "question": "Posso te fazer algumas perguntas diretas? Prometo não te vender nada hoje.", "purpose": "Alinhar expectativas", "expected_answers": ["sim", "ok", "pode perguntar"]},
    {"order": 3, "phase": "pain", "question": "Qual é a sua maior frustração com {{area}} hoje?", "purpose": "Identificar dor real", "expected_answers": ["frustração específica", "problema"]},
    {"order": 4, "phase": "pain", "question": "Há quanto tempo você convive com isso?", "purpose": "Medir profundidade da dor", "expected_answers": ["meses", "anos", "sempre"]},
    {"order": 5, "phase": "budget", "question": "Se existisse uma solução, você teria como investir para resolver isso?", "purpose": "Qualificar orçamento", "expected_answers": ["sim", "não", "depende"]},
    {"order": 6, "phase": "decision", "question": "Como funciona o processo de decisão na sua empresa para algo assim?", "purpose": "Mapear processo de compra", "expected_answers": ["eu decido", "comitê", "processo"]}
  ]'::jsonb,
  true,
  'pt-BR'
);

-- =====================================================
-- INSERT ENGLISH PLAYBOOKS
-- =====================================================

INSERT INTO agent_playbooks (account_id, name, description, methodology, opening_scripts, closing_scripts, qualification_questions, is_system, language)
VALUES (
  NULL,
  'SPIN Selling',
  'Consultative methodology based on strategic questions: Situation, Problem, Implication, Need',
  'spin',
  '[
    "Hi {{name}}! I noticed you work as {{title}} at {{company}}. How is managing the {{area}} going?",
    "Hello {{name}}! Your profile caught my attention. Do you deal with {{common_problem}} in your day-to-day?",
    "Hi {{name}}! I saw that {{company}} operates in {{industry}}. How is the current scenario for you?"
  ]'::jsonb,
  '[
    "Does it make sense to have a deeper conversation? I can show you how we solved this for similar companies.",
    "How about a 15-minute call so I can better understand if it makes sense for you?",
    "Can I send you a case study from a company similar to {{company}} that solved this problem?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "situation", "question": "How does the {{area}} process work at your company today?", "purpose": "Understand current context", "expected_answers": ["process description", "tools used", "team involved"]},
    {"order": 2, "phase": "situation", "question": "How many people are involved in this process?", "purpose": "Size the operation", "expected_answers": ["number of people", "team structure"]},
    {"order": 3, "phase": "problem", "question": "What is the biggest challenge you face with this today?", "purpose": "Identify main pain", "expected_answers": ["specific problem", "frustration", "limitation"]},
    {"order": 4, "phase": "problem", "question": "Are you satisfied with current results?", "purpose": "Validate dissatisfaction", "expected_answers": ["yes/no", "satisfaction level", "expectations"]},
    {"order": 5, "phase": "implication", "question": "How much time do you lose because of this?", "purpose": "Quantify impact", "expected_answers": ["hours", "days", "percentage"]},
    {"order": 6, "phase": "implication", "question": "How does this affect team/company results?", "purpose": "Connect with business impact", "expected_answers": ["sales impact", "productivity", "costs"]},
    {"order": 7, "phase": "need", "question": "If you could solve this, what would be the impact?", "purpose": "Lead verbalizes need", "expected_answers": ["expected benefits", "potential ROI"]}
  ]'::jsonb,
  true,
  'en'
),

(
  NULL,
  'BANT Qualification',
  'Quick and objective qualification: Budget, Authority, Need, Timeline',
  'bant',
  '[
    "Hi {{name}}! I saw your interest in {{area}}. Can I ask you a few quick questions to see if it makes sense to talk?",
    "Hello {{name}}! Before taking your time, I want to understand if we are a good fit. Can I ask 4 direct questions?",
    "{{name}}, I work with {{solution}} and want to be direct: can I quickly qualify you to see if a conversation is worth it?"
  ]'::jsonb,
  '[
    "Great! Based on your answers, it seems we are a good fit. Shall we schedule a demo?",
    "Perfect! With this context, I can prepare a proposal. What is the best day this week?",
    "Got it! Based on what you told me, I have a solution that can help. How about a 15-minute call?"
  ]'::jsonb,
  '[
    {"order": 1, "phase": "need", "question": "What is the main challenge you want to solve?", "purpose": "Identify need", "expected_answers": ["specific problem", "goal", "objective"]},
    {"order": 2, "phase": "authority", "question": "Are you the person who decides on this or are others involved?", "purpose": "Map decision maker", "expected_answers": ["I decide", "need approval", "others involved"]},
    {"order": 3, "phase": "budget", "question": "Do you have budget allocated to solve this?", "purpose": "Qualify budget", "expected_answers": ["yes", "no", "not yet", "depends on value"]},
    {"order": 4, "phase": "timeline", "question": "When do you need to solve this?", "purpose": "Understand urgency", "expected_answers": ["this month", "this quarter", "this year", "no deadline"]}
  ]'::jsonb,
  true,
  'en'
);
