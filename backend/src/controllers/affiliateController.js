/**
 * Affiliate Controller
 *
 * Handles affiliate program API requests
 */

const affiliateService = require('../services/affiliateService');

/**
 * Get or create affiliate link for current user
 */
exports.getAffiliateLink = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const link = await affiliateService.getOrCreateAffiliateLink(accountId);

    // Build full URL
    const baseUrl = process.env.WEBSITE_URL || 'https://getraze.co';
    const fullUrl = `${baseUrl}?ref=${link.code}`;

    res.json({
      success: true,
      data: {
        code: link.code,
        url: fullUrl,
        clicks: link.clicks,
        is_active: link.is_active,
        created_at: link.created_at
      }
    });
  } catch (error) {
    console.error('Error getting affiliate link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliate link'
    });
  }
};

/**
 * Track a click on affiliate link (public endpoint)
 */
exports.trackClick = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Affiliate code is required'
      });
    }

    const link = await affiliateService.trackClick(code);

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate link not found'
      });
    }

    res.json({
      success: true,
      data: { code: link.code }
    });
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track click'
    });
  }
};

/**
 * Validate affiliate code exists (public endpoint)
 */
exports.validateCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    const link = await affiliateService.getAffiliateLinkByCode(code);

    res.json({
      success: true,
      data: {
        valid: !!link,
        code: link ? link.code : null
      }
    });
  } catch (error) {
    console.error('Error validating affiliate code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate code'
    });
  }
};

/**
 * Get affiliate dashboard stats
 */
exports.getStats = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const stats = await affiliateService.getAffiliateStats(accountId);

    // Build full URL
    const baseUrl = process.env.WEBSITE_URL || 'https://getraze.co';
    stats.link.url = `${baseUrl}?ref=${stats.link.code}`;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting affiliate stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliate stats'
    });
  }
};

/**
 * Get referrals list
 */
exports.getReferrals = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { page = 1, limit = 20 } = req.query;

    const result = await affiliateService.getReferrals(accountId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Mask emails for privacy
    result.referrals = result.referrals.map(r => ({
      ...r,
      referred_email: maskEmail(r.referred_email)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get referrals'
    });
  }
};

/**
 * Get earnings history
 */
exports.getEarnings = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { page = 1, limit = 20 } = req.query;

    const result = await affiliateService.getEarnings(accountId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Mask emails for privacy
    result.earnings = result.earnings.map(e => ({
      ...e,
      referred_email: maskEmail(e.referred_email)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get earnings'
    });
  }
};

/**
 * Helper: Mask email for privacy
 * john@example.com -> j***@example.com
 */
function maskEmail(email) {
  if (!email) return null;

  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}
