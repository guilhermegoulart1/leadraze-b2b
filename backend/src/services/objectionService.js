// backend/src/services/objectionService.js

const db = require('../config/database');

/**
 * Objection Library Service
 * Manages objection templates and responses for AI agents
 */

/**
 * Get all objections for an account (including system templates)
 * @param {string} accountId - Account ID
 * @param {string} language - Language code (e.g., 'pt-BR', 'en')
 * @returns {Promise<Array>} List of objections
 */
async function getObjections(accountId, language = 'pt-BR') {
  try {
    const result = await db.query(`
      SELECT * FROM objection_library
      WHERE (account_id = $1 OR is_system = true)
        AND is_active = true
        AND language = $2
      ORDER BY category, objection_text
    `, [accountId, language]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching objections:', error);
    throw error;
  }
}

/**
 * Get objections by category
 * @param {string} accountId - Account ID
 * @param {string} category - Objection category
 * @param {string} language - Language code
 * @returns {Promise<Array>} List of objections in category
 */
async function getObjectionsByCategory(accountId, category, language = 'pt-BR') {
  try {
    const result = await db.query(`
      SELECT * FROM objection_library
      WHERE (account_id = $1 OR is_system = true)
        AND category = $2
        AND is_active = true
        AND language = $3
      ORDER BY objection_text
    `, [accountId, category, language]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching objections by category:', error);
    throw error;
  }
}

/**
 * Get system objection templates
 * @param {string} language - Language code
 * @returns {Promise<Array>} List of system objections
 */
async function getSystemObjections(language = 'pt-BR') {
  try {
    const result = await db.query(`
      SELECT * FROM objection_library
      WHERE is_system = true
        AND is_active = true
        AND language = $1
      ORDER BY category, objection_text
    `, [language]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching system objections:', error);
    throw error;
  }
}

/**
 * Format objections for AI prompt injection
 * @param {Array} objections - List of objection objects
 * @returns {string} Formatted text for prompt
 */
function formatObjectionsForPrompt(objections) {
  if (!objections || objections.length === 0) {
    return '';
  }

  const categoryLabels = {
    price: 'PREÇO/ORÇAMENTO',
    timing: 'TIMING/MOMENTO',
    authority: 'AUTORIDADE/DECISOR',
    need: 'NECESSIDADE/SOLUÇÃO EXISTENTE',
    trust: 'CONFIANÇA/CREDIBILIDADE',
    competitor: 'CONCORRÊNCIA',
    not_interested: 'SEM INTERESSE',
    skepticism: 'CETICISMO'
  };

  // Group by category
  const grouped = {};
  for (const obj of objections) {
    if (!grouped[obj.category]) {
      grouped[obj.category] = [];
    }
    grouped[obj.category].push(obj);
  }

  let formattedText = `
BIBLIOTECA DE OBJEÇÕES:
Quando o lead apresentar uma objeção, use estas respostas testadas como referência.
IMPORTANTE: Adapte a resposta ao contexto da conversa, não copie literalmente.

`;

  for (const [category, items] of Object.entries(grouped)) {
    const categoryLabel = categoryLabels[category] || category.toUpperCase();
    formattedText += `[${categoryLabel}]\n`;

    for (const obj of items) {
      // Get keywords for detection
      const keywordsText = obj.keywords && obj.keywords.length > 0
        ? `Palavras-chave: ${obj.keywords.slice(0, 5).join(', ')}`
        : '';

      // Get first response as example
      const responses = Array.isArray(obj.responses) ? obj.responses : [];
      const exampleResponse = responses[0] || 'Não disponível';

      formattedText += `• Se o lead disser algo como "${obj.objection_text}"
  ${keywordsText}
  → Resposta sugerida: "${exampleResponse}"

`;
    }
  }

  formattedText += `REGRAS PARA LIDAR COM OBJEÇÕES:
1. Primeiro, valide a preocupação do lead ("Entendo", "Faz sentido", etc.)
2. Faça uma pergunta para entender melhor o contexto
3. Nunca seja defensivo ou argumentativo
4. Use as respostas sugeridas como base, mas adapte ao tom da conversa
`;

  return formattedText;
}

/**
 * Detect objection in lead message
 * @param {string} message - Lead message
 * @param {Array} objections - List of objections to check against
 * @returns {Object|null} Matched objection or null
 */
function detectObjection(message, objections) {
  if (!message || !objections || objections.length === 0) {
    return null;
  }

  const messageLower = message.toLowerCase();

  for (const objection of objections) {
    const keywords = objection.keywords || [];

    for (const keyword of keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        return {
          objection: objection,
          matchedKeyword: keyword,
          suggestedResponses: objection.responses || []
        };
      }
    }
  }

  return null;
}

/**
 * Record that an objection response was used
 * @param {string} objectionId - Objection ID
 * @param {boolean} successful - Whether lead continued conversation
 */
async function recordObjectionUsage(objectionId, successful = false) {
  try {
    await db.query(`
      UPDATE objection_library
      SET
        times_used = times_used + 1,
        times_successful = times_successful + CASE WHEN $2 THEN 1 ELSE 0 END,
        updated_at = NOW()
      WHERE id = $1
    `, [objectionId, successful]);
  } catch (error) {
    console.error('Error recording objection usage:', error);
    // Non-critical, don't throw
  }
}

/**
 * Create custom objection for an account
 * @param {Object} data - Objection data
 * @returns {Promise<Object>} Created objection
 */
async function createObjection(data) {
  const {
    account_id,
    category,
    objection_text,
    keywords,
    responses,
    language = 'pt-BR'
  } = data;

  try {
    const result = await db.query(`
      INSERT INTO objection_library
        (account_id, category, objection_text, keywords, responses, language)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      account_id,
      category,
      objection_text,
      keywords || [],
      JSON.stringify(responses || []),
      language
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating objection:', error);
    throw error;
  }
}

/**
 * Update an objection
 * @param {string} objectionId - Objection ID
 * @param {string} accountId - Account ID (for authorization)
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated objection
 */
async function updateObjection(objectionId, accountId, data) {
  const {
    objection_text,
    keywords,
    responses,
    is_active
  } = data;

  try {
    const result = await db.query(`
      UPDATE objection_library
      SET
        objection_text = COALESCE($3, objection_text),
        keywords = COALESCE($4, keywords),
        responses = COALESCE($5, responses),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $1 AND account_id = $2 AND is_system = false
      RETURNING *
    `, [
      objectionId,
      accountId,
      objection_text,
      keywords,
      responses ? JSON.stringify(responses) : null,
      is_active
    ]);

    if (result.rows.length === 0) {
      throw new Error('Objection not found or not editable');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating objection:', error);
    throw error;
  }
}

/**
 * Delete an objection (soft delete)
 * @param {string} objectionId - Objection ID
 * @param {string} accountId - Account ID (for authorization)
 */
async function deleteObjection(objectionId, accountId) {
  try {
    const result = await db.query(`
      UPDATE objection_library
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND account_id = $2 AND is_system = false
      RETURNING id
    `, [objectionId, accountId]);

    if (result.rows.length === 0) {
      throw new Error('Objection not found or not deletable');
    }

    return true;
  } catch (error) {
    console.error('Error deleting objection:', error);
    throw error;
  }
}

/**
 * Get objection categories
 * @returns {Array} List of category definitions
 */
function getObjectionCategories() {
  return [
    { id: 'price', label: 'Preço/Orçamento', description: 'Objeções relacionadas a custo e investimento' },
    { id: 'timing', label: 'Timing/Momento', description: 'Objeções sobre o momento não ser adequado' },
    { id: 'authority', label: 'Autoridade/Decisor', description: 'Lead não é o decisor ou precisa aprovar internamente' },
    { id: 'need', label: 'Necessidade', description: 'Lead já tem solução ou não vê necessidade' },
    { id: 'trust', label: 'Confiança', description: 'Lead não conhece ou não confia na empresa' },
    { id: 'competitor', label: 'Concorrência', description: 'Lead menciona ou compara com concorrentes' },
    { id: 'not_interested', label: 'Sem Interesse', description: 'Lead declina sem motivo específico' },
    { id: 'skepticism', label: 'Ceticismo', description: 'Lead desconfia das promessas ou benefícios' }
  ];
}

module.exports = {
  getObjections,
  getObjectionsByCategory,
  getSystemObjections,
  formatObjectionsForPrompt,
  detectObjection,
  recordObjectionUsage,
  createObjection,
  updateObjection,
  deleteObjection,
  getObjectionCategories
};
