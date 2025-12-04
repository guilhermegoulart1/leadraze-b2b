/**
 * Email Service
 *
 * Sends transactional and billing emails via SMTP
 */

const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');
const emailTemplateService = require('./emailTemplateService');
const db = require('../config/database');

class EmailService {
  constructor() {
    this.transporter = null;
    this._initTransporter();
  }

  /**
   * Initialize SMTP transporter
   */
  _initTransporter() {
    if (!emailConfig.isConfigured()) {
      console.warn('Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
      return;
    }

    this.transporter = nodemailer.createTransport(emailConfig.smtp);

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        console.error('Email transporter verification failed:', error.message);
      } else {
        console.log('Email transporter ready');
      }
    });
  }

  /**
   * Check if email service is ready
   */
  isReady() {
    return this.transporter !== null;
  }

  /**
   * Queue an email for sending
   * This creates a log entry and adds to Bull queue
   */
  async queueEmail(options) {
    const {
      template,
      to,
      data = {},
      language = 'en',
      priority = 5,
      accountId = null,
      userId = null,
      category = 'transactional',
      metadata = {}
    } = options;

    // Create log entry
    const logResult = await db.query(
      `INSERT INTO email_logs (
        account_id, user_id, to_email, to_name,
        template_name, status, category, language, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        accountId, userId, to.email, to.name || null,
        template, 'queued', category, language, JSON.stringify(metadata)
      ]
    );

    const emailLogId = logResult.rows[0].id;

    // Add to queue (will be processed by emailWorker)
    const { emailQueue } = require('../queues');
    const job = await emailQueue.add(
      {
        emailLogId,
        template,
        to,
        data,
        language,
        category,
        accountId,
        userId,
        metadata
      },
      {
        priority,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000
        }
      }
    );

    return {
      jobId: job.id,
      emailLogId
    };
  }

  /**
   * Send email immediately (used by worker)
   */
  async sendEmail(jobData) {
    const { emailLogId, template, to, data, language } = jobData;

    if (!this.isReady()) {
      throw new Error('Email service not configured');
    }

    // Render template
    const rendered = await emailTemplateService.render(template, data, language);

    // Update subject in log
    await db.query(
      'UPDATE email_logs SET subject = $1 WHERE id = $2',
      [rendered.subject, emailLogId]
    );

    // Send email
    const mailOptions = {
      from: `"${emailConfig.defaults.from.name}" <${emailConfig.defaults.from.email}>`,
      to: to.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: emailConfig.defaults.replyTo
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      // Update log
      await db.query(
        `UPDATE email_logs
         SET status = 'sent', message_id = $1, sent_at = NOW()
         WHERE id = $2`,
        [info.messageId, emailLogId]
      );

      return { success: true, messageId: info.messageId };
    } catch (error) {
      // Update log with error
      await db.query(
        `UPDATE email_logs
         SET status = 'failed', failed_at = NOW(), error_message = $1
         WHERE id = $2`,
        [error.message, emailLogId]
      );

      throw error;
    }
  }

  // ============================================
  // Convenience methods for specific emails
  // ============================================

  /**
   * Send welcome email
   */
  async sendWelcome(user, accountId) {
    return this.queueEmail({
      template: 'welcome',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
      },
      language: user.preferred_language || 'en',
      priority: 1,
      accountId,
      userId: user.id,
      category: 'transactional'
    });
  }

  /**
   * Send welcome email with password setup link (for users created via Stripe checkout)
   */
  async sendWelcomeWithPasswordSetup(user, setupUrl, accountId) {
    return this.queueEmail({
      template: 'welcome',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        dashboardUrl: setupUrl, // Use password setup URL instead of dashboard
        isNewAccount: true,
        setupPasswordUrl: setupUrl
      },
      language: user.preferred_language || 'en',
      priority: 1,
      accountId,
      category: 'transactional'
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(user, resetToken, accountId) {
    return this.queueEmail({
      template: 'password-reset',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        expiryHours: 24
      },
      language: user.preferred_language || 'en',
      priority: 1,
      accountId,
      userId: user.id,
      category: 'transactional'
    });
  }

  /**
   * Send team invitation email
   */
  async sendInvitation(email, inviterName, inviteToken, accountId) {
    return this.queueEmail({
      template: 'invite-user',
      to: { email },
      data: {
        inviterName,
        inviteUrl: `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`
      },
      priority: 2,
      accountId,
      category: 'transactional'
    });
  }

  /**
   * Send invoice email
   */
  async sendInvoice(user, invoice, accountId) {
    return this.queueEmail({
      template: 'invoice',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        invoiceNumber: invoice.number,
        amount: (invoice.total_cents / 100).toFixed(2),
        currency: invoice.currency?.toUpperCase() || 'USD',
        dueDate: invoice.due_date,
        invoiceUrl: invoice.hosted_invoice_url,
        pdfUrl: invoice.invoice_pdf_url
      },
      language: user.preferred_language || 'en',
      priority: 2,
      accountId,
      userId: user.id,
      category: 'billing',
      metadata: { invoice_id: invoice.stripe_invoice_id }
    });
  }

  /**
   * Send payment failed email
   */
  async sendPaymentFailed(user, details, accountId) {
    return this.queueEmail({
      template: 'payment-failed',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        amount: details.amount,
        lastFourDigits: details.lastFourDigits || '****',
        retryDate: details.retryDate,
        updatePaymentUrl: `${process.env.FRONTEND_URL}/settings/billing`
      },
      language: user.preferred_language || 'en',
      priority: 1,
      accountId,
      userId: user.id,
      category: 'billing'
    });
  }

  /**
   * Send trial ending reminder
   */
  async sendTrialEnding(user, daysRemaining, accountId) {
    return this.queueEmail({
      template: 'trial-ending',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        daysRemaining,
        upgradeUrl: `${process.env.FRONTEND_URL}/pricing`
      },
      language: user.preferred_language || 'en',
      priority: 2,
      accountId,
      userId: user.id,
      category: 'billing'
    });
  }

  /**
   * Send subscription canceled email
   */
  async sendSubscriptionCanceled(user, endDate, accountId) {
    return this.queueEmail({
      template: 'subscription-canceled',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        endDate,
        dataRetentionDays: 30,
        reactivateUrl: `${process.env.FRONTEND_URL}/settings/billing`
      },
      language: user.preferred_language || 'en',
      priority: 2,
      accountId,
      userId: user.id,
      category: 'billing'
    });
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccess(user, details, accountId) {
    return this.queueEmail({
      template: 'payment-success',
      to: { email: user.email, name: user.name },
      data: {
        name: user.name,
        amount: details.amount,
        planName: details.planName,
        nextBillingDate: details.nextBillingDate,
        invoiceUrl: details.invoiceUrl
      },
      language: user.preferred_language || 'en',
      priority: 3,
      accountId,
      userId: user.id,
      category: 'billing'
    });
  }

  /**
   * Send admin notification for new partner registration with approve/reject buttons
   */
  async sendPartnerRegistrationNotification(partner, approvalToken) {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'guilherme@orbitflow.com.br';
    const apiUrl = process.env.API_URL || 'https://api.getraze.co';

    if (!this.isReady()) {
      console.warn('Email service not configured, skipping partner registration notification');
      return null;
    }

    const approveUrl = `${apiUrl}/api/partners/quick-approve/${partner.id}?token=${approvalToken}&action=approve`;
    const rejectUrl = `${apiUrl}/api/partners/quick-approve/${partner.id}?token=${approvalToken}&action=reject`;

    const mailOptions = {
      from: `"GetRaze Partners" <${emailConfig.defaults.from.email}>`,
      to: adminEmail,
      subject: `[GetRaze] Novo cadastro de Partner: ${partner.name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366F1; margin-bottom: 20px;">Novo Partner Cadastrado</h2>

          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Nome:</strong> ${partner.name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${partner.email}</p>
            <p style="margin: 5px 0;"><strong>Telefone:</strong> ${partner.phone || 'Não informado'}</p>
            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${partner.type === 'individual' ? 'Individual' : 'Empresa'}</p>
            <p style="margin: 5px 0;"><strong>País:</strong> ${partner.country || 'Não informado'}</p>
            <p style="margin: 5px 0;"><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>

          <p style="color: #666; margin-bottom: 20px;">
            Clique em um dos botões abaixo para aprovar ou reprovar este cadastro:
          </p>

          <div style="display: flex; gap: 12px; margin-bottom: 30px;">
            <a href="${approveUrl}"
               style="display: inline-block; background-color: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              ✓ Aprovar Partner
            </a>
            <a href="${rejectUrl}"
               style="display: inline-block; background-color: #EF4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              ✗ Reprovar
            </a>
          </div>

          <p style="color: #999; font-size: 12px;">
            Ou acesse o painel admin: <a href="${process.env.FRONTEND_URL || 'https://app.getraze.co'}/admin/partners">Ver todos os partners</a>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            Esta é uma notificação automática do sistema GetRaze Partners.
          </p>
        </div>
      `,
      text: `Novo Partner Cadastrado\n\nNome: ${partner.name}\nEmail: ${partner.email}\nTelefone: ${partner.phone || 'Não informado'}\nTipo: ${partner.type}\nPaís: ${partner.country || 'Não informado'}\n\nAprovar: ${approveUrl}\nReprovar: ${rejectUrl}`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Partner registration notification sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending partner registration notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send approval email to partner with set password link
   */
  async sendPartnerApprovalEmail(partner, setPasswordUrl) {
    if (!this.isReady()) {
      console.warn('Email service not configured, skipping partner approval email');
      return null;
    }

    const mailOptions = {
      from: `"GetRaze Partners" <${emailConfig.defaults.from.email}>`,
      to: partner.email,
      subject: `Parabéns! Você foi aprovado como Partner GetRaze`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10B981; margin-bottom: 10px;">🎉 Parabéns, ${partner.name}!</h1>
            <p style="color: #666; font-size: 18px;">Sua conta de Partner foi aprovada!</p>
          </div>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0; color: #166534;">
              Agora você faz parte do programa de Partners GetRaze e pode começar a indicar clientes e ganhar <strong>10% de comissão recorrente</strong> em cada pagamento!
            </p>
          </div>

          <p style="color: #666; margin-bottom: 20px;">
            Para acessar seu painel de Partner, primeiro defina sua senha clicando no botão abaixo:
          </p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${setPasswordUrl}"
               style="display: inline-block; background-color: #6366F1; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Criar Minha Senha
            </a>
          </p>

          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Seu código de afiliado:</h3>
            <p style="font-size: 24px; font-weight: bold; color: #6366F1; margin: 10px 0; font-family: monospace;">
              ${partner.affiliate_code}
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 0;">
              Compartilhe este código ou seu link personalizado com seus clientes!
            </p>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Este link expira em 7 dias. Se tiver problemas, entre em contato conosco.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            GetRaze Partners - Ganhe comissões indicando clientes
          </p>
        </div>
      `,
      text: `Parabéns, ${partner.name}!\n\nSua conta de Partner foi aprovada!\n\nSeu código de afiliado: ${partner.affiliate_code}\n\nCrie sua senha: ${setPasswordUrl}\n\nEste link expira em 7 dias.`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Partner approval email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending partner approval email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send rejection email to partner
   */
  async sendPartnerRejectionEmail(partner) {
    if (!this.isReady()) {
      console.warn('Email service not configured, skipping partner rejection email');
      return null;
    }

    const mailOptions = {
      from: `"GetRaze Partners" <${emailConfig.defaults.from.email}>`,
      to: partner.email,
      subject: `Atualização sobre sua solicitação de Partner GetRaze`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Olá, ${partner.name}</h2>

          <p style="color: #666; line-height: 1.6;">
            Agradecemos seu interesse em fazer parte do programa de Partners GetRaze.
          </p>

          <p style="color: #666; line-height: 1.6;">
            Após análise da sua solicitação, infelizmente não conseguimos aprovar seu cadastro neste momento.
          </p>

          <p style="color: #666; line-height: 1.6;">
            Isso pode ter ocorrido por diversos motivos. Se você acredita que houve um engano ou gostaria de mais informações, não hesite em entrar em contato conosco respondendo este email.
          </p>

          <p style="color: #666; line-height: 1.6; margin-top: 20px;">
            Atenciosamente,<br>
            Equipe GetRaze
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            GetRaze - Plataforma de Prospecção B2B
          </p>
        </div>
      `,
      text: `Olá, ${partner.name}\n\nAgradecemos seu interesse em fazer parte do programa de Partners GetRaze.\n\nApós análise da sua solicitação, infelizmente não conseguimos aprovar seu cadastro neste momento.\n\nSe você acredita que houve um engano, entre em contato conosco.\n\nAtenciosamente,\nEquipe GetRaze`
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Partner rejection email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending partner rejection email:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
