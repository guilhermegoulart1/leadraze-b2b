/**
 * Stripe Configuration
 *
 * SDK initialization and plan/addon configuration
 *
 * Modelo de preços:
 * - Plano Base: R$ 297/mês (1 canal, 2 usuários, 200 créditos/mês)
 * - Add-ons recorrentes: Canal (+R$ 147/mês), Usuário (+R$ 27/mês)
 * - Créditos avulsos: não expiram
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
      maxChannels: 999999,
      maxUsers: 999999,
      monthlyGmapsCredits: 999999
    },
    features: [
      'Canais ilimitados',
      'Usuários ilimitados',
      'Créditos Google Maps ilimitados',
      'Acesso total ao sistema'
    ],
    isPublic: false
  },
  base: {
    name: 'Base',
    slug: 'base',
    priceIdMonthly: process.env.STRIPE_PRICE_BASE_MONTHLY,
    priceMonthly: 29700, // R$ 297.00
    limits: {
      maxChannels: 1,
      maxUsers: 2,
      monthlyGmapsCredits: 200
    },
    features: [
      '1 canal de comunicação',
      '2 usuários',
      '200 créditos Google Maps/mês',
      'Agentes de IA ilimitados',
      'Suporte prioritário'
    ],
    isPublic: true,
    isDefault: true,
    isHighlighted: true,
    highlightText: 'Plano Único'
  }
};

/**
 * Add-on configurations (recurring)
 */
const ADDONS = {
  channel: {
    name: 'Canal Extra',
    slug: 'channel-extra',
    priceId: process.env.STRIPE_PRICE_CHANNEL_EXTRA,
    price: 14700, // R$ 147.00/month
    billingType: 'recurring',
    unit: 'channel'
  },
  user: {
    name: 'Usuário Extra',
    slug: 'user-extra',
    priceId: process.env.STRIPE_PRICE_USER_EXTRA,
    price: 2700, // R$ 27.00/month
    billingType: 'recurring',
    unit: 'user'
  }
};

/**
 * Credit package configurations (one-time, never expire)
 */
const CREDIT_PACKAGES = {
  gmaps_500: {
    name: '500 Créditos Google Maps',
    slug: 'credits-500',
    priceId: process.env.STRIPE_PRICE_CREDITS_500,
    price: 4700, // R$ 47.00
    credits: 500,
    expires: false,
    billingType: 'onetime'
  },
  gmaps_1000: {
    name: '1.000 Créditos Google Maps',
    slug: 'credits-1000',
    priceId: process.env.STRIPE_PRICE_CREDITS_1000,
    price: 8700, // R$ 87.00
    credits: 1000,
    expires: false,
    billingType: 'onetime'
  },
  gmaps_2500: {
    name: '2.500 Créditos Google Maps',
    slug: 'credits-2500',
    priceId: process.env.STRIPE_PRICE_CREDITS_2500,
    price: 19700, // R$ 197.00
    credits: 2500,
    expires: false,
    billingType: 'onetime'
  },
  gmaps_5000: {
    name: '5.000 Créditos Google Maps',
    slug: 'credits-5000',
    priceId: process.env.STRIPE_PRICE_CREDITS_5000,
    price: 29700, // R$ 297.00
    credits: 5000,
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
