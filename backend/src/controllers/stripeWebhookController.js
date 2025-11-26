/**
 * Stripe Webhook Controller
 *
 * Handles incoming Stripe webhook events
 */

const stripeService = require('../services/stripeService');
const subscriptionService = require('../services/subscriptionService');
const billingService = require('../services/billingService');
const emailService = require('../services/emailService');
const { CREDIT_PACKAGES, getPlanByPriceId } = require('../config/stripe');
const db = require('../config/database');

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
  const accountId = session.metadata?.account_id;
  if (!accountId) {
    console.error('Checkout session missing account_id in metadata');
    return;
  }

  // Handle credit purchase
  if (session.mode === 'payment' && session.metadata?.credit_package) {
    const packageKey = session.metadata.credit_package;
    const creditPackage = CREDIT_PACKAGES[packageKey];

    if (creditPackage) {
      await billingService.addCreditPackage({
        accountId,
        creditType: 'gmaps',
        credits: creditPackage.credits,
        validityDays: creditPackage.validityDays,
        source: 'purchase',
        stripeCheckoutSessionId: session.id,
        pricePaidCents: session.amount_total,
        currency: session.currency?.toUpperCase() || 'USD'
      });

      console.log(`Added ${creditPackage.credits} credits to account ${accountId}`);
    }
  }

  // For subscriptions, the subscription.created event will handle the rest
  console.log(`Checkout completed for account ${accountId}`);
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

  // If this is a subscription invoice (not first one), renew credits
  if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
    const subscription = await subscriptionService.getByStripeId(invoice.subscription);
    if (subscription) {
      await billingService.addMonthlyCredits(subscription.account_id, subscription.plan_type);
      console.log(`Renewed monthly credits for account ${subscription.account_id}`);
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
