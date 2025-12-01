// backend/src/services/accountHealthService.js
// Serviço de inteligência para cálculo de health score e limites recomendados

const db = require('../config/database');

// ================================
// LIMITES RECOMENDADOS POR TIPO
// ================================

const ACCOUNT_TYPE_LIMITS = {
  free: {
    safe: 28,
    moderate: 35,
    aggressive: 42,
    max_recommended: 50
  },
  premium: {
    safe: 45,
    moderate: 55,
    aggressive: 70,
    max_recommended: 80
  },
  sales_navigator: {
    safe: 70,
    moderate: 90,
    aggressive: 110,
    max_recommended: 120
  },
  recruiter: {
    safe: 110,
    moderate: 130,
    aggressive: 160,
    max_recommended: 180
  }
};

// ================================
// DETECTAR TIPO DE CONTA
// ================================

/**
 * Detecta automaticamente o tipo de conta baseado nos premium_features
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<string>} Tipo: 'free', 'premium', 'sales_navigator', 'recruiter'
 */
async function detectAccountType(linkedinAccountId) {
  try {
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    // Parse premium_features
    let premiumFeatures = {};
    if (account.premium_features) {
      try {
        premiumFeatures = typeof account.premium_features === 'string'
          ? JSON.parse(account.premium_features)
          : account.premium_features;
      } catch (e) {
        console.warn('⚠️ Erro ao parsear premium_features:', e);
      }
    }

    // Verificar tipo baseado nas features
    if (premiumFeatures.recruiter !== null && premiumFeatures.recruiter !== undefined) {
      return 'recruiter';
    }

    if (premiumFeatures.sales_navigator !== null && premiumFeatures.sales_navigator !== undefined) {
      return 'sales_navigator';
    }

    if (premiumFeatures.premium === true) {
      return 'premium';
    }

    return 'free';

  } catch (error) {
    console.error('❌ Erro ao detectar tipo de conta:', error);
    return 'free'; // Fallback para free
  }
}

// ================================
// CALCULAR IDADE DA CONTA
// ================================

/**
 * Calcula quantos dias desde que a conta foi conectada
 * @param {Date} connectedAt - Data de conexão
 * @returns {number} Dias desde conexão
 */
function getAccountAge(connectedAt) {
  const now = new Date();
  const connected = new Date(connectedAt);
  const diffTime = Math.abs(now - connected);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ================================
// CALCULAR TAXA DE ACEITAÇÃO
// ================================

/**
 * Calcula a taxa de aceitação de convites
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {number} days - Número de dias a analisar (padrão: 30)
 * @returns {Promise<Object>} { sent, accepted, rate }
 */
async function getAcceptanceRate(linkedinAccountId, days = 30) {
  try {
    const result = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('sent', 'accepted')) as sent,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND sent_at >= NOW() - INTERVAL '${days} days'`,
      [linkedinAccountId]
    );

    const sent = parseInt(result.rows[0]?.sent || 0);
    const accepted = parseInt(result.rows[0]?.accepted || 0);
    const rate = sent > 0 ? (accepted / sent) * 100 : 0;

    return {
      sent,
      accepted,
      rate: parseFloat(rate.toFixed(2))
    };

  } catch (error) {
    console.error('❌ Erro ao calcular taxa de aceitação:', error);
    return { sent: 0, accepted: 0, rate: 0 };
  }
}

// ================================
// CALCULAR TEMPO MÉDIO DE ACEITAÇÃO
// ================================

/**
 * Calcula o tempo médio entre envio e aceitação de convites
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {number} days - Número de dias a analisar
 * @returns {Promise<number>} Tempo médio em horas (ou null)
 */
async function getAverageResponseTime(linkedinAccountId, days = 30) {
  try {
    const result = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (accepted_at - sent_at)) / 3600) as avg_hours
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND accepted_at >= NOW() - INTERVAL '${days} days'
         AND status = 'accepted'
         AND accepted_at IS NOT NULL`,
      [linkedinAccountId]
    );

    const avgHours = result.rows[0]?.avg_hours;
    return avgHours ? parseFloat(avgHours.toFixed(2)) : null;

  } catch (error) {
    console.error('❌ Erro ao calcular tempo médio:', error);
    return null;
  }
}

// ================================
// CALCULAR HEALTH SCORE
// ================================

/**
 * Calcula o health score da conta (0-100)
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<Object>} { score, level, factors }
 */
async function calculateHealthScore(linkedinAccountId) {
  try {
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    let score = 100;
    const factors = [];

    // 1. Tempo de uso no sistema (período de aquecimento)
    const accountAge = getAccountAge(account.connected_at);

    if (accountAge < 30) {
      score -= 20;
      factors.push({ factor: 'account_age', impact: -20, message: 'Recém-conectada ao sistema (<30 dias) - em período de aquecimento' });
    } else if (accountAge < 90) {
      score -= 10;
      factors.push({ factor: 'account_age', impact: -10, message: 'Uso recente no sistema (<90 dias) - ainda em aquecimento' });
    } else if (accountAge > 365) {
      score += 5;
      factors.push({ factor: 'account_age', impact: +5, message: 'Uso consolidado no sistema (+1 ano)' });
    }

    // 2. Taxa de aceitação (últimos 30 dias)
    const acceptance30d = await getAcceptanceRate(linkedinAccountId, 30);

    if (acceptance30d.sent > 0) {
      if (acceptance30d.rate < 15) {
        score -= 30;
        factors.push({
          factor: 'acceptance_rate_30d',
          impact: -30,
          message: `Taxa de aceitação muito baixa (${acceptance30d.rate}%)`
        });
      } else if (acceptance30d.rate < 25) {
        score -= 15;
        factors.push({
          factor: 'acceptance_rate_30d',
          impact: -15,
          message: `Taxa de aceitação baixa (${acceptance30d.rate}%)`
        });
      } else if (acceptance30d.rate < 35) {
        score -= 5;
        factors.push({
          factor: 'acceptance_rate_30d',
          impact: -5,
          message: `Taxa de aceitação moderada (${acceptance30d.rate}%)`
        });
      } else if (acceptance30d.rate >= 50) {
        score += 10;
        factors.push({
          factor: 'acceptance_rate_30d',
          impact: +10,
          message: `Taxa de aceitação excelente (${acceptance30d.rate}%)`
        });
      }
    }

    // 3. Volume de envios (últimos 30 dias)
    if (acceptance30d.sent > 800) {
      score -= 20;
      factors.push({
        factor: 'high_volume',
        impact: -20,
        message: `Volume muito alto de convites (${acceptance30d.sent} em 30 dias)`
      });
    } else if (acceptance30d.sent > 500) {
      score -= 10;
      factors.push({
        factor: 'high_volume',
        impact: -10,
        message: `Volume alto de convites (${acceptance30d.sent} em 30 dias)`
      });
    }

    // 4. Taxa de aceitação (últimos 7 dias) - indicador recente
    const acceptance7d = await getAcceptanceRate(linkedinAccountId, 7);

    if (acceptance7d.sent > 0 && acceptance7d.rate < 15) {
      score -= 15;
      factors.push({
        factor: 'acceptance_rate_7d',
        impact: -15,
        message: `Taxa recente muito baixa (${acceptance7d.rate}% nos últimos 7 dias)`
      });
    }

    // 5. Status da conta
    if (account.status !== 'active') {
      score -= 50;
      factors.push({
        factor: 'account_status',
        impact: -50,
        message: 'Conta não está ativa'
      });
    }

    // Garantir que está entre 0 e 100
    score = Math.max(0, Math.min(100, score));

    // Determinar nível de risco
    let level = 'low';
    if (score < 50) {
      level = 'high';
    } else if (score < 70) {
      level = 'medium';
    }

    return {
      score: Math.round(score),
      level,
      factors,
      metrics: {
        account_age_days: accountAge,
        acceptance_rate_7d: acceptance7d.rate,
        acceptance_rate_30d: acceptance30d.rate,
        invites_sent_30d: acceptance30d.sent,
        invites_accepted_30d: acceptance30d.accepted
      }
    };

  } catch (error) {
    console.error('❌ Erro ao calcular health score:', error);
    return {
      score: 50,
      level: 'unknown',
      factors: [{ factor: 'error', impact: 0, message: 'Erro ao calcular score' }],
      metrics: {}
    };
  }
}

// ================================
// CALCULAR LIMITE RECOMENDADO
// ================================

/**
 * Calcula o limite diário recomendado baseado em múltiplos fatores
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @param {string} strategy - 'safe', 'moderate', 'aggressive'
 * @returns {Promise<Object>} { recommended, min, max, factors }
 */
async function getRecommendedLimit(linkedinAccountId, strategy = 'moderate') {
  try {
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    // Detectar tipo de conta
    const accountType = await detectAccountType(linkedinAccountId);

    // Limite base
    let baseLimit = ACCOUNT_TYPE_LIMITS[accountType][strategy];
    const maxRecommended = ACCOUNT_TYPE_LIMITS[accountType].max_recommended;

    const adjustmentFactors = [];

    // Calcular health score
    const healthData = await calculateHealthScore(linkedinAccountId);

    // Ajustar baseado no health score
    if (healthData.score < 50) {
      baseLimit *= 0.5; // -50%
      adjustmentFactors.push({
        factor: 'health_score',
        multiplier: 0.5,
        message: `Health score baixo (${healthData.score}/100): reduzido em 50%`
      });
    } else if (healthData.score < 70) {
      baseLimit *= 0.7; // -30%
      adjustmentFactors.push({
        factor: 'health_score',
        multiplier: 0.7,
        message: `Health score médio (${healthData.score}/100): reduzido em 30%`
      });
    } else if (healthData.score >= 90) {
      baseLimit *= 1.1; // +10%
      adjustmentFactors.push({
        factor: 'health_score',
        multiplier: 1.1,
        message: `Health score excelente (${healthData.score}/100): aumentado em 10%`
      });
    }

    // Ajustar baseado na idade da conta
    const accountAge = getAccountAge(account.connected_at);

    if (accountAge < 30) {
      baseLimit *= 0.5; // -50%
      adjustmentFactors.push({
        factor: 'account_age',
        multiplier: 0.5,
        message: `Conta nova (${accountAge} dias): reduzido em 50%`
      });
    } else if (accountAge < 90) {
      baseLimit *= 0.7; // -30%
      adjustmentFactors.push({
        factor: 'account_age',
        multiplier: 0.7,
        message: `Conta recente (${accountAge} dias): reduzido em 30%`
      });
    } else if (accountAge > 365) {
      baseLimit *= 1.2; // +20%
      adjustmentFactors.push({
        factor: 'account_age',
        multiplier: 1.2,
        message: `Conta antiga (${accountAge} dias): aumentado em 20%`
      });
    }

    // Arredondar e garantir limites mínimos/máximos
    const recommendedLimit = Math.round(baseLimit);
    const minLimit = Math.max(10, Math.round(baseLimit * 0.5));
    const maxLimit = Math.min(maxRecommended, Math.round(baseLimit * 1.5));

    return {
      recommended: recommendedLimit,
      min: minLimit,
      max: maxLimit,
      account_type: accountType,
      strategy,
      health_score: healthData.score,
      adjustment_factors: adjustmentFactors,
      warning: recommendedLimit < 20 ? 'Limite muito baixo. Verifique saúde da conta.' : null
    };

  } catch (error) {
    console.error('❌ Erro ao calcular limite recomendado:', error);
    return {
      recommended: 25,
      min: 10,
      max: 50,
      account_type: 'free',
      strategy: 'safe',
      adjustment_factors: [],
      error: error.message
    };
  }
}

// ================================
// VERIFICAR PADRÕES DE RISCO
// ================================

/**
 * Analisa padrões de uso e identifica riscos potenciais
 * @param {string} linkedinAccountId - ID da conta LinkedIn
 * @returns {Promise<Array>} Lista de riscos detectados
 */
async function checkRiskPatterns(linkedinAccountId) {
  const risks = [];

  try {
    const account = await db.findOne('linkedin_accounts', { id: linkedinAccountId });

    if (!account) {
      throw new Error('LinkedIn account not found');
    }

    // 1. Taxa de aceitação muito baixa (últimos 7 dias)
    const acceptance7d = await getAcceptanceRate(linkedinAccountId, 7);

    if (acceptance7d.sent >= 20 && acceptance7d.rate < 15) {
      risks.push({
        level: 'high',
        category: 'acceptance_rate',
        message: `Taxa de aceitação crítica: ${acceptance7d.rate}% (últimos 7 dias)`,
        recommendation: 'Revise sua mensagem de convite e perfil de targeting. Considere pausar envios.'
      });
    } else if (acceptance7d.sent >= 20 && acceptance7d.rate < 25) {
      risks.push({
        level: 'medium',
        category: 'acceptance_rate',
        message: `Taxa de aceitação baixa: ${acceptance7d.rate}% (últimos 7 dias)`,
        recommendation: 'Melhore a qualidade dos leads e mensagem de convite.'
      });
    }

    // 2. Volume muito alto hoje
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM linkedin_invite_logs
       WHERE linkedin_account_id = $1
         AND sent_at >= CURRENT_DATE
         AND status IN ('sent', 'accepted')`,
      [linkedinAccountId]
    );

    const todayCount = parseInt(result.rows[0]?.count || 0);
    const dailyLimit = account.daily_limit || 50;

    if (todayCount >= dailyLimit * 0.9) {
      risks.push({
        level: 'medium',
        category: 'daily_limit',
        message: `Próximo do limite diário: ${todayCount}/${dailyLimit}`,
        recommendation: 'Você está próximo do limite. Aguarde até amanhã para enviar mais.'
      });
    }

    // 3. Limite muito acima do recomendado
    const recommended = await getRecommendedLimit(linkedinAccountId, 'moderate');

    if (dailyLimit > recommended.max) {
      risks.push({
        level: 'high',
        category: 'excessive_limit',
        message: `Limite configurado (${dailyLimit}) está muito acima do recomendado (${recommended.recommended})`,
        recommendation: `Reduza para ${recommended.recommended} para evitar restrições do LinkedIn.`
      });
    } else if (dailyLimit > recommended.recommended * 1.3) {
      risks.push({
        level: 'medium',
        category: 'high_limit',
        message: `Limite configurado (${dailyLimit}) está acima do recomendado (${recommended.recommended})`,
        recommendation: 'Monitore taxa de aceitação de perto.'
      });
    }

    // 4. Conta recém-conectada com limite alto (aquecimento necessário)
    const accountAge = getAccountAge(account.connected_at);

    if (accountAge < 30 && dailyLimit > 30) {
      risks.push({
        level: 'high',
        category: 'new_account_high_limit',
        message: `Recém-conectada ao sistema (${accountAge} dias) com limite alto (${dailyLimit})`,
        recommendation: 'Contas em período de aquecimento devem começar com 15-20 convites/dia para estabelecer padrão seguro.'
      });
    }

    // 5. Health score baixo
    const healthData = await calculateHealthScore(linkedinAccountId);

    if (healthData.score < 50) {
      risks.push({
        level: 'high',
        category: 'low_health_score',
        message: `Health Score crítico: ${healthData.score}/100`,
        recommendation: 'Pause envios e revise estratégia. Risco de restrição do LinkedIn.'
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar padrões de risco:', error);
  }

  return risks;
}

// ================================
// LOG DE ALTERAÇÃO DE LIMITE
// ================================

/**
 * Registra alteração de limite no histórico
 * @param {Object} data - Dados da alteração
 */
async function logLimitChange(data) {
  try {
    const {
      linkedinAccountId,
      oldLimit,
      newLimit,
      userId,
      isManualOverride = false,
      reason = null
    } = data;

    // Calcular dados para contexto
    const healthData = await calculateHealthScore(linkedinAccountId);
    const recommended = await getRecommendedLimit(linkedinAccountId);
    const acceptance = await getAcceptanceRate(linkedinAccountId);

    // Determinar nível de risco da mudança
    let riskLevel = 'low';
    if (newLimit > recommended.max) {
      riskLevel = 'high';
    } else if (newLimit > recommended.recommended * 1.2) {
      riskLevel = 'medium';
    }

    await db.insert('linkedin_account_limit_changes', {
      linkedin_account_id: linkedinAccountId,
      old_limit: oldLimit,
      new_limit: newLimit,
      recommended_limit: recommended.recommended,
      changed_by: userId || null,
      is_manual_override: isManualOverride,
      reason,
      risk_level: riskLevel,
      account_health_score: healthData.score,
      acceptance_rate: acceptance.rate
    });

    console.log(`✅ Limite alterado: ${oldLimit} → ${newLimit} (Risco: ${riskLevel})`);

  } catch (error) {
    console.error('❌ Erro ao registrar mudança de limite:', error);
  }
}

// ================================
// EXPORTS
// ================================

module.exports = {
  detectAccountType,
  getAccountAge,
  getAcceptanceRate,
  getAverageResponseTime,
  calculateHealthScore,
  getRecommendedLimit,
  checkRiskPatterns,
  logLimitChange,
  ACCOUNT_TYPE_LIMITS
};
