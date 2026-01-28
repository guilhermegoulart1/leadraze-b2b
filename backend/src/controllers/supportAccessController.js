// backend/src/controllers/supportAccessController.js
const supportAccessService = require('../services/supportAccessService');

/**
 * =============================================
 * ENDPOINTS PARA CLIENTE (Admin da conta)
 * =============================================
 */

/**
 * Cria um novo token de acesso de suporte
 * POST /api/support-access/tokens
 */
const createToken = async (req, res) => {
  try {
    const { scope, durationHours, operatorEmail, operatorName, purpose, notes } = req.body;

    // Validações
    if (!scope || !Array.isArray(scope) || scope.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Escopo de permissões é obrigatório'
      });
    }

    // Valida escopos permitidos
    const validScopes = Object.values(supportAccessService.SUPPORT_SCOPES);
    const invalidScopes = scope.filter(s => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Escopos inválidos: ${invalidScopes.join(', ')}`,
        validScopes
      });
    }

    // Valida duração
    const maxHours = supportAccessService.MAX_TOKEN_DURATION_DAYS * 24;
    if (durationHours && (durationHours < 1 || durationHours > maxHours)) {
      return res.status(400).json({
        success: false,
        message: `Duração deve ser entre 1 e ${maxHours} horas (${supportAccessService.MAX_TOKEN_DURATION_DAYS} dias)`
      });
    }

    const token = await supportAccessService.createSupportToken({
      accountId: req.user.account_id,
      createdBy: req.user.id,
      scope,
      durationHours: durationHours || 168, // 7 dias padrão
      operatorEmail,
      operatorName,
      purpose,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Token de acesso criado com sucesso',
      data: {
        id: token.id,
        token: token.fullToken, // ATENÇÃO: Token completo mostrado apenas uma vez!
        tokenPrefix: token.token_prefix,
        scope: token.scope,
        expiresAt: token.expires_at,
        operatorEmail: token.operator_email,
        operatorName: token.operator_name,
        purpose: token.purpose,
        createdAt: token.created_at,
        extensionsRemaining: token.max_extensions - token.extension_count
      },
      warning: 'ATENÇÃO: O token completo só será exibido uma vez. Copie-o agora e envie ao operador de forma segura.'
    });
  } catch (error) {
    console.error('Error creating support token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar token de acesso'
    });
  }
};

/**
 * Lista tokens de acesso da conta
 * GET /api/support-access/tokens
 */
const listTokens = async (req, res) => {
  try {
    const { includeExpired } = req.query;

    const tokens = await supportAccessService.listTokens(
      req.user.account_id,
      includeExpired === 'true'
    );

    res.json({
      success: true,
      data: tokens.map(t => ({
        id: t.id,
        tokenPrefix: t.token_prefix,
        scope: t.scope,
        operatorEmail: t.operator_email,
        operatorName: t.operator_name,
        purpose: t.purpose,
        expiresAt: t.expires_at,
        status: t.status,
        useCount: t.use_count,
        lastUsedAt: t.last_used_at,
        totalSessions: parseInt(t.total_sessions),
        activeSessions: parseInt(t.active_sessions),
        totalActions: parseInt(t.total_actions),
        extensionCount: t.extension_count,
        maxExtensions: t.max_extensions,
        createdAt: t.created_at,
        createdByName: t.created_by_name,
        revokedAt: t.revoked_at,
        revokeReason: t.revoke_reason
      }))
    });
  } catch (error) {
    console.error('Error listing support tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar tokens de acesso'
    });
  }
};

/**
 * Busca detalhes de um token específico
 * GET /api/support-access/tokens/:id
 */
const getToken = async (req, res) => {
  try {
    const { id } = req.params;

    const token = await supportAccessService.getTokenById(id, req.user.account_id);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: token.id,
        tokenPrefix: token.token_prefix,
        scope: token.scope,
        operatorEmail: token.operator_email,
        operatorName: token.operator_name,
        purpose: token.purpose,
        notes: token.notes,
        expiresAt: token.expires_at,
        originalExpiresAt: token.original_expires_at,
        status: token.status,
        useCount: token.use_count,
        maxUses: token.max_uses,
        lastUsedAt: token.last_used_at,
        totalSessions: parseInt(token.total_sessions),
        totalActions: parseInt(token.total_actions),
        extensionCount: token.extension_count,
        maxExtensions: token.max_extensions,
        lastExtendedAt: token.last_extended_at,
        createdAt: token.created_at,
        createdByName: token.created_by_name,
        createdByEmail: token.created_by_email,
        revokedAt: token.revoked_at,
        revokeReason: token.revoke_reason
      }
    });
  } catch (error) {
    console.error('Error getting support token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar token de acesso'
    });
  }
};

/**
 * Estende a validade de um token
 * POST /api/support-access/tokens/:id/extend
 */
const extendToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { additionalHours } = req.body;

    const extended = await supportAccessService.extendToken(
      id,
      req.user.account_id,
      req.user.id,
      additionalHours
    );

    res.json({
      success: true,
      message: 'Token estendido com sucesso',
      data: {
        id: extended.id,
        newExpiresAt: extended.expires_at,
        extensionCount: extended.extension_count
      }
    });
  } catch (error) {
    console.error('Error extending support token:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao estender token'
    });
  }
};

/**
 * Revoga um token de acesso
 * DELETE /api/support-access/tokens/:id
 */
const revokeToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const revoked = await supportAccessService.revokeToken(
      id,
      req.user.account_id,
      req.user.id,
      reason || 'Revogado pelo administrador'
    );

    if (!revoked) {
      return res.status(404).json({
        success: false,
        message: 'Token não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Token revogado com sucesso. Todas as sessões ativas foram encerradas.',
      data: {
        id: revoked.id,
        revokedAt: revoked.revoked_at
      }
    });
  } catch (error) {
    console.error('Error revoking support token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao revogar token de acesso'
    });
  }
};

/**
 * Lista sessões de acesso
 * GET /api/support-access/sessions
 */
const listSessions = async (req, res) => {
  try {
    const { activeOnly } = req.query;

    const sessions = await supportAccessService.listSessions(
      req.user.account_id,
      activeOnly === 'true'
    );

    res.json({
      success: true,
      data: sessions.map(s => ({
        id: s.id,
        tokenId: s.token_id,
        tokenPrefix: s.token_prefix,
        tokenPurpose: s.purpose,
        operatorName: s.operator_name,
        operatorEmail: s.operator_email,
        ipAddress: s.ip_address,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        endReason: s.end_reason,
        isActive: s.is_active,
        actionsCount: parseInt(s.actions_count),
        lastActionAt: s.last_action_at
      }))
    });
  } catch (error) {
    console.error('Error listing support sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar sessões de acesso'
    });
  }
};

/**
 * Encerra uma sessão ativa
 * DELETE /api/support-access/sessions/:id
 */
const endSession = async (req, res) => {
  try {
    const { id } = req.params;

    const ended = await supportAccessService.endSupportSession(id, 'admin_terminated');

    if (!ended) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Sessão encerrada com sucesso',
      data: {
        id: ended.id,
        endedAt: ended.ended_at
      }
    });
  } catch (error) {
    console.error('Error ending support session:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao encerrar sessão'
    });
  }
};

/**
 * Busca o audit log
 * GET /api/support-access/audit
 */
const getAuditLog = async (req, res) => {
  try {
    const {
      sessionId,
      tokenId,
      actionType,
      resourceType,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const result = await supportAccessService.getAuditLog(req.user.account_id, {
      sessionId,
      tokenId,
      actionType,
      resourceType,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: result.logs.map(l => ({
        id: l.id,
        sessionId: l.session_id,
        tokenPrefix: l.token_prefix,
        tokenPurpose: l.purpose,
        operatorName: l.operator_name,
        operatorEmail: l.operator_email,
        actionType: l.action_type,
        resourceType: l.resource_type,
        resourceId: l.resource_id,
        resourceName: l.resource_name,
        actionDetails: l.action_details,
        endpoint: l.endpoint,
        httpMethod: l.http_method,
        responseStatus: l.response_status,
        ipAddress: l.ip_address,
        createdAt: l.created_at
      })),
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total
      }
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico de ações'
    });
  }
};

/**
 * Estatísticas de acesso de suporte
 * GET /api/support-access/stats
 */
const getAccessStats = async (req, res) => {
  try {
    const stats = await supportAccessService.getAccessStats(req.user.account_id);

    res.json({
      success: true,
      data: {
        activeTokens: parseInt(stats.active_tokens),
        activeSessions: parseInt(stats.active_sessions),
        actionsLast30Days: parseInt(stats.actions_last_30_days),
        sessionsLast30Days: parseInt(stats.sessions_last_30_days)
      }
    });
  } catch (error) {
    console.error('Error getting access stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas'
    });
  }
};

/**
 * =============================================
 * ENDPOINTS PARA OPERADOR
 * =============================================
 */

/**
 * Autentica com token de suporte e inicia sessão
 * POST /api/support-access/authenticate
 */
const authenticateWithToken = async (req, res) => {
  try {
    const { token, operatorName, operatorEmail } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token é obrigatório'
      });
    }

    if (!operatorName) {
      return res.status(400).json({
        success: false,
        message: 'Nome do operador é obrigatório'
      });
    }

    // Valida o token
    const tokenRecord = await supportAccessService.validateSupportToken(token);

    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido, expirado ou revogado',
        code: 'SUPPORT_TOKEN_INVALID'
      });
    }

    // Verifica se o token é restrito a um operador específico
    if (tokenRecord.operator_email && operatorEmail !== tokenRecord.operator_email) {
      return res.status(403).json({
        success: false,
        message: 'Este token está restrito a um operador específico',
        code: 'SUPPORT_TOKEN_RESTRICTED'
      });
    }

    // Cria a sessão
    const { session, sessionToken, account, scope } = await supportAccessService.createSupportSession({
      tokenId: tokenRecord.id,
      accountId: tokenRecord.account_id,
      operatorName,
      operatorEmail,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    });

    // Loga início da sessão
    await supportAccessService.logSupportAction({
      sessionId: session.id,
      tokenId: tokenRecord.id,
      accountId: tokenRecord.account_id,
      actionType: 'session_start',
      resourceType: 'session',
      resourceId: session.id,
      actionDetails: { operatorName, operatorEmail },
      endpoint: '/api/support-access/authenticate',
      httpMethod: 'POST',
      responseStatus: 200,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Sessão de suporte iniciada com sucesso',
      data: {
        sessionToken, // JWT para usar nas requisições seguintes
        sessionId: session.id,
        account: {
          id: tokenRecord.account_id,
          name: account.name,
          slug: account.slug
        },
        scope,
        purpose: tokenRecord.purpose,
        expiresAt: tokenRecord.expires_at,
        sessionStartedAt: session.started_at
      }
    });
  } catch (error) {
    console.error('Error authenticating support token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao autenticar token de suporte'
    });
  }
};

/**
 * Busca informações da sessão atual
 * GET /api/support-access/session/info
 */
const getSessionInfo = async (req, res) => {
  try {
    if (!req.supportSession) {
      return res.status(401).json({
        success: false,
        message: 'Sessão de suporte não autenticada'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: req.supportSession.sessionId,
        accountId: req.supportSession.accountId,
        accountName: req.supportSession.accountName,
        operatorName: req.supportSession.operatorName,
        scope: req.supportSession.scope,
        startedAt: req.supportSession.startedAt,
        isImpersonating: true
      }
    });
  } catch (error) {
    console.error('Error getting session info:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar informações da sessão'
    });
  }
};

/**
 * Encerra a própria sessão de suporte
 * POST /api/support-access/session/end
 */
const endOwnSession = async (req, res) => {
  try {
    if (!req.supportSession) {
      return res.status(401).json({
        success: false,
        message: 'Sessão de suporte não autenticada'
      });
    }

    // Loga fim da sessão
    await supportAccessService.logSupportAction({
      sessionId: req.supportSession.sessionId,
      tokenId: req.supportSession.tokenId,
      accountId: req.supportSession.accountId,
      actionType: 'session_end',
      resourceType: 'session',
      resourceId: req.supportSession.sessionId,
      actionDetails: { reason: 'operator_logout' },
      endpoint: '/api/support-access/session/end',
      httpMethod: 'POST',
      responseStatus: 200,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent']
    });

    const ended = await supportAccessService.endSupportSession(
      req.supportSession.sessionId,
      'manual'
    );

    res.json({
      success: true,
      message: 'Sessão encerrada com sucesso',
      data: {
        sessionId: ended.id,
        endedAt: ended.ended_at
      }
    });
  } catch (error) {
    console.error('Error ending own session:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao encerrar sessão'
    });
  }
};

/**
 * Lista escopos disponíveis
 * GET /api/support-access/scopes
 */
const listAvailableScopes = async (req, res) => {
  const scopes = [
    {
      id: 'read',
      name: 'Leitura',
      description: 'Visualizar dados (agentes, campanhas, conversas)'
    },
    {
      id: 'configure_agents',
      name: 'Configurar Agentes',
      description: 'Criar e editar agentes de IA'
    },
    {
      id: 'configure_campaigns',
      name: 'Configurar Campanhas',
      description: 'Criar e editar campanhas'
    },
    {
      id: 'configure_workflows',
      name: 'Configurar Workflows',
      description: 'Criar e editar workflows de automação'
    },
    {
      id: 'view_conversations',
      name: 'Ver Conversas',
      description: 'Visualizar histórico de conversas'
    },
    {
      id: 'manage_contacts',
      name: 'Gerenciar Contatos',
      description: 'Criar, editar e gerenciar contatos'
    },
    {
      id: 'manage_leads',
      name: 'Gerenciar Leads',
      description: 'Criar, editar e gerenciar leads'
    },
    {
      id: 'full_admin',
      name: 'Administrador Completo',
      description: 'Todas as permissões (exceto billing e usuários)'
    }
  ];

  res.json({
    success: true,
    data: scopes
  });
};

module.exports = {
  // Endpoints para cliente (admin)
  createToken,
  listTokens,
  getToken,
  extendToken,
  revokeToken,
  listSessions,
  endSession,
  getAuditLog,
  getAccessStats,
  listAvailableScopes,

  // Endpoints para operador
  authenticateWithToken,
  getSessionInfo,
  endOwnSession
};
