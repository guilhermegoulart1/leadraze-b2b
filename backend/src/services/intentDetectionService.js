// backend/src/services/intentDetectionService.js

// Palavras-chave que indicam interesse POSITIVO
const POSITIVE_KEYWORDS = [
  'interessante', 'legal', 'gostaria', 'quero', 'preciso', 'quanto custa',
  'preço', 'valor', 'investimento', 'orçamento', 'proposta',
  'reunião', 'conversar', 'agendar', 'disponível', 'pode ser',
  'me passa', 'manda', 'envia', 'conta mais', 'detalhe',
  'exatamente', 'perfeito', 'ideal', 'procurando', 'buscando'
];

// Palavras-chave que indicam DESINTERESSE
const NEGATIVE_KEYWORDS = [
  'não tenho interesse', 'não preciso', 'já tenho', 'já temos',
  'não é prioridade', 'talvez depois', 'mais tarde', 'futuramente',
  'não está nos planos', 'não quero', 'sem interesse',
  'obrigado mas não', 'agradeço mas', 'não se encaixa'
];

// Palavras neutras (agradecimentos genéricos)
const NEUTRAL_KEYWORDS = [
  'obrigado', 'valeu', 'ok', 'entendi', 'certo',
  'guardar contato', 'anotar', 'depois vejo'
];

/**
 * Analisa mensagem do lead e retorna nível de intenção
 * @param {string} message - Mensagem do lead
 * @returns {Object} - { intent: 'positiva'|'neutra'|'negativa', confidence: 0-100, reasons: [] }
 */
function detectIntent(message) {
  if (!message || typeof message !== 'string') {
    return { intent: 'neutra', confidence: 0, reasons: [] };
  }

  const lowerMessage = message.toLowerCase().trim();
  const reasons = [];
  let score = 0;

  // Verifica palavras negativas primeiro (maior peso)
  const negativeMatches = NEGATIVE_KEYWORDS.filter(kw => lowerMessage.includes(kw));
  if (negativeMatches.length > 0) {
    score -= negativeMatches.length * 30;
    reasons.push(...negativeMatches.map(kw => `Palavra negativa: "${kw}"`));
  }

  // Verifica palavras positivas
  const positiveMatches = POSITIVE_KEYWORDS.filter(kw => lowerMessage.includes(kw));
  if (positiveMatches.length > 0) {
    score += positiveMatches.length * 20;
    reasons.push(...positiveMatches.map(kw => `Palavra positiva: "${kw}"`));
  }

  // Verifica palavras neutras
  const neutralMatches = NEUTRAL_KEYWORDS.filter(kw => lowerMessage.includes(kw));
  if (neutralMatches.length > 0) {
    reasons.push(...neutralMatches.map(kw => `Palavra neutra: "${kw}"`));
  }

  // Características da mensagem
  if (message.includes('?')) {
    score += 15;
    reasons.push('Fez pergunta (demonstra interesse)');
  }

  if (message.length > 100) {
    score += 10;
    reasons.push('Mensagem longa (engajamento)');
  }

  if (message.length < 10 && neutralMatches.length > 0) {
    score -= 10;
    reasons.push('Resposta muito curta');
  }

  // Determinar intenção
  let intent, confidence;

  if (score >= 40) {
    intent = 'positiva';
    confidence = Math.min(score, 100);
  } else if (score <= -30) {
    intent = 'negativa';
    confidence = Math.min(Math.abs(score), 100);
  } else {
    intent = 'neutra';
    confidence = 50;
  }

  return {
    intent,
    confidence,
    score,
    reasons,
    message_length: message.length
  };
}

/**
 * Determina próxima ação baseado na intenção
 * @param {Object} detection - Resultado de detectIntent()
 * @param {Object} agent - Agente de IA
 * @returns {Object} - { action, new_status, should_send_message, message_template }
 */
function determineNextAction(detection, agent) {
  const { intent, confidence } = detection;

  if (intent === 'positiva' && confidence >= 70) {
    // Alta intenção positiva
    if (agent.auto_schedule) {
      return {
        action: 'offer_scheduling',
        new_status: 'scheduled',
        should_send_message: true,
        message_template: `Ótimo! Que tal agendar uma conversa rápida? ${agent.scheduling_link || '[link de agendamento]'}`
      };
    } else {
      return {
        action: 'move_to_qualifying',
        new_status: 'qualifying',
        should_send_message: false
      };
    }
  }

  if (intent === 'positiva' && confidence >= 40) {
    // Intenção positiva moderada
    return {
      action: 'continue_conversation',
      new_status: 'qualifying',
      should_send_message: false
    };
  }

  if (intent === 'negativa') {
    // Sem interesse
    return {
      action: 'mark_as_lost',
      new_status: 'lost',
      lost_reason: 'Sem interesse detectado pela IA',
      should_send_message: false
    };
  }

  // Neutro - continuar conversando
  return {
    action: 'continue_conversation',
    new_status: null, // mantém status atual
    should_send_message: false
  };
}

module.exports = {
  detectIntent,
  determineNextAction,
  POSITIVE_KEYWORDS,
  NEGATIVE_KEYWORDS,
  NEUTRAL_KEYWORDS
};
