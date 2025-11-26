/**
 * Billing Middleware
 *
 * Middleware functions for checking subscription status and limits
 */

const subscriptionService = require('../services/subscriptionService');
const billingService = require('../services/billingService');

/**
 * Require active subscription
 * Blocks requests if subscription is not active
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const isActive = await subscriptionService.isActive(accountId);

    if (!isActive) {
      const status = await subscriptionService.getStatus(accountId);

      return res.status(402).json({
        success: false,
        message: 'Active subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        status: status.status,
        blockLevel: status.blockLevel
      });
    }

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    next(error);
  }
};

/**
 * Check user limit before creating new user
 */
const checkUserLimit = async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const canAdd = await billingService.canAddUser(accountId);

    if (!canAdd) {
      const summary = await billingService.getBillingSummary(accountId);
      const maxUsers = (summary?.max_users || 0) + (summary?.extra_users || 0);

      return res.status(403).json({
        success: false,
        message: `User limit reached (${maxUsers}). Upgrade your plan or add extra users.`,
        code: 'USER_LIMIT_REACHED',
        current: summary?.current_users || 0,
        limit: maxUsers
      });
    }

    next();
  } catch (error) {
    console.error('Error checking user limit:', error);
    next(error);
  }
};

/**
 * Check channel limit before connecting new LinkedIn account
 */
const checkChannelLimit = async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const canAdd = await billingService.canAddChannel(accountId);

    if (!canAdd) {
      const summary = await billingService.getBillingSummary(accountId);
      const maxChannels = (summary?.max_channels || 0) + (summary?.extra_channels || 0);

      return res.status(403).json({
        success: false,
        message: `Channel limit reached (${maxChannels}). Upgrade your plan or add extra channels.`,
        code: 'CHANNEL_LIMIT_REACHED',
        current: summary?.current_channels || 0,
        limit: maxChannels
      });
    }

    next();
  } catch (error) {
    console.error('Error checking channel limit:', error);
    next(error);
  }
};

/**
 * Check Google Maps credits before operation
 * @param {number} requiredCredits - Number of credits needed
 */
const checkGMapsCredits = (requiredCredits = 1) => async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const available = await billingService.getAvailableCredits(accountId, 'gmaps');

    if (available < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: `Insufficient Google Maps credits. Need ${requiredCredits}, have ${available}.`,
        code: 'INSUFFICIENT_CREDITS',
        credits_required: requiredCredits,
        credits_available: available
      });
    }

    // Store available credits in request for later use
    req.gmapsCredits = available;
    next();
  } catch (error) {
    console.error('Error checking credits:', error);
    next(error);
  }
};

/**
 * Consume Google Maps credits after successful operation
 * Call this after the operation succeeds
 */
const consumeGMapsCredits = async (accountId, amount, context = {}) => {
  try {
    const success = await billingService.consumeCredits(accountId, 'gmaps', amount, context);

    if (!success) {
      console.warn(`Failed to consume ${amount} credits for account ${accountId}`);
    }

    return success;
  } catch (error) {
    console.error('Error consuming credits:', error);
    return false;
  }
};

/**
 * Check subscription status and attach to request
 * Useful for routes that need subscription info but shouldn't block
 */
const attachSubscriptionStatus = async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const status = await subscriptionService.getStatus(accountId);

    req.subscription = status;
    next();
  } catch (error) {
    console.error('Error attaching subscription status:', error);
    // Don't block the request, just continue without subscription info
    req.subscription = null;
    next();
  }
};

/**
 * Block if subscription is in hard block state
 */
const blockIfSuspended = async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const status = await subscriptionService.getStatus(accountId);

    if (status.blockLevel === 'hard_block') {
      return res.status(403).json({
        success: false,
        message: status.message || 'Account is suspended',
        code: 'ACCOUNT_SUSPENDED',
        status: status.status
      });
    }

    next();
  } catch (error) {
    console.error('Error checking suspension:', error);
    next(error);
  }
};

/**
 * Warn but don't block for soft block states
 * Adds warning header to response
 */
const warnIfLimited = async (req, res, next) => {
  try {
    const accountId = req.user.account_id;
    const status = await subscriptionService.getStatus(accountId);

    if (status.blockLevel === 'warning' || status.blockLevel === 'soft_block') {
      res.set('X-Billing-Warning', status.message);
      res.set('X-Billing-Status', status.status);
    }

    req.billingStatus = status;
    next();
  } catch (error) {
    console.error('Error checking billing status:', error);
    next();
  }
};

module.exports = {
  requireActiveSubscription,
  checkUserLimit,
  checkChannelLimit,
  checkGMapsCredits,
  consumeGMapsCredits,
  attachSubscriptionStatus,
  blockIfSuspended,
  warnIfLimited
};
