import React, { useState } from 'react';
import {
  Search, Filter, Star, Users, ArrowRight, Plus, Sparkles,
  Target, Brain, Lightbulb, TrendingUp, Shield, Compass, Award, Zap
} from 'lucide-react';

// Templates baseados em Métodos de Vendas
const TEMPLATES = {
  prospeccao: [
    {
      id: 'linkedin-sdr-complete',
      name: 'LinkedIn SDR Completo',
      description: 'Fluxo completo de prospeccao no LinkedIn: envio de convite com mensagem, aguarda aceite, rapport, descoberta, apresentacao de valor e conversao. Inclui tratamento de convite ignorado.',
      niche: 'linkedin',
      nicheIcon: Zap,
      rating: 5.0,
      usageCount: 0,
      isOfficial: true,
      tags: ['LinkedIn', 'SDR', 'Fluxo Completo'],
      useLinkedInFlow: true, // Special flag to use full LinkedIn workflow
      workflow_definition: null // Will use getLinkedInSDRWorkflow()
    },
    {
      id: 'spin-selling',
      name: 'SPIN Selling',
      description: 'Metodo criado por Neil Rackham. Foca em perguntas de Situacao, Problema, Implicacao e Necessidade de Solucao.',
      niche: 'metodologia',
      nicheIcon: Target,
      rating: 4.9,
      usageCount: 3240,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-situation',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Situacao (S)',
              stepNumber: 1,
              instructions: 'Faca perguntas para entender o CONTEXTO ATUAL do lead. Descubra como ele trabalha hoje, quais ferramentas usa, qual o tamanho da equipe, processos atuais. Seja genuinamente curioso. Exemplos: "Como voce faz X hoje?", "Quantas pessoas estao envolvidas em Y?", "Qual ferramenta voces usam para Z?"',
              objective: 'Entender a situacao atual do lead',
              maxMessages: 3,
              examples: ['Como voce gerencia seus leads atualmente?', 'Quantos vendedores tem na sua equipe?']
            }
          },
          {
            id: 'step-problem',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Problema (P)',
              stepNumber: 2,
              instructions: 'Explore PROBLEMAS, DIFICULDADES e INSATISFACOES com a situacao atual. Faca o lead verbalizar suas dores. Nao ofereca solucao ainda - apenas aprofunde nos problemas. Exemplos: "O que mais te frustra em X?", "Quais dificuldades voce enfrenta com Y?", "O que nao funciona bem hoje?"',
              objective: 'Identificar problemas e dores',
              maxMessages: 3,
              examples: ['O que mais te incomoda nesse processo?', 'Quais desafios voce enfrenta com isso?']
            }
          },
          {
            id: 'step-implication',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Implicacao (I)',
              stepNumber: 3,
              instructions: 'Amplifique a DOR fazendo o lead pensar nas CONSEQUENCIAS dos problemas. Faca-o perceber o impacto real: perda de tempo, dinheiro, oportunidades, stress. Exemplos: "Quanto tempo voce perde com isso por semana?", "Isso ja fez voce perder algum cliente?", "Como isso afeta o resultado do time?"',
              objective: 'Amplificar a percepcao do impacto',
              maxMessages: 3,
              examples: ['Quanto isso custa para voce por mes?', 'Ja perdeu oportunidades por causa disso?']
            }
          },
          {
            id: 'step-need',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Necessidade (N)',
              stepNumber: 4,
              instructions: 'Faca perguntas que levem o lead a VERBALIZAR O VALOR de uma solucao. Ele deve dizer o beneficio, nao voce. Exemplos: "Se voce pudesse resolver isso, quanto economizaria?", "Como seria ter um processo que funciona?", "O que mudaria se voce nao tivesse esse problema?"',
              objective: 'Lead verbalizar valor da solucao',
              maxMessages: 3,
              examples: ['Como seria se isso funcionasse perfeitamente?', 'O que mudaria na sua rotina?']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Agendar Demo',
              actionType: 'transfer',
              message: 'Pelo que voce me contou, acredito que podemos ajudar bastante. Que tal agendarmos uma demonstracao rapida para eu te mostrar como resolvemos exatamente esses pontos?'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-situation', source: 'condition-accepted', target: 'step-situation', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-situation', target: 'step-problem', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-problem', target: 'step-implication', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-implication', target: 'step-need', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-need', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'bant',
      name: 'BANT',
      description: 'Metodologia classica de qualificacao. Verifica Budget (orcamento), Authority (autoridade), Need (necessidade) e Timeline (prazo).',
      niche: 'metodologia',
      nicheIcon: Shield,
      rating: 4.7,
      usageCount: 2890,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-rapport',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Rapport',
              stepNumber: 1,
              instructions: 'Inicie uma conversa amigavel e natural. Mencione algo do perfil do lead ou contexto. Objetivo e criar conexao antes de qualificar.',
              objective: 'Criar conexao inicial',
              maxMessages: 2,
              examples: ['Vi que voce trabalha com X, como esta o mercado?']
            }
          },
          {
            id: 'step-need',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Need (Necessidade)',
              stepNumber: 2,
              instructions: 'Descubra se existe uma NECESSIDADE REAL. Pergunte sobre desafios, objetivos e prioridades. Se nao houver necessidade, nao ha venda. Exemplos: "Quais sao seus maiores desafios em X?", "O que voce esta tentando melhorar?", "Isso e prioridade agora?"',
              objective: 'Validar se existe necessidade real',
              maxMessages: 3,
              examples: ['Quais desafios voce enfrenta hoje?', 'Melhorar X e prioridade para voce?']
            }
          },
          {
            id: 'step-timeline',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Timeline (Prazo)',
              stepNumber: 3,
              instructions: 'Entenda o URGENCIA e o PRAZO. Quando eles precisam resolver isso? Ha algum evento ou deadline? Urgencia baixa = prioridade baixa. Exemplos: "Para quando voce precisa resolver isso?", "Tem algum prazo especifico?", "O que acontece se nao resolver ate X?"',
              objective: 'Validar urgencia e prazo',
              maxMessages: 2,
              examples: ['Para quando voce precisa disso funcionando?', 'Ha algum prazo ou evento proximo?']
            }
          },
          {
            id: 'step-authority',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Authority (Autoridade)',
              stepNumber: 4,
              instructions: 'Descubra QUEM DECIDE. E essa pessoa? Precisa de aprovacao? Quem mais esta envolvido? Seja diplomatico. Exemplos: "Como funciona o processo de decisao ai?", "Alem de voce, quem mais participa dessa escolha?", "Voce consegue aprovar isso sozinho?"',
              objective: 'Identificar decisores',
              maxMessages: 2,
              examples: ['Como funciona a decisao para algo assim?', 'Quem mais precisa estar envolvido?']
            }
          },
          {
            id: 'step-budget',
            type: 'conversationStep',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Budget (Orcamento)',
              stepNumber: 5,
              instructions: 'Valide se ha ORCAMENTO disponivel. Seja direto mas diplomatico. Se nao ha verba, entenda quando tera. Exemplos: "Voces ja tem orcamento reservado para isso?", "Qual a faixa de investimento que faz sentido?", "Isso ja esta no planejamento financeiro?"',
              objective: 'Validar disponibilidade de orcamento',
              maxMessages: 2,
              examples: ['Ja tem orcamento reservado para isso?', 'Qual faixa de investimento faz sentido?']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2700, y: 40 },
            data: {
              label: 'Agendar Reuniao',
              actionType: 'transfer',
              message: 'Perfeito! Pelo que conversamos, faz total sentido continuarmos. Posso agendar uma conversa com nosso especialista para aprofundarmos?'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-rapport', source: 'condition-accepted', target: 'step-rapport', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-rapport', target: 'step-need', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-need', target: 'step-timeline', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-timeline', target: 'step-authority', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-authority', target: 'step-budget', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e6', source: 'step-budget', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'challenger-sale',
      name: 'Challenger Sale',
      description: 'Baseado no livro de Matthew Dixon. O vendedor ENSINA algo novo, PERSONALIZA a mensagem e ASSUME O CONTROLE da conversa.',
      niche: 'metodologia',
      nicheIcon: Brain,
      rating: 4.8,
      usageCount: 1560,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-warmer',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Aquecimento',
              stepNumber: 1,
              instructions: 'Demonstre que voce PESQUISOU sobre o lead e seu mercado. Mencione algo especifico sobre a empresa ou setor. Mostre que nao e uma abordagem generica.',
              objective: 'Mostrar que conhece o contexto',
              maxMessages: 2,
              examples: ['Vi que a [empresa] esta expandindo para X, como esta esse processo?']
            }
          },
          {
            id: 'step-teach',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Ensinar (Teach)',
              stepNumber: 2,
              instructions: 'Compartilhe um INSIGHT VALIOSO que o lead nao conhecia. Pode ser uma estatistica, tendencia de mercado, ou uma perspectiva diferente. Voce deve ENSINAR algo novo. Exemplos: "Voce sabia que 70% das empresas do seu setor estao fazendo X?", "Um dado interessante: empresas que fazem Y tem 3x mais resultado"',
              objective: 'Entregar insight de valor',
              maxMessages: 3,
              examples: ['Sabia que empresas do seu setor estao perdendo X por nao fazer Y?']
            }
          },
          {
            id: 'step-tailor',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Personalizar (Tailor)',
              stepNumber: 3,
              instructions: 'Conecte o insight com a REALIDADE ESPECIFICA do lead. Mostre como aquilo se aplica ao contexto dele. Personalize totalmente. Exemplos: "No caso da [empresa], isso significa que...", "Considerando o tamanho do seu time, voces provavelmente..."',
              objective: 'Conectar insight com realidade do lead',
              maxMessages: 3,
              examples: ['No seu caso especifico, isso provavelmente significa que...']
            }
          },
          {
            id: 'step-control',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Controlar (Take Control)',
              stepNumber: 4,
              instructions: 'ASSUMA O CONTROLE da conversa. Seja assertivo sobre os proximos passos. Nao peca permissao, PROPONHA o caminho. Lide com objecoes com confianca. Exemplos: "O proximo passo e agendarmos uma call de 30min", "Vou te enviar o material e conversamos quinta"',
              objective: 'Direcionar proximos passos com assertividade',
              maxMessages: 3,
              examples: ['O ideal e conversarmos 30min essa semana. Quinta ou sexta funciona?']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Fechar Reuniao',
              actionType: 'transfer',
              message: 'Vou passar voce para meu colega que vai agendar o melhor horario. Ele ja tem o contexto da nossa conversa.'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-warmer', source: 'condition-accepted', target: 'step-warmer', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-warmer', target: 'step-teach', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-teach', target: 'step-tailor', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-tailor', target: 'step-control', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-control', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'sandler-selling',
      name: 'Sandler Selling System',
      description: 'Sistema Sandler de 7 etapas. Foco em qualificar dor, orcamento e processo de decisao antes de apresentar solucao.',
      niche: 'metodologia',
      nicheIcon: Compass,
      rating: 4.6,
      usageCount: 980,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-bonding',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Rapport & Contrato',
              stepNumber: 1,
              instructions: 'Estabeleca RAPPORT genuino e defina um "contrato" informal: o que vai acontecer nessa conversa, quanto tempo, e que ambos podem dizer nao. Exemplos: "Antes de comecar, deixa eu entender melhor o que voce busca - e no final decidimos juntos se faz sentido continuar"',
              objective: 'Criar rapport e definir expectativas',
              maxMessages: 2,
              examples: ['Vamos fazer assim: conversamos uns 10min, entendo sua situacao, e no final decidimos se faz sentido']
            }
          },
          {
            id: 'step-pain',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Dor (Pain)',
              stepNumber: 2,
              instructions: 'Explore a DOR profundamente usando a tecnica do "funil de dor". Comece superficial e va aprofundando. Pergunte: qual o problema? Ha quanto tempo? Ja tentou resolver? O que acontece se nao resolver? Como isso te afeta pessoalmente?',
              objective: 'Descobrir dor profunda e pessoal',
              maxMessages: 4,
              examples: ['Ha quanto tempo isso e um problema?', 'O que voce ja tentou fazer?', 'Como isso afeta voce no dia a dia?']
            }
          },
          {
            id: 'step-budget',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Orcamento (Budget)',
              stepNumber: 3,
              instructions: 'No Sandler, discutimos ORCAMENTO ANTES de apresentar solucao. Seja direto: "Se encontrarmos uma solucao que resolva isso, quanto voce investiria?" ou "Voces tem verba separada para isso?"',
              objective: 'Qualificar orcamento antes de apresentar',
              maxMessages: 2,
              examples: ['Se resolvermos isso, quanto faria sentido investir?', 'Voces ja tem orcamento para isso?']
            }
          },
          {
            id: 'step-decision',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Decisao (Decision)',
              stepNumber: 4,
              instructions: 'Entenda o PROCESSO DE DECISAO completo. Quem decide? Quais criterios? Qual o processo? Quem pode vetar? Mapeie todos os stakeholders. "Como voces decidem algo assim?", "Quem mais precisa aprovar?"',
              objective: 'Mapear processo de decisao',
              maxMessages: 3,
              examples: ['Como funciona o processo de decisao para algo assim?', 'Quem mais precisa estar envolvido?']
            }
          },
          {
            id: 'step-fulfillment',
            type: 'conversationStep',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Apresentacao',
              stepNumber: 5,
              instructions: 'SOMENTE AGORA apresente como voce pode ajudar. Conecte sua solucao EXATAMENTE com as dores que o lead mencionou. Nao fale de features que nao se conectam com os problemas discutidos.',
              objective: 'Conectar solucao com dores especificas',
              maxMessages: 3,
              examples: ['Voce mencionou que X e um problema. Nos resolvemos exatamente isso fazendo Y']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2700, y: 40 },
            data: {
              label: 'Proximo Passo',
              actionType: 'transfer',
              message: 'Faz sentido para voce? Se sim, o proximo passo e uma demonstracao com nosso especialista. Posso agendar?'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-bonding', source: 'condition-accepted', target: 'step-bonding', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-bonding', target: 'step-pain', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-pain', target: 'step-budget', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-budget', target: 'step-decision', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-decision', target: 'step-fulfillment', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e6', source: 'step-fulfillment', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'solution-selling',
      name: 'Solution Selling',
      description: 'Foco em entender problemas profundamente antes de propor solucoes. Diagnosticar > Desenhar > Demonstrar > Defender.',
      niche: 'metodologia',
      nicheIcon: Lightbulb,
      rating: 4.5,
      usageCount: 1120,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-diagnose',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Diagnosticar',
              stepNumber: 1,
              instructions: 'Aja como um MEDICO: diagnostique antes de receitar. Faca perguntas abertas para entender sintomas, causas e impactos. Nao mencione sua solucao ainda. "Me conta mais sobre...", "O que esta causando isso?", "Como isso afeta o dia a dia?"',
              objective: 'Diagnosticar problemas completamente',
              maxMessages: 4,
              examples: ['Me conta mais sobre como funciona hoje', 'O que voce acha que esta causando isso?']
            }
          },
          {
            id: 'step-design',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Desenhar Solucao',
              stepNumber: 2,
              instructions: 'Co-crie a VISAO DA SOLUCAO com o lead. Pergunte como seria o cenario ideal. Deixe ele descrever o que precisa. "Como seria se isso funcionasse perfeitamente?", "O que voce precisaria ter para resolver isso?"',
              objective: 'Definir visao da solucao ideal',
              maxMessages: 3,
              examples: ['Como seria o cenario ideal para voce?', 'O que voce precisaria ter?']
            }
          },
          {
            id: 'step-demonstrate',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Demonstrar Valor',
              stepNumber: 3,
              instructions: 'Conecte sua solucao com a visao que o lead descreveu. Use as PROPRIAS PALAVRAS dele. "Voce mencionou que precisa de X - nos fazemos exatamente isso atraves de Y". Mostre casos similares.',
              objective: 'Conectar solucao com necessidades',
              maxMessages: 3,
              examples: ['Voce disse que precisa de X. Nos resolvemos isso com Y']
            }
          },
          {
            id: 'step-defend',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Defender ROI',
              stepNumber: 4,
              instructions: 'Construa o BUSINESS CASE. Ajude o lead a calcular o ROI. Quanto ele perde hoje? Quanto economizaria? Em quanto tempo? Use numeros concretos sempre que possivel.',
              objective: 'Justificar investimento com ROI',
              maxMessages: 3,
              examples: ['Se voce perde X por mes, em 6 meses ja pagou o investimento']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Avancar',
              actionType: 'transfer',
              message: 'Os numeros fazem sentido para voce? Vamos agendar uma sessao para desenhar como ficaria a implementacao no seu caso?'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-diagnose', source: 'condition-accepted', target: 'step-diagnose', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-diagnose', target: 'step-design', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-design', target: 'step-demonstrate', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-demonstrate', target: 'step-defend', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-defend', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'consultative-selling',
      name: 'Venda Consultiva',
      description: 'Abordagem focada em ser um CONSULTOR de confianca. Prioriza relacionamento e valor antes da venda.',
      niche: 'metodologia',
      nicheIcon: Award,
      rating: 4.7,
      usageCount: 1890,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-research',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Pesquisa & Contexto',
              stepNumber: 1,
              instructions: 'Demonstre que fez o DEVER DE CASA. Mencione noticias da empresa, conquistas recentes, ou desafios do setor. Mostre interesse genuino em ajudar, nao em vender.',
              objective: 'Mostrar preparacao e interesse genuino',
              maxMessages: 2,
              examples: ['Vi que voces acabaram de lancer X. Como esta a recepcao?']
            }
          },
          {
            id: 'step-listen',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Escuta Ativa',
              stepNumber: 2,
              instructions: 'ESCUTE mais do que fale. Faca perguntas abertas e deixe o lead se expressar. Parafraseie o que ele disse para mostrar que entendeu. "Entao o principal desafio e...", "Se entendi bem, voce precisa de..."',
              objective: 'Entender profundamente atraves da escuta',
              maxMessages: 4,
              examples: ['Me conta mais sobre isso', 'Entao o que voce precisa e...']
            }
          },
          {
            id: 'step-advise',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Aconselhar',
              stepNumber: 3,
              instructions: 'De CONSELHOS GENUINOS, mesmo que nao envolvam seu produto. Compartilhe conhecimento, melhores praticas, e insights. Seja util primeiro. Isso constroi confianca.',
              objective: 'Agregar valor com conselhos genuinos',
              maxMessages: 3,
              examples: ['Uma coisa que funciona bem para empresas como a sua e...', 'Independente de fecharmos, eu recomendaria que voce...']
            }
          },
          {
            id: 'step-align',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Alinhar Solucao',
              stepNumber: 4,
              instructions: 'Se e quando fizer sentido, alinhe como sua solucao pode ajudar. Seja honesto sobre o que faz e o que NAO faz. Transparencia gera confianca. "Acho que podemos ajudar com X e Y, mas para Z talvez outra opcao seja melhor"',
              objective: 'Propor solucao com transparencia',
              maxMessages: 3,
              examples: ['Pelo que voce me contou, acho que podemos ajudar principalmente com X']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Proximo Passo',
              actionType: 'transfer',
              message: 'Faz sentido explorarmos isso mais a fundo? Posso conectar voce com nosso especialista para uma conversa mais tecnica.'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-research', source: 'condition-accepted', target: 'step-research', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-research', target: 'step-listen', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-listen', target: 'step-advise', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-advise', target: 'step-align', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-align', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'value-selling',
      name: 'Value Selling',
      description: 'Metodologia focada em vender VALOR, nao produto. Quantifica beneficios em termos financeiros para o cliente.',
      niche: 'metodologia',
      nicheIcon: TrendingUp,
      rating: 4.6,
      usageCount: 760,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-discover',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Descobrir Objetivos',
              stepNumber: 1,
              instructions: 'Descubra os OBJETIVOS DE NEGOCIO do lead. Nao pergunte sobre problemas ainda - pergunte sobre metas. "Quais sao as prioridades da empresa esse ano?", "O que voces estao tentando alcamcar?"',
              objective: 'Entender metas de negocio',
              maxMessages: 3,
              examples: ['Quais sao as prioridades para esse trimestre?', 'O que voces estao buscando alcancar?']
            }
          },
          {
            id: 'step-gap',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Identificar Gap',
              stepNumber: 2,
              instructions: 'Identifique o GAP entre onde estao e onde querem chegar. Quantifique: quanto falta? Qual o impacto de nao atingir? "Onde voces estao hoje vs onde querem chegar?", "O que impede de atingir essa meta?"',
              objective: 'Quantificar gap entre atual e desejado',
              maxMessages: 3,
              examples: ['Onde voces estao hoje em relacao a essa meta?', 'O que esta impedindo de chegar la?']
            }
          },
          {
            id: 'step-quantify',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Quantificar Valor',
              stepNumber: 3,
              instructions: 'QUANTIFIQUE O VALOR em reais/dolares. Quanto custa o problema? Quanto vale resolver? Use a linguagem do CFO. "Se voces perdem X% em Y, isso da quanto por mes?", "Quanto vale fechar esse gap?"',
              objective: 'Traduzir problema em valor financeiro',
              maxMessages: 3,
              examples: ['Quanto isso representa em reais por mes?', 'Qual o custo de nao resolver isso?']
            }
          },
          {
            id: 'step-differentiate',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Diferenciar',
              stepNumber: 4,
              instructions: 'Mostre como sua solucao entrega VALOR UNICO que outros nao entregam. Foque no ROI e no diferencial competitivo. "O que nos diferencia e que entregamos X a mais, que se traduz em Y de resultado"',
              objective: 'Demonstrar valor unico vs alternativas',
              maxMessages: 3,
              examples: ['O diferencial e que entregamos X, o que significa Y de economia']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Business Case',
              actionType: 'transfer',
              message: 'Posso montar um business case personalizado mostrando o ROI para o seu caso? Agenda uma call de 30min para apresentar?'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-discover', source: 'condition-accepted', target: 'step-discover', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-discover', target: 'step-gap', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-gap', target: 'step-quantify', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-quantify', target: 'step-differentiate', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-differentiate', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'gap-selling',
      name: 'Gap Selling',
      description: 'Criado por Keenan. Foca na diferenca (gap) entre o estado atual e o estado desejado do cliente.',
      niche: 'metodologia',
      nicheIcon: Zap,
      rating: 4.5,
      usageCount: 540,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 120 },
            data: {
              label: 'Inicio',
              event: 'invite_sent',
              description: 'Enviar convite de conexao',
              withNote: true,
              inviteNote: 'Ola {{first_name}}, tudo bem?'
            }
          },
          {
            id: 'condition-accepted',
            type: 'condition',
            position: { x: 420, y: 100 },
            data: {
              label: 'Convite Aceito?',
              conditionType: 'invite_accepted',
              waitTime: 7,
              waitUnit: 'days'
            }
          },
          {
            id: 'step-current',
            type: 'conversationStep',
            position: { x: 800, y: 40 },
            data: {
              label: 'Estado Atual',
              stepNumber: 1,
              instructions: 'Mapeie o ESTADO ATUAL em detalhes. Como funciona hoje? Quais os resultados atuais? Quais os problemas? Seja especifico e quantifique. "Me descreve como e o processo hoje", "Quais resultados voces tem atualmente?"',
              objective: 'Mapear estado atual completamente',
              maxMessages: 4,
              examples: ['Como funciona o processo hoje?', 'Quais resultados voces estao tendo?']
            }
          },
          {
            id: 'step-future',
            type: 'conversationStep',
            position: { x: 1180, y: 40 },
            data: {
              label: 'Estado Futuro',
              stepNumber: 2,
              instructions: 'Defina o ESTADO FUTURO desejado. Como o lead quer que seja? Quais resultados quer atingir? Faca-o visualizar o sucesso. "Como voce gostaria que fosse?", "Que resultados voce espera atingir?"',
              objective: 'Definir visao do estado desejado',
              maxMessages: 3,
              examples: ['Como voce gostaria que funcionasse?', 'Que resultado seria ideal?']
            }
          },
          {
            id: 'step-gap',
            type: 'conversationStep',
            position: { x: 1560, y: 40 },
            data: {
              label: 'Definir o Gap',
              stepNumber: 3,
              instructions: 'Articule o GAP claramente. Qual a diferenca entre atual e desejado? Quantifique em numeros, tempo, dinheiro. Faca o lead sentir a distancia. "Entao hoje voce tem X e quer chegar em Y - isso e um gap de Z"',
              objective: 'Quantificar a diferenca entre estados',
              maxMessages: 3,
              examples: ['Entao o gap entre onde voce esta e onde quer chegar e de X']
            }
          },
          {
            id: 'step-impact',
            type: 'conversationStep',
            position: { x: 1940, y: 40 },
            data: {
              label: 'Impacto do Gap',
              stepNumber: 4,
              instructions: 'Explore o IMPACTO de manter esse gap. O que acontece se nao fechar? Qual o custo de nao agir? Crie urgencia real. "O que acontece se voce continuar assim por mais 6 meses?", "Quanto custa esse gap por mes?"',
              objective: 'Criar urgencia mostrando impacto',
              maxMessages: 3,
              examples: ['O que acontece se continuar assim?', 'Qual o custo de nao resolver?']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 2320, y: 40 },
            data: {
              label: 'Fechar o Gap',
              actionType: 'transfer',
              message: 'Nos ajudamos empresas a fechar exatamente esse tipo de gap. Quer ver como funcionaria no seu caso?'
            }
          },
          {
            id: 'action-end',
            type: 'action',
            position: { x: 420, y: 280 },
            data: {
              label: 'Encerrar',
              actionType: 'close_negative',
              message: ''
            }
          }
        ],
        edges: [
          { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e-accepted-current', source: 'condition-accepted', target: 'step-current', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
          { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
          { id: 'e2', source: 'step-current', target: 'step-future', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-future', target: 'step-gap', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-gap', target: 'step-impact', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-impact', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    }
  ],
  atendimento: [
    {
      id: 'spin-atendimento',
      name: 'SPIN para Atendimento',
      description: 'Adaptacao do SPIN Selling para atendimento receptivo. Qualifica necessidades antes de oferecer solucao.',
      niche: 'metodologia',
      nicheIcon: Target,
      rating: 4.7,
      usageCount: 1450,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 100 },
            data: {
              label: 'Inicio',
              event: 'message_received',
              description: 'Quando mensagem for recebida'
            }
          },
          {
            id: 'step-greeting',
            type: 'conversationStep',
            position: { x: 380, y: 100 },
            data: {
              label: 'Saudacao',
              stepNumber: 1,
              instructions: 'Recepcione o cliente de forma calorosa e profissional. Pergunte como pode ajudar. Seja genuino e acolhedor.',
              objective: 'Criar primeira impressao positiva',
              maxMessages: 1,
              examples: ['Ola! Tudo bem? Como posso te ajudar hoje?']
            }
          },
          {
            id: 'step-situation',
            type: 'conversationStep',
            position: { x: 720, y: 100 },
            data: {
              label: 'Entender Situacao',
              stepNumber: 2,
              instructions: 'Entenda o CONTEXTO do cliente. O que ele busca? Qual a situacao atual? Para quem e? Colete informacoes basicas de forma natural.',
              objective: 'Entender contexto e situacao',
              maxMessages: 3,
              examples: ['Me conta um pouco mais sobre o que voce precisa', 'E para uso pessoal ou para empresa?']
            }
          },
          {
            id: 'step-problem',
            type: 'conversationStep',
            position: { x: 1060, y: 100 },
            data: {
              label: 'Identificar Problema',
              stepNumber: 3,
              instructions: 'Descubra o PROBLEMA ou DOR real. O que motivou o contato? Qual dificuldade ele quer resolver? Va alem do pedido superficial.',
              objective: 'Descobrir dor real por tras do contato',
              maxMessages: 3,
              examples: ['O que te motivou a buscar isso agora?', 'Qual problema voce quer resolver?']
            }
          },
          {
            id: 'step-solution',
            type: 'conversationStep',
            position: { x: 1400, y: 100 },
            data: {
              label: 'Apresentar Solucao',
              stepNumber: 4,
              instructions: 'Apresente a SOLUCAO conectada com o problema identificado. Mostre como resolve a dor especifica do cliente. Seja claro e objetivo.',
              objective: 'Conectar solucao com problema',
              maxMessages: 3,
              examples: ['Para resolver isso que voce mencionou, a melhor opcao seria...']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 1740, y: 100 },
            data: {
              label: 'Converter',
              actionType: 'transfer',
              message: 'Posso te ajudar a fechar isso agora ou prefere que eu te passe mais informacoes?'
            }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'step-greeting', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e2', source: 'step-greeting', target: 'step-situation', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-situation', target: 'step-problem', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-problem', target: 'step-solution', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-solution', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    },
    {
      id: 'consultive-service',
      name: 'Atendimento Consultivo',
      description: 'Abordagem consultiva para atendimento. Foca em ser um advisor de confianca, nao apenas tirar duvidas.',
      niche: 'metodologia',
      nicheIcon: Award,
      rating: 4.8,
      usageCount: 2100,
      isOfficial: true,
      tags: ['Metodos de Vendas'],
      workflow_definition: {
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 40, y: 100 },
            data: {
              label: 'Inicio',
              event: 'message_received',
              description: 'Quando mensagem for recebida'
            }
          },
          {
            id: 'step-welcome',
            type: 'conversationStep',
            position: { x: 380, y: 100 },
            data: {
              label: 'Boas-vindas',
              stepNumber: 1,
              instructions: 'De boas-vindas calorosas. Mostre que esta ali para ajudar de verdade. Pergunte como pode ser util.',
              objective: 'Criar ambiente de confianca',
              maxMessages: 1,
              examples: ['Ola! Fico feliz em te atender. Como posso te ajudar?']
            }
          },
          {
            id: 'step-understand',
            type: 'conversationStep',
            position: { x: 720, y: 100 },
            data: {
              label: 'Entender Necessidade',
              stepNumber: 2,
              instructions: 'ESCUTE ativamente. Faca perguntas para entender a fundo o que o cliente precisa. Nao assuma - pergunte. Parafraseie para confirmar entendimento.',
              objective: 'Entender necessidade completamente',
              maxMessages: 4,
              examples: ['Me conta mais sobre isso', 'Se entendi bem, voce precisa de... certo?']
            }
          },
          {
            id: 'step-advise',
            type: 'conversationStep',
            position: { x: 1060, y: 100 },
            data: {
              label: 'Aconselhar',
              stepNumber: 3,
              instructions: 'De CONSELHOS GENUINOS baseados na necessidade. Recomende a melhor opcao, mesmo que nao seja a mais cara. Seja honesto sobre pros e contras.',
              objective: 'Dar orientacao honesta e util',
              maxMessages: 3,
              examples: ['Pelo que voce me contou, eu recomendaria...', 'A opcao X seria melhor porque...']
            }
          },
          {
            id: 'step-confirm',
            type: 'conversationStep',
            position: { x: 1400, y: 100 },
            data: {
              label: 'Confirmar Solucao',
              stepNumber: 4,
              instructions: 'Confirme se a solucao atende. Tire duvidas restantes. Certifique-se que o cliente esta confortavel antes de prosseguir.',
              objective: 'Garantir satisfacao com a solucao',
              maxMessages: 2,
              examples: ['Isso resolve o que voce precisa?', 'Ficou alguma duvida?']
            }
          },
          {
            id: 'action-transfer',
            type: 'action',
            position: { x: 1740, y: 100 },
            data: {
              label: 'Finalizar',
              actionType: 'transfer',
              message: 'Perfeito! Vou te passar para a equipe finalizar. Foi um prazer te ajudar!'
            }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'step-welcome', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e2', source: 'step-welcome', target: 'step-understand', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e3', source: 'step-understand', target: 'step-advise', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e4', source: 'step-advise', target: 'step-confirm', sourceHandle: 'right', targetHandle: 'left' },
          { id: 'e5', source: 'step-confirm', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' }
        ]
      }
    }
  ]
};

// Channel display names
const CHANNEL_NAMES = {
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  email: 'Email',
  webchat: 'Chat do Site'
};

const TemplateGallery = ({ agentType, channel, onSelect, onCreateFromScratch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('all');

  const templates = TEMPLATES[agentType] || [];

  // Get unique tags
  const allTags = [...new Set(templates.flatMap(t => t.tags))];

  // Filter templates
  // Note: Sales methodology templates are channel-agnostic - they work for any channel
  // The trigger will be adapted based on the selected channel when loaded
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = filterTag === 'all' || template.tags.includes(filterTag);

    return matchesSearch && matchesTag;
  });

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-medium mb-4">
          Canal: {CHANNEL_NAMES[channel] || channel}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Escolha um Metodo de Vendas
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Cada template vem pre-configurado com as etapas e instrucoes do metodo. Voce pode personalizar depois.
        </p>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar metodos..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={() => setFilterTag('all')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filterTag === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Todos
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterTag === tag
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Create from scratch card */}
        <button
          onClick={onCreateFromScratch}
          className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-600 hover:border-purple-500 dark:hover:border-purple-400 transition-all group text-left"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
              <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <ArrowRight className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-auto" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Criar do zero
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Comece com uma folha em branco e crie seu proprio metodo.
          </p>
        </button>

        {/* Template cards */}
        {filteredTemplates.map((template) => {
          const NicheIcon = template.nicheIcon;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all group text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <NicheIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  {template.isOfficial && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded">
                      <Sparkles className="w-3 h-3" />
                      Oficial
                    </span>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>

              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {template.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                {template.description}
              </p>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-medium">{template.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{template.usageCount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                {template.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum metodo encontrado para "{searchQuery}"
          </p>
        </div>
      )}
    </div>
  );
};

export default TemplateGallery;
