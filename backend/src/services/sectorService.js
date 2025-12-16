/**
 * Sector Service
 * Handles sector operations including auto-creation and user assignment
 */

const db = require('../config/database');

// Default sector names by language
const DEFAULT_SECTOR_NAMES = {
  pt: 'Geral',
  es: 'General',
  en: 'General'
};

/**
 * Get or create the default "Geral" sector for an account
 * @param {string} accountId - The account ID
 * @param {string} language - The language preference (pt, es, en)
 * @returns {object} The sector object
 */
async function ensureDefaultSector(accountId, language = 'pt') {
  // Try to find existing default sector (check all possible names)
  const existingSector = await db.query(`
    SELECT * FROM sectors
    WHERE account_id = $1
    AND LOWER(name) IN ('geral', 'general')
    LIMIT 1
  `, [accountId]);

  if (existingSector.rows.length > 0) {
    return existingSector.rows[0];
  }

  // Create default sector with language-appropriate name
  const sectorName = DEFAULT_SECTOR_NAMES[language] || DEFAULT_SECTOR_NAMES.pt;

  const newSector = await db.query(`
    INSERT INTO sectors (account_id, name, description, color, is_active)
    VALUES ($1, $2, $3, $4, true)
    RETURNING *
  `, [
    accountId,
    sectorName,
    language === 'pt' ? 'Setor padrão para todos os usuários' :
    language === 'es' ? 'Sector predeterminado para todos los usuarios' :
    'Default sector for all users',
    '#6366f1' // Default indigo color
  ]);

  return newSector.rows[0];
}

/**
 * Assign a user to the default sector
 * @param {string} userId - The user ID
 * @param {string} accountId - The account ID
 * @param {string} language - The language preference
 */
async function assignUserToDefaultSector(userId, accountId, language = 'pt') {
  try {
    // Ensure default sector exists
    const sector = await ensureDefaultSector(accountId, language);

    // Check if user is already assigned to this sector
    const existing = await db.query(`
      SELECT * FROM user_sectors
      WHERE user_id = $1 AND sector_id = $2
    `, [userId, sector.id]);

    if (existing.rows.length > 0) {
      return { assigned: false, message: 'User already assigned to default sector', sector };
    }

    // Assign user to sector
    await db.query(`
      INSERT INTO user_sectors (user_id, sector_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, sector_id) DO NOTHING
    `, [userId, sector.id]);

    return { assigned: true, message: 'User assigned to default sector', sector };
  } catch (error) {
    console.error('Error assigning user to default sector:', error);
    throw error;
  }
}

/**
 * Get user's preferred language from their settings or default to Portuguese
 * @param {string} userId - The user ID
 * @returns {string} The language code (pt, es, en)
 */
async function getUserLanguage(userId) {
  try {
    const result = await db.query(`
      SELECT settings->>'language' as language
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length > 0 && result.rows[0].language) {
      const lang = result.rows[0].language;
      if (['pt', 'es', 'en'].includes(lang)) {
        return lang;
      }
    }
    return 'pt'; // Default to Portuguese
  } catch (error) {
    return 'pt';
  }
}

/**
 * Ensure default sector exists for an account (typically called during account creation)
 * @param {string} accountId - The account ID
 * @param {string} language - The language preference
 */
async function initializeAccountSector(accountId, language = 'pt') {
  return await ensureDefaultSector(accountId, language);
}

module.exports = {
  ensureDefaultSector,
  assignUserToDefaultSector,
  getUserLanguage,
  initializeAccountSector,
  DEFAULT_SECTOR_NAMES
};
