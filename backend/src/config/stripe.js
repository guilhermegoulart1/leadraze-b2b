/**
 * Stripe Configuration
 *
 * SDK initialization and plan/addon configuration
 *
 * Pricing model (USD):
 * - Base Plan: $45/month (1 channel, 2 users, 200 gmaps credits/month, 5000 AI credits/month)
 * - Recurring add-ons: Channel (+$27/month), User (+$3/month)
 * - One-time credits: never expire
 */

const Stripe = require('stripe');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: false
});

/**
 * Plan configuration
 */
const PLANS = {
  admin: {
    name: 'Admin',
    slug: 'admin',
    priceId: null,
    priceMonthly: 0,
    limits: {
      maxChannels: 100,
      maxUsers: 100,
      monthlyGmapsCredits: 1000,
      monthlyAiCredits: 10000
    },
    features: [
      '100 canais',
      '100 usuários',
      '1.000 créditos Google Maps/mês',
      '10.000 créditos IA/mês',
      'Acesso total ao sistema'
    ],
    isPublic: false
  },
  base: {
    name: 'Base',
    slug: 'base',
    priceIdMonthly: 'price_1SYIfEFYqwizUuNO9XT69vvV', // $45/month
    priceMonthly: 4500, // $45.00
    limits: {
      maxChannels: 1,
      maxUsers: 2,
      monthlyGmapsCredits: 200,
      monthlyAiCredits: 5000
    },
    features: [
      '1 communication channel',
      '2 users',
      '200 Google Maps credits/month',
      '5,000 AI agent interactions/month',
      'Unlimited AI agents',
      'Priority support'
    ],
    isPublic: true,
    isDefault: true,
    isHighlighted: true,
    highlightText: 'Single Plan'
  }
};

/**
 * Add-on configurations (recurring)
 */
const ADDONS = {
  channel: {
    name: 'Extra Channel',
    slug: 'channel-extra',
    priceId: process.env.STRIPE_PRICE_CHANNEL_EXTRA,
    price: 2700, // $27.00/month
    billingType: 'recurring',
    unit: 'channel'
  },
  user: {
    name: 'Extra User',
    slug: 'user-extra',
    priceId: process.env.STRIPE_PRICE_USER_EXTRA,
    price: 300, // $3.00/month
    billingType: 'recurring',
    unit: 'user'
  }
};

/**
 * Credit package configurations (one-time, never expire)
 */
const CREDIT_PACKAGES = {
  gmaps_500: {
    name: '500 Google Maps Credits (1 lead = 1 credit)',
    slug: 'credits-500',
    priceId: process.env.STRIPE_PRICE_CREDITS_500,
    price: 900, // $9.00
    credits: 500,
    creditType: 'gmaps',
    expires: false,
    billingType: 'onetime'
  },
  gmaps_1000: {
    name: '1,000 Google Maps Credits (1 lead = 1 credit)',
    slug: 'credits-1000',
    priceId: process.env.STRIPE_PRICE_CREDITS_1000,
    price: 1700, // $17.00
    credits: 1000,
    creditType: 'gmaps',
    expires: false,
    billingType: 'onetime'
  },
  gmaps_2500: {
    name: '2,500 Google Maps Credits (1 lead = 1 credit)',
    slug: 'credits-2500',
    priceId: process.env.STRIPE_PRICE_CREDITS_2500,
    price: 3900, // $39.00
    credits: 2500,
    creditType: 'gmaps',
    expires: false,
    billingType: 'onetime'
  },
  gmaps_5000: {
    name: '5,000 Google Maps Credits (1 lead = 1 credit)',
    slug: 'credits-5000',
    priceId: process.env.STRIPE_PRICE_CREDITS_5000,
    price: 5500, // $55.00
    credits: 5000,
    creditType: 'gmaps',
    expires: false,
    billingType: 'onetime'
  },
  // AI Agent Credits (never expire)
  ai_5000: {
    name: '5,000 AI Agent Credits',
    slug: 'ai-credits-5000',
    priceId: 'price_1SYHvUFYqwizUuNOXMaREDaD', // $20
    price: 2000, // $20.00
    credits: 5000,
    creditType: 'ai',
    expires: false,
    billingType: 'onetime'
  },
  ai_10000: {
    name: '10,000 AI Agent Credits',
    slug: 'ai-credits-10000',
    priceId: 'price_1SYHxYFYqwizUuNO8XWLrlan', // $30
    price: 3000, // $30.00
    credits: 10000,
    creditType: 'ai',
    expires: false,
    billingType: 'onetime'
  }
};

/**
 * Trial configuration
 */
const TRIAL_CONFIG = {
  days: parseInt(process.env.STRIPE_TRIAL_DAYS) || 7,
  requirePaymentMethod: false
};

/**
 * Trial limits and feature restrictions
 * Trial users have limited access to premium features
 */
const TRIAL_LIMITS = {
  maxChannels: 0,           // Cannot connect channels during trial
  maxUsers: 2,              // Same as Base plan
  trialGmapsCredits: 20,    // One-time 20 credits at trial start
  monthlyGmapsCredits: 0,   // No monthly renewal during trial
  monthlyAiCredits: 5000,   // Same as Base plan
  features: {
    canGenerateApiKey: false,
    canRunActivationCampaigns: false,
    canConnectChannels: false,
    canCreateAgents: true,
    canAccessCRM: true,
    canUploadLists: true,
    canUseTasks: true
  }
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
 * Get plan by slug/type
 */
function getPlan(planSlug) {
  return PLANS[planSlug] || PLANS.base;
}

/**
 * Get plan by Stripe price ID
 */
function getPlanByPriceId(priceId) {
  for (const [slug, plan] of Object.entries(PLANS)) {
    if (plan.priceIdMonthly === priceId) {
      return { slug, ...plan };
    }
  }
  return null;
}

/**
 * Get limits for a plan
 */
function getPlanLimits(planSlug) {
  const plan = getPlan(planSlug);
  return plan.limits;
}

/**
 * Get all public plans (for pricing page)
 */
function getPublicPlans() {
  return Object.entries(PLANS)
    .filter(([_, plan]) => plan.isPublic)
    .map(([slug, plan]) => ({ slug, ...plan }));
}

/**
 * Get all add-ons
 */
function getAddons() {
  return Object.entries(ADDONS).map(([key, addon]) => ({ key, ...addon }));
}

/**
 * Get all credit packages
 */
function getCreditPackages() {
  return Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => ({ key, ...pkg }));
}

/**
 * Get addon by price ID
 */
function getAddonByPriceId(priceId) {
  for (const [key, addon] of Object.entries(ADDONS)) {
    if (addon.priceId === priceId) {
      return { key, ...addon };
    }
  }
  return null;
}

/**
 * Get credit package by price ID
 */
function getCreditPackageByPriceId(priceId) {
  for (const [key, pkg] of Object.entries(CREDIT_PACKAGES)) {
    if (pkg.priceId === priceId) {
      return { key, ...pkg };
    }
  }
  return null;
}

/**
 * Check if a plan exists
 */
function planExists(planSlug) {
  return PLANS.hasOwnProperty(planSlug);
}

module.exports = {
  stripe,
  PLANS,
  ADDONS,
  CREDIT_PACKAGES,
  TRIAL_CONFIG,
  TRIAL_LIMITS,
  WEBHOOK_EVENTS,
  getPlan,
  getPlanByPriceId,
  getPlanLimits,
  getPublicPlans,
  getAddons,
  getCreditPackages,
  getAddonByPriceId,
  getCreditPackageByPriceId,
  planExists
};
