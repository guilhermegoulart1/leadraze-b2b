// backend/src/services/workflowTriggerFilterEvaluator.js

/**
 * Workflow Trigger Filter Evaluator
 *
 * Evaluates trigger filters to determine if workflow should activate
 * based on incoming message content.
 */

/**
 * Evaluate a single filter against message content
 * @param {object} filter - Filter configuration
 * @param {string} message - Message content to evaluate
 * @returns {boolean} - Whether filter matches
 */
function evaluateFilter(filter, message) {
  const { type, value, caseSensitive, negate } = filter;

  // Empty filter value always passes
  if (!value || value.trim() === '') {
    return true;
  }

  // Prepare text for comparison
  const text = caseSensitive ? message : message.toLowerCase();
  const pattern = caseSensitive ? value : value.toLowerCase();

  let matches = false;

  switch (type) {
    case 'contains':
      matches = text.includes(pattern);
      break;

    case 'starts_with':
      matches = text.startsWith(pattern);
      break;

    case 'ends_with':
      matches = text.endsWith(pattern);
      break;

    case 'regex':
      try {
        const regex = new RegExp(value, caseSensitive ? '' : 'i');
        matches = regex.test(message);
      } catch (e) {
        console.warn(`[TriggerFilter] Invalid regex pattern: "${value}"`, e.message);
        matches = false;
      }
      break;

    case 'keyword_list':
      // Split by comma, trim each keyword, filter empty
      const keywords = value
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      matches = keywords.some(keyword => {
        const kw = caseSensitive ? keyword : keyword.toLowerCase();
        return text.includes(kw);
      });
      break;

    case 'equals':
    case 'exactly':
      matches = text === pattern;
      break;

    case 'not_empty':
      matches = message.trim().length > 0;
      break;

    default:
      // Default to 'contains' behavior
      matches = text.includes(pattern);
  }

  // Apply negation if configured
  return negate ? !matches : matches;
}

/**
 * Evaluate all filters for a trigger
 * @param {object} triggerData - Trigger node data
 * @param {string} message - Incoming message content
 * @returns {object} - { passes: boolean, reason: string, results: array }
 */
function evaluateTriggerFilters(triggerData, message) {
  const { filtersEnabled, filtersLogic = 'AND', filters = [] } = triggerData;

  // If filters not enabled, always pass
  if (!filtersEnabled) {
    return {
      passes: true,
      reason: 'Filters not enabled',
      filtered: false
    };
  }

  // If no filters configured, pass
  if (!filters || filters.length === 0) {
    return {
      passes: true,
      reason: 'No filters configured',
      filtered: false
    };
  }

  // If no message to evaluate, fail
  if (!message || message.trim() === '') {
    return {
      passes: false,
      reason: 'No message content to evaluate',
      filtered: true,
      results: []
    };
  }

  // Evaluate each filter
  const results = filters.map(filter => {
    const matches = evaluateFilter(filter, message);
    return {
      filterId: filter.id,
      type: filter.type,
      value: filter.value,
      negate: filter.negate,
      matches
    };
  });

  // Apply logic (AND = all must match, OR = at least one must match)
  const passes = filtersLogic === 'AND'
    ? results.every(r => r.matches)
    : results.some(r => r.matches);

  const matchedCount = results.filter(r => r.matches).length;
  const reason = `${matchedCount}/${filters.length} filters matched (${filtersLogic} logic)`;

  if (passes) {
    console.log(`✅ [TriggerFilter] PASSED: ${reason}`);
  } else {
    console.log(`🚫 [TriggerFilter] BLOCKED: ${reason}`);
  }

  return {
    passes,
    reason,
    results,
    filtered: !passes,
    matchedCount,
    totalFilters: filters.length,
    logic: filtersLogic
  };
}

/**
 * Get filter type label for display
 */
function getFilterTypeLabel(type) {
  const labels = {
    contains: 'Contém',
    exactly: 'Exatamente',
    starts_with: 'Começa com',
    ends_with: 'Termina com',
    regex: 'Regex',
    keyword_list: 'Lista de palavras',
    equals: 'Igual a',
    not_empty: 'Não vazio'
  };
  return labels[type] || type;
}

module.exports = {
  evaluateFilter,
  evaluateTriggerFilters,
  getFilterTypeLabel
};
