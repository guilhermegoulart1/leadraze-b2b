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
}

module.exports = new EmailService();
