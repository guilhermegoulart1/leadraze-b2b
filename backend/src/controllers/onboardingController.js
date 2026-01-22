const db = require('../config/database');

/**
 * Get onboarding for the current account
 */
exports.getOnboarding = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const query = `
      SELECT *
      FROM onboarding_responses
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [accountId]);

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Error getting onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar onboarding',
      error: error.message
    });
  }
};

/**
 * Create a new onboarding
 */
exports.createOnboarding = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;

    // Check if already exists
    const existingQuery = `
      SELECT id FROM onboarding_responses WHERE account_id = $1
    `;
    const existing = await db.query(existingQuery, [accountId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding já existe para esta conta. Use PUT para atualizar.'
      });
    }

    const {
      // Etapa 1
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      // Etapa 2
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      // Etapa 3
      faq, objections, policies, business_hours, escalation_triggers,
      // Etapa 4
      goals, lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      // Contato
      contact_name, contact_role, contact_email, contact_phone,
      // Status
      current_step, status
    } = req.body;

    const query = `
      INSERT INTO onboarding_responses (
        account_id, user_id,
        company_name, website, industry, company_size, description,
        products_services, differentials, success_cases,
        ideal_customer, target_roles, target_location, target_industries,
        buying_signals, main_problem,
        faq, objections, policies, business_hours, escalation_triggers,
        goals, lead_target, meeting_target, materials_links, calendar_link,
        blacklist, additional_notes,
        contact_name, contact_role, contact_email, contact_phone,
        current_step, status,
        completed_at
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26,
        $27, $28,
        $29, $30, $31, $32,
        $33, $34,
        $35
      )
      RETURNING *
    `;

    const completedAt = status === 'completed' ? new Date() : null;

    const result = await db.query(query, [
      accountId, userId,
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      JSON.stringify(faq || []), JSON.stringify(objections || []), policies, business_hours, escalation_triggers || [],
      goals || [], lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      contact_name, contact_role, contact_email, contact_phone,
      current_step || 1, status || 'pending',
      completedAt
    ]);

    res.status(201).json({
      success: true,
      data: {
        onboarding: result.rows[0]
      },
      message: 'Onboarding criado com sucesso'
    });
  } catch (error) {
    console.error('Error creating onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar onboarding',
      error: error.message
    });
  }
};

/**
 * Update an existing onboarding
 */
exports.updateOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Check ownership
    const checkQuery = `
      SELECT id FROM onboarding_responses WHERE id = $1 AND account_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, accountId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    const {
      // Etapa 1
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      // Etapa 2
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      // Etapa 3
      faq, objections, policies, business_hours, escalation_triggers,
      // Etapa 4
      goals, lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      // Contato
      contact_name, contact_role, contact_email, contact_phone,
      // Status
      current_step, status
    } = req.body;

    const query = `
      UPDATE onboarding_responses SET
        company_name = COALESCE($1, company_name),
        website = COALESCE($2, website),
        industry = COALESCE($3, industry),
        company_size = COALESCE($4, company_size),
        description = COALESCE($5, description),
        products_services = COALESCE($6, products_services),
        differentials = COALESCE($7, differentials),
        success_cases = COALESCE($8, success_cases),
        ideal_customer = COALESCE($9, ideal_customer),
        target_roles = COALESCE($10, target_roles),
        target_location = COALESCE($11, target_location),
        target_industries = COALESCE($12, target_industries),
        buying_signals = COALESCE($13, buying_signals),
        main_problem = COALESCE($14, main_problem),
        faq = COALESCE($15, faq),
        objections = COALESCE($16, objections),
        policies = COALESCE($17, policies),
        business_hours = COALESCE($18, business_hours),
        escalation_triggers = COALESCE($19, escalation_triggers),
        goals = COALESCE($20, goals),
        lead_target = COALESCE($21, lead_target),
        meeting_target = COALESCE($22, meeting_target),
        materials_links = COALESCE($23, materials_links),
        calendar_link = COALESCE($24, calendar_link),
        blacklist = COALESCE($25, blacklist),
        additional_notes = COALESCE($26, additional_notes),
        contact_name = COALESCE($27, contact_name),
        contact_role = COALESCE($28, contact_role),
        contact_email = COALESCE($29, contact_email),
        contact_phone = COALESCE($30, contact_phone),
        current_step = COALESCE($31, current_step),
        status = COALESCE($32, status),
        completed_at = CASE WHEN $32 = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END
      WHERE id = $33 AND account_id = $34
      RETURNING *
    `;

    const result = await db.query(query, [
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      faq ? JSON.stringify(faq) : null, objections ? JSON.stringify(objections) : null, policies, business_hours, escalation_triggers,
      goals, lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      contact_name, contact_role, contact_email, contact_phone,
      current_step, status,
      id, accountId
    ]);

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0]
      },
      message: 'Onboarding atualizado com sucesso'
    });
  } catch (error) {
    console.error('Error updating onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar onboarding',
      error: error.message
    });
  }
};

/**
 * Get all onboardings (admin)
 */
exports.getOnboardingsAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        o.*,
        a.name as account_name,
        u.name as user_name,
        u.email as user_email
      FROM onboarding_responses o
      JOIN accounts a ON o.account_id = a.id
      JOIN users u ON o.user_id = u.id
    `;

    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` WHERE o.status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY[\s\S]*$/, '');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        onboardings: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting onboardings admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar onboardings',
      error: error.message
    });
  }
};

/**
 * Get single onboarding by ID (admin)
 */
exports.getOnboardingById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        o.*,
        a.name as account_name,
        u.name as user_name,
        u.email as user_email,
        rv.name as reviewer_name
      FROM onboarding_responses o
      JOIN accounts a ON o.account_id = a.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN users rv ON o.reviewed_by = rv.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting onboarding by id:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar onboarding',
      error: error.message
    });
  }
};

/**
 * Mark onboarding as reviewed
 */
exports.markAsReviewed = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;

    const query = `
      UPDATE onboarding_responses SET
        status = 'reviewed',
        reviewed_at = NOW(),
        reviewed_by = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [reviewerId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0]
      },
      message: 'Onboarding marcado como revisado'
    });
  } catch (error) {
    console.error('Error marking onboarding as reviewed:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao marcar onboarding como revisado',
      error: error.message
    });
  }
};
