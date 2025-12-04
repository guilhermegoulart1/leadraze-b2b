/**
 * Stripe Webhook Controller
 *
 * Handles incoming Stripe webhook events
 */

const stripeService = require('../services/stripeService');
const subscriptionService = require('../services/subscriptionService');
const billingService = require('../services/billingService');
const emailService = require('../services/emailService');
const affiliateService = require('../services/affiliateService');
const partnerService = require('../services/partnerService');
const { CREDIT_PACKAGES, getPlanByPriceId, TRIAL_LIMITS } = require('../config/stripe');
const db = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Handle Stripe webhook
 */
exports.handleWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    // Verify webhook signature
    event = stripeService.verifyWebhookSignature(req.body, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Check if we've already processed this event (idempotency)
  const existingEvent = await db.query(
    'SELECT id FROM stripe_webhook_events WHERE stripe_event_id = $1',
    [event.id]
  );

  if (existingEvent.rows.length > 0) {
    console.log(`Webhook event ${event.id} already processed, skipping`);
    return res.json({ received: true, status: 'already_processed' });
  }

  // Log the event
  await db.query(
    `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, payload, api_version)
     VALUES ($1, $2, $3, $4)`,
    [event.id, event.type, JSON.stringify(event.data), event.api_version]
  );

  try {
    // Process event based on type
    await processEvent(event);

    // Mark as processed
    await db.query(
      `UPDATE stripe_webhook_events
       SET status = 'processed', processed_at = NOW()
       WHERE stripe_event_id = $1`,
      [event.id]
    );

    res.json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);

    // Mark as failed
    await db.query(
      `UPDATE stripe_webhook_events
       SET status = 'failed', error_message = $1, retry_count = retry_count + 1
       WHERE stripe_event_id = $2`,
      [error.message, event.id]
    );

    // Still return 200 to prevent Stripe from retrying
    res.json({ received: true, error: error.message });
  }
};

/**
 * Process webhook event
 */
async function processEvent(event) {
  const { type, data } = event;
  const object = data.object;

  console.log(`Processing Stripe webhook: ${type}`);

  switch (type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(object);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(object);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(object);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(object);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(object);
      break;

    default:
      console.log(`Unhandled event type: ${type}`);
  }
}

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutCompleted(session) {
  const isGuest = session.metadata?.is_guest === 'true';
  let accountId = session.metadata?.account_id;

  // Handle GUEST checkout - create account from Stripe data
  if (isGuest && !accountId) {
    console.log('🆕 Processing guest checkout - creating account...');

    // Get customer data from Stripe
    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerName = session.customer_details?.name || customerEmail?.split('@')[0] || 'User';
    const customerPhone = session.customer_details?.phone || null;
    const customerAddress = session.customer_details?.address || null;
    const stripeCustomerId = session.customer;

    if (!customerEmail) {
      console.error('❌ Guest checkout missing customer email');
      return;
    }

    console.log(`📋 Customer data: email=${customerEmail}, name=${customerName}, phone=${customerPhone}`);
    if (customerAddress) {
      console.log(`📍 Address: ${customerAddress.line1}, ${customerAddress.city}, ${customerAddress.state}, ${customerAddress.country}`);
    }

    // Check if user already exists with this email
    const existingUser = await db.query(
      'SELECT id, account_id FROM users WHERE email = $1',
      [customerEmail.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      // User exists - use their account
      accountId = existingUser.rows[0].account_id;
      console.log(`✅ Found existing account for ${customerEmail}: ${accountId}`);

      // Update Stripe customer ID if needed
      await db.query(
        'UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL',
        [stripeCustomerId, accountId]
      );

      // Update phone if provided and not already set
      if (customerPhone) {
        await db.query(
          'UPDATE users SET phone = $1 WHERE id = $2 AND phone IS NULL',
          [customerPhone, existingUser.rows[0].id]
        );
      }
    } else {
      // Create new account and user
      const result = await createAccountFromStripe({
        email: customerEmail,
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        stripeCustomerId,
        extraChannels: parseInt(session.metadata?.extra_channels) || 0,
        extraUsers: parseInt(session.metadata?.extra_users) || 0
      });

      accountId = result.accountId;
      console.log(`✅ Created new account for ${customerEmail}: ${accountId}`);
    }

    // Update subscription metadata with account_id for future events
    if (session.subscription) {
      const { stripe } = require('../config/stripe');
      await stripe.subscriptions.update(session.subscription, {
        metadata: {
          account_id: accountId,
          extra_channels: session.metadata?.extra_channels || '0',
          extra_users: session.metadata?.extra_users || '0'
        }
      });
    }
  }

  if (!accountId) {
    console.error('Checkout session missing account_id in metadata');
    return;
  }

  // Handle credit purchase (one-time purchases NEVER expire)
  if (session.mode === 'payment' && session.metadata?.credit_package) {
    const packageKey = session.metadata.credit_package;
    const creditPackage = CREDIT_PACKAGES[packageKey];
    const neverExpires = session.metadata?.never_expires === 'true';

    if (creditPackage) {
      await stripeService.addCreditsToAccount(
        accountId,
        creditPackage.credits,
        neverExpires,
        'purchase_onetime',
        {
          checkoutSessionId: session.id,
          paymentIntentId: session.payment_intent
        }
      );

      console.log(`Added ${creditPackage.credits} credits to account ${accountId} (never expires: ${neverExpires})`);
    }
  }

  // Handle affiliate referral tracking
  if (session.metadata?.affiliate_code) {
    try {
      const affiliateCode = session.metadata.affiliate_code;
      const affiliateLink = await affiliateService.getAffiliateLinkByCode(affiliateCode);

      if (affiliateLink) {
        // Create referral record
        const customerEmail = session.customer_details?.email || session.customer_email;
        await affiliateService.createReferral(affiliateLink.id, customerEmail, session.id);
        console.log(`🤝 Created affiliate referral: ${affiliateCode} -> ${customerEmail}`);

        // If we have accountId and subscription, mark as converted immediately
        if (accountId && session.subscription) {
          await affiliateService.convertReferral(accountId, session.subscription);
          console.log(`✅ Affiliate referral converted for account ${accountId}`);
        }
      } else {
        console.log(`⚠️ Affiliate code not found: ${affiliateCode}`);
      }
    } catch (affError) {
      console.error('Error processing affiliate referral:', affError.message);
      // Don't fail the checkout for affiliate errors
    }
  }

  // Handle partner referral tracking
  if (session.metadata?.partner_code) {
    try {
      const partnerCode = session.metadata.partner_code;
      const partner = await partnerService.getByAffiliateCode(partnerCode);

      if (partner) {
        // Create referral record
        const customerEmail = session.customer_details?.email || session.customer_email;
        await partnerService.createReferral(partner.id, customerEmail, session.id);
        console.log(`🤝 Created partner referral: ${partnerCode} -> ${customerEmail}`);

        // If we have accountId and subscription, mark as converted immediately
        if (accountId && session.subscription) {
          await partnerService.convertReferral(accountId, session.subscription);
          console.log(`✅ Partner referral converted for account ${accountId}`);
        }
      } else {
        console.log(`⚠️ Partner code not found: ${partnerCode}`);
      }
    } catch (partnerError) {
      console.error('Error processing partner referral:', partnerError.message);
      // Don't fail the checkout for partner errors
    }
  }

  console.log(`✅ Checkout completed for account ${accountId}`);
}

/**
 * Create account and user from Stripe checkout data
 */
async function createAccountFromStripe({ email, name, phone, address, stripeCustomerId, extraChannels, extraUsers }) {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Add random suffix to ensure uniqueness
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    // Create account
    const accountResult = await client.query(`
      INSERT INTO accounts (name, slug, stripe_customer_id, subscription_status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `, [name, uniqueSlug, stripeCustomerId]);

    const accountId = accountResult.rows[0].id;

    // Generate password reset token (user will set password via email)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create temporary password (will be replaced when user sets their password)
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create admin user (with phone and billing address if provided)
    await client.query(`
      INSERT INTO users (account_id, email, password_hash, name, phone, billing_address, role, is_active, password_reset_token, password_reset_expires)
      VALUES ($1, $2, $3, $4, $5, $6, 'admin', true, $7, $8)
    `, [accountId, email.toLowerCase(), passwordHash, name, phone, address ? JSON.stringify(address) : null, resetTokenHash, resetTokenExpiry]);

    await client.query('COMMIT');

    // Send welcome email with password setup link
    try {
      const setupUrl = `${process.env.FRONTEND_URL}/set-password?token=${resetToken}`;
      await emailService.sendWelcomeWithPasswordSetup({
        email,
        name
      }, setupUrl, accountId);
      console.log(`📧 Sent welcome email to ${email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError.message);
    }

    return { accountId, email, resetToken };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdated(subscription) {
  // Get account ID from subscription metadata or customer
  let accountId = subscription.metadata?.account_id;

  if (!accountId) {
    // Try to find account by customer ID
    const accountResult = await db.query(
      'SELECT id FROM accounts WHERE stripe_customer_id = $1',
      [subscription.customer]
    );

    if (accountResult.rows.length > 0) {
      accountId = accountResult.rows[0].id;
    }
  }

  if (!accountId) {
    console.error('Could not determine account_id for subscription', subscription.id);
    return;
  }

  // Sync subscription to database
  const localSubscription = await subscriptionService.syncFromStripe(subscription, accountId);

  // If trial is starting, add one-time trial credits
  if (subscription.status === 'trialing') {
    // Check if we already gave trial credits to this account (using 'bonus' as source)
    const existingTrialCredits = await db.query(
      `SELECT id FROM credit_packages
       WHERE account_id = $1 AND source = 'bonus' AND credit_type = 'gmaps' AND initial_credits = $2`,
      [accountId, TRIAL_LIMITS.trialGmapsCredits]
    );

    if (existingTrialCredits.rows.length === 0) {
      // Calculate trial end date (7 days from now or from subscription.trial_end)
      const trialEndDate = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Add trial credits (20 gmaps credits, expire at trial end, using 'bonus' as allowed source)
      await db.query(
        `INSERT INTO credit_packages (
          account_id, credit_type, initial_credits, remaining_credits,
          expires_at, never_expires, source, status
        ) VALUES ($1, $2, $3, $3, $4, false, 'bonus', 'active')`,
        [accountId, 'gmaps', TRIAL_LIMITS.trialGmapsCredits, trialEndDate]
      );

      console.log(`Added ${TRIAL_LIMITS.trialGmapsCredits} trial credits to account ${accountId}`);
    }
  }

  // If this is a new subscription or status changed to active, add monthly credits
  if (subscription.status === 'active') {
    const planType = localSubscription.plan_type;
    await billingService.addMonthlyCredits(accountId, planType);
    console.log(`Added monthly credits for ${planType} plan to account ${accountId}`);
  }

  console.log(`Subscription ${subscription.id} synced for account ${accountId}`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription) {
  const deletedSubscription = await subscriptionService.handleDeletion(subscription.id);

  if (deletedSubscription) {
    // Send cancellation email
    const adminUser = await getAccountAdmin(deletedSubscription.account_id);
    if (adminUser) {
      const endDate = new Date(subscription.current_period_end * 1000).toLocaleDateString();
      await emailService.sendSubscriptionCanceled(
        adminUser,
        endDate,
        deletedSubscription.account_id
      );
    }

    // Cancel affiliate referral if this account was referred
    try {
      const canceledReferral = await affiliateService.cancelReferral(deletedSubscription.account_id);
      if (canceledReferral) {
        console.log(`🚫 Affiliate referral canceled for account ${deletedSubscription.account_id}`);
      }
    } catch (affError) {
      console.error('Error canceling affiliate referral:', affError.message);
    }

    // Cancel partner referral if this account was referred
    try {
      const canceledPartnerReferral = await partnerService.cancelReferral(deletedSubscription.account_id);
      if (canceledPartnerReferral) {
        console.log(`🚫 Partner referral canceled for account ${deletedSubscription.account_id}`);
      }
    } catch (partnerError) {
      console.error('Error canceling partner referral:', partnerError.message);
    }
  }

  console.log(`Subscription ${subscription.id} deleted`);
}

/**
 * Handle trial will end (3 days before)
 */
async function handleTrialWillEnd(subscription) {
  let accountId = subscription.metadata?.account_id;

  if (!accountId) {
    const accountResult = await db.query(
      'SELECT id FROM accounts WHERE stripe_customer_id = $1',
      [subscription.customer]
    );
    accountId = accountResult.rows[0]?.id;
  }

  if (accountId) {
    const adminUser = await getAccountAdmin(accountId);
    if (adminUser) {
      const trialEnd = new Date(subscription.trial_end * 1000);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

      await emailService.sendTrialEnding(adminUser, daysRemaining, accountId);
      console.log(`Sent trial ending email to account ${accountId}`);
    }
  }
}

/**
 * Handle invoice paid
 */
async function handleInvoicePaid(invoice) {
  // Cache invoice
  await cacheInvoice(invoice);

  // Get account ID
  const accountResult = await db.query(
    'SELECT id FROM accounts WHERE stripe_customer_id = $1',
    [invoice.customer]
  );
  const accountId = accountResult.rows[0]?.id;

  // If this is a subscription invoice (not first one), renew credits
  if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
    const subscription = await subscriptionService.getByStripeId(invoice.subscription);
    if (subscription) {
      await billingService.addMonthlyCredits(subscription.account_id, subscription.plan_type);
      console.log(`Renewed monthly credits for account ${subscription.account_id}`);
    }
  }

  // Process affiliate commission if this account was referred
  if (accountId && invoice.amount_paid > 0) {
    try {
      const referral = await affiliateService.getActiveReferralByAccount(accountId);
      if (referral) {
        const earning = await affiliateService.recordEarning(
          referral.id,
          invoice.id,
          invoice.amount_paid,
          10 // 10% commission
        );

        if (earning) {
          console.log(`💰 Affiliate earning recorded: $${(earning.earning_cents / 100).toFixed(2)} for referral ${referral.id}`);
        }
      }
    } catch (affError) {
      console.error('Error processing affiliate earning:', affError.message);
      // Don't fail invoice processing for affiliate errors
    }

    // Process partner commission if this account was referred by a partner
    try {
      const partnerReferral = await partnerService.getActiveReferralByAccount(accountId);
      if (partnerReferral) {
        const partnerEarning = await partnerService.recordEarning(
          partnerReferral.id,
          invoice.id,
          invoice.amount_paid,
          10 // 10% commission
        );

        if (partnerEarning) {
          console.log(`💰 Partner earning recorded: $${(partnerEarning.earning_cents / 100).toFixed(2)} for referral ${partnerReferral.id}`);
        }
      }
    } catch (partnerError) {
      console.error('Error processing partner earning:', partnerError.message);
      // Don't fail invoice processing for partner errors
    }
  }

  console.log(`Invoice ${invoice.id} paid`);
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice) {
  // Cache invoice
  await cacheInvoice(invoice);

  // Get account
  const accountResult = await db.query(
    'SELECT id FROM accounts WHERE stripe_customer_id = $1',
    [invoice.customer]
  );

  const accountId = accountResult.rows[0]?.id;
  if (accountId) {
    // Update subscription status
    if (invoice.subscription) {
      await db.query(
        `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [invoice.subscription]
      );

      await db.query(
        'UPDATE accounts SET subscription_status = $1 WHERE id = $2',
        ['past_due', accountId]
      );
    }

    // Send payment failed email
    const adminUser = await getAccountAdmin(accountId);
    if (adminUser) {
      await emailService.sendPaymentFailed(
        adminUser,
        {
          amount: `$${(invoice.amount_due / 100).toFixed(2)}`,
          retryDate: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
            : 'Soon'
        },
        accountId
      );
    }
  }

  console.log(`Invoice ${invoice.id} payment failed`);
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(invoice) {
  // Cache invoice
  await cacheInvoice(invoice);

  // Get account
  const accountResult = await db.query(
    'SELECT id FROM accounts WHERE stripe_customer_id = $1',
    [invoice.customer]
  );

  const accountId = accountResult.rows[0]?.id;
  if (accountId) {
    // Send payment success email for subscription invoices
    if (invoice.subscription && invoice.billing_reason !== 'subscription_create') {
      const subscription = await subscriptionService.getByStripeId(invoice.subscription);
      const adminUser = await getAccountAdmin(accountId);

      if (adminUser && subscription) {
        const planInfo = getPlanByPriceId(subscription.stripe_price_id);
        await emailService.sendPaymentSuccess(
          adminUser,
          {
            amount: `$${(invoice.amount_paid / 100).toFixed(2)}`,
            planName: planInfo?.name || subscription.plan_type,
            nextBillingDate: subscription.current_period_end
              ? new Date(subscription.current_period_end).toLocaleDateString()
              : 'N/A',
            invoiceUrl: invoice.hosted_invoice_url
          },
          accountId
        );
      }
    }
  }

  console.log(`Invoice ${invoice.id} payment succeeded`);
}

/**
 * Cache invoice in local database
 */
async function cacheInvoice(invoice) {
  // Get account ID
  const accountResult = await db.query(
    'SELECT id FROM accounts WHERE stripe_customer_id = $1',
    [invoice.customer]
  );

  const accountId = accountResult.rows[0]?.id;
  if (!accountId) return;

  await db.query(
    `INSERT INTO invoices (
      account_id, stripe_invoice_id, stripe_subscription_id, stripe_customer_id,
      number, status, amount_due_cents, amount_paid_cents, subtotal_cents,
      tax_cents, total_cents, currency, hosted_invoice_url, invoice_pdf_url,
      period_start, period_end, due_date, paid_at, line_items
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (stripe_invoice_id) DO UPDATE SET
      status = EXCLUDED.status,
      amount_paid_cents = EXCLUDED.amount_paid_cents,
      hosted_invoice_url = EXCLUDED.hosted_invoice_url,
      invoice_pdf_url = EXCLUDED.invoice_pdf_url,
      paid_at = EXCLUDED.paid_at`,
    [
      accountId,
      invoice.id,
      invoice.subscription,
      invoice.customer,
      invoice.number,
      invoice.status,
      invoice.amount_due,
      invoice.amount_paid,
      invoice.subtotal,
      invoice.tax || 0,
      invoice.total,
      invoice.currency?.toUpperCase() || 'USD',
      invoice.hosted_invoice_url,
      invoice.invoice_pdf,
      invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      invoice.status === 'paid' ? new Date() : null,
      JSON.stringify(invoice.lines?.data || [])
    ]
  );
}

/**
 * Get admin user for an account
 */
async function getAccountAdmin(accountId) {
  const result = await db.query(
    `SELECT id, email, name, preferred_language
     FROM users
     WHERE account_id = $1 AND role = 'admin'
     ORDER BY created_at ASC
     LIMIT 1`,
    [accountId]
  );
  return result.rows[0] || null;
}
