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

    await db.update('users', {
      terms_accepted_at: new Date(),
      terms_version: version
    }, { id: userId });

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
