/**
 * Transfer Rule Service
 *
 * Centralized service for managing and evaluating global transfer rules.
 * Each rule defines WHEN to transfer (trigger) and WHERE to transfer (destination).
 *
 * Trigger types:
 * - keyword: match keywords in lead message
 * - preset: use predefined trigger definitions (doubt, qualified, price, etc.)
 * - exchange_limit: transfer after N exchanges
 * - ai_detected: AI evaluates custom prompt condition
 * - sentiment: detect specific sentiments
 *
 * Destination types:
 * - default: use agent's default_transfer_config
 * - sector_round_robin: assign to sector via round-robin
 * - sector_specific: assign to specific user in sector
 * - user: assign to specific user directly
 */

const db = require('../config/database');
const handoffService = require('./handoffService');

/**
 * Preset trigger definitions with keywords
 */
const PRESET_TRIGGER_DEFINITIONS = {
  doubt: {
    keywords: ['não entendi', 'como funciona', 'dúvida', 'não sei', 'pode explicar', 'confuso', 'complexo'],
    label: 'Dúvida',
    description: 'O lead expressa dúvidas ou confusão'
  },
  qualified: {
    keywords: ['interessado', 'quero saber mais', 'me conta mais', 'parece bom', 'gostei', 'vamos conversar'],
    label: 'Lead Qualificado',
    description: 'O lead demonstra alto interesse'
  },
  price: {
    keywords: ['preço', 'quanto custa', 'valor', 'investimento', 'custo', 'orçamento', 'budget', 'pricing', 'planos'],
    label: 'Preço',
    description: 'O lead pergunta sobre preços ou valores'
  },
  demo: {
    keywords: ['demo', 'demonstração', 'apresentação', 'mostrar', 'ver funcionando', 'teste', 'trial', 'experimentar'],
    label: 'Demo',
    description: 'O lead solicita demonstração ou teste'
  },
  competitor: {
    keywords: ['concorrente', 'outra empresa', 'já uso', 'comparar', 'diferença entre', 'vs', 'versus'],
    label: 'Concorrente',
    description: 'O lead menciona concorrentes'
  },
  urgency: {
    keywords: ['urgente', 'preciso agora', 'rápido', 'prazo', 'deadline', 'imediato', 'hoje', 'amanhã'],
    label: 'Urgência',
    description: 'O lead demonstra urgência'
  },
  frustration: {
    keywords: ['frustrado', 'irritado', 'problema', 'não funciona', 'péssimo', 'horrível', 'decepcionado', 'cansado'],
    label: 'Frustração',
    description: 'O lead expressa frustração'
  },
  // AI-evaluated presets (triggered by AI self-assessment, not keywords)
  ai_no_answer: {
    keywords: [],
    ai_evaluated: true,
    prompt: 'Você não sabe a resposta, não tem informação suficiente na base de conhecimento, ou a pergunta foge do seu escopo',
    label: 'IA Sem Resposta',
    description: 'A IA não sabe responder a pergunta do lead'
  },
  ai_confused: {
    keywords: [],
    ai_evaluated: true,
    prompt: 'A mensagem do lead é ambígua, confusa ou você não conseguiu entender o que ele quis dizer mesmo após tentar clarificar',
    label: 'IA Não Entendeu',
    description: 'A IA não conseguiu entender a pergunta'
  },
  ai_repeated_question: {
    keywords: [],
    ai_evaluated: true,
    prompt: 'O lead está repetindo a mesma pergunta ou insistindo no mesmo assunto porque não ficou satisfeito com as respostas anteriores',
    label: 'Lead Insatisfeito',
    description: 'O lead repete a pergunta, insatisfeito com a resposta'
  },
  ai_complex_request: {
    keywords: [],
    ai_evaluated: true,
    prompt: 'O lead fez uma solicitação complexa que exige análise humana, como negociação de contrato, suporte técnico avançado ou caso muito específico',
    label: 'Caso Complexo',
    description: 'Solicitação complexa que exige atendimento humano'
  },
  human_request: {
    keywords: ['falar com humano', 'falar com atendente', 'atendente humano', 'pessoa real', 'falar com alguém', 'quero falar com uma pessoa', 'atendimento humano', 'falar com gente'],
    ai_evaluated: true,
    prompt: 'O lead pediu explicitamente para falar com um humano ou atendente real',
    label: 'Pediu Humano',
    description: 'O lead pediu para falar com um atendente humano'
  }
};

// ==========================================
// CRUD Operations
// ==========================================

/**
 * Get all transfer rules for an agent, ordered by priority
 */
async function getRulesForAgent(agentId) {
  const result = await db.query(`
    SELECT * FROM agent_transfer_rules
    WHERE agent_id = $1
    ORDER BY priority ASC, created_at ASC
  `, [agentId]);
  return result.rows;
}

/**
 * Get a single transfer rule by ID
 */
async function getRuleById(ruleId) {
  const result = await db.query(`
    SELECT * FROM agent_transfer_rules WHERE id = $1
  `, [ruleId]);
  return result.rows[0] || null;
}

/**
 * Create a new transfer rule
 */
async function createRule(agentId, accountId, ruleData) {
  // Get max priority to place new rule at the end
  const maxResult = await db.query(`
    SELECT COALESCE(MAX(priority), -1) as max_priority
    FROM agent_transfer_rules WHERE agent_id = $1
  `, [agentId]);
  const nextPriority = maxResult.rows[0].max_priority + 1;

  const result = await db.query(`
    INSERT INTO agent_transfer_rules (
      agent_id, account_id, name, description, priority, is_active,
      trigger_type, trigger_config,
      destination_type, destination_config,
      transfer_mode, transfer_message, notify_on_handoff, actions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `, [
    agentId,
    accountId,
    ruleData.name,
    ruleData.description || null,
    ruleData.priority !== undefined ? ruleData.priority : nextPriority,
    ruleData.is_active !== false,
    ruleData.trigger_type,
    JSON.stringify(ruleData.trigger_config || {}),
    ruleData.destination_type || 'default',
    JSON.stringify(ruleData.destination_config || {}),
    ruleData.transfer_mode || 'notify',
    ruleData.transfer_message || null,
    ruleData.notify_on_handoff !== false,
    JSON.stringify(ruleData.actions || [])
  ]);

  return result.rows[0];
}

/**
 * Update an existing transfer rule
 */
async function updateRule(ruleId, ruleData) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'name', 'description', 'priority', 'is_active',
    'trigger_type', 'trigger_config',
    'destination_type', 'destination_config',
    'transfer_mode', 'transfer_message', 'notify_on_handoff',
    'actions'
  ];

  for (const field of allowedFields) {
    if (ruleData[field] !== undefined) {
      const value = (field === 'trigger_config' || field === 'destination_config' || field === 'actions')
        ? JSON.stringify(ruleData[field])
        : ruleData[field];
      fields.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  values.push(ruleId);

  const result = await db.query(`
    UPDATE agent_transfer_rules
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0] || null;
}

/**
 * Delete a transfer rule
 */
async function deleteRule(ruleId) {
  const result = await db.query(`
    DELETE FROM agent_transfer_rules WHERE id = $1 RETURNING id
  `, [ruleId]);
  return result.rows.length > 0;
}

/**
 * Reorder transfer rules for an agent
 * @param {string} agentId
 * @param {string[]} ruleIds - Array of rule IDs in desired order
 */
async function reorderRules(agentId, ruleIds) {
  await db.query('BEGIN');
  try {
    for (let i = 0; i < ruleIds.length; i++) {
      await db.query(`
        UPDATE agent_transfer_rules
        SET priority = $1, updated_at = NOW()
        WHERE id = $2 AND agent_id = $3
      `, [i, ruleIds[i], agentId]);
    }
    await db.query('COMMIT');
    return true;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Get default transfer config for an agent
 */
async function getDefaultTransferConfig(agentId) {
  const result = await db.query(`
    SELECT default_transfer_config FROM ai_agents WHERE id = $1
  `, [agentId]);
  return result.rows[0]?.default_transfer_config || {};
}

/**
 * Update default transfer config for an agent
 */
async function updateDefaultTransferConfig(agentId, config) {
  const result = await db.query(`
    UPDATE ai_agents
    SET default_transfer_config = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING default_transfer_config
  `, [JSON.stringify(config), agentId]);
  return result.rows[0]?.default_transfer_config || {};
}

// ==========================================
// Rule Evaluation
// ==========================================

/**
 * Evaluate all active transfer rules against an incoming message
 * Rules are evaluated in priority order; first match wins.
 *
 * @param {string} agentId - The agent ID
 * @param {string} message - The lead's message content
 * @param {object} context - Additional context
 * @param {number} context.exchangeCount - Current exchange count
 * @param {string} context.aiResponse - AI's response (for post-response evaluation)
 * @param {string} context.ruleIdFromAI - Rule ID extracted from [TRANSFER:uuid] tag
 * @returns {object} { shouldTransfer, matchedRule, reason, reasonText }
 */
async function evaluateTransferRules(agentId, message, context = {}) {
  try {
    const rules = await db.query(`
      SELECT * FROM agent_transfer_rules
      WHERE agent_id = $1 AND is_active = true
      ORDER BY priority ASC
    `, [agentId]);

    if (rules.rows.length === 0) {
      return { shouldTransfer: false, matchedRule: null, reason: null };
    }

    // If AI signaled a specific rule via [TRANSFER:rule_id]
    if (context.ruleIdFromAI) {
      const aiRule = rules.rows.find(r => r.id === context.ruleIdFromAI);
      if (aiRule) {
        return {
          shouldTransfer: true,
          matchedRule: aiRule,
          reason: `rule_ai_detected_${aiRule.name}`,
          reasonText: `IA detectou: ${aiRule.name}`
        };
      }
    }

    const messageLower = (message || '').toLowerCase();

    for (const rule of rules.rows) {
      const triggerConfig = rule.trigger_config || {};
      let matched = false;
      let matchDetail = '';

      switch (rule.trigger_type) {
        case 'keyword': {
          const keywords = triggerConfig.keywords || [];
          const matchedKeywords = keywords.filter(kw =>
            messageLower.includes(kw.toLowerCase())
          );
          if (matchedKeywords.length > 0) {
            matched = true;
            matchDetail = `Palavras: ${matchedKeywords.join(', ')}`;
          }
          break;
        }

        case 'preset': {
          const presetId = triggerConfig.preset_id;
          const preset = PRESET_TRIGGER_DEFINITIONS[presetId];
          if (preset) {
            const matchedKeywords = preset.keywords.filter(kw =>
              messageLower.includes(kw.toLowerCase())
            );
            if (matchedKeywords.length > 0) {
              matched = true;
              matchDetail = `Preset "${preset.label}": ${matchedKeywords.join(', ')}`;
            }
          }
          break;
        }

        case 'exchange_limit': {
          const limit = triggerConfig.limit || 0;
          if (limit > 0 && (context.exchangeCount || 0) >= limit) {
            matched = true;
            matchDetail = `Limite de ${limit} interações atingido`;
          }
          break;
        }

        case 'ai_detected':
          // AI-detected rules are handled via prompt injection.
          // The AI includes [TRANSFER:rule_id] in its response.
          // Already handled above via context.ruleIdFromAI.
          break;

        case 'sentiment':
          // Sentiment rules are also handled via AI prompt.
          // The AI signals via [TRANSFER:rule_id] when it detects matching sentiment.
          break;
      }

      if (matched) {
        return {
          shouldTransfer: true,
          matchedRule: rule,
          reason: `rule_${rule.trigger_type}_${rule.id}`,
          reasonText: `${rule.name}: ${matchDetail}`
        };
      }
    }

    return { shouldTransfer: false, matchedRule: null, reason: null };
  } catch (error) {
    console.error('[TransferRuleService] Error evaluating rules:', error);
    return { shouldTransfer: false, matchedRule: null, reason: null };
  }
}

// ==========================================
// Prompt Building (for AI-detected and sentiment rules)
// ==========================================

/**
 * Build the transfer rules section for the AI prompt.
 * Includes all rule types so the AI knows about them:
 * - keyword/preset rules: informational (evaluated server-side)
 * - ai_detected/sentiment rules: AI must signal with [TRANSFER:rule_id]
 */
async function buildTransferPromptSection(agentId) {
  try {
    const rules = await db.query(`
      SELECT * FROM agent_transfer_rules
      WHERE agent_id = $1 AND is_active = true
      ORDER BY priority ASC
    `, [agentId]);

    if (rules.rows.length === 0) return '';

    const aiDetectedRules = [];
    const sentimentRules = [];
    const aiPresetRules = [];
    const keywordRules = [];

    for (const rule of rules.rows) {
      switch (rule.trigger_type) {
        case 'ai_detected':
          aiDetectedRules.push(rule);
          break;
        case 'sentiment':
          sentimentRules.push(rule);
          break;
        case 'preset': {
          const presetId = rule.trigger_config?.preset_id;
          const preset = PRESET_TRIGGER_DEFINITIONS[presetId];
          if (preset?.ai_evaluated) {
            aiPresetRules.push({ rule, preset });
          } else {
            keywordRules.push(rule);
          }
          break;
        }
        case 'keyword':
          keywordRules.push(rule);
          break;
      }
    }

    let section = '';

    // AI-detected, sentiment, and AI-evaluated preset rules need the AI to signal
    const hasAiRules = aiDetectedRules.length > 0 || sentimentRules.length > 0 || aiPresetRules.length > 0;
    if (hasAiRules) {
      section += `\nGATILHOS DE TRANSFERÊNCIA PARA HUMANO:
Quando detectar QUALQUER uma destas situações, você DEVE:
1. Informar gentilmente que vai conectar o lead com um especialista
2. Incluir a tag de transferência correspondente no final da sua mensagem

Situações que exigem transferência:\n`;

      for (const rule of aiDetectedRules) {
        const prompt = rule.trigger_config?.prompt || rule.name;
        section += `- ${prompt} → Incluir [TRANSFER:${rule.id}]\n`;
      }

      for (const { rule, preset } of aiPresetRules) {
        section += `- ${preset.prompt} → Incluir [TRANSFER:${rule.id}]\n`;
      }

      for (const rule of sentimentRules) {
        const sentiments = rule.trigger_config?.sentiments || [];
        const sentimentLabels = {
          frustration: 'frustração ou irritação',
          confusion: 'confusão ou dificuldade de entendimento',
          high_interest: 'alto interesse e entusiasmo',
          urgency: 'urgência ou necessidade imediata'
        };
        const desc = sentiments.map(s => sentimentLabels[s] || s).join(', ');
        section += `- Quando o lead expressar ${desc} → Incluir [TRANSFER:${rule.id}]\n`;
      }

      section += `\nIMPORTANTE: Ao detectar um gatilho, responda de forma empática, informe que entendeu a necessidade e que vai conectar com alguém da equipe. Termine a mensagem com a tag [TRANSFER:id] correspondente.\n`;
    }

    // Also inform AI about keyword rules (so it knows transfers may happen)
    if (keywordRules.length > 0) {
      section += `\nNOTA: O sistema também monitora automaticamente palavras-chave que podem disparar transferência. Coopere com o sistema respondendo de forma natural.\n`;
    }

    return section;
  } catch (error) {
    console.error('[TransferRuleService] Error building prompt section:', error);
    return '';
  }
}

// ==========================================
// Transfer Execution
// ==========================================

/**
 * Execute automation actions configured for a transfer rule.
 * Actions run before the actual handoff so tags/notes are visible to the assignee.
 *
 * @param {string} conversationId
 * @param {object} rule - The matched transfer rule (with actions array)
 * @param {object} agent - The AI agent config
 */
async function executeActions(conversationId, rule, agent) {
  const actions = rule.actions || [];
  if (actions.length === 0) return;

  // Get conversation context for variable replacement and contact_id
  const convResult = await db.query(`
    SELECT c.*, ct.id as contact_id, ct.name as contact_name
    FROM conversations c
    LEFT JOIN opportunities o ON c.opportunity_id = o.id
    LEFT JOIN contacts ct ON o.contact_id = ct.id
    WHERE c.id = $1
  `, [conversationId]);

  const conv = convResult.rows[0];
  if (!conv) return;

  const contactId = conv.contact_id;

  // Variable replacement helper
  const replaceVars = (text) => {
    if (!text) return text;
    return text
      .replace(/\{\{contact_name\}\}/g, conv.contact_name || 'Lead')
      .replace(/\{\{agent_name\}\}/g, agent.name || 'AI Agent')
      .replace(/\{\{rule_name\}\}/g, rule.name || '')
      .replace(/\{\{handoff_reason\}\}/g, rule.name || rule.trigger_type || '');
  };

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'add_tag': {
          if (!contactId || !action.config?.tag_id) break;
          await db.query(`
            INSERT INTO contact_tags (contact_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [contactId, action.config.tag_id]);
          console.log(`[TransferActions] Added tag ${action.config.tag_id} to contact ${contactId}`);
          break;
        }

        case 'remove_tag': {
          if (!contactId || !action.config?.tag_id) break;
          await db.query(`
            DELETE FROM contact_tags WHERE contact_id = $1 AND tag_id = $2
          `, [contactId, action.config.tag_id]);
          console.log(`[TransferActions] Removed tag ${action.config.tag_id} from contact ${contactId}`);
          break;
        }

        case 'add_note': {
          const noteText = replaceVars(action.config?.note);
          if (!noteText) break;
          await db.query(`
            INSERT INTO messages (conversation_id, content, message_type, sender_type, created_at)
            VALUES ($1, $2, 'note', 'system', NOW())
          `, [conversationId, noteText]);
          console.log(`[TransferActions] Added note to conversation ${conversationId}`);
          break;
        }

        case 'update_contact': {
          if (!contactId || !action.config?.field || action.config?.value === undefined) break;
          const allowedContactFields = ['company', 'role', 'phone', 'email'];
          if (!allowedContactFields.includes(action.config.field)) break;
          await db.query(`
            UPDATE contacts SET ${action.config.field} = $1, updated_at = NOW() WHERE id = $2
          `, [action.config.value, contactId]);
          console.log(`[TransferActions] Updated contact ${contactId} field ${action.config.field}`);
          break;
        }

        case 'send_webhook': {
          if (!action.config?.url) break;
          const webhookPayload = {
            event: 'transfer_triggered',
            rule: { id: rule.id, name: rule.name, trigger_type: rule.trigger_type },
            conversation_id: conversationId,
            contact: { id: contactId, name: conv.contact_name },
            agent: { id: agent.id, name: agent.name },
            timestamp: new Date().toISOString()
          };
          fetch(action.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(action.config.headers || {}) },
            body: JSON.stringify(webhookPayload)
          }).catch(err => console.error(`[TransferActions] Webhook failed:`, err.message));
          console.log(`[TransferActions] Sent webhook to ${action.config.url}`);
          break;
        }

        default:
          console.warn(`[TransferActions] Unknown action type: ${action.type}`);
      }
    } catch (actionError) {
      console.error(`[TransferActions] Error executing action ${action.type}:`, actionError.message);
      // Continue with next action - don't block transfer
    }
  }
}

/**
 * Execute a transfer based on a matched rule.
 * Resolves the rule's destination and delegates to handoffService.
 *
 * @param {string} conversationId
 * @param {object} rule - The matched transfer rule
 * @param {object} agent - The AI agent config
 * @returns {Promise<object>}
 */
async function executeTransferFromRule(conversationId, rule, agent) {
  try {
    console.log(`[TransferRuleService] Executing transfer from rule "${rule.name}" for conversation ${conversationId}`);

    // Resolve destination
    let sectorId = null;
    let userId = null;
    let transferMode = rule.transfer_mode || 'notify';
    let transferMessage = rule.transfer_message || null;

    switch (rule.destination_type) {
      case 'sector_round_robin': {
        sectorId = rule.destination_config?.sector_id;
        break;
      }
      case 'sector_specific': {
        sectorId = rule.destination_config?.sector_id;
        userId = rule.destination_config?.user_id;
        break;
      }
      case 'user': {
        userId = rule.destination_config?.user_id;
        break;
      }
      case 'default':
      default: {
        // Use agent's default transfer config
        const defaultConfig = agent.default_transfer_config || {};
        sectorId = defaultConfig.sector_id || agent.sector_id;
        transferMode = defaultConfig.transfer_mode || transferMode;
        transferMessage = defaultConfig.transfer_message || transferMessage;
        break;
      }
    }

    // Execute automation actions before handoff
    await executeActions(conversationId, rule, agent);

    // Record the rule that triggered this handoff
    await db.query(`
      UPDATE conversations SET handoff_rule_id = $1 WHERE id = $2
    `, [rule.id, conversationId]);

    // Execute via handoffService with per-rule options
    const result = await handoffService.executeHandoff(conversationId, agent, `rule_${rule.name}`, {
      ruleId: rule.id,
      sectorId,
      userId,
      transferMode,
      transferMessage,
      notifyOnHandoff: rule.notify_on_handoff
    });

    return result;
  } catch (error) {
    console.error(`[TransferRuleService] Error executing transfer from rule:`, error);
    throw error;
  }
}

module.exports = {
  // CRUD
  getRulesForAgent,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
  getDefaultTransferConfig,
  updateDefaultTransferConfig,

  // Evaluation
  evaluateTransferRules,
  buildTransferPromptSection,

  // Execution
  executeTransferFromRule,

  // Constants
  PRESET_TRIGGER_DEFINITIONS
};
