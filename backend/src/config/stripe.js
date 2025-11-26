/**
 * Stripe Configuration
 *
 * SDK initialization and plan configuration
 */

const Stripe = require('stripe');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: false
});

/**
 * Plan configurations with limits
 * These should match the products/prices created in Stripe Dashboard
 */
const PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    price: 0,
    limits: {
      maxChannels: 1,
      maxUsers: 1,
      monthlyGmapsCredits: 100
    },
    features: ['1 channel', '1 user', '100 Google Maps credits/month']
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER,
    price: 4900, // $49.00 in cents
    limits: {
      maxChannels: 2,
      maxUsers: 3,
      monthlyGmapsCredits: 500
    },
    features: ['2 channels', '3 users', '500 Google Maps credits/month', 'Email support']
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL,
    price: 14900, // $149.00 in cents
    limits: {
      maxChannels: 5,
      maxUsers: 10,
      monthlyGmapsCredits: 2000
    },
    features: ['5 channels', '10 users', '2000 Google Maps credits/month', 'Priority support', 'Advanced analytics']
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    price: 39900, // $399.00 in cents
    limits: {
      maxChannels: 20,
      maxUsers: 50,
      monthlyGmapsCredits: 10000
    },
    features: ['20 channels', '50 users', '10000 Google Maps credits/month', 'Dedicated support', 'Custom integrations']
  }
};

/**
 * Add-on configurations
 */
const ADDONS = {
  channel: {
    name: 'Extra Channel',
    priceId: process.env.STRIPE_PRICE_CHANNEL_EXTRA,
    price: 3000, // $30.00/month
    unit: 'channel'
  },
  user: {
    name: 'Extra User',
    priceId: process.env.STRIPE_PRICE_USER_EXTRA,
    price: 500, // $5.00/month
    unit: 'user'
  }
};

/**
 * Credit package configurations
 */
const CREDIT_PACKAGES = {
  gmaps_1000: {
    name: '1000 Google Maps Credits',
    priceId: process.env.STRIPE_PRICE_CREDITS_1000,
    price: 5000, // $50.00 one-time
    credits: 1000,
    validityDays: 30
  }
};

/**
 * Trial configuration
 */
const TRIAL_CONFIG = {
  days: parseInt(process.env.STRIPE_TRIAL_DAYS) || 14,
  requirePaymentMethod: false
};

/**
 * Webhook events we process
 */
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.created',
  'customer.updated',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed'
];

/**
 * Get plan by type
 */
function getPlan(planType) {
  return PLANS[planType] || PLANS.free;
}

/**
 * Get plan by Stripe price ID
 */
function getPlanByPriceId(priceId) {
  for (const [type, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) {
      return { type, ...plan };
    }
  }
  return null;
}

/**
 * Get limits for a plan
 */
function getPlanLimits(planType) {
  const plan = getPlan(planType);
  return plan.limits;
}

module.exports = {
  stripe,
  PLANS,
  ADDONS,
  CREDIT_PACKAGES,
  TRIAL_CONFIG,
  WEBHOOK_EVENTS,
  getPlan,
  getPlanByPriceId,
  getPlanLimits
};
