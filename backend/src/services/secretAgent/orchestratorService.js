/**
 * Secret Agent Orchestrator Service
 *
 * The "brain" that coordinates all intelligence agents
 * Decomposes objectives into subtasks and assigns to agents
 */

const { Pool } = require('pg');
const OpenAI = require('openai');
const {
  publishInvestigationStarted,
  publishAgentStarted,
  publishAgentProgress,
  publishAgentCompleted,
  publishDirectorCompiling,
  publishInvestigationComplete,
  publishAgentError
} = require('../socketService');

// Intelligence services
const { cnpjService, exaService, tavilyService, openCorporatesService } = require('../intelligence');
const linkedinIntelService = require('../intelligence/linkedinIntelService');

// Gemini for large context fallback
const { geminiService } = require('../../config/gemini');

// Token estimation (rough: 1 token ~= 4 chars)
const estimateTokens = (text) => Math.ceil((text || '').length / 4);
const MAX_GPT_TOKENS = 100000; // Leave some room below 128k limit

// Agent definitions with PhD-level expertise
const AGENTS = {
  marcus_chen: {
    id: 'marcus_chen',
    name: 'Marcus Chen',
    role: 'Analista de Dados Corporativos',
    roleEn: 'Corporate Data Analyst',
    avatar: '/agents/marcus-chen.jpg',
    specialty: 'Official data, CNPJ, government records, corporate structure',
    expertise: `PhD em Análise de Dados Corporativos com especialização em:
- Due diligence e análise de risco empresarial
- Estruturas societárias complexas e holdings
- Interpretação de balanços e indicadores financeiros
- Identificação de red flags em dados cadastrais
- Mapeamento de subsidiárias e grupos econômicos
Ao analisar uma empresa, SEMPRE busque: capital social, faturamento estimado, número de funcionários, tempo de mercado, situação fiscal, e estrutura de controle.`
  },
  sarah_mitchell: {
    id: 'sarah_mitchell',
    name: 'Sarah Mitchell',
    role: 'Especialista em Mapeamento de Decisores',
    roleEn: 'Decision Maker Mapping Specialist',
    avatar: '/agents/sarah-mitchell.jpg',
    specialty: 'Decision makers, org charts, LinkedIn profiles, career history',
    expertise: `PhD em Psicologia Organizacional e Vendas B2B com especialização em:
- Identificação de DMUs (Decision Making Units) em organizações complexas
- Análise de perfil comportamental DISC de executivos
- Mapeamento de poder formal vs informal nas organizações
- Técnicas de Account-Based Selling
- Identificação de champions, influenciadores e blockers
Ao analisar pessoas, SEMPRE identifique: cargo real vs título, tempo na empresa, histórico de decisões, estilo de comunicação preferido, e gatilhos de compra.`
  },
  james_rodriguez: {
    id: 'james_rodriguez',
    name: 'James Rodriguez',
    role: 'Estrategista de Networking B2B',
    roleEn: 'B2B Networking Strategist',
    avatar: '/agents/james-rodriguez.jpg',
    specialty: 'Relationship mapping, mutual connections, access paths',
    expertise: `PhD em Teoria de Redes e Vendas Consultivas com especialização em:
- Teoria dos 6 graus de separação aplicada a vendas
- Warm introduction strategies e referral selling
- Mapeamento de clusters de relacionamento
- Social proximity scoring
- Identificação de "super conectores" em indústrias
Ao mapear conexões, SEMPRE busque: conexões de 1º, 2º e 3º grau, eventos em comum, empresas anteriores em comum, grupos/associações, e o "caminho mais quente" para acesso.`
  },
  elena_volkov: {
    id: 'elena_volkov',
    name: 'Elena Volkov',
    role: 'Analista de Inteligência Competitiva',
    roleEn: 'Competitive Intelligence Analyst',
    avatar: '/agents/elena-volkov.jpg',
    specialty: 'Market analysis, competitors, trends, opportunities',
    expertise: `PhD em Estratégia Competitiva e Inteligência de Mercado com especialização em:
- Frameworks de análise: Porter's 5 Forces, SWOT, PESTEL
- Identificação de market gaps e blue oceans
- Análise de share of voice e posicionamento
- Mapeamento de substitute products e indirect competitors
- Timing de mercado e ciclos de compra
Ao analisar mercado, SEMPRE identifique: tamanho do mercado (TAM/SAM/SOM), principais players, tendências emergentes, barreiras de entrada, e oportunidades de diferenciação.`
  },
  david_park: {
    id: 'david_park',
    name: 'David Park',
    role: 'Analista de Reputação e Timing',
    roleEn: 'Reputation & Timing Analyst',
    avatar: '/agents/david-park.jpg',
    specialty: 'News, social media, reputation, public mentions',
    expertise: `PhD em Comunicação Corporativa e Sales Intelligence com especialização em:
- Análise de sentimento e reputação online
- Identificação de trigger events para vendas
- Monitoramento de sinais de compra (funding, expansão, contratações)
- Crisis detection e risk assessment
- Timing intelligence para abordagem comercial
Ao analisar mídia, SEMPRE busque: notícias de funding, expansão, mudanças de liderança, problemas públicos, e qualquer "trigger event" que crie urgência de compra.`
  },
  director_morgan: {
    id: 'director_morgan',
    name: 'Director Morgan',
    role: 'Diretor de Estratégia Comercial',
    roleEn: 'Commercial Strategy Director',
    avatar: '/agents/director-morgan.jpg',
    specialty: 'Coordinates team, compiles reports, strategic recommendations',
    expertise: `PhD em Estratégia de Vendas Enterprise com especialização em:
- Metodologias de vendas: SPIN, Challenger, MEDDIC, Sandler
- Account planning e territory management
- Value proposition design
- Competitive positioning e battlecards
- Sales playbooks e sequências de abordagem
Ao compilar o dossiê, SEMPRE entregue: resumo executivo acionável, pontos de dor prováveis, proposta de valor customizada, objeções esperadas e como contorná-las, e um plano de abordagem em 3 passos.`
  }
};

// Objective analysis categories
const OBJECTIVE_TYPES = {
  SELL: 'sell',           // Quero vender para...
  CONNECT: 'connect',     // Quero me conectar com...
  RESEARCH: 'research',   // Quero entender/pesquisar...
  COMPETE: 'compete',     // Quero competir com...
  PARTNER: 'partner',     // Quero fazer parceria com...
  HIRE: 'hire'            // Quero contratar de/para...
};

class OrchestratorService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'leadraze',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * 🎼 MAESTRO: Analyze the client's objective and create mission briefing
   * This is the brain that understands WHAT the client really wants
   */
  async analyzeObjective(targetName, researchType, objective, targetDetails) {
    // Build enhanced context from targetDetails
    const enhancedContext = this.buildEnhancedContext(targetDetails, researchType);

    const systemPrompt = `Você é o Director Morgan, um estrategista de vendas B2B com PhD em Estratégia Comercial.

Sua tarefa é ANALISAR o objetivo do cliente e criar um BRIEFING DE MISSÃO para sua equipe de inteligência.

CATEGORIAS DE OBJETIVO:
- SELL: Cliente quer vender algo para o alvo
- CONNECT: Cliente quer se conectar/networking com o alvo
- RESEARCH: Cliente quer entender/pesquisar o alvo
- COMPETE: Cliente quer competir com o alvo
- PARTNER: Cliente quer fazer parceria com o alvo
- HIRE: Cliente quer contratar ou ser contratado

IMPORTANTE: Use os DADOS CONTEXTUAIS fornecidos para criar queries ESPECÍFICAS e DIRECIONADAS.
Por exemplo, se o cliente informou o setor, use isso para refinar as buscas.
Se informou o cargo da pessoa, foque nas conexões desse nível hierárquico.

Retorne um JSON com:
{
  "objectiveType": "SELL|CONNECT|RESEARCH|COMPETE|PARTNER|HIRE",
  "summary": "Resumo de 1 linha do que o cliente quer",
  "keyQuestions": ["3-5 perguntas-chave que a investigação deve responder, usando contexto específico fornecido"],
  "priorityAgents": ["IDs dos agentes mais importantes para este objetivo em ordem"],
  "specialFocus": {
    "marcus_chen": "Instrução específica para Marcus usando dados contextuais",
    "sarah_mitchell": "Instrução específica para Sarah usando dados contextuais",
    "james_rodriguez": "Instrução específica para James usando dados contextuais",
    "elena_volkov": "Instrução específica para Elena usando dados contextuais",
    "david_park": "Instrução específica para David usando dados contextuais"
  },
  "searchQueries": {
    "marcus_chen": ["Queries específicas para busca de dados corporativos"],
    "sarah_mitchell": ["Queries específicas para busca de pessoas/decisores"],
    "james_rodriguez": ["Queries específicas para mapeamento de conexões"],
    "elena_volkov": ["Queries específicas para análise de mercado"],
    "david_park": ["Queries específicas para monitoramento de mídia"]
  },
  "successCriteria": "O que define sucesso para esta investigação"
}`;

    const userPrompt = `ALVO: ${targetName}
TIPO DE INVESTIGAÇÃO: ${researchType}
OBJETIVO DO CLIENTE: ${objective || 'Investigação geral - descobrir tudo sobre o alvo'}

DADOS CONTEXTUAIS COLETADOS:
${enhancedContext}

Analise e crie o briefing de missão com queries específicas para cada agente.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const briefing = JSON.parse(response.choices[0].message.content);
      console.log(`[Maestro] Mission briefing created: ${briefing.objectiveType}`);
      return briefing;

    } catch (error) {
      console.error('[Maestro] Error analyzing objective:', error.message);
      // Fallback to default briefing
      return {
        objectiveType: 'RESEARCH',
        summary: `Investigação completa sobre ${targetName}`,
        keyQuestions: [
          'Quem são os decisores?',
          'Qual a situação atual da empresa/pessoa?',
          'Quais são as oportunidades?'
        ],
        priorityAgents: ['marcus_chen', 'sarah_mitchell', 'elena_volkov', 'david_park', 'james_rodriguez'],
        specialFocus: {},
        searchQueries: {},
        successCriteria: 'Dossiê completo com informações acionáveis'
      };
    }
  }

  /**
   * Build enhanced context string from target details
   * Makes the conversation data usable for query generation
   */
  buildEnhancedContext(targetDetails, researchType) {
    if (!targetDetails) return 'Nenhum dado adicional fornecido.';

    const contextLines = [];

    // Common fields
    if (targetDetails.cnpj) contextLines.push(`• CNPJ: ${targetDetails.cnpj}`);
    if (targetDetails.domain) contextLines.push(`• Website/Domínio: ${targetDetails.domain}`);
    if (targetDetails.linkedinUrl) contextLines.push(`• LinkedIn: ${targetDetails.linkedinUrl}`);

    // LinkedIn integration status
    if (targetDetails.useLinkedIn) {
      contextLines.push(`• 🔗 LINKEDIN ATIVADO: Usar API Unipile para buscar funcionários, conexões e perfis detalhados`);
    }

    // Company-specific
    if (researchType === 'company') {
      if (targetDetails.industry) contextLines.push(`• Setor/Indústria: ${targetDetails.industry}`);
      if (targetDetails.companySize) contextLines.push(`• Porte da empresa: ${targetDetails.companySize}`);
      if (targetDetails.departments) contextLines.push(`• Departamentos de interesse: ${targetDetails.departments}`);
      if (targetDetails.relationship) contextLines.push(`• Relacionamento existente: ${targetDetails.relationship}`);
      if (targetDetails.knownContacts) contextLines.push(`• Contatos conhecidos: ${targetDetails.knownContacts}`);
    }

    // Person-specific
    if (researchType === 'person' || researchType === 'connection') {
      if (targetDetails.currentCompany) contextLines.push(`• Empresa atual: ${targetDetails.currentCompany}`);
      if (targetDetails.currentRole) contextLines.push(`• Cargo/Função: ${targetDetails.currentRole}`);
      if (targetDetails.connectionReason) contextLines.push(`• Motivo da conexão: ${targetDetails.connectionReason}`);
      if (targetDetails.mutualContext) contextLines.push(`• Contexto mútuo: ${targetDetails.mutualContext}`);
    }

    // Niche-specific
    if (researchType === 'niche') {
      if (targetDetails.region) contextLines.push(`• Região geográfica: ${targetDetails.region}`);
      if (targetDetails.targetSize) contextLines.push(`• Porte alvo: ${targetDetails.targetSize}`);
      if (targetDetails.productService) contextLines.push(`• Produto/Serviço oferecido: ${targetDetails.productService}`);
    }

    return contextLines.length > 0
      ? contextLines.join('\n')
      : 'Nenhum dado adicional fornecido.';
  }

  /**
   * 🎼 MAESTRO: Create specific instructions for an agent based on mission briefing
   */
  createAgentInstructions(agent, missionBriefing, targetName, objective, targetDetails = {}) {
    // Get suggested search queries for this agent
    const agentQueries = missionBriefing.searchQueries?.[agent.id] || [];
    const queriesSection = agentQueries.length > 0
      ? `\n🔍 QUERIES SUGERIDAS PARA SUAS BUSCAS:\n${agentQueries.map((q, i) => `${i + 1}. "${q}"`).join('\n')}`
      : '';

    // Build context about LinkedIn availability
    const linkedInContext = targetDetails.useLinkedIn
      ? '\n📊 LINKEDIN ATIVADO: Você pode usar a API Unipile para buscar perfis, funcionários e conexões detalhadas.'
      : '';

    // Build context about known data
    const knownDataContext = this.buildKnownDataContext(targetDetails);

    const baseInstruction = `
🎯 MISSÃO: ${missionBriefing.summary}
📋 OBJETIVO DO CLIENTE: ${objective || 'Investigação completa'}
🎯 ALVO: ${targetName}

CONTEXTO DA MISSÃO:
- Tipo de objetivo: ${missionBriefing.objectiveType}
- Critério de sucesso: ${missionBriefing.successCriteria}
${linkedInContext}

${knownDataContext ? `DADOS JÁ CONHECIDOS SOBRE O ALVO:\n${knownDataContext}\n` : ''}

PERGUNTAS-CHAVE QUE VOCÊ DEVE AJUDAR A RESPONDER:
${missionBriefing.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${missionBriefing.specialFocus[agent.id] ? `
⭐ SUA INSTRUÇÃO ESPECÍFICA PARA ESTA MISSÃO:
${missionBriefing.specialFocus[agent.id]}
` : ''}
${queriesSection}

LEMBRE-SE: Você é ${agent.name}, ${agent.role}, com as seguintes credenciais:
${agent.expertise}
`;

    return baseInstruction;
  }

  /**
   * Build context string with known data about the target
   */
  buildKnownDataContext(targetDetails) {
    if (!targetDetails) return '';

    const lines = [];
    if (targetDetails.industry) lines.push(`- Setor: ${targetDetails.industry}`);
    if (targetDetails.companySize) lines.push(`- Porte: ${targetDetails.companySize}`);
    if (targetDetails.currentCompany) lines.push(`- Empresa atual: ${targetDetails.currentCompany}`);
    if (targetDetails.currentRole) lines.push(`- Cargo: ${targetDetails.currentRole}`);
    if (targetDetails.region) lines.push(`- Região de interesse: ${targetDetails.region}`);
    if (targetDetails.connectionReason) lines.push(`- Motivo da conexão: ${targetDetails.connectionReason}`);
    if (targetDetails.mutualContext) lines.push(`- Contexto mútuo: ${targetDetails.mutualContext}`);
    if (targetDetails.productService) lines.push(`- Produto/Serviço do cliente: ${targetDetails.productService}`);
    if (targetDetails.linkedinUrl) lines.push(`- LinkedIn URL: ${targetDetails.linkedinUrl}`);

    return lines.join('\n');
  }

  /**
   * Execute a full investigation
   *
   * @param {Object} investigation - Investigation record from database
   * @param {Object} session - Session record with target details
   */
  async executeInvestigation(investigation, session) {
    const { id: investigationId, case_number: caseNumber, account_id: accountId } = investigation;
    const { research_type: researchType, target_name: targetName, target_details: targetDetails, objective } = session;

    console.log(`[Orchestrator] Starting investigation ${caseNumber}`);
    console.log(`  Type: ${researchType}, Target: ${targetName}`);
    console.log(`  Objective: ${objective || 'General investigation'}`);

    try {
      // 🎼 MAESTRO STEP 1: Analyze the client's objective
      console.log('[Maestro] Analyzing client objective...');
      const missionBriefing = await this.analyzeObjective(targetName, researchType, objective, targetDetails);
      console.log(`[Maestro] Mission type: ${missionBriefing.objectiveType}`);
      console.log(`[Maestro] Key questions: ${missionBriefing.keyQuestions.length}`);

      // Notify investigation started
      publishInvestigationStarted({
        accountId,
        investigationId,
        caseNumber,
        missionType: missionBriefing.objectiveType,
        missionSummary: missionBriefing.summary,
        agents: Object.values(AGENTS).map(a => ({
          id: a.id,
          name: a.name,
          role: a.role
        }))
      });

      // Initialize agent reports in database
      await this.initializeAgentReports(investigationId);

      // 🎼 MAESTRO STEP 2: Execute agents with personalized instructions
      const agentResults = {};

      // Execute agents based on research type
      // All types now run most agents for comprehensive analysis
      const agentsToExecute = researchType === 'company'
        ? ['marcus_chen', 'sarah_mitchell', 'elena_volkov', 'david_park', 'james_rodriguez']
        : researchType === 'person'
          ? ['sarah_mitchell', 'james_rodriguez', 'david_park', 'elena_volkov']
          : ['elena_volkov', 'david_park', 'sarah_mitchell', 'james_rodriguez']; // niche/connection - added james for networking

      // Reorder based on mission priority if available
      const orderedAgents = missionBriefing.priorityAgents?.length
        ? [...new Set([...missionBriefing.priorityAgents.filter(a => agentsToExecute.includes(a)), ...agentsToExecute])]
        : agentsToExecute;

      for (const agentId of orderedAgents) {
        const agentInstructions = this.createAgentInstructions(
          AGENTS[agentId],
          missionBriefing,
          targetName,
          objective,
          targetDetails // Pass targetDetails for enhanced context
        );

        switch (agentId) {
          case 'marcus_chen':
            agentResults.marcus_chen = await this.executeMarcusChen(investigationId, accountId, targetName, targetDetails, agentInstructions);
            break;
          case 'sarah_mitchell':
            agentResults.sarah_mitchell = await this.executeSarahMitchell(investigationId, accountId, targetName, targetDetails, researchType, agentInstructions);
            break;
          case 'james_rodriguez':
            agentResults.james_rodriguez = await this.executeJamesRodriguez(investigationId, accountId, targetName, targetDetails, researchType, agentInstructions);
            break;
          case 'elena_volkov':
            agentResults.elena_volkov = await this.executeElenaVolkov(investigationId, accountId, targetName, targetDetails, researchType, agentInstructions);
            break;
          case 'david_park':
            agentResults.david_park = await this.executeDavidPark(investigationId, accountId, targetName, targetDetails, researchType, agentInstructions);
            break;
        }
      }

      // 🎼 MAESTRO STEP 3: Director Morgan compiles final report with mission context
      publishDirectorCompiling({
        accountId,
        investigationId,
        message: 'Director Morgan está compilando o dossiê estratégico...'
      });

      const briefing = await this.executeDirectorMorgan(investigationId, accountId, session, agentResults, missionBriefing);

      // Update investigation status
      await this.pool.query(
        `UPDATE secret_agent_investigations
         SET status = 'completed', progress = 100, completed_at = NOW()
         WHERE id = $1`,
        [investigationId]
      );

      // Update session with briefing reference
      await this.pool.query(
        `UPDATE secret_agent_sessions
         SET status = 'completed', briefing_id = $1, completed_at = NOW()
         WHERE id = $2`,
        [briefing.id, session.id]
      );

      // Notify completion
      publishInvestigationComplete({
        accountId,
        investigationId,
        briefingId: briefing.id,
        caseNumber,
        classification: briefing.classification,
        totalFindings: briefing.totalFindings,
        duration: briefing.duration,
        suggestedCampaigns: briefing.suggestedCampaigns
      });

      return briefing;

    } catch (error) {
      console.error(`[Orchestrator] Investigation ${caseNumber} failed:`, error);

      // Update investigation status to failed
      await this.pool.query(
        `UPDATE secret_agent_investigations
         SET status = 'failed', completed_at = NOW()
         WHERE id = $1`,
        [investigationId]
      );

      throw error;
    }
  }

  /**
   * Initialize agent reports in database
   */
  async initializeAgentReports(investigationId) {
    for (const agent of Object.values(AGENTS)) {
      await this.pool.query(
        `INSERT INTO secret_agent_reports (investigation_id, agent_id, agent_name, agent_role, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT DO NOTHING`,
        [investigationId, agent.id, agent.name, agent.role]
      );
    }
  }

  /**
   * Update agent status in database
   */
  async updateAgentReport(investigationId, agentId, updates) {
    const setClauses = [];
    const values = [investigationId, agentId];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      paramIndex++;
    }

    if (setClauses.length > 0) {
      await this.pool.query(
        `UPDATE secret_agent_reports
         SET ${setClauses.join(', ')}
         WHERE investigation_id = $1 AND agent_id = $2`,
        values
      );
    }
  }

  /**
   * Execute Marcus Chen - PhD Corporate Data Analyst
   * Collects official data: CNPJ, OpenCorporates, government records
   * Enhanced: Uses Tavily and LLM for comprehensive company research
   */
  async executeMarcusChen(investigationId, accountId, targetName, targetDetails, missionInstructions = '') {
    const agentId = 'marcus_chen';
    const agent = AGENTS[agentId];

    publishAgentStarted({
      accountId,
      investigationId,
      agentId,
      agentName: agent.name,
      agentRole: agent.role,
      task: 'Consultando dados cadastrais oficiais...'
    });

    // Store mission instructions for report generation
    this.currentMissionInstructions = missionInstructions;

    await this.updateAgentReport(investigationId, agentId, {
      status: 'working',
      started_at: new Date()
    });

    const findings = [];
    const sourcesUsed = [];

    try {
      // Check for CNPJ (Brazilian companies)
      if (targetDetails?.cnpj) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 20,
          currentTask: 'Consultando ReceitaWS...'
        });

        try {
          const cnpjData = await cnpjService.lookup(targetDetails.cnpj);
          findings.push({
            type: 'cnpj_data',
            title: 'Dados Cadastrais CNPJ',
            data: cnpjData,
            summary: cnpjService.getSummary(cnpjData)
          });
          sourcesUsed.push('receitaws');
        } catch (error) {
          console.error('[Marcus Chen] CNPJ error:', error.message);
        }
      }

      // Search OpenCorporates
      publishAgentProgress({
        accountId,
        investigationId,
        agentId,
        progress: 35,
        currentTask: 'Buscando dados corporativos globais...'
      });

      try {
        const corpData = await openCorporatesService.getCompanyProfile(targetName, targetDetails?.country);
        if (corpData.found) {
          findings.push({
            type: 'corporate_data',
            title: 'Dados Corporativos',
            data: corpData,
            summary: {
              name: corpData.company.name,
              status: corpData.company.currentStatus,
              jurisdiction: corpData.company.jurisdictionCode,
              officers: corpData.officers.length
            }
          });
          sourcesUsed.push('opencorporates');
        }
      } catch (error) {
        console.error('[Marcus Chen] OpenCorporates error:', error.message);
      }

      // 🔍 TAVILY SEARCH for company data (always run for comprehensive research)
      if (tavilyService.isConfigured()) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 55,
          currentTask: 'Pesquisando informações corporativas na web...'
        });

        try {
          const companyInfo = await tavilyService.search(
            `"${targetName}" company overview history founded headquarters revenue employees`,
            { maxResults: 5, searchDepth: 'advanced' }
          );

          if (companyInfo.results && companyInfo.results.length > 0) {
            findings.push({
              type: 'web_company_data',
              title: 'Informações Corporativas (Web)',
              data: {
                results: companyInfo.results.map(r => ({
                  title: r.title,
                  content: r.content?.substring(0, 500),
                  url: r.url
                }))
              },
              summary: {
                sourcesFound: companyInfo.results.length,
                mainInfo: companyInfo.results[0]?.content?.substring(0, 200)
              }
            });
            sourcesUsed.push('tavily');
          }
        } catch (error) {
          console.error('[Marcus Chen] Tavily error:', error.message);
        }
      }

      // 🧠 LLM RESEARCH - Use OpenAI to gather general knowledge about the company
      // This ensures we always have something to report, even for well-known companies
      if (findings.length < 2) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 75,
          currentTask: 'Consultando base de conhecimento...'
        });

        try {
          const llmResearch = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Você é um analista de dados corporativos. Forneça informações factuais e verificáveis sobre empresas.
IMPORTANTE: Se você não tiver informações confiáveis, diga claramente. Não invente dados.
Formato da resposta em JSON:
{
  "companyExists": true/false,
  "basicInfo": {
    "fullName": "Nome completo da empresa",
    "founded": "Ano de fundação (se conhecido)",
    "headquarters": "Sede (cidade, país)",
    "industry": "Setor de atuação",
    "type": "Tipo (startup, corporation, etc.)",
    "website": "Site oficial (se conhecido)"
  },
  "businessOverview": "Descrição do negócio em 2-3 frases",
  "products": ["Principais produtos ou serviços"],
  "notableInfo": ["Fatos notáveis: funding, aquisições, marcos importantes"],
  "confidence": "high/medium/low"
}`
              },
              {
                role: 'user',
                content: `Forneça informações sobre a empresa: "${targetName}"
${targetDetails?.industry ? `Setor informado: ${targetDetails.industry}` : ''}
${targetDetails?.domain ? `Website: ${targetDetails.domain}` : ''}`
              }
            ],
            max_tokens: 800,
            temperature: 0.3
          });

          const llmContent = llmResearch.choices[0].message.content;
          try {
            // Try to parse as JSON
            const jsonMatch = llmContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const companyData = JSON.parse(jsonMatch[0]);
              if (companyData.companyExists && companyData.confidence !== 'low') {
                findings.push({
                  type: 'llm_company_knowledge',
                  title: 'Conhecimento Geral da Empresa',
                  data: companyData,
                  summary: {
                    name: companyData.basicInfo?.fullName || targetName,
                    industry: companyData.basicInfo?.industry,
                    headquarters: companyData.basicInfo?.headquarters,
                    overview: companyData.businessOverview?.substring(0, 150),
                    confidence: companyData.confidence
                  }
                });
                sourcesUsed.push('llm-knowledge');
              }
            }
          } catch (parseError) {
            // If JSON parsing fails, still use the text response
            if (llmContent && llmContent.length > 50 && !llmContent.toLowerCase().includes('não tenho informações')) {
              findings.push({
                type: 'llm_company_knowledge',
                title: 'Conhecimento Geral da Empresa',
                data: { rawResponse: llmContent },
                summary: { overview: llmContent.substring(0, 200) }
              });
              sourcesUsed.push('llm-knowledge');
            }
          }
        } catch (error) {
          console.error('[Marcus Chen] LLM research error:', error.message);
        }
      }

      // Generate report
      const reportText = await this.generateAgentReport(agent, findings, targetName);

      await this.updateAgentReport(investigationId, agentId, {
        status: 'completed',
        progress: 100,
        report_text: reportText,
        report_data: { findings },
        sources_used: sourcesUsed,
        findings: findings.map(f => f.summary),
        completed_at: new Date()
      });

      publishAgentCompleted({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        report: {
          summary: reportText.substring(0, 500),
          findings: findings.map(f => f.summary),
          sourcesUsed
        }
      });

      return { findings, reportText, sourcesUsed };

    } catch (error) {
      publishAgentError({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        error: error.message,
        willRetry: false
      });

      await this.updateAgentReport(investigationId, agentId, {
        status: 'failed',
        completed_at: new Date()
      });

      return { findings: [], reportText: `Error: ${error.message}`, sourcesUsed: [] };
    }
  }

  /**
   * Execute Sarah Mitchell - PhD Decision Maker Mapping Specialist
   */
  async executeSarahMitchell(investigationId, accountId, targetName, targetDetails, type = 'company', missionInstructions = '') {
    const agentId = 'sarah_mitchell';
    const agent = AGENTS[agentId];

    publishAgentStarted({
      accountId,
      investigationId,
      agentId,
      agentName: agent.name,
      agentRole: agent.role,
      task: 'Identificando decisores e perfis...'
    });

    // Store mission instructions for report generation
    this.currentMissionInstructions = missionInstructions;

    await this.updateAgentReport(investigationId, agentId, {
      status: 'working',
      started_at: new Date()
    });

    const findings = [];
    const sourcesUsed = [];

    try {
      // 🔗 LINKEDIN SEARCH (when enabled)
      if (targetDetails?.useLinkedIn && targetDetails?.linkedInAccountId) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 20,
          currentTask: 'Buscando perfis no LinkedIn...'
        });

        try {
          let linkedinProfiles = [];

          if (type === 'company') {
            // Search for company employees, focusing on decision makers
            linkedinProfiles = await linkedinIntelService.searchCompanyEmployees(
              targetDetails.linkedInAccountId,
              targetName,
              {
                limit: 25,
                jobTitles: ['CEO', 'Diretor', 'Director', 'Gerente', 'Manager', 'Head', 'VP', 'Coordenador'],
                industry: targetDetails.industry || null
              }
            );
          } else if (type === 'person') {
            // Search for the specific person
            linkedinProfiles = await linkedinIntelService.searchPerson(
              targetDetails.linkedInAccountId,
              targetName,
              {
                company: targetDetails.currentCompany || null,
                role: targetDetails.currentRole || null
              }
            );
          }

          if (linkedinProfiles.length > 0) {
            findings.push({
              type: 'linkedin_profiles',
              title: 'Perfis LinkedIn',
              data: linkedinIntelService.formatFindings(linkedinProfiles, targetName),
              summary: {
                count: linkedinProfiles.length,
                profiles: linkedinProfiles.slice(0, 5).map(p => `${p.name} - ${p.title || p.headline}`),
                hasConnections: linkedinProfiles.some(p => p.connectionDegree === 1)
              }
            });
            sourcesUsed.push('linkedin');
          }
        } catch (error) {
          console.error('[Sarah Mitchell] LinkedIn error:', error.message);
        }
      }

      // 🔍 EXA SEARCH
      if (exaService.isConfigured()) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 40,
          currentTask: 'Buscando perfis de decisores...'
        });

        try {
          if (type === 'company') {
            const decisionMakers = await exaService.findDecisionMakers(targetName);
            findings.push({
              type: 'decision_makers',
              title: 'Decisores Identificados',
              data: decisionMakers,
              summary: {
                count: decisionMakers.decisionMakers.length,
                roles: decisionMakers.decisionMakers.slice(0, 5).map(d => d.name)
              }
            });
            sourcesUsed.push('exa');
          } else if (type === 'person') {
            const personData = await exaService.researchPerson(targetName, targetDetails?.currentCompany || targetDetails?.company);
            findings.push({
              type: 'person_profile',
              title: 'Perfil da Pessoa',
              data: personData,
              summary: {
                profiles: personData.profiles.length,
                sources: personData.profiles.map(p => p.type)
              }
            });
            sourcesUsed.push('exa');
          }
        } catch (error) {
          console.error('[Sarah Mitchell] Exa error:', error.message);
        }
      }

      if (tavilyService.isConfigured()) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 70,
          currentTask: 'Pesquisando histórico profissional...'
        });

        try {
          const profileData = await tavilyService.getPersonProfile(
            type === 'person' ? targetName : `${targetName} CEO leadership`,
            targetDetails?.company || ''
          );
          findings.push({
            type: 'profile_mentions',
            title: 'Menções e Perfil',
            data: profileData,
            summary: {
              biography: profileData.biography?.substring(0, 200),
              mentions: profileData.recentMentions?.length || 0
            }
          });
          sourcesUsed.push('tavily');
        } catch (error) {
          console.error('[Sarah Mitchell] Tavily error:', error.message);
        }
      }

      const reportText = await this.generateAgentReport(agent, findings, targetName);

      await this.updateAgentReport(investigationId, agentId, {
        status: 'completed',
        progress: 100,
        report_text: reportText,
        report_data: { findings },
        sources_used: sourcesUsed,
        findings: findings.map(f => f.summary),
        completed_at: new Date()
      });

      publishAgentCompleted({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        report: {
          summary: reportText.substring(0, 500),
          findings: findings.map(f => f.summary),
          sourcesUsed
        }
      });

      return { findings, reportText, sourcesUsed };

    } catch (error) {
      publishAgentError({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        error: error.message,
        willRetry: false
      });

      await this.updateAgentReport(investigationId, agentId, {
        status: 'failed',
        completed_at: new Date()
      });

      return { findings: [], reportText: `Error: ${error.message}`, sourcesUsed: [] };
    }
  }

  /**
   * Execute James Rodriguez - PhD B2B Networking Strategist
   */
  async executeJamesRodriguez(investigationId, accountId, targetName, targetDetails, type = 'company', missionInstructions = '') {
    const agentId = 'james_rodriguez';
    const agent = AGENTS[agentId];

    publishAgentStarted({
      accountId,
      investigationId,
      agentId,
      agentName: agent.name,
      agentRole: agent.role,
      task: 'Mapeando rede de conexões...'
    });

    // Store mission instructions for report generation
    this.currentMissionInstructions = missionInstructions;

    await this.updateAgentReport(investigationId, agentId, {
      status: 'working',
      started_at: new Date()
    });

    const findings = [];
    const sourcesUsed = [];

    try {
      // 🔗 LINKEDIN CONNECTIONS SEARCH (when enabled)
      if (targetDetails?.useLinkedIn && targetDetails?.linkedInAccountId) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 25,
          currentTask: 'Buscando conexões no LinkedIn...'
        });

        try {
          // Search for mutual connections (people in our network related to the target)
          const mutualConnections = await linkedinIntelService.findMutualConnections(
            targetDetails.linkedInAccountId,
            targetName
          );

          if (mutualConnections.length > 0) {
            findings.push({
              type: 'linkedin_connections',
              title: 'Conexões LinkedIn (Ponte de Acesso)',
              data: linkedinIntelService.formatFindings(mutualConnections, `conexões para ${targetName}`),
              summary: {
                count: mutualConnections.length,
                bridges: mutualConnections.slice(0, 5).map(p => `${p.name} - ${p.title || p.headline}`),
                directAccess: mutualConnections.length > 0
              }
            });
            sourcesUsed.push('linkedin');
          }
        } catch (error) {
          console.error('[James Rodriguez] LinkedIn error:', error.message);
        }
      }

      // 🔍 EXA SEARCH
      if (exaService.isConfigured()) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 50,
          currentTask: 'Identificando conexões e caminhos de acesso...'
        });

        try {
          const connections = await exaService.findPeopleConnections(targetName);
          findings.push({
            type: 'connections',
            title: 'Rede de Conexões',
            data: connections,
            summary: {
              potentialConnections: connections.potentialConnections.length,
              queriesUsed: connections.queriesUsed
            }
          });
          sourcesUsed.push('exa');
        } catch (error) {
          console.error('[James Rodriguez] Exa error:', error.message);
        }
      }

      const reportText = await this.generateAgentReport(agent, findings, targetName);

      await this.updateAgentReport(investigationId, agentId, {
        status: 'completed',
        progress: 100,
        report_text: reportText,
        report_data: { findings },
        sources_used: sourcesUsed,
        findings: findings.map(f => f.summary),
        completed_at: new Date()
      });

      publishAgentCompleted({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        report: {
          summary: reportText.substring(0, 500),
          findings: findings.map(f => f.summary),
          sourcesUsed
        }
      });

      return { findings, reportText, sourcesUsed };

    } catch (error) {
      publishAgentError({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        error: error.message,
        willRetry: false
      });

      await this.updateAgentReport(investigationId, agentId, {
        status: 'failed',
        completed_at: new Date()
      });

      return { findings: [], reportText: `Error: ${error.message}`, sourcesUsed: [] };
    }
  }

  /**
   * Execute Elena Volkov - PhD Competitive Intelligence Analyst
   */
  async executeElenaVolkov(investigationId, accountId, targetName, targetDetails, type = 'company', missionInstructions = '') {
    const agentId = 'elena_volkov';
    const agent = AGENTS[agentId];

    publishAgentStarted({
      accountId,
      investigationId,
      agentId,
      agentName: agent.name,
      agentRole: agent.role,
      task: 'Analisando cenário de mercado...'
    });

    // Store mission instructions for report generation
    this.currentMissionInstructions = missionInstructions;

    await this.updateAgentReport(investigationId, agentId, {
      status: 'working',
      started_at: new Date()
    });

    const findings = [];
    const sourcesUsed = [];

    try {
      // 🔗 LINKEDIN SEARCH FOR NICHE (when enabled and type is niche)
      if (targetDetails?.useLinkedIn && targetDetails?.linkedInAccountId && type === 'niche') {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 20,
          currentTask: 'Buscando decisores no LinkedIn...'
        });

        try {
          // Search for decision makers in this niche
          const nicheProfiles = await linkedinIntelService.searchNicheProfiles(
            targetDetails.linkedInAccountId,
            targetName,
            {
              limit: 20,
              decisionMakers: true,
              region: targetDetails.region || null
            }
          );

          if (nicheProfiles.length > 0) {
            findings.push({
              type: 'linkedin_niche_profiles',
              title: 'Decisores no Nicho (LinkedIn)',
              data: linkedinIntelService.formatFindings(nicheProfiles, `decisores em ${targetName}`),
              summary: {
                count: nicheProfiles.length,
                profiles: nicheProfiles.slice(0, 5).map(p => `${p.name} - ${p.title || p.headline}`),
                companies: [...new Set(nicheProfiles.map(p => p.company).filter(Boolean))].slice(0, 5)
              }
            });
            sourcesUsed.push('linkedin');
          }
        } catch (error) {
          console.error('[Elena Volkov] LinkedIn error:', error.message);
        }
      }

      // 📊 TAVILY MARKET ANALYSIS
      if (tavilyService.isConfigured()) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 40,
          currentTask: 'Pesquisando análise de mercado...'
        });

        try {
          const marketData = await tavilyService.getMarketAnalysis(
            type === 'niche' ? targetName : targetDetails?.industry || targetName
          );
          findings.push({
            type: 'market_analysis',
            title: 'Análise de Mercado',
            data: marketData,
            summary: {
              aspects: marketData.aspects.length,
              hasAnswers: marketData.aspects.filter(a => a.answer).length
            }
          });
          sourcesUsed.push('tavily');
        } catch (error) {
          console.error('[Elena Volkov] Tavily market error:', error.message);
        }
      }

      // 🔍 EXA COMPETITORS SEARCH
      if (exaService.isConfigured() && type === 'company') {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 70,
          currentTask: 'Identificando concorrentes...'
        });

        try {
          const competitors = await exaService.findSimilarCompanies(targetName, targetDetails?.website);
          findings.push({
            type: 'competitors',
            title: 'Concorrentes',
            data: competitors,
            summary: {
              count: competitors.results?.length || 0
            }
          });
          sourcesUsed.push('exa');
        } catch (error) {
          console.error('[Elena Volkov] Exa competitors error:', error.message);
        }
      }

      const reportText = await this.generateAgentReport(agent, findings, targetName);

      await this.updateAgentReport(investigationId, agentId, {
        status: 'completed',
        progress: 100,
        report_text: reportText,
        report_data: { findings },
        sources_used: sourcesUsed,
        findings: findings.map(f => f.summary),
        completed_at: new Date()
      });

      publishAgentCompleted({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        report: {
          summary: reportText.substring(0, 500),
          findings: findings.map(f => f.summary),
          sourcesUsed
        }
      });

      return { findings, reportText, sourcesUsed };

    } catch (error) {
      publishAgentError({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        error: error.message,
        willRetry: false
      });

      await this.updateAgentReport(investigationId, agentId, {
        status: 'failed',
        completed_at: new Date()
      });

      return { findings: [], reportText: `Error: ${error.message}`, sourcesUsed: [] };
    }
  }

  /**
   * Execute David Park - PhD Reputation & Timing Analyst
   */
  async executeDavidPark(investigationId, accountId, targetName, targetDetails, type = 'company', missionInstructions = '') {
    const agentId = 'david_park';
    const agent = AGENTS[agentId];

    publishAgentStarted({
      accountId,
      investigationId,
      agentId,
      agentName: agent.name,
      agentRole: agent.role,
      task: 'Monitorando mídia e reputação...'
    });

    // Store mission instructions for report generation
    this.currentMissionInstructions = missionInstructions;

    await this.updateAgentReport(investigationId, agentId, {
      status: 'working',
      started_at: new Date()
    });

    const findings = [];
    const sourcesUsed = [];

    try {
      if (tavilyService.isConfigured()) {
        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 40,
          currentTask: 'Buscando notícias recentes...'
        });

        try {
          const newsData = await tavilyService.getCompanyNews(targetName, 30);
          findings.push({
            type: 'news',
            title: 'Notícias Recentes',
            data: newsData,
            summary: {
              count: newsData.newsCount,
              summary: newsData.summary?.substring(0, 200)
            }
          });
          sourcesUsed.push('tavily');
        } catch (error) {
          console.error('[David Park] Tavily news error:', error.message);
        }

        publishAgentProgress({
          accountId,
          investigationId,
          agentId,
          progress: 70,
          currentTask: 'Analisando reputação online...'
        });

        try {
          const reputation = await tavilyService.analyzeReputation(targetName);
          findings.push({
            type: 'reputation',
            title: 'Análise de Reputação',
            data: reputation,
            summary: {
              sentiment: reputation.overallSentiment,
              positiveCount: reputation.positive?.sources?.length || 0,
              negativeCount: reputation.negative?.sources?.length || 0
            }
          });
          sourcesUsed.push('tavily');
        } catch (error) {
          console.error('[David Park] Tavily reputation error:', error.message);
        }
      }

      const reportText = await this.generateAgentReport(agent, findings, targetName);

      await this.updateAgentReport(investigationId, agentId, {
        status: 'completed',
        progress: 100,
        report_text: reportText,
        report_data: { findings },
        sources_used: sourcesUsed,
        findings: findings.map(f => f.summary),
        completed_at: new Date()
      });

      publishAgentCompleted({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        report: {
          summary: reportText.substring(0, 500),
          findings: findings.map(f => f.summary),
          sourcesUsed
        }
      });

      return { findings, reportText, sourcesUsed };

    } catch (error) {
      publishAgentError({
        accountId,
        investigationId,
        agentId,
        agentName: agent.name,
        error: error.message,
        willRetry: false
      });

      await this.updateAgentReport(investigationId, agentId, {
        status: 'failed',
        completed_at: new Date()
      });

      return { findings: [], reportText: `Error: ${error.message}`, sourcesUsed: [] };
    }
  }

  /**
   * Execute Director Morgan - PhD Commercial Strategy Director
   * Compiles final briefing with mission context
   */
  async executeDirectorMorgan(investigationId, accountId, session, agentResults, missionBriefing = null) {
    const agentId = 'director_morgan';
    const agent = AGENTS[agentId];
    const startTime = Date.now();

    await this.updateAgentReport(investigationId, agentId, {
      status: 'working',
      started_at: new Date()
    });

    try {
      // Compile all findings
      const allFindings = [];
      const allSources = new Set();

      for (const [agentKey, result] of Object.entries(agentResults)) {
        if (result.findings) {
          allFindings.push(...result.findings);
        }
        if (result.sourcesUsed) {
          result.sourcesUsed.forEach(s => allSources.add(s));
        }
      }

      // Generate executive summary with GPT, including mission context
      const briefingContent = await this.generateBriefing(session, agentResults, allFindings, missionBriefing);

      // Calculate duration
      const duration = Math.round((Date.now() - startTime) / 1000);
      const durationText = duration > 60
        ? `${Math.floor(duration / 60)} minutos ${duration % 60} segundos`
        : `${duration} segundos`;

      // Determine classification based on findings
      const classification = allFindings.length > 15 ? 'TOP_SECRET'
        : allFindings.length > 8 ? 'CLASSIFIED'
        : 'CONFIDENTIAL';

      // Get investigation for case number
      const invResult = await this.pool.query(
        'SELECT case_number FROM secret_agent_investigations WHERE id = $1',
        [investigationId]
      );
      const caseNumber = invResult.rows[0]?.case_number;

      // Generate suggested campaigns
      const suggestedCampaigns = await this.generateCampaignSuggestions(session, allFindings);

      // Convert findings summaries to strings for storage
      const keyFindingsStrings = allFindings.map(f => {
        if (typeof f.summary === 'string') return f.summary;
        if (typeof f.summary === 'object' && f.summary !== null) {
          // Try to extract meaningful text from object
          return f.summary.text || f.summary.title || f.summary.name ||
                 f.summary.description || f.summary.biography ||
                 (f.summary.count !== undefined ? `${f.title}: ${f.summary.count} encontrados` : null) ||
                 JSON.stringify(f.summary);
        }
        return String(f.summary || f.title || 'Descoberta');
      });

      // Organize data by section for the briefing tabs
      const sectionData = this.organizeFindingsBySection(allFindings, agentResults);

      // Save briefing to database
      const briefingResult = await this.pool.query(
        `INSERT INTO secret_agent_briefings (
          account_id, session_id, investigation_id, created_by, title, case_number, classification,
          research_type, target_name, executive_summary, key_findings,
          full_report_markdown, suggested_campaigns, tags,
          company_data, people_data, connections_data, market_data, media_data,
          sources_consulted, total_findings, duration_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING id`,
        [
          accountId,
          session.id,
          investigationId,
          session.user_id,
          `Investigação: ${session.target_name}`,
          caseNumber,
          classification,
          session.research_type,
          session.target_name,
          briefingContent.executiveSummary,
          JSON.stringify(keyFindingsStrings),
          briefingContent.fullReport,
          JSON.stringify(suggestedCampaigns),
          [session.research_type, session.target_name.toLowerCase()],
          JSON.stringify(sectionData.company || {}),
          JSON.stringify(sectionData.people || {}),
          JSON.stringify(sectionData.connections || {}),
          JSON.stringify(sectionData.market || {}),
          JSON.stringify(sectionData.media || {}),
          Array.from(allSources).length,
          allFindings.length,
          duration
        ]
      );

      const briefingId = briefingResult.rows[0].id;

      // Update agent report
      await this.updateAgentReport(investigationId, agentId, {
        status: 'completed',
        progress: 100,
        report_text: briefingContent.executiveSummary,
        report_data: { briefingId },
        completed_at: new Date()
      });

      return {
        id: briefingId,
        classification,
        totalFindings: allFindings.length,
        duration: durationText,
        suggestedCampaigns,
        sources: Array.from(allSources)
      };

    } catch (error) {
      console.error('[Director Morgan] Error compiling briefing:', error);

      await this.updateAgentReport(investigationId, agentId, {
        status: 'failed',
        completed_at: new Date()
      });

      throw error;
    }
  }

  /**
   * Generate agent report - Uses PhD credentials and mission instructions
   * Short summary with expert insights (max 400 words)
   */
  async generateAgentReport(agent, findings, targetName) {
    if (findings.length === 0) {
      return `Como ${agent.role} com ${agent.expertise?.split('\n')[0] || 'expertise especializada'}, não encontrei informações relevantes sobre ${targetName} nas fontes consultadas.`;
    }

    // Extract only summaries for the AI prompt - NO raw data
    const findingSummaries = findings.map(f => ({
      type: f.type,
      title: f.title,
      summary: typeof f.summary === 'object' ? JSON.stringify(f.summary) : f.summary
    }));

    // Get mission context if available
    const missionContext = this.currentMissionInstructions || '';

    const systemPrompt = `Você é ${agent.name}, ${agent.role} da Central de Inteligência GetRaze.

🎓 SUAS CREDENCIAIS:
${agent.expertise}

📋 FORMATO DO RELATÓRIO:
- Máximo 350 palavras
- Comece identificando-se brevemente e sua expertise
- Use sua expertise para dar INSIGHTS profundos, não apenas dados
- Destaque: riscos, oportunidades e recomendações específicas
- Termine com 1 ação recomendada baseada em sua análise

${missionContext ? `\n🎯 CONTEXTO DA MISSÃO:\n${missionContext}` : ''}`;

    const userContent = `ALVO DA INVESTIGAÇÃO: ${targetName}

DADOS COLETADOS:
${findingSummaries.map(f => `• ${f.title}: ${f.summary}`).join('\n')}

Gere seu relatório de especialista com insights acionáveis.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 700,
        temperature: 0.7
      });

      return response.choices[0].message.content;
    } catch (gptError) {
      console.error(`[${agent.name}] GPT error:`, gptError.message);

      // Fallback with credentials
      return `📊 Relatório de ${agent.name} - ${agent.role}

${findingSummaries.map(f => `• ${f.title}: ${f.summary}`).join('\n')}

_Análise gerada automaticamente._`;
    }
  }

  /**
   * Use Gemini for deep analysis when needed (large context)
   * Called separately when user wants more details
   */
  async deepAnalysis(targetName, rawData, analysisType = 'general') {
    if (!geminiService.isConfigured()) {
      return { error: 'Gemini not configured for deep analysis' };
    }

    const prompts = {
      general: `Analise em profundidade os dados sobre "${targetName}" e forneça insights detalhados, padrões identificados e recomendações estratégicas.`,
      connections: `Analise os dados e identifique TODAS as possíveis conexões, relacionamentos e caminhos de acesso para "${targetName}".`,
      opportunities: `Com base nos dados, identifique oportunidades de negócio, gaps no mercado e pontos de entrada para "${targetName}".`,
      risks: `Analise os dados e identifique riscos, alertas e pontos de atenção sobre "${targetName}".`
    };

    try {
      const result = await geminiService.generateText(
        'Você é um analista de inteligência experiente. Forneça análises detalhadas e acionáveis.',
        `${prompts[analysisType] || prompts.general}\n\nDados disponíveis:\n${JSON.stringify(rawData, null, 2)}`,
        { maxTokens: 4000, temperature: 0.7 }
      );

      return { analysis: result, type: analysisType };
    } catch (error) {
      console.error('[Deep Analysis] Gemini error:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Truncate text intelligently to fit within token limits
   */
  truncateForTokenLimit(text, maxTokens = 10000) {
    if (!text) return '';
    const estimatedTokens = estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    // Truncate to roughly maxTokens
    const maxChars = maxTokens * 4;
    return text.substring(0, maxChars) + '\n\n[...conteúdo truncado por limite de tamanho...]';
  }

  /**
   * Generate final briefing - Uses only SHORT summaries from agents
   * Raw data stays in database, not in the prompt
   * Now includes mission context from the maestro
   */
  async generateBriefing(session, agentResults, allFindings, missionBriefing = null) {
    // Agent reports are already short (max 300 words each)
    // Total: ~1500 words max = ~2000 tokens - well within limits
    const agentReports = Object.entries(agentResults)
      .filter(([_, result]) => result.reportText)
      .map(([agent, result]) => `### ${AGENTS[agent]?.name || agent}\n${result.reportText}`)
      .join('\n\n');

    // Build mission context if available
    const missionContext = missionBriefing ? `
🎯 CONTEXTO DA MISSÃO:
- Tipo de objetivo: ${missionBriefing.objectiveType}
- Resumo: ${missionBriefing.summary}
- Critério de sucesso: ${missionBriefing.successCriteria}

PERGUNTAS-CHAVE QUE DEVEM SER RESPONDIDAS:
${missionBriefing.keyQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n') || 'N/A'}
` : '';

    const systemPrompt = `Você é o Diretor Morgan, PhD em Estratégia de Vendas Enterprise, coordenador da equipe de inteligência GetRaze.

${AGENTS.director_morgan.expertise}

${missionContext}

Compile um DOSSIÊ EXECUTIVO baseado nos relatórios da sua equipe.

Estrutura do dossiê:
1. **SUMÁRIO EXECUTIVO** (2 parágrafos - visão geral e conclusão principal)
2. **PRINCIPAIS DESCOBERTAS** (5-7 bullets com os insights mais importantes)
3. **ANÁLISE ESTRATÉGICA** (Como abordar o alvo usando metodologias SPIN/Challenger/MEDDIC)
4. **PRÓXIMOS PASSOS RECOMENDADOS** (3-5 ações concretas com priorização)

Regras:
- Seja CONCISO e DIRETO
- Foque em insights ACIONÁVEIS para vendas B2B
- Use sua expertise em metodologias de vendas para dar recomendações práticas
- Use formatação Markdown
- Máximo 700 palavras total`;

    const userContent = `**Alvo:** ${session.target_name}
**Tipo:** ${session.research_type}
**Objetivo:** ${session.objective || 'Investigação completa'}

---

## Relatórios da Equipe:

${agentReports}`;

    console.log(`[Director Morgan] Compiling briefing (~${estimateTokens(systemPrompt + userContent)} tokens)`);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 1500, // ~700 words with strategic analysis
        temperature: 0.7
      });

      const fullReport = response.choices[0].message.content;

      // Extract executive summary (first section)
      const summaryMatch = fullReport.match(/SUMÁRIO EXECUTIVO[*\s]*\n([\s\S]*?)(?=\n##|\n\*\*|$)/i);
      const executiveSummary = summaryMatch
        ? summaryMatch[1].trim()
        : fullReport.split('\n').slice(0, 8).join('\n');

      console.log('[Director Morgan] Briefing compiled successfully');
      return { fullReport, executiveSummary };

    } catch (gptError) {
      console.error('[Director Morgan] GPT error:', gptError.message);

      // Fallback to Gemini if GPT fails
      if (geminiService.isConfigured()) {
        try {
          const fullReport = await geminiService.chatCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ], { maxTokens: 1200, temperature: 0.7 });

          const executiveSummary = fullReport.split('\n').slice(0, 8).join('\n');
          console.log('[Director Morgan] Briefing compiled with Gemini fallback');
          return { fullReport, executiveSummary };

        } catch (geminiError) {
          console.error('[Director Morgan] Gemini fallback error:', geminiError.message);
        }
      }

      // Final fallback: Simple concatenation
      const basicReport = `# Dossiê: ${session.target_name}

## Sumário Executivo
Investigação do tipo "${session.research_type}" sobre ${session.target_name}.

## Relatórios da Equipe

${agentReports}

---
*Dossiê gerado automaticamente.*`;

      return {
        fullReport: basicReport,
        executiveSummary: `Investigação sobre ${session.target_name} concluída.`
      };
    }
  }

  /**
   * Generate campaign suggestions
   */
  async generateCampaignSuggestions(session, findings) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Com base na investigação, sugira 2-3 campanhas de prospecção.
Retorne em formato JSON array: [{ "title": "...", "description": "...", "channel": "linkedin|email|whatsapp", "targetAudience": "..." }]`
          },
          {
            role: 'user',
            content: `Alvo: ${session.target_name}
Tipo: ${session.research_type}
Objetivo: ${session.objective || 'Prospecção geral'}
Descobertas: ${JSON.stringify(findings.slice(0, 5))}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const content = response.choices[0].message.content;
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (error) {
      console.error('[Campaign Suggestions] Error:', error.message);
      return [];
    }
  }

  /**
   * Organize findings by section for briefing tabs
   * Maps agent findings to the appropriate section in the briefing
   */
  organizeFindingsBySection(allFindings, agentResults) {
    const sections = {
      company: {
        cnpjData: null,
        corporateData: null,
        webData: null,
        llmKnowledge: null,
        officers: [],
        subsidiaries: []
      },
      people: {
        decisionMakers: [],
        profiles: [],
        linkedinProfiles: [],
        contacts: []
      },
      connections: {
        potentialConnections: [],
        linkedinConnections: [],
        pathways: []
      },
      market: {
        analysis: null,
        competitors: [],
        nicheProfiles: [],
        trends: []
      },
      media: {
        news: [],
        reputation: null,
        socialMentions: []
      }
    };

    // Process findings by type
    for (const finding of allFindings) {
      switch (finding.type) {
        case 'cnpj_data':
          sections.company.cnpjData = finding.data;
          break;
        case 'corporate_data':
          sections.company.corporateData = finding.data;
          if (finding.data?.officers) {
            sections.company.officers = finding.data.officers;
          }
          break;
        case 'web_company_data':
          sections.company.webData = finding.data;
          break;
        case 'llm_company_knowledge':
          sections.company.llmKnowledge = finding.data;
          break;
        case 'decision_makers':
          sections.people.decisionMakers = finding.data?.decisionMakers || [];
          break;
        case 'person_profile':
        case 'profile_mentions':
          if (finding.data?.profiles) {
            sections.people.profiles.push(...finding.data.profiles);
          }
          if (finding.data?.biography) {
            sections.people.profiles.push({
              type: 'biography',
              content: finding.data.biography
            });
          }
          break;
        case 'linkedin_profiles':
          sections.people.linkedinProfiles = finding.data?.profiles || [];
          break;
        case 'connections':
          sections.connections.potentialConnections = finding.data?.potentialConnections || [];
          break;
        case 'linkedin_connections':
          sections.connections.linkedinConnections = finding.data?.profiles || [];
          break;
        case 'market_analysis':
          sections.market.analysis = finding.data;
          if (finding.data?.aspects) {
            sections.market.trends = finding.data.aspects;
          }
          break;
        case 'competitors':
          sections.market.competitors = finding.data?.results || [];
          break;
        case 'linkedin_niche_profiles':
          sections.market.nicheProfiles = finding.data?.profiles || [];
          break;
        case 'news':
          sections.media.news = finding.data?.articles || finding.data?.news || [];
          if (finding.data?.summary) {
            sections.media.news.unshift({ summary: finding.data.summary });
          }
          break;
        case 'reputation':
          sections.media.reputation = finding.data;
          break;
      }
    }

    // Also extract from agent report data
    for (const [agentId, result] of Object.entries(agentResults)) {
      if (!result.findings) continue;

      for (const finding of result.findings) {
        // Additional extraction from raw findings
        if (finding.data && typeof finding.data === 'object') {
          // Add any additional data to appropriate sections
        }
      }
    }

    return sections;
  }
}

// Singleton
const orchestratorService = new OrchestratorService();

module.exports = {
  orchestratorService,
  AGENTS
};
