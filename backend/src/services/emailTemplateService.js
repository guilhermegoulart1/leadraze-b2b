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
        {{#if isNewAccount}}
        <h1>Bem-vindo ao GetRaze, {{name}}!</h1>
        <p>Sua assinatura foi ativada com sucesso! Estamos muito felizes em ter voce conosco.</p>
        <p>Para acessar sua conta, voce precisa criar uma senha. Clique no botao abaixo:</p>
        <p style="margin: 30px 0;">
          <a href="{{setupPasswordUrl}}" style="background-color: #6366F1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Criar Minha Senha</a>
        </p>
        <p style="color: #666; font-size: 14px;">Este link expira em 24 horas. Apos criar sua senha, voce tera acesso completo ao dashboard.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <h3>O que voce pode fazer no GetRaze:</h3>
        <ul style="color: #555;">
          <li>Conectar sua conta do LinkedIn para prospecao automatizada</li>
          <li>Criar campanhas inteligentes de outreach</li>
          <li>Usar IA para personalizar suas mensagens</li>
          <li>Buscar leads no Google Maps e outras fontes</li>
        </ul>
        <p>Qualquer duvida, estamos a disposicao!</p>
        {{else}}
        <h1>Bem-vindo ao GetRaze, {{name}}!</h1>
        <p>Sua conta foi criada com sucesso.</p>
        <p><a href="{{dashboardUrl}}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Acessar Dashboard</a></p>
        {{/if}}
      `),
      'password-reset': Handlebars.compile(`
        <h1>Redefinicao de Senha</h1>
        <p>Ola {{name}},</p>
        <p>Voce solicitou a redefinicao da sua senha. Clique no botao abaixo:</p>
        <p><a href="{{resetUrl}}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir Senha</a></p>
        <p style="color: #666; font-size: 14px;">Este link expira em {{expiryHours}} horas.</p>
      `),
      'invoice': Handlebars.compile(`
        <h1>Fatura #{{invoiceNumber}}</h1>
        <p>Ola {{name}},</p>
        <p>Sua fatura de {{amount}} {{currency}} esta disponivel.</p>
        <p><a href="{{invoiceUrl}}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ver Fatura</a></p>
      `),
      'payment-failed': Handlebars.compile(`
        <h1>Falha no Pagamento</h1>
        <p>Ola {{name}},</p>
        <p>Nao conseguimos processar seu pagamento de {{amount}}.</p>
        <p>Por favor, atualize sua forma de pagamento para continuar usando o GetRaze.</p>
        <p><a href="{{updatePaymentUrl}}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Atualizar Pagamento</a></p>
      `),
      'trial-ending': Handlebars.compile(`
        <h1>Seu Trial Esta Acabando</h1>
        <p>Ola {{name}},</p>
        <p>Seu periodo de teste gratuito termina em {{daysRemaining}} dias.</p>
        <p>Faca upgrade agora para manter seus dados e continuar usando o GetRaze.</p>
        <p><a href="{{upgradeUrl}}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Fazer Upgrade</a></p>
      `),
      'subscription-canceled': Handlebars.compile(`
        <h1>Assinatura Cancelada</h1>
        <p>Ola {{name}},</p>
        <p>Sua assinatura foi cancelada e terminara em {{endDate}}.</p>
        <p><strong>Importante:</strong> Seus dados serao mantidos por {{dataRetentionDays}} dias apos o cancelamento.</p>
        <p>Mudou de ideia? Voce pode reativar a qualquer momento.</p>
        <p><a href="{{reactivateUrl}}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reativar Assinatura</a></p>
      `),
      'invite-user': Handlebars.compile(`
        <h1>Voce foi convidado!</h1>
        <p>{{inviterName}} convidou voce para fazer parte do time no GetRaze.</p>
        <p><a href="{{inviteUrl}}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Aceitar Convite</a></p>
      `),
      'payment-success': Handlebars.compile(`
        <h1>Pagamento Confirmado!</h1>
        <p>Ola {{name}},</p>
        <p>Seu pagamento de {{amount}} para o plano {{planName}} foi confirmado com sucesso.</p>
        <p>Proxima cobranca: {{nextBillingDate}}</p>
        {{#if invoiceUrl}}
        <p><a href="{{invoiceUrl}}" style="color: #6366F1;">Ver Fatura</a></p>
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
    a { color: #6366F1; }
    h1 { color: #1F2937; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="color: #6366F1; margin: 0;">{{appName}}</h2>
      <p style="color: #888; margin: 5px 0 0 0; font-size: 12px;">Deals Drop</p>
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
        subject: 'Bem-vindo ao GetRaze - Ative sua conta!',
        greeting: 'Bem-vindo!'
      },
      'password-reset': {
        subject: 'Redefinir sua Senha - GetRaze',
        greeting: 'Redefinicao de Senha'
      },
      'invoice': {
        subject: 'Sua Fatura GetRaze esta Pronta',
        greeting: 'Nova Fatura'
      },
      'payment-failed': {
        subject: 'Falha no Pagamento - Acao Necessaria',
        greeting: 'Problema no Pagamento'
      },
      'trial-ending': {
        subject: 'Seu Periodo de Teste Esta Acabando - GetRaze',
        greeting: 'Trial Acabando'
      },
      'subscription-canceled': {
        subject: 'Assinatura Cancelada - GetRaze',
        greeting: 'Ate logo!'
      },
      'invite-user': {
        subject: 'Voce foi convidado para o GetRaze!',
        greeting: 'Convite de Equipe'
      },
      'payment-success': {
        subject: 'Pagamento Confirmado - GetRaze',
        greeting: 'Obrigado!'
      }
    };

    return defaults[templateName] || { subject: 'GetRaze - Notificacao', greeting: 'Ola' };
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
      appName: 'GetRaze | Deals Drop',
      appUrl: process.env.FRONTEND_URL || 'https://getraze.co',
      supportEmail: process.env.EMAIL_REPLY_TO || 'suporte@getraze.co'
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
