// backend/src/controllers/termsController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError } = require('../utils/errors');

// Versão atual dos termos — alterar este valor força re-aceite de todos os usuários
const CURRENT_TERMS_VERSION = '2026-02-11';

// ================================
// ACCEPT TERMS
// ================================
const acceptTerms = async (req, res) => {
  try {
    const userId = req.user.id;
    const { version } = req.body;

    if (!version) {
      throw new ValidationError('Terms version is required');
    }

    if (version !== CURRENT_TERMS_VERSION) {
      throw new ValidationError('Invalid terms version');
    }

    const now = new Date();

    // Buscar dados do usuario para o log
    const user = await db.findOne('users', { id: userId });
    const isReAccept = user.terms_version !== null && user.terms_version !== version;

    // Atualizar usuario
    await db.update('users', {
      terms_accepted_at: now,
      terms_version: version
    }, { id: userId });

    // Gravar audit log completo
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.connection?.remoteAddress
      || req.ip;

    await db.insert('terms_acceptance_logs', {
      user_id: userId,
      account_id: req.user.account_id || req.user.accountId || null,
      terms_version: version,
      accepted_at: now,
      ip_address: ipAddress || null,
      user_agent: req.headers['user-agent'] || null,
      email: user.email,
      user_name: user.name,
      action: isReAccept ? 're-accept' : 'accept'
    });

    console.log(`[TERMS] ${isReAccept ? '🔄' : '✅'} User ${user.email} ${isReAccept ? 're-accepted' : 'accepted'} terms v${version} from IP ${ipAddress}`);

    const updatedUser = await db.findOne('users', { id: userId });
    const { password_hash, ...userWithoutPassword } = updatedUser;

    sendSuccess(res, {
      user: userWithoutPassword
    }, 'Terms accepted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// GET TERMS STATUS
// ================================
const getTermsStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await db.findOne('users', { id: userId });

    const accepted = user.terms_version === CURRENT_TERMS_VERSION;

    sendSuccess(res, {
      accepted,
      currentVersion: CURRENT_TERMS_VERSION,
      userVersion: user.terms_version || null,
      acceptedAt: user.terms_accepted_at || null
    }, 'Terms status retrieved');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  acceptTerms,
  getTermsStatus,
  CURRENT_TERMS_VERSION
};
