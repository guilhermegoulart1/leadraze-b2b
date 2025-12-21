-- Migration 092: Create objection library table
-- Purpose: Store common sales objections with pre-tested responses

-- Create objection_library table
CREATE TABLE IF NOT EXISTS objection_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,

  -- Categorization
  category VARCHAR(50) NOT NULL, -- price, timing, authority, need, trust, competitor
  objection_text TEXT NOT NULL, -- Display text: "É muito caro / Não tenho orçamento"
  keywords TEXT[] NOT NULL DEFAULT '{}', -- Keywords that trigger this objection

  -- Responses (array of alternative responses)
  responses JSONB NOT NULL DEFAULT '[]', -- Array of response strings

  -- Metrics
  times_used INTEGER DEFAULT 0,
  times_successful INTEGER DEFAULT 0, -- Lead continued conversation after response
  success_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN times_used > 0 THEN (times_successful::decimal / times_used * 100) ELSE 0 END
  ) STORED,

  -- Flags
  is_system BOOLEAN DEFAULT false, -- System templates (not editable by user)
  is_active BOOLEAN DEFAULT true,
  language VARCHAR(10) DEFAULT 'pt-BR',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast keyword search
CREATE INDEX idx_objection_library_account ON objection_library(account_id);
CREATE INDEX idx_objection_library_category ON objection_library(category);
CREATE INDEX idx_objection_library_keywords ON objection_library USING GIN(keywords);
CREATE INDEX idx_objection_library_system ON objection_library(is_system) WHERE is_system = true;

-- Add comments for documentation
COMMENT ON TABLE objection_library IS 'Library of common sales objections with pre-tested responses';
COMMENT ON COLUMN objection_library.category IS 'Objection category: price, timing, authority, need, trust, competitor';
COMMENT ON COLUMN objection_library.keywords IS 'Keywords that trigger this objection detection';
COMMENT ON COLUMN objection_library.responses IS 'Array of alternative response templates';
COMMENT ON COLUMN objection_library.is_system IS 'System templates are shared across all accounts';

-- Insert system objection templates (Portuguese)
INSERT INTO objection_library (account_id, category, objection_text, keywords, responses, is_system, language) VALUES

-- PRICE objections
(NULL, 'price', 'É muito caro / Não tenho orçamento',
 ARRAY['caro', 'preço', 'orçamento', 'custo', 'investimento', 'budget', 'valor', 'dinheiro', 'grana', 'pagar'],
 '[
   "Entendo a preocupação com investimento. Posso perguntar: quanto você estimaria que está perdendo hoje sem uma solução?",
   "Antes de falar de valores, me ajuda a entender: qual seria o impacto de resolver esse problema?",
   "Faz sentido. Muitos clientes tinham essa mesma dúvida antes de ver o ROI. Posso mostrar um caso similar?",
   "Entendo! O que você consideraria um investimento justo pra resolver esse problema?"
 ]'::jsonb, true, 'pt-BR'),

-- TIMING objections
(NULL, 'timing', 'Agora não é o momento / Estou ocupado',
 ARRAY['agora não', 'depois', 'ano que vem', 'momento', 'ocupado', 'timing', 'sem tempo', 'correria', 'prioridade'],
 '[
   "Entendo! O que precisaria acontecer para ser o momento certo?",
   "Sem problemas. Posso perguntar: é uma questão de prioridade ou de capacidade?",
   "Faz sentido. Vocês já têm algo planejado pra resolver isso ou é mais uma questão de agenda?",
   "Entendo a correria! Qual seria o melhor momento pra uma conversa de 10 minutos?"
 ]'::jsonb, true, 'pt-BR'),

-- AUTHORITY objections
(NULL, 'authority', 'Preciso falar com meu chefe / Não sou o decisor',
 ARRAY['chefe', 'diretor', 'decisor', 'aprovar', 'permissão', 'superior', 'gestor', 'diretoria', 'board'],
 '[
   "Claro! Quem seria a pessoa ideal pra essa conversa? Posso enviar um material que facilite essa conversa interna.",
   "Entendo. O que você acha que seu gestor precisaria ver pra considerar?",
   "Sem problemas. Você consegue me dizer qual é o processo de decisão aí?",
   "Faz sentido! Posso preparar um resumo executivo pra você apresentar internamente?"
 ]'::jsonb, true, 'pt-BR'),

-- NEED/COMPETITOR objections
(NULL, 'need', 'Já uso outra ferramenta / Já temos solução',
 ARRAY['já uso', 'já tenho', 'concorrente', 'ferramenta', 'solução', 'outro sistema', 'satisfeito', 'funciona bem'],
 '[
   "Ótimo que vocês já investem nisso! Me conta: o que você mais gosta da solução atual?",
   "Interessante! E o que você mudaria se pudesse?",
   "Entendo. Muitos dos nossos clientes vieram de soluções similares. O que os fez mudar foi [diferencial]. Faz sentido pra vocês?",
   "Legal! Vocês estão 100% satisfeitos ou tem algo que poderia ser melhor?"
 ]'::jsonb, true, 'pt-BR'),

-- TRUST objections
(NULL, 'trust', 'Não conheço a empresa / Preciso de referências',
 ARRAY['não conheço', 'nunca ouvi', 'referência', 'garantia', 'seguro', 'confiança', 'cases', 'clientes'],
 '[
   "Faz sentido querer conhecer melhor! Trabalhamos com empresas como [clientes]. Posso compartilhar um case?",
   "Entendo totalmente. O que te deixaria mais seguro pra uma conversa inicial?",
   "Boa pergunta! Temos vários clientes no seu segmento. Posso te conectar com algum pra referência?",
   "Super válido! Temos cases públicos que mostram resultados reais. Quer que eu envie?"
 ]'::jsonb, true, 'pt-BR'),

-- COMPETITOR objections (specific)
(NULL, 'competitor', 'Já falei com [concorrente] / Estou comparando',
 ARRAY['concorrente', 'comparando', 'cotação', 'outras propostas', 'vs', 'versus', 'diferença'],
 '[
   "Ótimo que está pesquisando! Posso perguntar: o que você está priorizando nessa decisão?",
   "Legal! O que você mais gostou do que viu até agora?",
   "Faz sentido comparar. Nossos clientes costumam nos escolher por [diferencial]. Isso é importante pra você?",
   "Entendo! Qual critério vai pesar mais na sua decisão?"
 ]'::jsonb, true, 'pt-BR'),

-- NOT_INTERESTED objections
(NULL, 'not_interested', 'Não tenho interesse / Não preciso',
 ARRAY['não tenho interesse', 'não preciso', 'não quero', 'obrigado mas não', 'sem interesse'],
 '[
   "Sem problemas! Posso perguntar: vocês já resolveram isso de outra forma ou simplesmente não é prioridade?",
   "Entendo! Só por curiosidade: o que faria você considerar algo assim no futuro?",
   "Tudo bem! Se não for prioridade agora, posso voltar a falar em alguns meses?",
   "Ok! Antes de encerrar, posso perguntar o que te fez não ter interesse?"
 ]'::jsonb, true, 'pt-BR'),

-- SKEPTICISM objections
(NULL, 'skepticism', 'Parece bom demais / Qual é o truque?',
 ARRAY['bom demais', 'truque', 'pegadinha', 'letra miúda', 'escondido', 'armadilha'],
 '[
   "Entendo o ceticismo! Quer que eu te mostre casos reais de clientes como você?",
   "Faz sentido questionar. Posso ser transparente sobre limitações também. O que te preocupa?",
   "Boa pergunta! Prefiro ser honesto: funciona muito bem pra [perfil], mas nem sempre pra [outro perfil]. Qual é o seu caso?",
   "Entendo! Que tal uma conversa rápida pra eu entender sua situação e ver se realmente faz sentido?"
 ]'::jsonb, true, 'pt-BR');

-- Insert English system templates
INSERT INTO objection_library (account_id, category, objection_text, keywords, responses, is_system, language) VALUES

(NULL, 'price', 'Too expensive / No budget',
 ARRAY['expensive', 'price', 'budget', 'cost', 'afford', 'money', 'investment'],
 '[
   "I understand the investment concern. Can I ask: how much do you estimate you''re losing today without a solution?",
   "Before talking about pricing, help me understand: what would be the impact of solving this problem?",
   "Makes sense. Many clients had the same doubt before seeing the ROI. Can I show you a similar case?",
   "I hear you! What would you consider a fair investment to solve this problem?"
 ]'::jsonb, true, 'en'),

(NULL, 'timing', 'Now is not the right time / Too busy',
 ARRAY['not now', 'later', 'next year', 'timing', 'busy', 'no time', 'priority'],
 '[
   "I understand! What would need to happen for it to be the right time?",
   "No problem. Can I ask: is it a priority issue or a capacity issue?",
   "Makes sense. Do you have anything planned to solve this or is it more about timing?",
   "I get it! When would be a better time for a quick 10-minute chat?"
 ]'::jsonb, true, 'en'),

(NULL, 'authority', 'I need to talk to my boss / Not the decision maker',
 ARRAY['boss', 'director', 'decision maker', 'approve', 'manager', 'board', 'executive'],
 '[
   "Of course! Who would be the right person for this conversation? I can send material to help the internal discussion.",
   "I understand. What do you think your manager would need to see to consider this?",
   "No problem. Can you tell me what the decision process looks like there?",
   "Makes sense! Can I prepare an executive summary for you to present internally?"
 ]'::jsonb, true, 'en'),

(NULL, 'need', 'Already using another tool / Already have a solution',
 ARRAY['already use', 'already have', 'competitor', 'tool', 'solution', 'satisfied', 'works fine'],
 '[
   "Great that you''re already investing in this! Tell me: what do you like most about your current solution?",
   "Interesting! And what would you change if you could?",
   "I see. Many of our clients came from similar solutions. What made them switch was [differentiator]. Does that resonate?",
   "Nice! Are you 100% satisfied or is there something that could be better?"
 ]'::jsonb, true, 'en');
