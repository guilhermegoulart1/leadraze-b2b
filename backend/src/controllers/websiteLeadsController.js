// backend/src/controllers/websiteLeadsController.js
const db = require('../config/database');

/**
 * Capture a lead from the website (public - no auth required)
 */
const captureLead = async (req, res) => {
  try {
    const {
      email,
      source = 'hero',
      locale = 'en',
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      referrer,
      affiliate_code,
      extra_data = {}
    } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    // Get IP and user agent
    const ip_address = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.connection?.remoteAddress;
    const user_agent = req.headers['user-agent'];

    // Check if lead already exists
    const existingLead = await db.query(
      'SELECT id, status, stripe_customer_id FROM website_leads WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingLead.rows.length > 0) {
      // Lead exists - update last visit info but don't overwrite status
      const lead = existingLead.rows[0];

      await db.query(`
        UPDATE website_leads
        SET
          updated_at = CURRENT_TIMESTAMP,
          extra_data = extra_data || $1::jsonb
        WHERE id = $2
      `, [
        JSON.stringify({ last_visit: new Date().toISOString(), ...extra_data }),
        lead.id
      ]);

      return res.json({
        success: true,
        data: {
          id: lead.id,
          email: email.toLowerCase().trim(),
          status: lead.status,
          is_existing: true,
          has_stripe: !!lead.stripe_customer_id
        }
      });
    }

    // Insert new lead
    const result = await db.query(`
      INSERT INTO website_leads (
        email, source, locale,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        referrer, ip_address, user_agent, affiliate_code, extra_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, email, status, created_at
    `, [
      email.toLowerCase().trim(),
      source,
      locale,
      utm_source || null,
      utm_medium || null,
      utm_campaign || null,
      utm_content || null,
      utm_term || null,
      referrer || null,
      ip_address || null,
      user_agent || null,
      affiliate_code || null,
      JSON.stringify(extra_data)
    ]);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        is_existing: false
      }
    });

  } catch (error) {
    console.error('Error capturing lead:', error);

    // Handle unique constraint violation gracefully
    if (error.code === '23505') {
      return res.json({
        success: true,
        data: {
          email: req.body.email,
          is_existing: true
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to capture lead'
    });
  }
};

/**
 * Update lead status (called from Stripe webhook or checkout)
 */
const updateLeadStatus = async (email, status, stripeData = {}) => {
  try {
    const updates = {
      status,
      updated_at: new Date()
    };

    if (stripeData.customer_id) {
      updates.stripe_customer_id = stripeData.customer_id;
    }
    if (stripeData.session_id) {
      updates.stripe_session_id = stripeData.session_id;
    }
    if (status === 'trial_started') {
      updates.trial_started_at = new Date();
    }
    if (status === 'subscribed') {
      updates.subscribed_at = new Date();
    }
    if (stripeData.channels) {
      updates.plan_channels = stripeData.channels;
    }
    if (stripeData.users) {
      updates.plan_users = stripeData.users;
    }
    if (stripeData.amount) {
      updates.plan_amount = stripeData.amount;
    }

    const setClauses = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`);

    await db.query(`
      UPDATE website_leads
      SET ${setClauses.join(', ')}
      WHERE email = $1
    `, [email.toLowerCase().trim(), ...Object.values(updates)]);

    return true;
  } catch (error) {
    console.error('Error updating lead status:', error);
    return false;
  }
};

/**
 * Get all leads (admin - requires auth)
 */
const getLeads = async (req, res) => {
  try {
    const {
      status,
      source,
      search,
      limit = 50,
      offset = 0,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    let query = `
      SELECT *
      FROM website_leads
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (source) {
      query += ` AND source = $${paramIndex++}`;
      params.push(source);
    }

    if (search) {
      query += ` AND email ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    // Validate sort column to prevent SQL injection
    const allowedSorts = ['created_at', 'updated_at', 'email', 'status', 'source'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM website_leads WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND status = $${countParamIndex++}`;
      countParams.push(status);
    }
    if (source) {
      countQuery += ` AND source = $${countParamIndex++}`;
      countParams.push(source);
    }
    if (search) {
      countQuery += ` AND email ILIKE $${countParamIndex++}`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leads'
    });
  }
};

/**
 * Get lead stats (admin - requires auth)
 */
const getLeadStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const stats = await db.query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'captured' THEN 1 END) as captured,
        COUNT(CASE WHEN status = 'trial_started' THEN 1 END) as trial_started,
        COUNT(CASE WHEN status = 'subscribed' THEN 1 END) as subscribed,
        COUNT(CASE WHEN status = 'churned' THEN 1 END) as churned,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as today,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week
      FROM website_leads
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
    `);

    const bySource = await db.query(`
      SELECT
        source,
        COUNT(*) as leads,
        COUNT(CASE WHEN status = 'trial_started' THEN 1 END) as trials,
        COUNT(CASE WHEN status = 'subscribed' THEN 1 END) as subscriptions
      FROM website_leads
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY source
      ORDER BY leads DESC
    `);

    const dailyStats = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as leads,
        COUNT(CASE WHEN status = 'trial_started' THEN 1 END) as trials,
        COUNT(CASE WHEN status = 'subscribed' THEN 1 END) as subscriptions
      FROM website_leads
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    // Calculate conversion rates
    const overview = stats.rows[0];
    const conversionRates = {
      capture_to_trial: overview.total_leads > 0
        ? ((overview.trial_started / overview.total_leads) * 100).toFixed(1)
        : 0,
      trial_to_subscription: overview.trial_started > 0
        ? ((overview.subscribed / overview.trial_started) * 100).toFixed(1)
        : 0,
      overall_conversion: overview.total_leads > 0
        ? ((overview.subscribed / overview.total_leads) * 100).toFixed(1)
        : 0
    };

    res.json({
      success: true,
      data: {
        overview: {
          ...overview,
          conversion_rates: conversionRates
        },
        bySource: bySource.rows,
        daily: dailyStats.rows
      }
    });

  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lead stats'
    });
  }
};

/**
 * Export leads as CSV (admin - requires auth)
 */
const exportLeads = async (req, res) => {
  try {
    const { status, source, start_date, end_date } = req.query;

    let query = `
      SELECT
        email,
        status,
        source,
        locale,
        utm_source,
        utm_medium,
        utm_campaign,
        affiliate_code,
        stripe_customer_id,
        plan_channels,
        plan_users,
        plan_amount,
        created_at,
        trial_started_at,
        subscribed_at
      FROM website_leads
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (source) {
      query += ` AND source = $${paramIndex++}`;
      params.push(source);
    }
    if (start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);

    // Generate CSV
    const headers = [
      'Email', 'Status', 'Source', 'Locale', 'UTM Source', 'UTM Medium',
      'UTM Campaign', 'Affiliate Code', 'Stripe Customer', 'Plan Channels',
      'Plan Users', 'Plan Amount', 'Created At', 'Trial Started', 'Subscribed At'
    ];

    const rows = result.rows.map(row => [
      row.email,
      row.status,
      row.source,
      row.locale,
      row.utm_source || '',
      row.utm_medium || '',
      row.utm_campaign || '',
      row.affiliate_code || '',
      row.stripe_customer_id || '',
      row.plan_channels || '',
      row.plan_users || '',
      row.plan_amount ? (row.plan_amount / 100).toFixed(2) : '',
      row.created_at,
      row.trial_started_at || '',
      row.subscribed_at || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=website_leads.csv');
    res.send(csv);

  } catch (error) {
    console.error('Error exporting leads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export leads'
    });
  }
};

module.exports = {
  captureLead,
  updateLeadStatus,
  getLeads,
  getLeadStats,
  exportLeads
};
