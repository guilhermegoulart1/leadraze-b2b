/**
 * Email Configuration
 *
 * SMTP configuration for sending transactional emails
 */

module.exports = {
  /**
   * SMTP Configuration
   * Uses user's own SMTP server
   */
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    // Connection settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,
    socketTimeout: 30000,
    // TLS options
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  },

  /**
   * Default sender configuration
   */
  defaults: {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'GetRaze',
      email: process.env.EMAIL_FROM_ADDRESS || 'noreply@getraze.com'
    },
    replyTo: process.env.EMAIL_REPLY_TO || 'support@getraze.com'
  },

  /**
   * Email categories and their priorities
   * Lower number = higher priority
   */
  categories: {
    transactional: {
      priority: 1,
      description: 'Welcome, password reset, verification emails'
    },
    billing: {
      priority: 2,
      description: 'Invoices, payment failures, subscription updates'
    },
    notification: {
      priority: 3,
      description: 'Lead collected, campaign completed, etc.'
    },
    marketing: {
      priority: 5,
      description: 'Promotional emails, newsletters'
    }
  },

  /**
   * Template configuration
   */
  templates: {
    basePath: 'src/templates/email',
    layouts: {
      base: 'layouts/base.html',
      transactional: 'layouts/transactional.html',
      billing: 'layouts/billing.html'
    },
    defaultLayout: 'base'
  },

  /**
   * Queue configuration (used by emailQueue)
   */
  queue: {
    maxConcurrency: 10,
    maxRetries: 5,
    backoffDelay: 3000, // 3 seconds, exponential
    removeOnComplete: {
      age: 7 * 24 * 3600, // 7 days
      count: 5000
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // 30 days
      count: 10000
    }
  },

  /**
   * Rate limiting
   */
  rateLimit: {
    maxPerSecond: 10,
    maxPerMinute: 100,
    maxPerHour: 1000
  },

  /**
   * Available templates
   */
  availableTemplates: {
    // Transactional
    welcome: {
      category: 'transactional',
      description: 'Welcome email after registration'
    },
    'password-reset': {
      category: 'transactional',
      description: 'Password reset request'
    },
    'email-verification': {
      category: 'transactional',
      description: 'Email verification link'
    },
    'invite-user': {
      category: 'transactional',
      description: 'Team member invitation'
    },

    // Billing
    invoice: {
      category: 'billing',
      description: 'New invoice notification'
    },
    'payment-failed': {
      category: 'billing',
      description: 'Payment failure notification'
    },
    'payment-success': {
      category: 'billing',
      description: 'Payment success confirmation'
    },
    'trial-ending': {
      category: 'billing',
      description: 'Trial ending soon reminder'
    },
    'subscription-canceled': {
      category: 'billing',
      description: 'Subscription cancellation confirmation'
    },
    'subscription-renewed': {
      category: 'billing',
      description: 'Subscription renewal confirmation'
    },

    // Notifications
    'lead-collected': {
      category: 'notification',
      description: 'New leads collected notification'
    },
    'campaign-completed': {
      category: 'notification',
      description: 'Campaign completed notification'
    },
    'weekly-summary': {
      category: 'notification',
      description: 'Weekly activity summary'
    }
  },

  /**
   * Check if email service is configured
   */
  isConfigured() {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    );
  }
};
