// backend/src/services/profileAnalysisService.js

/**
 * Profile Analysis Service
 * Analyzes LinkedIn profile data to generate insights for personalized outreach
 */

/**
 * Decision maker role patterns
 */
const DECISION_MAKER_PATTERNS = {
  executive: /\b(CEO|CFO|CTO|COO|CMO|CRO|CIO|CISO|CPO|CDO|CAO)\b/i,
  founder: /\b(Founder|Co-Founder|Fundador|Cofundador|Sócio|Partner|Owner|Dono|Proprietário)\b/i,
  director: /\b(Director|Diretor|VP|Vice.?President|Head|Chief|Managing)\b/i,
  manager: /\b(Manager|Gerente|Coordenador|Coordinator|Lead|Líder|Supervisor)\b/i
};

/**
 * Sales-related role patterns
 */
const SALES_PATTERNS = {
  sales: /\b(Sales|Vendas|Comercial|Revenue|Business Development|BDR|SDR|Account Executive|AE)\b/i,
  marketing: /\b(Marketing|Growth|Demand Gen|Content|Brand|Digital)\b/i,
  customer: /\b(Customer|Cliente|Success|Support|Service|Atendimento)\b/i
};

/**
 * Growth mindset indicators in headline/bio
 */
const GROWTH_INDICATORS = [
  /\b(Transform|Transformando|Scale|Escala|Growth|Crescimento|Innovation|Inovação)\b/i,
  /\b(Disrupt|Building|Construindo|Leading|Liderando|Driving|Impulsionando)\b/i,
  /\b(10x|2x|3x|doubl|tripl|expand|grow)\b/i,
  /\b(startup|empreend|entrepreneur)\b/i
];

/**
 * Pain indicators that might suggest needs
 */
const PAIN_INDICATORS = {
  efficiency: /\b(automat|eficiência|efficiency|produtiv|streamlin|otimiz|optimize)\b/i,
  scaling: /\b(escal|scale|growth|cresci|expand)\b/i,
  leads: /\b(lead|prospect|pipeline|funnel|vendas|sales)\b/i,
  team: /\b(hiring|contrat|team|equipe|talent)\b/i,
  tech: /\b(digital|tech|software|saas|platform)\b/i
};

/**
 * Analyze LinkedIn profile headline
 * @param {string} headline - LinkedIn headline
 * @returns {Object} Analysis results
 */
function analyzeHeadline(headline) {
  if (!headline) {
    return {
      isDecisionMaker: false,
      decisionMakerLevel: null,
      isSalesPerson: false,
      salesRole: null,
      showsGrowthMindset: false,
      growthIndicators: [],
      painIndicators: [],
      insights: []
    };
  }

  const analysis = {
    isDecisionMaker: false,
    decisionMakerLevel: null,
    isSalesPerson: false,
    salesRole: null,
    showsGrowthMindset: false,
    growthIndicators: [],
    painIndicators: [],
    insights: []
  };

  // Check decision maker status
  for (const [level, pattern] of Object.entries(DECISION_MAKER_PATTERNS)) {
    if (pattern.test(headline)) {
      analysis.isDecisionMaker = true;
      analysis.decisionMakerLevel = level;
      analysis.insights.push(`Decisor nível ${level}`);
      break;
    }
  }

  // Check if sales-related role
  for (const [role, pattern] of Object.entries(SALES_PATTERNS)) {
    if (pattern.test(headline)) {
      analysis.isSalesPerson = true;
      analysis.salesRole = role;
      analysis.insights.push(`Atua em ${role}`);
      break;
    }
  }

  // Check growth mindset
  for (const pattern of GROWTH_INDICATORS) {
    const match = headline.match(pattern);
    if (match) {
      analysis.showsGrowthMindset = true;
      analysis.growthIndicators.push(match[0]);
    }
  }

  if (analysis.showsGrowthMindset) {
    analysis.insights.push('Demonstra mentalidade de crescimento');
  }

  // Check pain indicators
  for (const [pain, pattern] of Object.entries(PAIN_INDICATORS)) {
    if (pattern.test(headline)) {
      analysis.painIndicators.push(pain);
    }
  }

  return analysis;
}

/**
 * Parse tenure string to months
 * @param {string} tenure - Tenure string (e.g., "2 anos", "6 meses", "3 years")
 * @returns {number} Months
 */
function parseTenure(tenure) {
  if (!tenure) return 0;

  const tenureLower = tenure.toLowerCase();
  let months = 0;

  // Match years
  const yearsMatch = tenureLower.match(/(\d+)\s*(ano|year|yr)/i);
  if (yearsMatch) {
    months += parseInt(yearsMatch[1]) * 12;
  }

  // Match months
  const monthsMatch = tenureLower.match(/(\d+)\s*(mes|month|mo)/i);
  if (monthsMatch) {
    months += parseInt(monthsMatch[1]);
  }

  return months;
}

/**
 * Detect buying signals based on profile data
 * @param {Object} profile - Lead profile data
 * @returns {Object} Buying signals
 */
function detectBuyingSignals(profile) {
  const signals = {
    recentlyPromoted: false,
    newJob: false,
    companyGrowing: false,
    activePoster: false,
    highEngagement: false,
    signals: [],
    score: 0
  };

  // Check tenure for recent changes
  const currentTenure = profile.current_position?.duration || profile.tenure;
  const tenureMonths = parseTenure(currentTenure);

  if (tenureMonths > 0 && tenureMonths <= 6) {
    signals.newJob = true;
    signals.signals.push('Mudou de emprego recentemente (pode querer provar valor)');
    signals.score += 20;
  } else if (tenureMonths > 6 && tenureMonths <= 12) {
    signals.signals.push('Menos de 1 ano na posição (ainda se estabelecendo)');
    signals.score += 10;
  }

  // Check title for recent promotion indicators
  const headline = profile.headline || '';
  if (/\bnew\b|\bnovo\b|\brecém\b/i.test(headline)) {
    signals.recentlyPromoted = true;
    signals.signals.push('Possível promoção recente');
    signals.score += 15;
  }

  // Check connections count as engagement indicator
  const connections = profile.connections || profile.connection_count || 0;
  if (connections > 500) {
    signals.highEngagement = true;
    signals.signals.push(`Alta rede de conexões (${connections}+)`);
    signals.score += 10;
  }

  // Check if they have recent activity
  if (profile.recent_posts || profile.last_activity_at) {
    signals.activePoster = true;
    signals.signals.push('Ativo no LinkedIn (aberto a interações)');
    signals.score += 15;
  }

  // Check company indicators
  if (profile.company_size) {
    const size = profile.company_size.toLowerCase();
    if (size.includes('11-50') || size.includes('51-200')) {
      signals.signals.push('Empresa em crescimento (11-200 funcionários)');
      signals.score += 10;
    }
  }

  return signals;
}

/**
 * Generate personalized hooks based on profile analysis
 * @param {Object} profile - Lead profile data
 * @param {Object} agent - AI agent with products/services info
 * @returns {Array} List of personalized hooks
 */
function generatePersonalizedHooks(profile, agent = {}) {
  // IMPORTANTE: Hooks devem ser NATURAIS - sem mencionar dados específicos do perfil
  // A IA tem o contexto interno, mas não deve "mostrar que sabe" de forma óbvia

  const hooks = [];
  const headlineAnalysis = analyzeHeadline(profile.headline);
  const buyingSignals = detectBuyingSignals(profile);

  // Hooks são sempre genéricos e naturais - como uma pessoa real falaria
  // A análise serve para PRIORIZAR qual hook usar, não para personalizar o texto

  if (headlineAnalysis.isDecisionMaker) {
    hooks.push({
      type: 'decision_maker',
      text: `Qual tem sido o maior desafio pra você ultimamente?`,
      reason: `Identificado como decisor (${headlineAnalysis.decisionMakerLevel})`
    });
  }

  if (headlineAnalysis.showsGrowthMindset) {
    hooks.push({
      type: 'growth_mindset',
      text: `Como estão os resultados por aí?`,
      reason: 'Headline menciona crescimento/transformação'
    });
  }

  if (buyingSignals.newJob) {
    hooks.push({
      type: 'new_job',
      text: `Como está sendo a experiência até agora?`,
      reason: 'Menos de 6 meses na posição atual'
    });
  }

  if (headlineAnalysis.painIndicators.length > 0) {
    hooks.push({
      type: 'pain_indicator',
      text: `Qual o maior desafio que você enfrenta hoje?`,
      reason: `Headline sugere foco em: ${headlineAnalysis.painIndicators.join(', ')}`
    });
  }

  // Hook genérico sempre disponível
  hooks.push({
    type: 'generic',
    text: `Como estão as coisas por aí?`,
    reason: 'Hook genérico e natural'
  });

  return hooks;
}

/**
 * Analyze complete profile and generate insights for AI prompt
 * @param {Object} profile - Lead profile data
 * @param {Object} agent - AI agent configuration
 * @returns {Object} Complete analysis
 */
function analyzeProfile(profile, agent = {}) {
  if (!profile) {
    return {
      analysis: null,
      promptContext: '',
      hooks: []
    };
  }

  const headlineAnalysis = analyzeHeadline(profile.headline);
  const buyingSignals = detectBuyingSignals(profile);
  const personalizedHooks = generatePersonalizedHooks(profile, agent);

  const analysis = {
    headline: headlineAnalysis,
    buyingSignals,
    personalizedHooks,
    overallScore: buyingSignals.score + (headlineAnalysis.isDecisionMaker ? 20 : 0) + (headlineAnalysis.showsGrowthMindset ? 10 : 0),
    recommendation: getRecommendation(headlineAnalysis, buyingSignals)
  };

  // Format for prompt injection
  const promptContext = formatAnalysisForPrompt(analysis, profile);

  return {
    analysis,
    promptContext,
    hooks: personalizedHooks
  };
}

/**
 * Get recommendation based on analysis
 * @param {Object} headlineAnalysis - Headline analysis
 * @param {Object} buyingSignals - Buying signals
 * @returns {string} Recommendation
 */
function getRecommendation(headlineAnalysis, buyingSignals) {
  const score = buyingSignals.score + (headlineAnalysis.isDecisionMaker ? 20 : 0);

  if (score >= 40) {
    return 'Lead de alta prioridade - Perfil forte, provavelmente decisor com sinais de compra';
  } else if (score >= 25) {
    return 'Lead promissor - Bom perfil com alguns sinais positivos';
  } else if (score >= 10) {
    return 'Lead padrão - Engajar para descobrir mais';
  } else {
    return 'Lead frio - Qualificar com cuidado';
  }
}

/**
 * Format analysis for AI prompt injection
 * @param {Object} analysis - Complete analysis
 * @param {Object} profile - Lead profile
 * @returns {string} Formatted text for prompt
 */
function formatAnalysisForPrompt(analysis, profile) {
  if (!analysis || !analysis.headline) {
    return '';
  }

  // Esta análise é para ENTENDER o lead, NÃO para mencionar na conversa
  let text = `
ANÁLISE INTERNA DO LEAD (NÃO mencione estes dados diretamente - use apenas para entender o contexto):
`;

  // Decision maker status
  if (analysis.headline.isDecisionMaker) {
    text += `• É decisor (${analysis.headline.decisionMakerLevel}) - pode tomar decisões
`;
  }

  // Tenure insight
  const tenure = profile.current_position?.duration || profile.tenure;
  if (tenure) {
    const tenureMonths = parseTenure(tenure);
    if (tenureMonths <= 6) {
      text += `• Novo na posição - pode querer mostrar resultados rápidos
`;
    }
  }

  // Buying signals
  if (analysis.buyingSignals.signals.length > 0) {
    text += `• Sinais positivos detectados
`;
  }

  // Growth mindset
  if (analysis.headline.showsGrowthMindset) {
    text += `• Perfil com foco em crescimento
`;
  }

  text += `
PRIORIDADE: ${analysis.recommendation}

⚠️ LEMBRETE: Converse de forma NATURAL. Não diga "vi que você trabalha com X" ou "na sua área de Y".
Faça perguntas abertas como "Como estão as coisas?", "Qual o maior desafio atualmente?"
`;

  return text;
}

module.exports = {
  analyzeHeadline,
  detectBuyingSignals,
  generatePersonalizedHooks,
  analyzeProfile,
  formatAnalysisForPrompt,
  parseTenure
};
