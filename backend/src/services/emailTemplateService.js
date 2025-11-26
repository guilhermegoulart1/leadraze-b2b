/**
 * Email Template Service
 *
 * Renders email templates with Handlebars and i18n support
 */

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const i18next = require('../config/i18n');

class EmailTemplateService {
  constructor() {
    this.templateCache = new Map();
    this.layoutCache = new Map();
    this._registerHelpers();
  }

  /**
   * Register Handlebars helpers
   */
  _registerHelpers() {
    // Format currency
    Handlebars.registerHelper('formatCurrency', (amount, currency) => {
      const curr = currency || 'USD';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: curr
      }).format(amount);
    });

    // Format date
    Handlebars.registerHelper('formatDate', (date, locale) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString(locale || 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Format date with time
    Handlebars.registerHelper('formatDateTime', (date, locale) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleString(locale || 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    // Conditional helper
    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });

    // Pluralize helper
    Handlebars.registerHelper('pluralize', (count, singular, plural) => {
      return count === 1 ? singular : plural;
    });
  }

  /**
   * Get template path based on template name
   */
  _getTemplatePath(templateName) {
    const basePath = path.join(__dirname, '../templates/email');

    // Determine category from template name
    const billingTemplates = ['invoice', 'payment-failed', 'payment-success', 'trial-ending', 'subscription-canceled', 'subscription-renewed'];
    const notificationTemplates = ['lead-collected', 'campaign-completed', 'weekly-summary'];

    let category = 'transactional';
    if (billingTemplates.includes(templateName)) {
      category = 'billing';
    } else if (notificationTemplates.includes(templateName)) {
      category = 'notifications';
    }

    return path.join(basePath, category, `${templateName}.html`);
  }

  /**
   * Load and compile template
   */
  async _loadTemplate(templateName) {
    const cacheKey = templateName;

    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }

    const templatePath = this._getTemplatePath(templateName);

    try {
      const html = await fs.readFile(templatePath, 'utf-8');
      const compiled = Handlebars.compile(html);
      this.templateCache.set(cacheKey, compiled);
      return compiled;
    } catch (error) {
      // If template file doesn't exist, use fallback
      console.warn(`Template file not found: ${templatePath}, using fallback`);
      return this._getFallbackTemplate(templateName);
    }
  }

  /**
   * Load layout
   */
  async _loadLayout() {
    if (this.layoutCache.has('base')) {
      return this.layoutCache.get('base');
    }

    const layoutPath = path.join(__dirname, '../templates/email/layouts/base.html');

    try {
      const html = await fs.readFile(layoutPath, 'utf-8');
      const compiled = Handlebars.compile(html);
      this.layoutCache.set('base', compiled);
      return compiled;
    } catch (error) {
      // Use inline fallback layout
      return this._getFallbackLayout();
    }
  }

  /**
   * Get fallback template
   */
  _getFallbackTemplate(templateName) {
    const fallbacks = {
      'welcome': Handlebars.compile(`
        <h1>Welcome to LeadRaze, {{name}}!</h1>
        <p>Your account has been created successfully.</p>
        <p><a href="{{dashboardUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
      `),
      'password-reset': Handlebars.compile(`
        <h1>Password Reset Request</h1>
        <p>Hi {{name}},</p>
        <p>You requested to reset your password. Click the button below:</p>
        <p><a href="{{resetUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
        <p>This link expires in {{expiryHours}} hours.</p>
      `),
      'invoice': Handlebars.compile(`
        <h1>Invoice #{{invoiceNumber}}</h1>
        <p>Hi {{name}},</p>
        <p>Your invoice for {{amount}} {{currency}} is ready.</p>
        <p><a href="{{invoiceUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Invoice</a></p>
      `),
      'payment-failed': Handlebars.compile(`
        <h1>Payment Failed</h1>
        <p>Hi {{name}},</p>
        <p>We couldn't process your payment of {{amount}}.</p>
        <p>Please update your payment method to continue using LeadRaze.</p>
        <p><a href="{{updatePaymentUrl}}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
      `),
      'trial-ending': Handlebars.compile(`
        <h1>Your Trial Ends Soon</h1>
        <p>Hi {{name}},</p>
        <p>Your free trial ends in {{daysRemaining}} days.</p>
        <p>Upgrade now to keep your data and continue using LeadRaze.</p>
        <p><a href="{{upgradeUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade Now</a></p>
      `),
      'subscription-canceled': Handlebars.compile(`
        <h1>Subscription Canceled</h1>
        <p>Hi {{name}},</p>
        <p>Your subscription has been canceled and will end on {{endDate}}.</p>
        <p><strong>Important:</strong> Your data will be retained for {{dataRetentionDays}} days after cancellation.</p>
        <p>Changed your mind? You can reactivate anytime.</p>
        <p><a href="{{reactivateUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reactivate Subscription</a></p>
      `),
      'invite-user': Handlebars.compile(`
        <h1>You've Been Invited!</h1>
        <p>{{inviterName}} has invited you to join their team on LeadRaze.</p>
        <p><a href="{{inviteUrl}}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
      `),
      'payment-success': Handlebars.compile(`
        <h1>Payment Successful</h1>
        <p>Hi {{name}},</p>
        <p>Your payment of {{amount}} for {{planName}} was successful.</p>
        <p>Next billing date: {{nextBillingDate}}</p>
        {{#if invoiceUrl}}
        <p><a href="{{invoiceUrl}}">View Invoice</a></p>
        {{/if}}
      `)
    };

    return fallbacks[templateName] || Handlebars.compile(`
      <h1>{{subject}}</h1>
      <p>{{message}}</p>
    `);
  }

  /**
   * Get fallback layout
   */
  _getFallbackLayout() {
    return Handlebars.compile(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .content { background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    a { color: #3B82F6; }
    h1 { color: #1F2937; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="color: #3B82F6; margin: 0;">{{appName}}</h2>
    </div>
    <div class="content">
      {{{content}}}
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
      <p><a href="{{appUrl}}">{{appUrl}}</a></p>
    </div>
  </div>
</body>
</html>
    `);
  }

  /**
   * Get translations for a template
   */
  async _getTranslations(templateName, language) {
    // Change i18next language
    await i18next.changeLanguage(language);

    // Try to get translations for this template
    const key = `emails:${templateName}`;
    const translations = i18next.t(key, { returnObjects: true });

    // If translations don't exist, return defaults
    if (typeof translations === 'string' && translations === key) {
      return this._getDefaultTranslations(templateName);
    }

    return translations;
  }

  /**
   * Get default translations
   */
  _getDefaultTranslations(templateName) {
    const defaults = {
      'welcome': {
        subject: 'Welcome to LeadRaze!',
        greeting: 'Welcome!'
      },
      'password-reset': {
        subject: 'Reset Your Password',
        greeting: 'Password Reset Request'
      },
      'invoice': {
        subject: 'Your Invoice is Ready',
        greeting: 'New Invoice'
      },
      'payment-failed': {
        subject: 'Payment Failed - Action Required',
        greeting: 'Payment Issue'
      },
      'trial-ending': {
        subject: 'Your Trial Ends Soon',
        greeting: 'Trial Ending'
      },
      'subscription-canceled': {
        subject: 'Subscription Canceled',
        greeting: 'We\'re Sorry to See You Go'
      },
      'invite-user': {
        subject: 'You\'ve Been Invited to LeadRaze',
        greeting: 'Team Invitation'
      },
      'payment-success': {
        subject: 'Payment Successful',
        greeting: 'Thank You!'
      }
    };

    return defaults[templateName] || { subject: 'LeadRaze Notification', greeting: 'Hello' };
  }

  /**
   * Render email template
   */
  async render(templateName, data, language = 'en') {
    // Get translations
    const translations = await this._getTranslations(templateName, language);

    // Merge data with translations and common variables
    const templateData = {
      ...data,
      ...translations,
      year: new Date().getFullYear(),
      appName: 'LeadRaze',
      appUrl: process.env.FRONTEND_URL || 'https://leadraze.com',
      supportEmail: process.env.EMAIL_REPLY_TO || 'support@leadraze.com'
    };

    // Load and render template
    const template = await this._loadTemplate(templateName);
    const htmlContent = template(templateData);

    // Load and apply layout
    const layout = await this._loadLayout();
    const finalHtml = layout({
      ...templateData,
      content: htmlContent
    });

    // Generate plain text version
    const text = this._htmlToText(htmlContent);

    return {
      subject: translations.subject || templateName,
      html: finalHtml,
      text
    };
  }

  /**
   * Simple HTML to text conversion
   */
  _htmlToText(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.templateCache.clear();
    this.layoutCache.clear();
  }
}

module.exports = new EmailTemplateService();
