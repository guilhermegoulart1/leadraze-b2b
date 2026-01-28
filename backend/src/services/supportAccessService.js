// backend/src/services/supportAccessService.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Escopos disponíveis para tokens de suporte
const SUPPORT_SCOPES = {
  READ: 'read',
  CONFIGURE_AGENTS: 'configure_agents',
  CONFIGURE_CAMPAIGNS: 'configure_campaigns',
  CONFIGURE_WORKFLOWS: 'configure_workflows',
  VIEW_CONVERSATIONS: 'view_conversations',
  MANAGE_CONTACTS: 'manage_contacts',
  MANAGE_LEADS: 'manage_leads',
  FULL_ADMIN: 'full_admin'
};

// Duração máxima de tokens (14 dias)
const MAX_TOKEN_DURATION_DAYS = 14;

// Duração de extensão (7 dias)
const EXTENSION_DURATION_DAYS = 7;

// Máximo de extensões permitidas
const MAX_EXTENSIONS = 3;

/**
 * Gera um novo token de suporte
 * Retorna o token completo (apenas uma vez) e o hash para armazenamento
 */
const generateSupportToken = () => {
  // Gera 32 bytes aleatórios (256 bits)
  const randomBytes = crypto.randomBytes(32);

  // Cria o token com prefixo: sat_<base64 encoded random bytes>
  const tokenBody = randomBytes.toString('base64url');
  const fullToken = `sat_${tokenBody}`;

  // Cria prefixo para identificação visual (primeiros 12 chars)
  const tokenPrefix = fullToken.substring(0, 12);

  // Hash do token com SHA-256 para armazenamento
  const tokenHash = crypto.createHash('sha256').update(fullToken).digest('hex');

  return {
    fullToken,     // Retornar ao usuário APENAS UMA VEZ
    tokenPrefix,   // Armazenar para identificação
    tokenHash      // Armazenar no banco de dados
  };
};

/**
 * Hash de um token para comparação
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Calcula data de expiração baseada na duração
 */
const calculateExpiresAt = (durationHours) => {
  const maxHours = MAX_TOKEN_DURATION_DAYS * 24;
  const hours = Math.min(durationHours, maxHours);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt;
};

/**
 * Cria um novo token de acesso de suporte
 */
const createSupportToken = async ({
  accountId,
  createdBy,
  scope = ['read', 'configure_agents'],
  durationHours = 168, // 7 dias padrão
  operatorEmail,
  operatorName,
  purpose,
  notes
}) => {
  const { fullToken, tokenPrefix, tokenHash } = generateSupportToken();
  const expiresAt = calculateExpiresAt(durationHours);

  const result = await db.query(
    `INSERT INTO support_access_tokens
     (account_id, created_by, token_hash, token_prefix, scope, expires_at, original_expires_at,
      operator_email, operator_name, purpose, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10)
     RETURNING id, account_id, token_prefix, scope, expires_at, operator_email, operator_name,
               purpose, notes, is_active, created_at, extension_count, max_extensions`,
    [accountId, createdBy, tokenHash, tokenPrefix, JSON.stringify(scope), expiresAt,
     operatorEmail, operatorName, purpose, notes]
  );

  return {
    ...result.rows[0],
    fullToken // Retorna o token completo apenas na criação
  };
};

/**
 * Valida um token de suporte
 * Retorna os dados do token se válido, null se inválido
 */
const validateSupportToken = async (token) => {
  if (!token || !token.startsWith('sat_')) {
    return null;
  }

  const tokenHash = hashToken(token);

  const result = await db.query(
    `SELECT t.*, a.name as account_name, a.is_active as account_active
     FROM support_access_tokens t
     JOIN accounts a ON t.account_id = a.id
     WHERE t.token_hash = $1
       AND t.is_active = true
       AND t.expires_at > NOW()
       AND t.revoked_at IS NULL`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenRecord = result.rows[0];

  // Verifica se conta está ativa
  if (!tokenRecord.account_active) {
    return null;
  }

  // Verifica limite de usos
  if (tokenRecord.max_uses !== null && tokenRecord.use_count >= tokenRecord.max_uses) {
    return null;
  }

  return tokenRecord;
};

/**
 * Atualiza o uso do token
 */
const updateTokenUsage = async (tokenId) => {
  await db.query(
    `UPDATE support_access_tokens
     SET use_count = use_count + 1,
         last_used_at = NOW()
     WHERE id = $1`,
    [tokenId]
  );
};

/**
 * Cria uma sessão de suporte
 * Retorna um JWT para a sessão
 */
const createSupportSession = async ({
  tokenId,
  accountId,
  operatorName,
  operatorEmail,
  ipAddress,
  userAgent
}) => {
  // Gera identificador único para o operador
  const operatorIdentifier = crypto.createHash('sha256')
    .update(`${operatorName}-${operatorEmail || ''}-${Date.now()}`)
    .digest('hex')
    .substring(0, 16);

  // Gera JWT para a sessão de suporte (expira em 8 horas)
  const sessionPayload = {
    type: 'support_session',
    tokenId,
    accountId,
    operatorName,
    operatorIdentifier,
    isImpersonating: true
  };

  const sessionToken = jwt.sign(sessionPayload, process.env.JWT_SECRET, {
    expiresIn: '8h'
  });

  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  const result = await db.query(
    `INSERT INTO support_access_sessions
     (token_id, account_id, operator_name, operator_email, operator_identifier,
      session_token_hash, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, token_id, account_id, operator_name, started_at, is_active`,
    [tokenId, accountId, operatorName, operatorEmail, operatorIdentifier,
     sessionTokenHash, ipAddress, userAgent]
  );

  // Atualiza uso do token
  await updateTokenUsage(tokenId);

  // Busca informações da conta para retornar
  const accountResult = await db.query(
    `SELECT name, slug FROM accounts WHERE id = $1`,
    [accountId]
  );

  // Busca escopo do token
  const tokenResult = await db.query(
    `SELECT scope FROM support_access_tokens WHERE id = $1`,
    [tokenId]
  );

  return {
    session: result.rows[0],
    sessionToken,
    account: accountResult.rows[0],
    scope: tokenResult.rows[0].scope
  };
};

/**
 * Valida uma sessão de suporte via JWT
 */
const validateSupportSession = async (sessionToken) => {
  try {
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);

    if (decoded.type !== 'support_session') {
      return null;
    }

    // Verifica se a sessão ainda está ativa
    const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

    const result = await db.query(
      `SELECT s.*, t.scope, t.is_active as token_active, t.expires_at as token_expires_at,
              a.name as account_name
       FROM support_access_sessions s
       JOIN support_access_tokens t ON s.token_id = t.id
       JOIN accounts a ON s.account_id = a.id
       WHERE s.session_token_hash = $1
         AND s.is_active = true`,
      [sessionTokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];

    // Verifica se o token ainda está válido
    if (!session.token_active || new Date(session.token_expires_at) < new Date()) {
      // Encerra a sessão automaticamente
      await endSupportSession(session.id, 'token_expired');
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
};

/**
 * Encerra uma sessão de suporte
 */
const endSupportSession = async (sessionId, reason = 'manual') => {
  const result = await db.query(
    `UPDATE support_access_sessions
     SET is_active = false,
         ended_at = NOW(),
         end_reason = $2
     WHERE id = $1
     RETURNING id, ended_at`,
    [sessionId, reason]
  );

  return result.rows[0];
};

/**
 * Encerra todas as sessões de um token
 */
const endAllTokenSessions = async (tokenId, reason = 'token_revoked') => {
  const result = await db.query(
    `UPDATE support_access_sessions
     SET is_active = false,
         ended_at = NOW(),
         end_reason = $2
     WHERE token_id = $1 AND is_active = true
     RETURNING id`,
    [tokenId, reason]
  );

  return result.rowCount;
};

/**
 * Registra uma ação no audit log
 */
const logSupportAction = async ({
  sessionId,
  tokenId,
  accountId,
  actionType,
  resourceType,
  resourceId,
  resourceName,
  actionDetails,
  endpoint,
  httpMethod,
  requestBodySummary,
  responseStatus,
  ipAddress,
  userAgent
}) => {
  // Atualiza contagem de ações na sessão
  await db.query(
    `UPDATE support_access_sessions
     SET actions_count = actions_count + 1,
         last_action_at = NOW()
     WHERE id = $1`,
    [sessionId]
  );

  // Insere no audit log
  const result = await db.query(
    `INSERT INTO support_access_audit_log
     (session_id, token_id, account_id, action_type, resource_type, resource_id,
      resource_name, action_details, endpoint, http_method, request_body_summary,
      response_status, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, created_at`,
    [sessionId, tokenId, accountId, actionType, resourceType, resourceId,
     resourceName, actionDetails ? JSON.stringify(actionDetails) : null,
     endpoint, httpMethod, requestBodySummary ? JSON.stringify(requestBodySummary) : null,
     responseStatus, ipAddress, userAgent]
  );

  return result.rows[0];
};

/**
 * Lista tokens de uma conta
 */
const listTokens = async (accountId, includeExpired = false) => {
  let query = `
    SELECT t.*, u.name as created_by_name, u.email as created_by_email,
           (SELECT COUNT(*) FROM support_access_sessions s WHERE s.token_id = t.id) as total_sessions,
           (SELECT COUNT(*) FROM support_access_sessions s WHERE s.token_id = t.id AND s.is_active = true) as active_sessions,
           (SELECT COUNT(*) FROM support_access_audit_log l WHERE l.token_id = t.id) as total_actions,
           CASE
             WHEN t.revoked_at IS NOT NULL THEN 'revoked'
             WHEN t.expires_at < NOW() THEN 'expired'
             WHEN t.is_active = false THEN 'inactive'
             ELSE 'active'
           END as status
    FROM support_access_tokens t
    JOIN users u ON t.created_by = u.id
    WHERE t.account_id = $1
  `;

  if (!includeExpired) {
    query += ` AND (t.expires_at > NOW() OR t.revoked_at IS NOT NULL)`;
  }

  query += ` ORDER BY t.created_at DESC`;

  const result = await db.query(query, [accountId]);
  return result.rows;
};

/**
 * Busca um token por ID
 */
const getTokenById = async (tokenId, accountId) => {
  const result = await db.query(
    `SELECT t.*, u.name as created_by_name, u.email as created_by_email,
            (SELECT COUNT(*) FROM support_access_sessions s WHERE s.token_id = t.id) as total_sessions,
            (SELECT COUNT(*) FROM support_access_audit_log l WHERE l.token_id = t.id) as total_actions,
            CASE
              WHEN t.revoked_at IS NOT NULL THEN 'revoked'
              WHEN t.expires_at < NOW() THEN 'expired'
              WHEN t.is_active = false THEN 'inactive'
              ELSE 'active'
            END as status
     FROM support_access_tokens t
     JOIN users u ON t.created_by = u.id
     WHERE t.id = $1 AND t.account_id = $2`,
    [tokenId, accountId]
  );

  return result.rows[0];
};

/**
 * Revoga um token
 */
const revokeToken = async (tokenId, accountId, revokedBy, reason) => {
  // Encerra todas as sessões ativas
  await endAllTokenSessions(tokenId, 'token_revoked');

  // Revoga o token
  const result = await db.query(
    `UPDATE support_access_tokens
     SET is_active = false,
         revoked_at = NOW(),
         revoked_by = $3,
         revoke_reason = $4
     WHERE id = $1 AND account_id = $2
     RETURNING id, revoked_at`,
    [tokenId, accountId, revokedBy, reason]
  );

  return result.rows[0];
};

/**
 * Estende a validade de um token
 */
const extendToken = async (tokenId, accountId, extendedBy, additionalHours = EXTENSION_DURATION_DAYS * 24) => {
  // Verifica se pode estender
  const token = await getTokenById(tokenId, accountId);

  if (!token) {
    throw new Error('Token não encontrado');
  }

  if (token.status !== 'active') {
    throw new Error('Apenas tokens ativos podem ser estendidos');
  }

  if (token.extension_count >= token.max_extensions) {
    throw new Error(`Limite máximo de extensões atingido (${token.max_extensions})`);
  }

  // Calcula nova data de expiração
  const currentExpires = new Date(token.expires_at);
  const newExpires = new Date(currentExpires.getTime() + (additionalHours * 60 * 60 * 1000));

  // Limita a extensão máxima total
  const originalExpires = new Date(token.original_expires_at);
  const maxTotalDuration = MAX_TOKEN_DURATION_DAYS * 2 * 24 * 60 * 60 * 1000; // 28 dias no máximo
  const maxAllowedExpires = new Date(originalExpires.getTime() + maxTotalDuration);

  const finalExpires = newExpires > maxAllowedExpires ? maxAllowedExpires : newExpires;

  const result = await db.query(
    `UPDATE support_access_tokens
     SET expires_at = $3,
         extension_count = extension_count + 1,
         last_extended_at = NOW(),
         last_extended_by = $4
     WHERE id = $1 AND account_id = $2
     RETURNING id, expires_at, extension_count`,
    [tokenId, accountId, finalExpires, extendedBy]
  );

  return result.rows[0];
};

/**
 * Lista sessões de uma conta
 */
const listSessions = async (accountId, activeOnly = false) => {
  let query = `
    SELECT s.*, t.token_prefix, t.purpose,
           (SELECT COUNT(*) FROM support_access_audit_log l WHERE l.session_id = s.id) as actions_count
    FROM support_access_sessions s
    JOIN support_access_tokens t ON s.token_id = t.id
    WHERE s.account_id = $1
  `;

  if (activeOnly) {
    query += ` AND s.is_active = true`;
  }

  query += ` ORDER BY s.started_at DESC`;

  const result = await db.query(query, [accountId]);
  return result.rows;
};

/**
 * Busca o audit log de uma conta
 */
const getAuditLog = async (accountId, {
  sessionId,
  tokenId,
  actionType,
  resourceType,
  startDate,
  endDate,
  limit = 100,
  offset = 0
} = {}) => {
  let query = `
    SELECT l.*, s.operator_name, s.operator_email, t.token_prefix, t.purpose
    FROM support_access_audit_log l
    JOIN support_access_sessions s ON l.session_id = s.id
    JOIN support_access_tokens t ON l.token_id = t.id
    WHERE l.account_id = $1
  `;

  const params = [accountId];
  let paramCount = 2;

  if (sessionId) {
    query += ` AND l.session_id = $${paramCount++}`;
    params.push(sessionId);
  }

  if (tokenId) {
    query += ` AND l.token_id = $${paramCount++}`;
    params.push(tokenId);
  }

  if (actionType) {
    query += ` AND l.action_type = $${paramCount++}`;
    params.push(actionType);
  }

  if (resourceType) {
    query += ` AND l.resource_type = $${paramCount++}`;
    params.push(resourceType);
  }

  if (startDate) {
    query += ` AND l.created_at >= $${paramCount++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND l.created_at <= $${paramCount++}`;
    params.push(endDate);
  }

  // Conta total
  const countQuery = query.replace(
    'SELECT l.*, s.operator_name, s.operator_email, t.token_prefix, t.purpose',
    'SELECT COUNT(*)'
  );
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);

  // Adiciona ordenação e paginação
  query += ` ORDER BY l.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
  params.push(limit, offset);

  const result = await db.query(query, params);

  return {
    logs: result.rows,
    total,
    limit,
    offset
  };
};

/**
 * Verifica se um escopo inclui determinada permissão
 */
const hasScope = (scope, requiredScope) => {
  if (!scope || !Array.isArray(scope)) {
    return false;
  }

  // Full admin tem acesso a tudo
  if (scope.includes(SUPPORT_SCOPES.FULL_ADMIN)) {
    return true;
  }

  // Verifica escopo específico
  return scope.includes(requiredScope);
};

/**
 * Limpa sessões inativas
 */
const cleanupInactiveSessions = async () => {
  const result = await db.query(
    `SELECT cleanup_inactive_support_sessions()`
  );
  return result.rows[0].cleanup_inactive_support_sessions;
};

/**
 * Estatísticas de acesso de suporte para uma conta
 */
const getAccessStats = async (accountId) => {
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM support_access_tokens WHERE account_id = $1 AND is_active = true AND expires_at > NOW()) as active_tokens,
       (SELECT COUNT(*) FROM support_access_sessions WHERE account_id = $1 AND is_active = true) as active_sessions,
       (SELECT COUNT(*) FROM support_access_audit_log WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days') as actions_last_30_days,
       (SELECT COUNT(DISTINCT session_id) FROM support_access_audit_log WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days') as sessions_last_30_days`,
    [accountId]
  );

  return result.rows[0];
};

module.exports = {
  SUPPORT_SCOPES,
  MAX_TOKEN_DURATION_DAYS,
  EXTENSION_DURATION_DAYS,
  MAX_EXTENSIONS,
  generateSupportToken,
  hashToken,
  createSupportToken,
  validateSupportToken,
  updateTokenUsage,
  createSupportSession,
  validateSupportSession,
  endSupportSession,
  endAllTokenSessions,
  logSupportAction,
  listTokens,
  getTokenById,
  revokeToken,
  extendToken,
  listSessions,
  getAuditLog,
  hasScope,
  cleanupInactiveSessions,
  getAccessStats
};
