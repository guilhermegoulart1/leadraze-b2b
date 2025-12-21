// backend/src/services/playbookService.js

const db = require('../config/database');

/**
 * Playbook Service
 * Manages sales playbooks with scripts, questions and methodologies
 */

/**
 * Get playbook by ID
 * @param {string} playbookId - Playbook ID
 * @returns {Promise<Object>} Playbook data
 */
async function getPlaybook(playbookId) {
  try {
    const result = await db.query(`
      SELECT * FROM agent_playbooks
      WHERE id = $1 AND is_active = true
    `, [playbookId]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching playbook:', error);
    throw error;
  }
}

/**
 * Get playbook for an agent (either assigned or by methodology)
 * @param {Object} agent - AI agent object
 * @returns {Promise<Object|null>} Playbook data or null
 */
async function getPlaybookForAgent(agent) {
  try {
    // First check if agent has a specific playbook assigned
    if (agent.playbook_id) {
      const result = await db.query(`
        SELECT * FROM agent_playbooks
        WHERE id = $1 AND is_active = true
      `, [agent.playbook_id]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    // If no specific playbook, try to find one by methodology from config
    const methodology = agent.config?.methodology_template_id;
    if (methodology) {
      const language = agent.language || 'pt-BR';
      const result = await db.query(`
        SELECT * FROM agent_playbooks
        WHERE methodology = $1
          AND is_system = true
          AND is_active = true
          AND language = $2
        LIMIT 1
      `, [methodology, language]);

      return result.rows[0] || null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching playbook for agent:', error);
    return null;
  }
}

/**
 * Get all playbooks for an account
 * @param {string} accountId - Account ID
 * @param {string} language - Language code
 * @returns {Promise<Array>} List of playbooks
 */
async function getPlaybooks(accountId, language = 'pt-BR') {
  try {
    const result = await db.query(`
      SELECT * FROM agent_playbooks
      WHERE (account_id = $1 OR is_system = true)
        AND is_active = true
        AND language = $2
      ORDER BY is_system DESC, name
    `, [accountId, language]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    throw error;
  }
}

/**
 * Get system playbooks by methodology
 * @param {string} methodology - Methodology type
 * @param {string} language - Language code
 * @returns {Promise<Object|null>} Playbook or null
 */
async function getSystemPlaybook(methodology, language = 'pt-BR') {
  try {
    const result = await db.query(`
      SELECT * FROM agent_playbooks
      WHERE methodology = $1
        AND is_system = true
        AND is_active = true
        AND language = $2
      LIMIT 1
    `, [methodology, language]);

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching system playbook:', error);
    return null;
  }
}

/**
 * Format playbook for AI prompt injection
 * @param {Object} playbook - Playbook object
 * @param {Object} leadData - Lead data for variable substitution
 * @returns {string} Formatted text for prompt
 */
function formatPlaybookForPrompt(playbook, leadData = {}) {
  if (!playbook) {
    return '';
  }

  const methodologyLabels = {
    spin: 'SPIN Selling (Situation, Problem, Implication, Need)',
    challenger: 'Challenger Sale (Teach, Tailor, Take Control)',
    sandler: 'Sandler Selling System (Pain, Budget, Decision)',
    meddpicc: 'MEDDPICC (Enterprise Qualification)',
    gap: 'Gap Selling (Current State → Future State)',
    bant: 'BANT (Budget, Authority, Need, Timeline)',
    inbound: 'Inbound Sales (Help First)',
    'consultivo-br': 'Consultivo Brasileiro (Relationship First)'
  };

  let formattedText = `
METODOLOGIA DE VENDAS: ${methodologyLabels[playbook.methodology] || playbook.name}
${playbook.description ? `\n${playbook.description}` : ''}

`;

  // Opening scripts
  const openingScripts = Array.isArray(playbook.opening_scripts) ? playbook.opening_scripts : [];
  if (openingScripts.length > 0) {
    formattedText += `SCRIPTS DE ABERTURA (use como inspiração, adapte ao contexto):
${openingScripts.map((script, i) => `${i + 1}. "${substituteVariables(script, leadData)}"`).join('\n')}

`;
  }

  // Qualification questions by phase
  const questions = Array.isArray(playbook.qualification_questions) ? playbook.qualification_questions : [];
  if (questions.length > 0) {
    // Group by phase
    const phases = {};
    for (const q of questions) {
      const phase = q.phase || 'general';
      if (!phases[phase]) {
        phases[phase] = [];
      }
      phases[phase].push(q);
    }

    const phaseLabels = {
      situation: 'SITUAÇÃO (entender contexto)',
      problem: 'PROBLEMA (identificar dor)',
      implication: 'IMPLICAÇÃO (amplificar dor)',
      need: 'NECESSIDADE (lead verbaliza)',
      teach: 'ENSINAR (compartilhar insight)',
      tailor: 'CUSTOMIZAR (adaptar ao contexto)',
      take_control: 'CONTROLAR (conduzir conversa)',
      rapport: 'RAPPORT (criar conexão)',
      discovery: 'DESCOBERTA (entender necessidades)',
      value: 'VALOR (apresentar solução)',
      closing: 'FECHAMENTO (próximos passos)',
      bonding: 'CONEXÃO (criar vínculo)',
      upfront_contract: 'CONTRATO INICIAL (alinhar expectativas)',
      pain: 'DOR (identificar frustração)',
      budget: 'ORÇAMENTO (qualificar investimento)',
      decision: 'DECISÃO (mapear processo)',
      authority: 'AUTORIDADE (identificar decisor)',
      timeline: 'TIMELINE (entender urgência)',
      qualification: 'QUALIFICAÇÃO (validar fit)',
      general: 'PERGUNTAS GERAIS'
    };

    formattedText += `PERGUNTAS DE QUALIFICAÇÃO (siga a sequência, uma por vez):
`;

    for (const [phase, phaseQuestions] of Object.entries(phases)) {
      const phaseLabel = phaseLabels[phase] || phase.toUpperCase();
      formattedText += `
[${phaseLabel}]
`;
      for (const q of phaseQuestions.sort((a, b) => (a.order || 0) - (b.order || 0))) {
        formattedText += `• "${substituteVariables(q.question, leadData)}"
  Objetivo: ${q.purpose || 'Coletar informação'}
`;
      }
    }

    formattedText += `
`;
  }

  // Closing scripts
  const closingScripts = Array.isArray(playbook.closing_scripts) ? playbook.closing_scripts : [];
  if (closingScripts.length > 0) {
    formattedText += `SCRIPTS DE FECHAMENTO (quando lead demonstrar interesse):
${closingScripts.map((script, i) => `${i + 1}. "${substituteVariables(script, leadData)}"`).join('\n')}

`;
  }

  formattedText += `REGRAS DO PLAYBOOK:
1. Siga a sequência de perguntas - não pule fases
2. Faça UMA pergunta por vez
3. Escute a resposta antes de prosseguir
4. Adapte as perguntas ao contexto da conversa
5. Use os scripts como inspiração, não copie literalmente
6. Se o lead responder algo fora do esperado, volte para a pergunta adequada
`;

  return formattedText;
}

/**
 * Substitute variables in text
 * @param {string} text - Text with variables
 * @param {Object} data - Data for substitution
 * @returns {string} Text with substituted variables
 */
function substituteVariables(text, data) {
  if (!text) return '';

  const variables = {
    '{{nome}}': data.name || data.nome || '[Nome]',
    '{{name}}': data.name || data.nome || '[Name]',
    '{{empresa}}': data.company || data.empresa || '[Empresa]',
    '{{company}}': data.company || data.empresa || '[Company]',
    '{{cargo}}': data.title || data.cargo || '[Cargo]',
    '{{title}}': data.title || data.cargo || '[Title]',
    '{{industria}}': data.industry || data.industria || '[Indústria]',
    '{{industry}}': data.industry || data.industria || '[Industry]',
    '{{area}}': data.area || data.industry || '[área]',
    '{{problema_comum}}': '[desafio comum do segmento]',
    '{{common_problem}}': '[common challenge]',
    '{{solucao}}': '[sua solução]',
    '{{solution}}': '[your solution]',
    '{{tempo}}': data.tenure || '[X meses]',
    '{{tendencia_mercado}}': '[tendência atual do mercado]',
    '{{insight_mercado}}': '[insight relevante do mercado]'
  };

  let result = text;
  for (const [variable, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
}

/**
 * Get current conversation phase based on exchange count
 * @param {Object} playbook - Playbook object
 * @param {number} exchangeCount - Number of exchanges
 * @returns {Object} Current phase info
 */
function getCurrentPhase(playbook, exchangeCount) {
  if (!playbook || !playbook.qualification_questions) {
    return { phase: 'general', questionIndex: 0 };
  }

  const questions = Array.isArray(playbook.qualification_questions)
    ? playbook.qualification_questions
    : [];

  // Find current question based on exchange count
  const questionIndex = Math.min(exchangeCount, questions.length - 1);
  const currentQuestion = questions[questionIndex];

  return {
    phase: currentQuestion?.phase || 'general',
    questionIndex,
    currentQuestion,
    totalQuestions: questions.length,
    progress: Math.round((questionIndex / questions.length) * 100)
  };
}

/**
 * Create custom playbook
 * @param {Object} data - Playbook data
 * @returns {Promise<Object>} Created playbook
 */
async function createPlaybook(data) {
  const {
    account_id,
    name,
    description,
    methodology,
    opening_scripts,
    closing_scripts,
    qualification_questions,
    follow_up_sequence,
    language = 'pt-BR'
  } = data;

  try {
    const result = await db.query(`
      INSERT INTO agent_playbooks
        (account_id, name, description, methodology, opening_scripts, closing_scripts,
         qualification_questions, follow_up_sequence, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      account_id,
      name,
      description,
      methodology,
      JSON.stringify(opening_scripts || []),
      JSON.stringify(closing_scripts || []),
      JSON.stringify(qualification_questions || []),
      JSON.stringify(follow_up_sequence || []),
      language
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating playbook:', error);
    throw error;
  }
}

/**
 * Update playbook
 * @param {string} playbookId - Playbook ID
 * @param {string} accountId - Account ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated playbook
 */
async function updatePlaybook(playbookId, accountId, data) {
  try {
    const result = await db.query(`
      UPDATE agent_playbooks
      SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        opening_scripts = COALESCE($5, opening_scripts),
        closing_scripts = COALESCE($6, closing_scripts),
        qualification_questions = COALESCE($7, qualification_questions),
        follow_up_sequence = COALESCE($8, follow_up_sequence),
        updated_at = NOW()
      WHERE id = $1 AND account_id = $2 AND is_system = false
      RETURNING *
    `, [
      playbookId,
      accountId,
      data.name,
      data.description,
      data.opening_scripts ? JSON.stringify(data.opening_scripts) : null,
      data.closing_scripts ? JSON.stringify(data.closing_scripts) : null,
      data.qualification_questions ? JSON.stringify(data.qualification_questions) : null,
      data.follow_up_sequence ? JSON.stringify(data.follow_up_sequence) : null
    ]);

    if (result.rows.length === 0) {
      throw new Error('Playbook not found or not editable');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating playbook:', error);
    throw error;
  }
}

/**
 * Get available methodologies
 * @returns {Array} List of methodology definitions
 */
function getMethodologies() {
  return [
    { id: 'spin', name: 'SPIN Selling', description: 'Perguntas estratégicas: Situação, Problema, Implicação, Necessidade' },
    { id: 'challenger', name: 'Challenger Sale', description: 'Desafie o status quo, ensine, customize, controle' },
    { id: 'sandler', name: 'Sandler System', description: 'Qualificação rigorosa, inversão de dinâmica de vendas' },
    { id: 'meddpicc', name: 'MEDDPICC', description: 'Qualificação enterprise: Metrics, Economic Buyer, Decision...' },
    { id: 'gap', name: 'Gap Selling', description: 'Identifique o gap entre estado atual e futuro desejado' },
    { id: 'bant', name: 'BANT', description: 'Qualificação rápida: Budget, Authority, Need, Timeline' },
    { id: 'inbound', name: 'Inbound Sales', description: 'Ajude primeiro, venda depois - metodologia HubSpot' },
    { id: 'consultivo-br', name: 'Consultivo Brasileiro', description: 'Relacionamento e confiança primeiro' }
  ];
}

module.exports = {
  getPlaybook,
  getPlaybookForAgent,
  getPlaybooks,
  getSystemPlaybook,
  formatPlaybookForPrompt,
  substituteVariables,
  getCurrentPhase,
  createPlaybook,
  updatePlaybook,
  getMethodologies
};
