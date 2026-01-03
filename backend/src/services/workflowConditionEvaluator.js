// backend/src/services/workflowConditionEvaluator.js

/**
 * Workflow Condition Evaluator
 *
 * Evaluates condition nodes in the workflow to determine which path to take.
 * Supports boolean conditions and comparison operators.
 */

const aiResponseService = require('./aiResponseService');
const db = require('../config/database');

/**
 * Comparison operators
 */
const OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  GREATER_OR_EQUAL: 'greater_or_equal',
  LESS_OR_EQUAL: 'less_or_equal'
};

/**
 * Boolean condition types (no operator needed)
 */
const BOOLEAN_CONDITIONS = [
  'invite_accepted',
  'invite_ignored',
  'is_connected',
  'response_received',
  'has_responded',
  'has_email',
  'has_phone',
  'is_qualified',
  'is_business_hours'
];

/**
 * Comparison condition types (require operator and value)
 */
const COMPARISON_CONDITIONS = [
  'sentiment',
  'keyword',
  'intent',
  'time_elapsed',
  'message_count',
  'exchange_count',
  'lead_status',
  'custom'
];

/**
 * Evaluate a condition node
 * @param {object} conditionNode - The condition node to evaluate
 * @param {object} context - Execution context
 * @returns {Promise<object>} Result with path ('yes' or 'no') and reason
 */
async function evaluateCondition(conditionNode, context) {
  const { data } = conditionNode;
  const conditionType = data.conditionType || data.condition;
  const operator = data.operator;
  const value = data.value;
  const waitTime = data.waitTime;
  const waitUnit = data.waitUnit;

  const startTime = Date.now();

  try {
    console.log(`🔍 Evaluating condition: ${conditionType} ${operator || ''} ${value || ''}`);

    let result;
    let reason;

    // Boolean conditions
    if (BOOLEAN_CONDITIONS.includes(conditionType)) {
      const evalResult = await evaluateBooleanCondition(conditionType, context);
      result = evalResult.result;
      reason = evalResult.reason;
    }
    // Comparison conditions
    else if (COMPARISON_CONDITIONS.includes(conditionType)) {
      const evalResult = await evaluateComparisonCondition(conditionType, operator, value, context);
      result = evalResult.result;
      reason = evalResult.reason;
    }
    // Unknown condition type
    else {
      console.warn(`⚠️ Unknown condition type: ${conditionType}, defaulting to false`);
      result = false;
      reason = `Unknown condition type: ${conditionType}`;
    }

    const durationMs = Date.now() - startTime;

    console.log(`✅ Condition evaluated: ${result ? 'YES' : 'NO'} (${reason})`);

    return {
      path: result ? 'yes' : 'no',
      result,
      reason,
      conditionType,
      operator,
      value,
      durationMs
    };
  } catch (error) {
    console.error(`❌ Error evaluating condition:`, error);
    return {
      path: 'no',
      result: false,
      reason: `Error: ${error.message}`,
      conditionType,
      error: error.message,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Evaluate boolean condition
 */
async function evaluateBooleanCondition(conditionType, context) {
  switch (conditionType) {
    case 'invite_accepted':
      return {
        result: context.event === 'invite_accepted',
        reason: context.event === 'invite_accepted' ? 'Convite foi aceito' : 'Convite não foi aceito'
      };

    case 'invite_ignored':
      return {
        result: context.event === 'invite_ignored' || context.event === 'no_response',
        reason: context.event === 'invite_ignored' ? 'Convite foi ignorado' : 'Convite não foi ignorado'
      };

    case 'is_connected':
      const isConnected = context.lead?.status === 'connected' || context.isConnected === true;
      return {
        result: isConnected,
        reason: isConnected ? 'Lead está conectado' : 'Lead não está conectado'
      };

    case 'response_received':
      return {
        result: context.event === 'message_received' && context.hasResponse === true,
        reason: context.hasResponse ? 'Resposta recebida' : 'Nenhuma resposta recebida'
      };

    case 'has_responded':
      const leadMessages = context.conversationStats?.leadMessages || 0;
      const hasResponded = leadMessages > 0;
      return {
        result: hasResponded,
        reason: hasResponded ? `Lead enviou ${leadMessages} mensagem(ns)` : 'Lead ainda não respondeu'
      };

    case 'has_email':
      const hasEmail = !!(context.lead?.email || context.extractedContacts?.email);
      return {
        result: hasEmail,
        reason: hasEmail ? 'Email disponível' : 'Email não disponível'
      };

    case 'has_phone':
      const hasPhone = !!(context.lead?.phone || context.extractedContacts?.phone);
      return {
        result: hasPhone,
        reason: hasPhone ? 'Telefone disponível' : 'Telefone não disponível'
      };

    case 'is_qualified':
      const qualifiedStatuses = ['qualified', 'engaged', 'ready_to_buy'];
      const isQualified = qualifiedStatuses.includes(context.lead?.status);
      return {
        result: isQualified,
        reason: isQualified ? `Lead qualificado (status: ${context.lead?.status})` : 'Lead não qualificado'
      };

    case 'is_business_hours':
      const isBusinessHours = checkBusinessHours(context.workingHours);
      return {
        result: isBusinessHours,
        reason: isBusinessHours ? 'Dentro do horário comercial' : 'Fora do horário comercial'
      };

    default:
      return {
        result: false,
        reason: `Condição booleana desconhecida: ${conditionType}`
      };
  }
}

/**
 * Evaluate comparison condition
 */
async function evaluateComparisonCondition(conditionType, operator, value, context) {
  switch (conditionType) {
    case 'sentiment':
      return await evaluateSentimentCondition(operator, value, context);

    case 'keyword':
      return evaluateKeywordCondition(operator, value, context);

    case 'intent':
      return await evaluateIntentCondition(operator, value, context);

    case 'time_elapsed':
      return evaluateTimeElapsedCondition(operator, value, context);

    case 'message_count':
      return evaluateMessageCountCondition(operator, value, context);

    case 'exchange_count':
      return evaluateExchangeCountCondition(operator, value, context);

    case 'lead_status':
      return evaluateLeadStatusCondition(operator, value, context);

    case 'custom':
      return evaluateCustomCondition(operator, value, context);

    default:
      return {
        result: false,
        reason: `Condição de comparação desconhecida: ${conditionType}`
      };
  }
}

/**
 * Evaluate sentiment condition
 */
async function evaluateSentimentCondition(operator, value, context) {
  try {
    const message = context.lastMessage || context.message;
    if (!message) {
      return { result: false, reason: 'Nenhuma mensagem para análise de sentimento' };
    }

    // Use cached sentiment if available
    let sentiment = context.lastSentiment;

    // Otherwise, detect sentiment
    if (!sentiment) {
      const sentimentResult = await aiResponseService.detectSentiment(message, []);
      sentiment = sentimentResult.sentiment;
    }

    const result = compareValues(sentiment, operator, value);
    return {
      result,
      reason: `Sentimento detectado: ${sentiment} ${operator} ${value} = ${result}`
    };
  } catch (error) {
    return {
      result: false,
      reason: `Erro ao detectar sentimento: ${error.message}`
    };
  }
}

/**
 * Evaluate keyword condition
 */
function evaluateKeywordCondition(operator, value, context) {
  const message = (context.lastMessage || context.message || '').toLowerCase();
  const keyword = (value || '').toLowerCase();

  if (!message || !keyword) {
    return { result: false, reason: 'Mensagem ou palavra-chave vazia' };
  }

  let result;
  switch (operator) {
    case OPERATORS.CONTAINS:
      result = message.includes(keyword);
      break;
    case OPERATORS.NOT_CONTAINS:
      result = !message.includes(keyword);
      break;
    case OPERATORS.EQUALS:
      result = message === keyword;
      break;
    case OPERATORS.NOT_EQUALS:
      result = message !== keyword;
      break;
    default:
      result = message.includes(keyword);
  }

  return {
    result,
    reason: `Mensagem ${result ? 'contém' : 'não contém'} "${keyword}"`
  };
}

/**
 * Evaluate intent condition
 */
async function evaluateIntentCondition(operator, value, context) {
  try {
    const message = context.lastMessage || context.message;
    if (!message) {
      return { result: false, reason: 'Nenhuma mensagem para análise de intenção' };
    }

    // Use cached intent if available
    let intent = context.lastIntent;

    // Otherwise, detect intent
    if (!intent) {
      intent = await aiResponseService.detectIntent(message);
    }

    const result = compareValues(intent, operator, value);
    return {
      result,
      reason: `Intenção detectada: ${intent} ${operator} ${value} = ${result}`
    };
  } catch (error) {
    return {
      result: false,
      reason: `Erro ao detectar intenção: ${error.message}`
    };
  }
}

/**
 * Evaluate time elapsed condition (in seconds)
 */
function evaluateTimeElapsedCondition(operator, value, context) {
  const lastMessageAt = context.lastMessageAt || context.conversationStats?.lastMessageAt;

  if (!lastMessageAt) {
    return { result: false, reason: 'Nenhuma mensagem anterior' };
  }

  const elapsedMs = Date.now() - new Date(lastMessageAt).getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const valueSeconds = parseInt(value) || 0;

  const result = compareNumbers(elapsedSeconds, operator, valueSeconds);
  return {
    result,
    reason: `Tempo decorrido: ${elapsedSeconds}s ${operator} ${valueSeconds}s = ${result}`
  };
}

/**
 * Evaluate message count condition
 */
function evaluateMessageCountCondition(operator, value, context) {
  const messageCount = context.conversationStats?.totalMessages || 0;
  const targetCount = parseInt(value) || 0;

  const result = compareNumbers(messageCount, operator, targetCount);
  return {
    result,
    reason: `Total de mensagens: ${messageCount} ${operator} ${targetCount} = ${result}`
  };
}

/**
 * Evaluate exchange count condition
 */
function evaluateExchangeCountCondition(operator, value, context) {
  const exchangeCount = context.conversationStats?.exchangeCount || 0;
  const targetCount = parseInt(value) || 0;

  const result = compareNumbers(exchangeCount, operator, targetCount);
  return {
    result,
    reason: `Total de trocas: ${exchangeCount} ${operator} ${targetCount} = ${result}`
  };
}

/**
 * Evaluate lead status condition
 */
function evaluateLeadStatusCondition(operator, value, context) {
  const leadStatus = context.lead?.status || '';
  const result = compareValues(leadStatus, operator, value);
  return {
    result,
    reason: `Status do lead: ${leadStatus} ${operator} ${value} = ${result}`
  };
}

/**
 * Evaluate custom condition (uses expression)
 */
function evaluateCustomCondition(operator, value, context) {
  try {
    // For custom conditions, value is expected to be a path like "variables.qualified"
    const parts = value.split('.');
    let current = context;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }

    // If operator is not specified, treat as boolean check
    if (!operator) {
      const result = !!current;
      return {
        result,
        reason: `Variável ${value} = ${current} (${result ? 'truthy' : 'falsy'})`
      };
    }

    const result = compareValues(current, operator, value);
    return {
      result,
      reason: `Custom: ${value} ${operator} = ${result}`
    };
  } catch (error) {
    return {
      result: false,
      reason: `Erro em condição customizada: ${error.message}`
    };
  }
}

/**
 * Compare values using operator
 */
function compareValues(actual, operator, expected) {
  const actualStr = String(actual || '').toLowerCase();
  const expectedStr = String(expected || '').toLowerCase();

  switch (operator) {
    case OPERATORS.EQUALS:
      return actualStr === expectedStr;
    case OPERATORS.NOT_EQUALS:
      return actualStr !== expectedStr;
    case OPERATORS.CONTAINS:
      return actualStr.includes(expectedStr);
    case OPERATORS.NOT_CONTAINS:
      return !actualStr.includes(expectedStr);
    default:
      return actualStr === expectedStr;
  }
}

/**
 * Compare numbers using operator
 */
function compareNumbers(actual, operator, expected) {
  const actualNum = parseFloat(actual) || 0;
  const expectedNum = parseFloat(expected) || 0;

  switch (operator) {
    case OPERATORS.EQUALS:
      return actualNum === expectedNum;
    case OPERATORS.NOT_EQUALS:
      return actualNum !== expectedNum;
    case OPERATORS.GREATER_THAN:
      return actualNum > expectedNum;
    case OPERATORS.LESS_THAN:
      return actualNum < expectedNum;
    case OPERATORS.GREATER_OR_EQUAL:
      return actualNum >= expectedNum;
    case OPERATORS.LESS_OR_EQUAL:
      return actualNum <= expectedNum;
    default:
      return actualNum === expectedNum;
  }
}

/**
 * Check if current time is within business hours
 */
function checkBusinessHours(workingHours) {
  if (!workingHours || !workingHours.enabled) {
    return true; // If not configured, assume always open
  }

  const now = new Date();
  const timezone = workingHours.timezone || 'America/Sao_Paulo';

  // Get current time in configured timezone
  const options = { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false };
  const timeStr = now.toLocaleTimeString('en-US', options);
  const [hour, minute] = timeStr.split(':').map(Number);
  const currentMinutes = hour * 60 + minute;

  // Parse start and end times
  const [startHour, startMinute] = (workingHours.startTime || '09:00').split(':').map(Number);
  const [endHour, endMinute] = (workingHours.endTime || '18:00').split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Check if within time range
  const inTimeRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  // Check if current day is active
  const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayOptions = { timeZone: timezone };
  const currentDay = dayMap[now.toLocaleDateString('en-US', dayOptions).includes('Sun') ? 0 :
    now.toLocaleDateString('en-US', dayOptions).includes('Mon') ? 1 :
      now.toLocaleDateString('en-US', dayOptions).includes('Tue') ? 2 :
        now.toLocaleDateString('en-US', dayOptions).includes('Wed') ? 3 :
          now.toLocaleDateString('en-US', dayOptions).includes('Thu') ? 4 :
            now.toLocaleDateString('en-US', dayOptions).includes('Fri') ? 5 : 6];
  const isDayActive = workingHours.days?.includes(currentDay) ?? true;

  return inTimeRange && isDayActive;
}

/**
 * Get the output handle ID based on condition result
 * @param {boolean} result - Condition result
 * @returns {string} Handle ID ('yes' or 'no')
 */
function getConditionOutputHandle(result) {
  return result ? 'yes' : 'no';
}

module.exports = {
  evaluateCondition,
  evaluateBooleanCondition,
  evaluateComparisonCondition,
  compareValues,
  compareNumbers,
  checkBusinessHours,
  getConditionOutputHandle,
  OPERATORS,
  BOOLEAN_CONDITIONS,
  COMPARISON_CONDITIONS
};
