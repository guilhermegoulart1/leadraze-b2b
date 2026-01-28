// backend/src/middleware/supportAccessAuth.js
const supportAccessService = require('../services/supportAccessService');

/**
 * Middleware para autenticar sessão de suporte via JWT
 * Usado em rotas que requerem sessão ativa de suporte
 */
const authenticateSupportSession = async (req, res, next) => {
  try {
    // Extrai token de sessão do header Authorization ou X-Support-Session
    const authHeader = req.headers['authorization'];
    const supportSessionHeader = req.headers['x-support-session'];

    const sessionToken = supportSessionHeader ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Token de sessão de suporte não fornecido',
        code: 'SUPPORT_SESSION_REQUIRED'
      });
    }

    // Valida a sessão
    const session = await supportAccessService.validateSupportSession(sessionToken);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Sessão de suporte inválida ou expirada',
        code: 'SUPPORT_SESSION_INVALID'
      });
    }

    // Popula req.supportSession com dados da sessão
    req.supportSession = {
      sessionId: session.id,
      tokenId: session.token_id,
      accountId: session.account_id,
      accountName: session.account_name,
      operatorName: session.operator_name,
      operatorEmail: session.operator_email,
      scope: session.scope,
      startedAt: session.started_at,
      isImpersonating: true
    };

    // Também popula req.user para compatibilidade com middlewares existentes
    // O operador age como se fosse um admin da conta, mas com escopo limitado
    req.user = {
      id: null, // Não há usuário real associado
      userId: null,
      email: session.operator_email || `support-${session.operator_identifier}@getraze.co`,
      name: session.operator_name,
      role: 'support', // Role especial para suporte
      account_id: session.account_id,
      accountId: session.account_id,
      must_change_password: false,
      sectors: [],
      // Flags de impersonação
      isImpersonating: true,
      impersonationSessionId: session.id,
      impersonationTokenId: session.token_id,
      impersonationScope: session.scope,
      originalOperator: {
        name: session.operator_name,
        email: session.operator_email
      }
    };

    next();
  } catch (error) {
    console.error('Error authenticating support session:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao validar sessão de suporte'
    });
  }
};

/**
 * Middleware para verificar se a sessão tem um escopo específico
 */
const checkSupportScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.supportSession) {
      return res.status(401).json({
        success: false,
        message: 'Sessão de suporte não autenticada',
        code: 'SUPPORT_SESSION_REQUIRED'
      });
    }

    const hasRequiredScope = supportAccessService.hasScope(
      req.supportSession.scope,
      requiredScope
    );

    if (!hasRequiredScope) {
      return res.status(403).json({
        success: false,
        message: `Permissão insuficiente. Escopo necessário: ${requiredScope}`,
        code: 'SUPPORT_SCOPE_INSUFFICIENT',
        requiredScope
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se tem qualquer um dos escopos
 */
const checkAnySupportScope = (requiredScopes) => {
  return (req, res, next) => {
    if (!req.supportSession) {
      return res.status(401).json({
        success: false,
        message: 'Sessão de suporte não autenticada',
        code: 'SUPPORT_SESSION_REQUIRED'
      });
    }

    const hasAnyScope = requiredScopes.some(scope =>
      supportAccessService.hasScope(req.supportSession.scope, scope)
    );

    if (!hasAnyScope) {
      return res.status(403).json({
        success: false,
        message: `Permissão insuficiente. Um dos escopos necessários: ${requiredScopes.join(', ')}`,
        code: 'SUPPORT_SCOPE_INSUFFICIENT',
        requiredScopes
      });
    }

    next();
  };
};

/**
 * Middleware para logging automático de ações de suporte
 * Usa após authenticateSupportSession e antes do handler da rota
 */
const auditSupportAction = (actionType, resourceType = null) => {
  return async (req, res, next) => {
    if (!req.supportSession) {
      return next();
    }

    // Guarda a função original do res.json para interceptar a resposta
    const originalJson = res.json.bind(res);
    let responseStatus = null;
    let resourceId = null;
    let resourceName = null;

    res.json = function(data) {
      responseStatus = res.statusCode;

      // Tenta extrair ID e nome do recurso da resposta
      if (data && typeof data === 'object') {
        resourceId = data.id || data.data?.id || req.params.id;
        resourceName = data.name || data.data?.name;
      }

      // Log da ação após a resposta
      setImmediate(async () => {
        try {
          await supportAccessService.logSupportAction({
            sessionId: req.supportSession.sessionId,
            tokenId: req.supportSession.tokenId,
            accountId: req.supportSession.accountId,
            actionType,
            resourceType: resourceType || inferResourceType(req.path),
            resourceId,
            resourceName,
            actionDetails: {
              params: req.params,
              query: sanitizeForLog(req.query)
            },
            endpoint: req.originalUrl,
            httpMethod: req.method,
            requestBodySummary: sanitizeForLog(req.body),
            responseStatus,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
          });
        } catch (error) {
          console.error('Error logging support action:', error);
        }
      });

      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware para impedir ações proibidas para suporte
 */
const blockForbiddenActions = (req, res, next) => {
  if (!req.supportSession) {
    return next();
  }

  // Rotas bloqueadas para acesso de suporte
  const forbiddenPatterns = [
    /\/users$/,           // Gerenciar usuários
    /\/users\/\w+$/,      // Modificar usuário específico
    /\/billing/,          // Qualquer coisa de billing
    /\/subscription/,     // Assinatura
    /\/payment/,          // Pagamentos
    /\/support-access\/tokens$/, // Criar novos tokens de suporte
    /\/api-keys/,         // API keys
  ];

  const isForbidden = forbiddenPatterns.some(pattern => pattern.test(req.path));
  const isModifyingAction = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (isForbidden && isModifyingAction) {
    return res.status(403).json({
      success: false,
      message: 'Esta ação não é permitida para acesso de suporte',
      code: 'SUPPORT_ACTION_FORBIDDEN'
    });
  }

  next();
};

/**
 * Helper para inferir tipo de recurso da URL
 */
const inferResourceType = (path) => {
  const patterns = {
    '/agents': 'ai_agents',
    '/campaigns': 'campaigns',
    '/workflows': 'workflows',
    '/conversations': 'conversations',
    '/leads': 'leads',
    '/contacts': 'contacts',
    '/knowledge': 'knowledge_base',
    '/templates': 'templates'
  };

  for (const [pattern, type] of Object.entries(patterns)) {
    if (path.includes(pattern)) {
      return type;
    }
  }

  return 'other';
};

/**
 * Helper para sanitizar dados para log (remove dados sensíveis)
 */
const sanitizeForLog = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password', 'senha', 'token', 'secret', 'api_key', 'apiKey',
    'credit_card', 'creditCard', 'cvv', 'card_number', 'cardNumber'
  ];

  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Limita tamanho do body logado
  const stringified = JSON.stringify(sanitized);
  if (stringified.length > 5000) {
    return { _truncated: true, _size: stringified.length };
  }

  return sanitized;
};

/**
 * Middleware combinado para rotas de suporte
 * Autentica + verifica escopo + bloqueia ações proibidas + loga
 */
const supportAccessGuard = (requiredScope, actionType) => {
  return [
    authenticateSupportSession,
    checkSupportScope(requiredScope),
    blockForbiddenActions,
    auditSupportAction(actionType)
  ];
};

module.exports = {
  authenticateSupportSession,
  checkSupportScope,
  checkAnySupportScope,
  auditSupportAction,
  blockForbiddenActions,
  supportAccessGuard
};
